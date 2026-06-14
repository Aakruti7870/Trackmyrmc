import type { Request, Response, NextFunction } from 'express';
import { lt, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { rateLimitHits } from '../db/schema.js';

// Fixed-window rate limiter backed by Postgres so the limit holds across every
// server instance. With an in-memory counter each instance keeps its own tally,
// so under horizontal scaling (autoscale / multiple instances) the effective
// limit is multiplied by the instance count and a paid upstream (e.g. Google
// Places) can be hammered well past the intended ceiling. A shared counter in
// the DB enforces one window per IP regardless of which instance serves it.
//
// `name` namespaces the counter so independent limiters never collide on the
// same IP key.
export function rateLimit({
  windowMs,
  max,
  name = 'default',
}: {
  windowMs: number;
  max: number;
  name?: string;
}) {
  let lastCleanup = 0;

  return async (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${name}:${ip}`;

    try {
      // Atomic upsert: start a fresh window when the previous one has expired,
      // otherwise increment in place. RETURNING gives us the post-increment
      // count and the window end so a single round-trip decides everything.
      const [row] = await db
        .insert(rateLimitHits)
        .values({
          key,
          count: 1,
          resetAt: sql`NOW() + (${windowMs} * INTERVAL '1 millisecond')`,
        })
        .onConflictDoUpdate({
          target: rateLimitHits.key,
          set: {
            count: sql`CASE WHEN ${rateLimitHits.resetAt} <= NOW() THEN 1 ELSE ${rateLimitHits.count} + 1 END`,
            resetAt: sql`CASE WHEN ${rateLimitHits.resetAt} <= NOW() THEN NOW() + (${windowMs} * INTERVAL '1 millisecond') ELSE ${rateLimitHits.resetAt} END`,
          },
        })
        .returning({ count: rateLimitHits.count, resetAt: rateLimitHits.resetAt });

      if (row && row.count > max) {
        const retryAfter = Math.ceil((row.resetAt.getTime() - Date.now()) / 1000);
        res.setHeader('Retry-After', String(Math.max(retryAfter, 1)));
        res.status(429).json({ error: 'Too many requests, please slow down and try again shortly.' });
        return;
      }

      // Opportunistic cleanup of expired windows so the table can't grow
      // unbounded under IP churn. Throttled to at most once per window.
      const now = Date.now();
      if (now - lastCleanup > windowMs) {
        lastCleanup = now;
        db.delete(rateLimitHits)
          .where(lt(rateLimitHits.resetAt, new Date()))
          .catch(() => {});
      }

      next();
    } catch (err) {
      // Fail open: a transient DB error must not take the protected route fully
      // offline. We log and allow the request through rather than 500-ing.
      console.error('rateLimit store error, allowing request', err);
      next();
    }
  };
}
