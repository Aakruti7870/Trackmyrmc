import type { NextFunction, Request, Response } from 'express';
import { isUserKycVerified } from '../lib/kycBadge.js';

// Mounted only on customer self-service order create/edit routes after
// requireAuth. Staff-created orders use /api/orders and are intentionally not
// affected by this gate.
export async function requireVerifiedCustomerKyc(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  // Let the route's existing role middleware return the canonical Forbidden
  // response for non-customer accounts.
  if (!req.user || req.user.role !== 'client') {
    next();
    return;
  }

  try {
    const verified = await isUserKycVerified(req.user.id);
    if (!verified) {
      // This response reflects live identity state and must not be reused after
      // the customer completes verification in another tab or session.
      res.set('Cache-Control', 'no-store');
      res.status(403).json({
        code: 'CUSTOMER_KYC_REQUIRED',
        error: 'Complete KYC verification before placing or resubmitting an order.',
        nextAction: '/kyc',
        canPlaceOrder: false,
      });
      return;
    }

    next();
  } catch (error) {
    // Fail closed: a KYC lookup outage must never silently allow an order.
    console.error('Customer KYC authorization check failed', error);
    res.set('Cache-Control', 'no-store');
    res.status(500).json({
      code: 'KYC_CHECK_FAILED',
      error: 'We could not verify your KYC status. Please try again shortly.',
    });
  }
}

// An unverified customer must still be able to pause an existing schedule so no
// future order can fire. Creating, editing or resuming a schedule requires the
// same live KYC authorization as a one-time order.
export async function allowRecurringPauseOrRequireVerifiedKyc(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const keys = Object.keys(body);
  if (keys.length === 1 && keys[0] === 'active' && body.active === false) {
    next();
    return;
  }
  await requireVerifiedCustomerKyc(req, res, next);
}
