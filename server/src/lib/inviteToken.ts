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

export type TokenKind = 'invite' | 'reset';

// Issue a fresh single-use token for a user. Any earlier unused token for the
// same user is invalidated first so only the most recent link ever works.
// `kind` distinguishes owner-onboarding invites (redeeming activates the
// account) from forgot-password resets (redeeming only changes the password).
export async function createInviteToken(
  userId: number,
  ttlMs: number = INVITE_TTL_MS,
  kind: TokenKind = 'invite',
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + ttlMs);

  await db.transaction(async (tx) => {
    // Burn any still-pending token for this user, so re-issuing hands out a new
    // link and the old one can no longer be redeemed.
    await tx
      .update(passwordSetupTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(passwordSetupTokens.userId, userId), isNull(passwordSetupTokens.usedAt)));
    await tx.insert(passwordSetupTokens).values({ userId, tokenHash, kind, expiresAt });
  });

  return { token, expiresAt };
}

type PeekResult =
  | { ok: true; user: InviteUser }
  | { ok: false; reason: 'invalid' | 'used' | 'expired' | 'disabled' };

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
    .select({ id: users.id, name: users.name, email: users.email, role: users.role, deletedAt: users.deletedAt })
    .from(users)
    .where(eq(users.id, row.userId));
  if (!user) return { ok: false, reason: 'invalid' };
  if (user.deletedAt) return { ok: false, reason: 'disabled' };
  return { ok: true, user };
}

type RedeemResult =
  | { ok: true; user: InviteUser; kind: TokenKind }
  | { ok: false; reason: 'invalid' | 'used' | 'expired' | 'disabled' };

// Atomically consume a token and set the target user's password. The token row
// is locked FOR UPDATE so two concurrent redemptions can't both succeed — the
// loser sees the row already marked used.
//
// Reactivation semantics depend on the token kind:
//   - 'invite': the account is (re)activated so a freshly-provisioned owner who
//     sets their password can sign in immediately.
//   - 'reset' (forgot-password): the account's active flag is left UNCHANGED, so
//     a suspended user can never self-reactivate by resetting their password. A
//     suspended/deleted account is rejected outright ('disabled').
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

    const kind: TokenKind = row.kind === 'reset' ? 'reset' : 'invite';

    // Lock the target user so the active-state check and update are consistent
    // even if an admin suspends the account concurrently.
    const [existing] = await tx
      .select({ id: users.id, isActive: users.isActive, deletedAt: users.deletedAt })
      .from(users)
      .where(eq(users.id, row.userId))
      .for('update');
    if (!existing) return { ok: false, reason: 'invalid' };

    // Permanent deletion cannot be reversed by any token issued before the
    // deletion. An administrator must explicitly restore the account (which
    // clears deletedAt) before a newly issued invite can activate it again.
    if (existing.deletedAt || (kind === 'reset' && !existing.isActive)) {
      return { ok: false, reason: 'disabled' };
    }

    await tx
      .update(passwordSetupTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordSetupTokens.id, row.id));

    // Invites activate the account; resets leave isActive untouched.
    const set = kind === 'invite' ? { passwordHash, isActive: true, deletedAt: null } : { passwordHash };
    const [user] = await tx
      .update(users)
      .set(set)
      .where(eq(users.id, row.userId))
      .returning({ id: users.id, name: users.name, email: users.email, role: users.role });
    if (!user) return { ok: false, reason: 'invalid' };
    return { ok: true, user, kind };
  });
}
