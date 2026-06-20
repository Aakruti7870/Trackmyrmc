// Branded, lightweight animated avatar for the assistant — a friendly
// construction "concrete bot" rendered entirely in CSS (no images, no external
// deps). It reacts to three states:
//   • idle      — gentle breathing + occasional eye blink
//   • thinking  — eyes squint and a row of dots pulses (model is generating)
//   • speaking  — an animated equaliser "mouth" + a sound ripple ring
// All animation names are namespaced (aiAv*) so they never collide with other
// keyframes on the page.
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
  // Geometry scaled from the size so it looks right at 44px (header) and 88px.
  const hatH = s * 0.26;
  const eyeW = s * 0.12;
  const eyeH = s * 0.16;
  const mouthW = s * 0.34;

  return (
    <div
      style={{
        width: s,
        height: s,
        borderRadius: '50%',
        flexShrink: 0,
        position: 'relative',
        background: 'radial-gradient(circle at 32% 26%, var(--gold-hi), var(--gold) 46%, var(--gold-dark))',
        display: 'grid',
        placeItems: 'center',
        boxShadow: speaking
          ? '0 0 0 4px color-mix(in srgb, var(--gold) 28%, transparent), 0 12px 30px color-mix(in srgb, var(--gold) 30%, transparent)'
          : '0 10px 26px rgba(var(--shadow-rgb),.32), inset 0 2px 2px rgba(255,255,255,.5)',
        transition: 'box-shadow .25s ease',
        animation: state === 'idle' ? 'aiAvBreathe 3.6s ease-in-out infinite' : undefined,
      }}
    >
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

      {/* Robot head/face plate */}
      <div
        aria-hidden
        style={{
          position: 'relative',
          width: s * 0.62,
          height: s * 0.56,
          borderRadius: s * 0.16,
          background: 'linear-gradient(180deg, #2a1d05, #160f02)',
          boxShadow: 'inset 0 1px 2px rgba(255,255,255,.18), inset 0 -3px 6px rgba(0,0,0,.5)',
          display: 'grid',
          placeItems: 'center',
          marginTop: s * 0.06,
        }}
      >
        {/* Hard hat */}
        <div
          style={{
            position: 'absolute',
            top: -hatH * 0.72,
            left: '50%',
            transform: 'translateX(-50%)',
            width: s * 0.7,
            height: hatH,
            background: 'linear-gradient(180deg, var(--gold-hi), var(--gold) 60%, var(--gold-dark))',
            borderTopLeftRadius: s * 0.4,
            borderTopRightRadius: s * 0.4,
            boxShadow: 'inset 0 2px 2px rgba(255,255,255,.5)',
          }}
        >
          {/* Hat brim */}
          <span style={{
            position: 'absolute', bottom: -s * 0.04, left: '50%', transform: 'translateX(-50%)',
            width: s * 0.82, height: s * 0.06, borderRadius: s * 0.04,
            background: 'linear-gradient(180deg, var(--gold), var(--gold-dark))',
            boxShadow: '0 1px 2px rgba(0,0,0,.35)',
          }} />
          {/* Center ridge */}
          <span style={{
            position: 'absolute', top: s * 0.03, left: '50%', transform: 'translateX(-50%)',
            width: s * 0.05, height: hatH * 0.7, borderRadius: s * 0.03,
            background: 'color-mix(in srgb, var(--gold-dark) 70%, #000)',
          }} />
        </div>

        {/* Eyes */}
        <div style={{ display: 'flex', gap: s * 0.1, marginTop: s * 0.02 }}>
          {[0, 1].map(i => (
            <span
              key={i}
              style={{
                width: eyeW,
                height: eyeH,
                borderRadius: eyeW,
                background: 'radial-gradient(circle at 50% 40%, #fff6d8, var(--gold) 60%, var(--gold-dark))',
                boxShadow: '0 0 6px color-mix(in srgb, var(--gold) 70%, transparent)',
                transformOrigin: 'center',
                animation:
                  state === 'thinking'
                    ? 'aiAvSquint 1s ease-in-out infinite'
                    : state === 'idle'
                      ? 'aiAvBlink 4.2s steps(1) infinite'
                      : undefined,
              }}
            />
          ))}
        </div>

        {/* Mouth: equaliser bars while speaking, dots while thinking, line idle */}
        <div style={{
          position: 'absolute', bottom: s * 0.06, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: s * 0.02,
          width: mouthW, height: s * 0.1,
        }}>
          {state === 'speaking' &&
            [0, 1, 2, 3].map(i => (
              <span
                key={i}
                style={{
                  width: s * 0.05, height: s * 0.04, borderRadius: s * 0.02,
                  background: 'var(--gold-hi)',
                  animation: `aiAvBar .5s ease-in-out ${i * 0.09}s infinite`,
                }}
              />
            ))}
          {state === 'thinking' &&
            [0, 1, 2].map(i => (
              <span
                key={i}
                style={{
                  width: s * 0.05, height: s * 0.05, borderRadius: '50%',
                  background: 'color-mix(in srgb, var(--gold) 75%, transparent)',
                  animation: `aiAvDot 1s ease-in-out ${i * 0.16}s infinite`,
                }}
              />
            ))}
          {state === 'idle' && (
            <span style={{
              width: mouthW * 0.7, height: s * 0.025, borderRadius: s * 0.02,
              background: 'color-mix(in srgb, var(--gold) 65%, transparent)',
            }} />
          )}
        </div>
      </div>

      <style>{`
        @keyframes aiAvRipple {
          0% { transform: scale(1); opacity: .7; }
          100% { transform: scale(1.35); opacity: 0; }
        }
        @keyframes aiAvBreathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.035); }
        }
        @keyframes aiAvBlink {
          0%, 92%, 100% { transform: scaleY(1); }
          95% { transform: scaleY(.1); }
        }
        @keyframes aiAvSquint {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(.45); }
        }
        @keyframes aiAvBar {
          0%, 100% { transform: scaleY(.5); }
          50% { transform: scaleY(2.4); }
        }
        @keyframes aiAvDot {
          0%, 100% { opacity: .35; transform: translateY(0); }
          50% { opacity: 1; transform: translateY(-15%); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="aiAv"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
