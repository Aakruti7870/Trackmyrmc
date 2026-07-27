export const KYC_STATES = [
  'pending',
  'submitted',
  'under_review',
  'verified',
  'rejected',
  'suspended',
  'expired',
  'revoked',
] as const;

export type KycState = typeof KYC_STATES[number];

export type KycTransitionActor = 'subject' | 'reviewer' | 'system';

const TRANSITIONS: Readonly<Record<KycState, Readonly<Partial<Record<KycState, readonly KycTransitionActor[]>>>>> = {
  pending: { submitted: ['subject'] },
  submitted: { pending: ['subject'], under_review: ['reviewer'] },
  under_review: { verified: ['reviewer'], rejected: ['reviewer'] },
  verified: { suspended: ['reviewer'], expired: ['system', 'reviewer'], revoked: ['reviewer'] },
  rejected: { pending: ['subject', 'reviewer'] },
  suspended: { verified: ['reviewer'], revoked: ['reviewer'] },
  expired: { pending: ['subject', 'reviewer'], revoked: ['reviewer'] },
  revoked: { pending: ['reviewer'] },
};

export function isKycState(value: unknown): value is KycState {
  return typeof value === 'string' && (KYC_STATES as readonly string[]).includes(value);
}

export function canTransitionKyc(from: KycState, to: KycState, actor: KycTransitionActor): boolean {
  return TRANSITIONS[from][to]?.includes(actor) ?? false;
}

export function assertKycTransition(from: KycState, to: KycState, actor: KycTransitionActor): void {
  if (!canTransitionKyc(from, to, actor)) {
    throw new Error(`KYC transition ${from} -> ${to} is not permitted for ${actor}`);
  }
}

export function kycOrderEligible(state: KycState): boolean {
  return state === 'verified';
}

export function transitionRequiresReason(from: KycState, to: KycState): boolean {
  return to === 'rejected' || to === 'suspended' || to === 'revoked' || (from === 'suspended' && to === 'verified');
}
