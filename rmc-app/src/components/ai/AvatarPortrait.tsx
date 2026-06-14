import { Bot } from 'lucide-react';

// Portrait placeholder for the assistant. A talking-avatar video is deferred for
// the MVP; for now we show a stylised portrait that gently pulses while the
// assistant is "speaking" (voice output) so there's a sense of presence.
export default function AvatarPortrait({ speaking, size = 88 }: { speaking?: boolean; size?: number }) {
  return (
    <div
      style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0, position: 'relative',
        background: 'radial-gradient(circle at 32% 28%, var(--gold-hi), var(--gold) 45%, var(--gold-dark))',
        display: 'grid', placeItems: 'center',
        boxShadow: speaking
          ? '0 0 0 4px color-mix(in srgb, var(--gold) 28%, transparent), 0 12px 30px color-mix(in srgb, var(--gold) 30%, transparent)'
          : '0 10px 26px rgba(0,0,0,.32), inset 0 2px 2px rgba(255,255,255,.5)',
        transition: 'box-shadow .25s ease',
      }}
    >
      <Bot size={size * 0.5} color="#1a1205" strokeWidth={2} />
      {speaking && (
        <span
          aria-hidden
          style={{
            position: 'absolute', inset: -2, borderRadius: '50%',
            border: '2px solid color-mix(in srgb, var(--gold) 55%, transparent)',
            animation: 'aiSpeakPulse 1.1s ease-out infinite',
          }}
        />
      )}
      <style>{`
        @keyframes aiSpeakPulse {
          0% { transform: scale(1); opacity: .7; }
          100% { transform: scale(1.35); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
