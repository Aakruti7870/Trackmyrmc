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
