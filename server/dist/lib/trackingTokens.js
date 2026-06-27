import { createHash, randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { trackingTokens } from '../db/schema.js';
// Only a hash of a tracking token is ever stored; the raw token lives solely in
// the shared URL. SHA-256 is sufficient here — the token is high-entropy random,
// so it isn't brute-forceable and needs no salt/slow-hash.
export function hashTrackingToken(raw) {
    return createHash('sha256').update(raw).digest('hex');
}
// Mint a new shareable tracking token for a challan and return the RAW token
// (stored only as a hash). The caller composes the public URL. ttlMs null = no
// expiry (the trip itself ends, after which the payload simply shows delivered).
export async function createTrackingToken(challanId, createdBy, ttlMs = null) {
    const raw = randomBytes(24).toString('hex');
    const expiresAt = ttlMs != null ? new Date(Date.now() + ttlMs) : null;
    await db.insert(trackingTokens).values({
        challanId,
        tokenHash: hashTrackingToken(raw),
        createdBy,
        expiresAt,
    });
    return raw;
}
// Resolve a raw token to its challanId iff the token is live (not revoked, not
// expired). Returns null in every other case so the public route 404s.
export async function resolveTrackingToken(raw) {
    if (!raw)
        return null;
    const [row] = await db
        .select({
        challanId: trackingTokens.challanId,
        expiresAt: trackingTokens.expiresAt,
        revokedAt: trackingTokens.revokedAt,
    })
        .from(trackingTokens)
        .where(eq(trackingTokens.tokenHash, hashTrackingToken(raw)));
    if (!row)
        return null;
    if (row.revokedAt)
        return null;
    if (row.expiresAt && row.expiresAt.getTime() < Date.now())
        return null;
    return row.challanId;
}
