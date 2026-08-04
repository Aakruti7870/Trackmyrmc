import { MessageCircle } from 'lucide-react';
import { SUPPORT_WHATSAPP_URL } from '@/lib/brand';
import SocialLinksBar from '@/components/SocialLinksBar';

const PRIVACY_POLICY_URL = 'https://trackmyrmc.com/privacy_policy';

// Shared footer for the auth screens (Login / Register): Privacy Policy + Terms links,
// a consent acknowledgment line, and a direct Support-on-WhatsApp link.
export default function AuthLegalFooter({ consentPrefix }: { consentPrefix?: string }) {
  const link: React.CSSProperties = {
    background: 'none', border: 'none', padding: 0, cursor: 'pointer',
    color: 'var(--gold)', fontWeight: 700, textDecoration: 'underline', fontSize: 12,
  };
  return (
    <div style={{
      marginTop: 22, paddingTop: 16, borderTop: '1px solid var(--line)',
      textAlign: 'center', fontSize: 12, color: 'var(--muted)', lineHeight: 1.6,
    }}>
      {consentPrefix && <p style={{ margin: '0 0 10px' }}>{consentPrefix}</p>}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
        <a href={PRIVACY_POLICY_URL} target="_blank" rel="noopener noreferrer" style={link}>Privacy Policy</a>
        <span aria-hidden>·</span>
        <a href="/terms" style={link}>Terms of Service</a>
        <span aria-hidden>·</span>
        <a
          href={SUPPORT_WHATSAPP_URL} target="_blank" rel="noopener noreferrer"
          style={{ ...link, display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          <MessageCircle size={12} /> Support
        </a>
      </div>
      <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center' }}>
        <SocialLinksBar compact center />
      </div>
    </div>
  );
}
