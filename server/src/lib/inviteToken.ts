import { randomBytes, createHash } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { passwordSetupTokens, users } from '../db/schema.js';

// How long an emailed "set your password" invite stays valid. Long enough that
// an owner can act on it at their convenience, short enough that a leaked link
// stops working quickly.
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// We store only the SHA-256 hash of the token; the plaintext lives solely in the
// emailed link. A fast hash is fine here (unlike passwords) because the token is
// 256 bits of cryptographic randomness, not a low-entropy human secret.
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface InviteUser {
  id: number;
  name: string;
  email: string;
  role: string;
}

// Issue a fresh single-use invite for a user. Any earlier unused invite for the
// same user is invalidated first so only the most recent link ever works.
export async function createInviteToken(
  userId: number,
  ttlMs: number = INVITE_TTL_MS,
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + ttlMs);

  await db.transaction(async (tx) => {
    // Burn any still-pending invite for this user, so re-provisioning hands out
    // a new link and the old one can no longer be redeemed.
    await tx
      .update(passwordSetupTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(passwordSetupTokens.userId, userId), isNull(passwordSetupTokens.usedAt)));
    await tx.insert(passwordSetupTokens).values({ userId, tokenHash, expiresAt });
  });

  return { token, expiresAt };
}

type PeekResult =
  | { ok: true; user: InviteUser }
  | { ok: false; reason: 'invalid' | 'used' | 'expired' };

// Read-only validity check used by the "set password" page before showing the
// form. Never mutates the token (that happens on redeem).
export async function peekInviteToken(token: string): Promise<PeekResult> {
  if (!token) return { ok: false, reason: 'invalid' };
  const tokenHash = hashToken(token);
  const [row] = await db
    .select()
    .from(passwordSetupTokens)
    .where(eq(passwordSetupTokens.tokenHash, tokenHash));
  if (!row) return { ok: false, reason: 'invalid' };
  if (row.usedAt) return { ok: false, reason: 'used' };
  if (row.expiresAt.getTime() < Date.now()) return { ok: false, reason: 'expired' };

  const [user] = await db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role })
    .from(users)
    .where(eq(users.id, row.userId));
  if (!user) return { ok: false, reason: 'invalid' };
  return { ok: true, user };
}

type RedeemResult =
  | { ok: true; user: InviteUser }
  | { ok: false; reason: 'invalid' | 'used' | 'expired' };

// Atomically consume an invite and set the target user's password. The token row
// is locked FOR UPDATE so two concurrent redemptions can't both succeed — the
// loser sees the row already marked used. The account is (re)activated so an
// owner who sets their password can sign in immediately.
export async function redeemInviteToken(
  token: string,
  passwordHash: string,
): Promise<RedeemResult> {
  if (!token) return { ok: false, reason: 'invalid' };
  const tokenHash = hashToken(token);

  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(passwordSetupTokens)
      .where(eq(passwordSetupTokens.tokenHash, tokenHash))
      .for('update');
    if (!row) return { ok: false, reason: 'invalid' };
    if (row.usedAt) return { ok: false, reason: 'used' };
    if (row.expiresAt.getTime() < Date.now()) return { ok: false, reason: 'expired' };

    await tx
      .update(passwordSetupTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordSetupTokens.id, row.id));

    const [user] = await tx
      .update(users)
      .set({ passwordHash, isActive: true })
      .where(eq(users.id, row.userId))
      .returning({ id: users.id, name: users.name, email: users.email, role: users.role });
    if (!user) return { ok: false, reason: 'invalid' };
    return { ok: true, user };
  });
}
