// Branded animated avatar for the assistant — the CONCRETE KING mascot (a
// friendly hard-hat Shiba) on a soft brand-orange disc. It reacts to three
// states:
//   • idle      — gentle breathing
//   • thinking  — a sweeping glow ring (model is generating)
//   • speaking  — an animated sound ripple + brighter glow
// All animation names are namespaced (aiAv*) so they never collide with other
// keyframes on the page.
import mascot from '@/assets/ai-mascot.png';

export default function AvatarPortrait({
  speaking,
  thinking,
  size = 88,
}: {
  speaking?: boolean;
  thinking?: boolean;
  size?: number;
}) {
  const s = size;
  const state = speaking ? 'speaking' : thinking ? 'thinking' : 'idle';

  return (
    <div
      style={{
        width: s,
        height: s,
        borderRadius: '50%',
        flexShrink: 0,
        position: 'relative',
        background: 'radial-gradient(circle at 32% 26%, var(--gold-hi), var(--gold) 52%, var(--gold-dark))',
        display: 'grid',
        placeItems: 'center',
        overflow: 'hidden',
        boxShadow: speaking
          ? '0 0 0 4px color-mix(in srgb, var(--gold) 28%, transparent), 0 12px 30px color-mix(in srgb, var(--gold) 30%, transparent)'
          : '0 10px 26px rgba(var(--shadow-rgb),.32), inset 0 2px 2px rgba(255,255,255,.45)',
        transition: 'box-shadow .25s ease',
        animation: state === 'idle' ? 'aiAvBreathe 3.6s ease-in-out infinite' : undefined,
      }}
    >
      {/* Sweeping glow while the model is thinking */}
      {state === 'thinking' && (
        <span
          aria-hidden
          style={{
            position: 'absolute', inset: -1, borderRadius: '50%',
            background: 'conic-gradient(from 0deg, transparent 0deg, color-mix(in srgb, var(--gold-hi) 80%, #fff) 60deg, transparent 140deg)',
            animation: 'aiAvSpin 1.1s linear infinite',
          }}
        />
      )}

      {/* The mascot portrait */}
      <img
        src={mascot}
        alt=""
        aria-hidden
        draggable={false}
        style={{
          position: 'relative',
          width: '94%',
          height: '94%',
          objectFit: 'contain',
          objectPosition: 'center 42%',
          transform: `scale(${state === 'speaking' ? 1.05 : 1})`,
          transformOrigin: 'center 60%',
          transition: 'transform .2s ease',
          animation: state === 'speaking' ? 'aiAvNod 0.7s ease-in-out infinite' : undefined,
          filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.25))',
        }}
      />

      {/* Sound ripple while speaking */}
      {speaking && (
        <span
          aria-hidden
          style={{
            position: 'absolute', inset: -2, borderRadius: '50%',
            border: '2px solid color-mix(in srgb, var(--gold) 55%, transparent)',
            animation: 'aiAvRipple 1.1s ease-out infinite',
          }}
        />
      )}

      <style>{`
        @keyframes aiAvRipple {
          0% { transform: scale(1); opacity: .7; }
          100% { transform: scale(1.35); opacity: 0; }
        }
        @keyframes aiAvBreathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.035); }
        }
        @keyframes aiAvSpin {
          to { transform: rotate(360deg); }
        }
        @keyframes aiAvNod {
          0%, 100% { transform: scale(1.05) translateY(0); }
          50% { transform: scale(1.05) translateY(2%); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="aiAv"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
