import ekycBadge from '@/assets/ekyc-badge.png';

// "E KYC Verified" trust mark shown next to a customer's name once their
// account has completed KYC (Aadhaar eKYC or an approved KYC profile).
// Rendered from the official badge artwork so it reads as a seal, not a pill.
export default function EkycBadge({ size = 16, withLabel = false }: {
  size?: number;
  withLabel?: boolean;
}) {
  return (
    <span
      title="E-KYC verified customer — identity confirmed via KYC"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, verticalAlign: 'middle' }}
    >
      <img
        src={ekycBadge}
        alt="E KYC Verified"
        width={size}
        height={size}
        style={{ display: 'block', objectFit: 'contain' }}
      />
      {withLabel && (
        <span style={{ fontSize: 11, fontWeight: 700, color: '#2196e8' }}>KYC Verified</span>
      )}
    </span>
  );
}

// "GST & PAN Verified" pill for plants whose approved KYC profile carries both
// registrations. Kept alongside EkycBadge so all trust marks live together.
export function GstPanBadge({ size = 12 }: { size?: number }) {
  return (
    <span
      title="GST & PAN verified — business registrations confirmed via KYC"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999,
        fontSize: size - 1, fontWeight: 700, color: 'var(--green)', background: 'rgba(34,197,94,.12)',
        whiteSpace: 'nowrap',
      }}
    >
      <img src={ekycBadge} alt="" width={size + 2} height={size + 2} style={{ display: 'block', objectFit: 'contain' }} />
      GST &amp; PAN Verified
    </span>
  );
}
