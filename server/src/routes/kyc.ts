import { Router } from 'express';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, kycVerifications } from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { getKycConfig, getKycProvider, newProviderRef } from '../lib/kyc.js';

const router = Router();

// Public base URL our DigiLocker callback lives at. Prefers an explicit env
// override (custom domain in prod), then the proxy-forwarded host — matching the
// owner-invite link builder so the aggregator redirects back to the same domain
// the customer is actually using.
function appBaseUrl(req: { headers: Record<string, unknown>; protocol: string }): string {
  const envUrl = process.env.APP_URL || process.env.PUBLIC_URL;
  if (envUrl) return envUrl.replace(/\/+$/, '');
  const fwdProto = String(req.headers['x-forwarded-proto'] ?? '').split(',')[0].trim();
  const proto = fwdProto || req.protocol || 'https';
  const host = String(req.headers['x-forwarded-host'] ?? req.headers['host'] ?? '').trim();
  return `${proto}://${host}`;
}

// Minimal self-contained page shown in the tab the customer completed consent
// in. The app itself polls GET /status to update the badge, so this page only
// needs to tell the human it's safe to return. No app data is embedded.
function resultPage(kind: 'success' | 'failed' | 'error', message: string): string {
  const heading = kind === 'success' ? 'Verification complete' : 'Verification not completed';
  const color = kind === 'success' ? '#178a6e' : '#ef4444';
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>KYC</title></head>
<body style="font-family:system-ui,-apple-system,sans-serif;background:#f5f7f6;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px">
<div style="max-width:420px;text-align:center;background:#fff;border-radius:16px;padding:32px;box-shadow:0 6px 24px rgba(0,0,0,.08)">
<div style="font-size:44px;line-height:1;color:${color}">${kind === 'success' ? '\u2713' : '\u26A0'}</div>
<h1 style="font-size:20px;color:#0f2e29;margin:16px 0 8px">${heading}</h1>
<p style="color:#4b5563;font-size:14px;margin:0 0 20px">${message}</p>
<p style="color:#9ca3af;font-size:13px;margin:0">You can close this window and return to the app.</p>
</div></body></html>`;
}

function sendPage(res: import('express').Response, status: number, kind: 'success' | 'failed' | 'error', message: string): void {
  res.status(status).type('html').send(resultPage(kind, message));
}

// PUBLIC — the aggregator redirects the customer's browser here after DigiLocker
// consent. Deliberately NOT behind requireAuth (the returning browser has no app
// token). We correlate strictly by our own opaque ?ref, fetch the eKYC result,
// and persist ONLY the masked Aadhaar + consented demographics.
router.get('/callback', async (req, res) => {
  const ref = typeof req.query.ref === 'string' ? req.query.ref : '';
  if (!ref) {
    sendPage(res, 400, 'error', 'Missing verification reference.');
    return;
  }

  const [row] = await db.select().from(kycVerifications).where(eq(kycVerifications.providerRef, ref));
  if (!row) {
    sendPage(res, 404, 'error', 'This verification link is invalid or has expired.');
    return;
  }
  if (row.status !== 'pending') {
    // Idempotent: a refresh/second hit just reports the settled outcome.
    sendPage(res, 200, row.status === 'verified' ? 'success' : 'failed',
      row.status === 'verified' ? 'Your identity is verified.' : 'Verification was not successful.');
    return;
  }

  const config = await getKycConfig();
  if (!config.configured || !row.providerTxnId) {
    await db.update(kycVerifications)
      .set({ status: 'failed', error: 'not configured or missing session', completedAt: new Date() })
      .where(eq(kycVerifications.id, row.id));
    sendPage(res, 503, 'error', 'KYC verification is temporarily unavailable.');
    return;
  }

  try {
    const provider = await getKycProvider();
    const result = await provider.fetch(row.providerTxnId);
    const now = new Date();

    if (result.status === 'verified') {
      await db.transaction(async (tx) => {
        await tx.update(kycVerifications)
          .set({
            status: 'verified',
            maskedAadhaar: result.maskedAadhaar ?? null,
            fullName: result.fullName ?? null,
            dob: result.dob ?? null,
            gender: result.gender ?? null,
            completedAt: now,
          })
          .where(eq(kycVerifications.id, row.id));
        await tx.update(users)
          .set({ kycStatus: 'verified', kycVerifiedAt: now })
          .where(eq(users.id, row.userId));
      });
      sendPage(res, 200, 'success', 'Your Aadhaar identity has been verified.');
      return;
    }

    // Failed result: record it, but never downgrade an already-verified user.
    await db.transaction(async (tx) => {
      await tx.update(kycVerifications)
        .set({ status: 'failed', error: result.error ?? 'verification failed', completedAt: now })
        .where(eq(kycVerifications.id, row.id));
      await tx.update(users)
        .set({ kycStatus: 'failed' })
        .where(and(eq(users.id, row.userId), eq(users.kycStatus, 'pending')));
    });
    sendPage(res, 200, 'failed', 'We could not verify your identity. Please try again.');
  } catch (err) {
    console.error('[kyc] callback fetch failed:', err);
    await db.update(kycVerifications)
      .set({ status: 'failed', error: 'aggregator error', completedAt: new Date() })
      .where(eq(kycVerifications.id, row.id));
    await db.update(users)
      .set({ kycStatus: 'failed' })
      .where(and(eq(users.id, row.userId), eq(users.kycStatus, 'pending')));
    sendPage(res, 502, 'error', 'The verification service did not respond. Please try again.');
  }
});

router.use(requireAuth);

// Current customer's KYC state, for the profile badge. `configured` tells the UI
// whether the Verify action is available at all.
router.get('/status', requireRole('client'), async (req, res) => {
  const actor = req.user!;
  const config = await getKycConfig();
  const [user] = await db
    .select({ kycStatus: users.kycStatus, kycVerifiedAt: users.kycVerifiedAt })
    .from(users)
    .where(eq(users.id, actor.id));
  const [latest] = await db
    .select({ maskedAadhaar: kycVerifications.maskedAadhaar, fullName: kycVerifications.fullName })
    .from(kycVerifications)
    .where(and(eq(kycVerifications.userId, actor.id), eq(kycVerifications.status, 'verified')))
    .orderBy(desc(kycVerifications.completedAt))
    .limit(1);

  res.json({
    configured: config.configured,
    status: user?.kycStatus ?? 'unverified',
    verifiedAt: user?.kycVerifiedAt ?? null,
    maskedAadhaar: latest?.maskedAadhaar ?? null,
    fullName: latest?.fullName ?? null,
  });
});

// Start a DigiLocker consent session. Returns the aggregator authorization URL
// the client should open. 503 (never a fake pass) when unconfigured.
router.post('/start', requireRole('client'), async (req, res) => {
  const actor = req.user!;
  const config = await getKycConfig();
  if (!config.configured) {
    res.status(503).json({ error: 'KYC verification is not configured yet. Please try again later.' });
    return;
  }

  const ref = newProviderRef();
  const redirectUrl = `${appBaseUrl(req)}/api/kyc/callback?ref=${ref}`;

  let authUrl: string;
  let txnId: string;
  try {
    const provider = await getKycProvider();
    const started = await provider.start(redirectUrl);
    authUrl = started.authUrl;
    txnId = started.txnId;
  } catch (err) {
    console.error('[kyc] start failed:', err);
    res.status(502).json({ error: 'Could not start verification. Please try again in a moment.' });
    return;
  }

  await db.transaction(async (tx) => {
    await tx.insert(kycVerifications).values({
      userId: actor.id,
      provider: config.provider,
      providerRef: ref,
      providerTxnId: txnId,
      status: 'pending',
    });
    // Reflect the in-flight attempt on the profile, but never overwrite an
    // existing 'verified' badge while a re-verification is in progress.
    await tx.update(users)
      .set({ kycStatus: 'pending' })
      .where(and(eq(users.id, actor.id), eq(users.kycStatus, 'unverified')));
    await tx.update(users)
      .set({ kycStatus: 'pending' })
      .where(and(eq(users.id, actor.id), eq(users.kycStatus, 'failed')));
  });

  res.json({ authUrl });
});

export default router;
