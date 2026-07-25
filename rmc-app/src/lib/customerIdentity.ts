export type KycStatus =
  | 'NOT_STARTED'
  | 'PENDING'
  | 'UNDER_REVIEW'
  | 'VERIFIED'
  | 'REJECTED'
  | 'EXPIRED';

export type CustomerIdentityLike = {
  role?: string | null;
  name?: string | null;
  displayName?: string | null;
  verifiedCustomerName?: string | null;
  legalName?: string | null;
  approvedBusinessName?: string | null;
  fullName?: string | null;
  customerKycStatus?: string | null;
  kycStatus?: string | null;
  isCustomerVerified?: boolean | null;
  customerKycVerified?: boolean | null;
};

const GENERATED_CUSTOMER_NAME = /^customer\s*[#-]?\s*\d+$/i;

export function normalizeKycStatus(value?: string | null, verified?: boolean | null): KycStatus {
  if (verified) return 'VERIFIED';
  switch ((value || '').trim().toLowerCase()) {
    case 'approved':
    case 'verified':
      return 'VERIFIED';
    case 'submitted':
    case 'under_review':
    case 'under review':
      return 'UNDER_REVIEW';
    case 'pending':
      return 'PENDING';
    case 'rejected':
      return 'REJECTED';
    case 'expired':
      return 'EXPIRED';
    default:
      return 'NOT_STARTED';
  }
}

function clean(value?: string | null): string | null {
  const result = value?.trim();
  return result ? result : null;
}

export function isGeneratedCustomerName(value?: string | null): boolean {
  const candidate = clean(value);
  return candidate ? GENERATED_CUSTOMER_NAME.test(candidate) : false;
}

export function resolveCustomerDisplayName(identity: CustomerIdentityLike): string {
  const verified = Boolean(identity.isCustomerVerified || identity.customerKycVerified);
  const status = normalizeKycStatus(identity.customerKycStatus || identity.kycStatus, verified);

  const verifiedName = clean(identity.verifiedCustomerName) || clean(identity.legalName);
  if (status === 'VERIFIED' && verifiedName) return verifiedName;

  const approvedBusinessName = clean(identity.approvedBusinessName);
  if (approvedBusinessName && !isGeneratedCustomerName(approvedBusinessName)) return approvedBusinessName;

  const manualName = clean(identity.fullName) || clean(identity.displayName) || clean(identity.name);
  if (manualName && !isGeneratedCustomerName(manualName)) return manualName;

  return 'KYC Pending';
}

export function customerVerificationLabel(identity: CustomerIdentityLike): string {
  const status = normalizeKycStatus(
    identity.customerKycStatus || identity.kycStatus,
    identity.isCustomerVerified || identity.customerKycVerified,
  );
  switch (status) {
    case 'VERIFIED': return 'Verified Customer';
    case 'UNDER_REVIEW': return 'KYC Under Review';
    case 'REJECTED': return 'KYC Requires Attention';
    case 'EXPIRED': return 'KYC Expired';
    default: return 'KYC Pending';
  }
}
