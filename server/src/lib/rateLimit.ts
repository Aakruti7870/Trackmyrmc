import type { Request, Response, NextFunction } from 'express';

// Tiny in-memory fixed-window rate limiter. Good enough to keep a public,
// money-costing upstream (e.g. Google Places) from being hammered per IP.
// Not a distributed limiter — state is per-process, which matches our single
// long-running server.
export function rateLimit({ windowMs, max }: { windowMs: number; max: number }) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    let entry = hits.get(ip);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(ip, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(Math.max(retryAfter, 1)));
      res.status(429).json({ error: 'Too many requests, please slow down and try again shortly.' });
      return;
    }
    // Opportunistic cleanup so the map can't grow unbounded under churn.
    if (hits.size > 5000) {
      for (const [k, v] of hits) if (now > v.resetAt) hits.delete(k);
    }
    next();
  };
}
