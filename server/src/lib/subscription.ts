// Single source of truth for plant subscription billing values, shared by the
// admin plant routes (validation), the login flow (access gate), and tests.

export const SUBSCRIPTION_STATUSES = ['trial', 'active', 'past_due', 'suspended', 'cancelled'] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const SUBSCRIPTION_PLANS = ['free', 'basic', 'pro', 'enterprise'] as const;
export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number];

// Statuses that block a plant-scoped staff member from logging in. trial/active
// are fine; past_due is a soft grace period (warn but allow).
export const BLOCKING_SUBSCRIPTION_STATUSES: readonly SubscriptionStatus[] = ['suspended', 'cancelled'];

export function isSubscriptionBlocking(status: string | null | undefined): boolean {
  return !!status && (BLOCKING_SUBSCRIPTION_STATUSES as readonly string[]).includes(status);
}

// User-facing message shown at login when a plant's billing blocks access.
export function subscriptionBlockMessage(status: SubscriptionStatus): string {
  if (status === 'cancelled') {
    return "Your plant's subscription has been cancelled. Please contact CONCRETE KING support to reactivate access.";
  }
  return "Your plant's subscription is suspended due to a billing issue. Please contact CONCRETE KING support to restore access.";
}
