import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, Send, Square, Mic, MicOff, Volume2, VolumeX, LifeBuoy, Loader2, Copy, Check, RefreshCw } from 'lucide-react';
import { aiApi, type AiConfig, type AiPlantOption } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import AvatarPortrait from './AvatarPortrait';
import { useSpeechToText, useTextToSpeech } from './useVoice';

interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
  spoken?: boolean;
}

function getSessionId(): string {
  const KEY = 'rmc_ai_session';
  let id = sessionStorage.getItem(KEY);
  if (!id) {
    id = `s_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(KEY, id);
  }
  return id;
}

// Role-aware quick-prompt chips so the user can explore capabilities with one tap.
const ROLE_CHIPS: Record<string, string[]> = {
  client: [
    'My active orders',
    'Latest delivery status',
    'My outstanding balance',
    'How to place an order',
    'M25 cement per m³',
  ],
  driver: [
    'My trips today',
    'My assigned vehicle',
    'How to mark a delivery done',
    'Slump test for M30',
    'Transit mixer capacity',
  ],
  dispatcher: [
    'Active orders today',
    'Available vehicles',
    'How to generate a challan',
    'Cement bags for M20 slab',
    'IS 4926 acceptance criteria',
  ],
  admin: [
    'Today\'s dispatch summary',
    'Pending orders',
    'Plant monthly volume',
    'M25 vs M30 – when to use',
    'IS 456 exposure classes',
  ],
  default: [
    'Cement bags for M20 per m³',
    'What is IS 456?',
    'Design mix vs nominal mix',
    'Slump test procedure',
    'How to place an order',
  ],
};

function chipsForRole(role: string): string[] {
  return ROLE_CHIPS[role] ?? ROLE_CHIPS.default;
}

export default function AIHelpAgent() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<AiConfig | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [awaitingReply, setAwaitingReply] = useState(false);
  const [voiceOut, setVoiceOut] = useState(() => {
    try { return localStorage.getItem('rmc_ai_voice_out') === '1'; } catch { return false; }
  });
  const [selectedPlantId, setSelectedPlantId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Last user message kept in state so the Retry button can re-send it.
  const [lastUserMsg, setLastUserMsg] = useState<string | null>(null);
  // Per-turn copy confirmation state (keyed by turn index).
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  // Support ticket form
  const [ticketOpen, setTicketOpen] = useState(false);
  const [ticketMsg, setTicketMsg] = useState('');
  const [ticketContact, setTicketContact] = useState('');
  const [ticketBusy, setTicketBusy] = useState(false);
  const [ticketDone, setTicketDone] = useState<string | null>(null);

  const sessionId = useMemo(() => getSessionId(), []);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const tts = useTextToSpeech();

  const sttFinal = useCallback((text: string) => {
    setInput(prev => (prev ? `${prev} ${text}` : text));
  }, []);
  const stt = useSpeechToText(sttFinal, { serverEnabled: !!config?.voiceInput });

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    aiApi.config().then(cfg => { if (!cancelled) setConfig(cfg); }).catch(() => { if (!cancelled) setConfig(null); });
    return () => { cancelled = true; };
  }, [user]);

  const displayTurns: ChatTurn[] = config?.greeting
    ? [{ role: 'assistant', text: config.greeting }, ...turns]
    : turns;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, sending, open]);

  const send = useCallback(async (raw: string, viaVoice: boolean) => {
    const message = raw.trim();
    if (!message || sending) return;
    setError(null);
    setInput('');
    setLastUserMsg(message);
    setTurns(prev => [...prev, { role: 'user', text: message }]);
    setSending(true);
    setAwaitingReply(true);

    let acc = '';
    let started = false;
    const pushDelta = (text: string) => {
      acc += text;
      setTurns(prev => {
        if (!started) {
          started = true;
          setAwaitingReply(false);
          return [...prev, { role: 'assistant', text: acc, spoken: voiceOut }];
        }
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.role === 'assistant') next[next.length - 1] = { ...last, text: acc };
        return next;
      });
    };

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await aiApi.chatStream(
        {
          message, sessionId,
          inputType: viaVoice ? 'voice' : 'text',
          outputType: voiceOut ? 'audio' : 'text',
          selectedPlantId: config?.requiresPlantSelection ? selectedPlantId : undefined,
        },
        {
          onDelta: pushDelta,
          onDone: ({ reply }) => {
            if (reply && reply !== acc) {
              acc = reply;
              setTurns(prev => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last && last.role === 'assistant') next[next.length - 1] = { ...last, text: reply };
                return next;
              });
            }
            if (voiceOut && acc) tts.speak(acc);
          },
        },
        controller.signal,
      );
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') { /* stopped by user */ }
      else setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      abortRef.current = null;
      setSending(false);
      setAwaitingReply(false);
    }
  }, [sending, sessionId, voiceOut, config, selectedPlantId, tts]);

  const stop = useCallback(() => { abortRef.current?.abort(); }, []);

  const retry = useCallback(() => {
    const msg = lastUserMsg;
    if (!msg || sending) return;
    // Remove the last assistant turn if present so we re-generate cleanly.
    setTurns(prev => {
      const next = [...prev];
      if (next[next.length - 1]?.role === 'assistant') next.pop();
      // Also remove the user turn so send() re-adds it.
      if (next[next.length - 1]?.role === 'user') next.pop();
      return next;
    });
    setError(null);
    void send(msg, false);
  }, [send, sending, lastUserMsg]);

  const copyTurn = useCallback((text: string, idx: number) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1800);
    }).catch(() => { /* clipboard blocked */ });
  }, []);

  const submitTicket = useCallback(async () => {
    if (!ticketMsg.trim() || ticketBusy) return;
    setTicketBusy(true);
    try {
      const res = await aiApi.supportTicket({
        message: ticketMsg.trim(),
        contactInfo: ticketContact.trim() || undefined,
        selectedPlantId: config?.requiresPlantSelection ? selectedPlantId : undefined,
      });
      setTicketDone(`Ticket #${res.id} created — our team will reach out.`);
      setTicketMsg(''); setTicketContact('');
      setTimeout(() => { setTicketOpen(false); setTicketDone(null); }, 2200);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the ticket.');
    } finally {
      setTicketBusy(false);
    }
  }, [ticketMsg, ticketContact, ticketBusy, config, selectedPlantId]);

  const toggleVoiceOut = useCallback(() => {
    setVoiceOut(v => {
      if (v) tts.cancel();
      const next = !v;
      try { localStorage.setItem('rmc_ai_voice_out', next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  }, [tts]);

  if (!user || !config?.enabled) return null;

  const chips = chipsForRole(user.role ?? 'default');
  const hasHistory = turns.length > 0;

  return (
    <>
      {/* Floating launcher */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open help assistant"
          style={{
            position: 'fixed', right: 20, bottom: 20, zIndex: 60,
            width: 60, height: 60, borderRadius: '50%', cursor: 'pointer', border: 'none',
            padding: 0, background: 'transparent',
            boxShadow: '0 12px 30px color-mix(in srgb, var(--gold) 34%, transparent)',
          }}
        >
          <AvatarPortrait size={60} />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div
          role="dialog"
          aria-label="Help assistant"
          style={{
            position: 'fixed', zIndex: 60, right: 0, bottom: 0,
            width: 'min(420px, 100vw)', height: 'min(640px, 100dvh)',
            display: 'flex', flexDirection: 'column',
            background: 'linear-gradient(180deg, var(--panel), var(--panel2))',
            border: '1px solid var(--line)', borderTopLeftRadius: 18, borderTopRightRadius: 18,
            boxShadow: '0 -10px 50px rgba(var(--shadow-rgb),.5)',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
            borderBottom: '1px solid var(--line)',
          }}>
            <AvatarPortrait speaking={tts.speaking} thinking={sending} size={44} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>Help Assistant</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                {tts.speaking
                  ? <><span style={{ display: 'inline-block', animation: 'aiAvNod 0.7s ease-in-out infinite', fontSize: 10 }}>🔊</span> Speaking…</>
                  : sending
                    ? <ThinkingDots />
                    : <><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} /> Online</>
                }
              </div>
            </div>
            {tts.supported && (
              <button
                onClick={toggleVoiceOut}
                title={voiceOut ? 'Turn voice replies off' : 'Turn voice replies on'}
                aria-label={voiceOut ? 'Turn voice replies off' : 'Turn voice replies on'}
                style={iconBtn(voiceOut)}
              >
                {voiceOut ? <Volume2 size={17} /> : <VolumeX size={17} />}
              </button>
            )}
            {tts.supported && voiceOut && (
              <button
                onClick={() => {
                  const next = tts.voiceGender === 'female' ? 'male' : 'female';
                  tts.setVoiceGender(next);
                  tts.cancel();
                }}
                title={`Voice: ${tts.voiceGender === 'female' ? 'Female' : 'Male'} — tap to switch`}
                aria-label={`Switch assistant voice, currently ${tts.voiceGender}`}
                style={{ ...iconBtn(true), fontSize: 16, fontWeight: 800, lineHeight: 1 }}
              >
                {tts.voiceGender === 'female' ? '♀' : '♂'}
              </button>
            )}
            <button onClick={() => { setOpen(false); tts.cancel(); }} aria-label="Close" style={iconBtn(false)}>
              <X size={18} />
            </button>
          </div>

          {/* Platform-staff plant picker */}
          {config.requiresPlantSelection && (
            <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--line)' }}>
              <select
                value={selectedPlantId ?? ''}
                onChange={e => setSelectedPlantId(e.target.value ? Number(e.target.value) : null)}
                style={{
                  width: '100%', padding: '7px 10px', borderRadius: 8, fontSize: 12.5,
                  background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--line)',
                }}
              >
                <option value="">General / public info (no plant)</option>
                {(config.plants ?? []).map((p: AiPlantOption) => (
                  <option key={p.id} value={p.id}>{p.name}{p.plantCode ? ` (${p.plantCode})` : ''}</option>
                ))}
              </select>
            </div>
          )}

          {/* Messages */}
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {displayTurns.map((t, i) => (
              <div key={i} style={{ alignSelf: t.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '88%' }}>
                <div style={{
                  padding: '9px 13px', borderRadius: 14, fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap',
                  background: t.role === 'user'
                    ? 'linear-gradient(135deg,var(--gold-mid),var(--gold-dark))'
                    : 'var(--surface)',
                  color: t.role === 'user' ? '#1a1205' : 'var(--text)',
                  border: t.role === 'user' ? 'none' : '1px solid var(--line)',
                  fontWeight: t.role === 'user' ? 600 : 500,
                }}>
                  {t.text}
                </div>
                {/* Copy button — assistant messages only, skip greeting (index 0 when greeting exists) */}
                {t.role === 'assistant' && i > 0 && (
                  <button
                    onClick={() => copyTurn(t.text, i)}
                    title="Copy reply"
                    aria-label="Copy reply"
                    style={{
                      marginTop: 3, display: 'flex', alignItems: 'center', gap: 4,
                      padding: '2px 8px', borderRadius: 6, border: 'none', cursor: 'pointer',
                      background: 'transparent', color: 'var(--muted)', fontSize: 11,
                      opacity: 0.7, transition: 'opacity .15s',
                    }}
                  >
                    {copiedIdx === i ? <Check size={11} /> : <Copy size={11} />}
                    {copiedIdx === i ? 'Copied!' : 'Copy'}
                  </button>
                )}
              </div>
            ))}

            {/* Thinking / streaming indicator */}
            {awaitingReply && (
              <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8,
                background: 'var(--surface)', border: '1px solid var(--line)',
                borderRadius: 14, padding: '10px 14px' }}>
                <AvatarPortrait thinking size={22} />
                <ThinkingDots />
              </div>
            )}

            {/* Error with retry */}
            {error && (
              <div style={{
                alignSelf: 'stretch', padding: '10px 12px', borderRadius: 10, fontSize: 12.5,
                background: 'color-mix(in srgb, var(--red) 10%, transparent)',
                border: '1px solid color-mix(in srgb, var(--red) 30%, transparent)',
                color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{ flex: 1 }}>{error}</span>
                {lastUserMsg && (
                  <button
                    onClick={retry}
                    title="Retry"
                    disabled={sending}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
                      padding: '4px 10px', borderRadius: 8, border: '1px solid color-mix(in srgb, var(--red) 40%, transparent)',
                      background: 'color-mix(in srgb, var(--red) 14%, transparent)',
                      color: 'var(--red)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    <RefreshCw size={11} /> Retry
                  </button>
                )}
              </div>
            )}

            {/* Quick-prompt chips — show only before first user message */}
            {!hasHistory && !error && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                {chips.map(chip => (
                  <button
                    key={chip}
                    onClick={() => send(chip, false)}
                    disabled={sending}
                    style={{
                      padding: '6px 12px', borderRadius: 20, fontSize: 11.5, fontWeight: 600,
                      border: '1px solid var(--line)', cursor: sending ? 'default' : 'pointer',
                      background: 'var(--surface)', color: 'var(--text)',
                      opacity: sending ? 0.5 : 1, transition: 'background .15s',
                      whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={e => { if (!sending) (e.currentTarget as HTMLButtonElement).style.background = 'color-mix(in srgb, var(--gold) 12%, var(--surface))'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface)'; }}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Support ticket panel */}
          {ticketOpen ? (
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>Contact the team</div>
              {ticketDone ? (
                <div style={{ fontSize: 12.5, color: 'var(--green)' }}>{ticketDone}</div>
              ) : (
                <>
                  <textarea
                    value={ticketMsg} onChange={e => setTicketMsg(e.target.value)}
                    placeholder="Describe what you need help with…" rows={3}
                    style={fieldStyle}
                  />
                  <input
                    value={ticketContact} onChange={e => setTicketContact(e.target.value)}
                    placeholder="Phone or email (optional)" style={fieldStyle}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={submitTicket} disabled={ticketBusy || !ticketMsg.trim()} style={primaryBtn(ticketBusy || !ticketMsg.trim())}>
                      {ticketBusy ? 'Sending…' : 'Send'}
                    </button>
                    <button onClick={() => setTicketOpen(false)} style={ghostBtn}>Cancel</button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
              {/* Composer */}
              <div style={{ padding: '10px 12px', borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                {stt.supported && (
                  <button
                    onClick={() => (stt.listening ? stt.stop() : stt.start())}
                    disabled={stt.transcribing}
                    title={stt.transcribing ? 'Transcribing…' : stt.listening ? 'Stop listening' : 'Speak'}
                    aria-label={stt.transcribing ? 'Transcribing' : stt.listening ? 'Stop listening' : 'Speak'}
                    style={iconBtn(stt.listening, stt.transcribing)}
                  >
                    {stt.transcribing ? <Loader2 size={18} className="ai-spin" /> : stt.listening ? <MicOff size={18} /> : <Mic size={18} />}
                  </button>
                )}
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input, false); }
                  }}
                  placeholder={stt.transcribing ? 'Transcribing…' : stt.listening ? 'Listening…' : 'Ask anything about concrete or your account…'}
                  rows={1}
                  style={{ ...fieldStyle, flex: 1, resize: 'none', maxHeight: 96 }}
                />
                {sending ? (
                  <button onClick={stop} aria-label="Stop" title="Stop the reply" style={iconBtn(true)}>
                    <Square size={16} fill="currentColor" />
                  </button>
                ) : (
                  <button onClick={() => send(input, false)} disabled={!input.trim()} aria-label="Send" style={iconBtn(false, !input.trim())}>
                    <Send size={18} />
                  </button>
                )}
              </div>
              <button onClick={() => { setError(null); setTicketOpen(true); }} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '8px', border: 'none', borderTop: '1px solid var(--line)',
                background: 'transparent', color: 'var(--muted)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
              }}>
                <LifeBuoy size={13} /> Talk to a human
              </button>
            </>
          )}

          <style>{`
            .ai-spin { animation: aiSpin 1s linear infinite; }
            @keyframes aiSpin { to { transform: rotate(360deg); } }
            @keyframes aiDot { 0%,80%,100% { transform: scale(0.55); opacity:.4; } 40% { transform: scale(1); opacity:1; } }
          `}</style>
        </div>
      )}
    </>
  );
}

// Animated "..." thinking indicator: three dots that pulse in sequence.
function ThinkingDots() {
  return (
    <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center', color: 'var(--muted)', fontSize: 11 }}>
      Thinking
      {[0, 1, 2].map(i => (
        <span
          key={i}
          aria-hidden
          style={{
            width: 5, height: 5, borderRadius: '50%',
            background: 'var(--gold)', display: 'inline-block',
            animation: `aiDot 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </span>
  );
}

function iconBtn(active: boolean, disabled = false): React.CSSProperties {
  return {
    width: 38, height: 38, borderRadius: 10, flexShrink: 0,
    display: 'grid', placeItems: 'center', cursor: disabled ? 'default' : 'pointer',
    background: active ? 'color-mix(in srgb, var(--gold) 18%, transparent)' : 'var(--surface)',
    border: `1px solid ${active ? 'color-mix(in srgb, var(--gold) 45%, transparent)' : 'var(--line)'}`,
    color: active ? 'var(--gold)' : 'var(--text)',
    opacity: disabled ? 0.5 : 1,
  };
}

const fieldStyle: React.CSSProperties = {
  padding: '9px 12px', borderRadius: 10, fontSize: 13,
  background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--line)',
  fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
};

function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: '8px 16px', borderRadius: 10, border: 'none', cursor: disabled ? 'default' : 'pointer',
    background: 'linear-gradient(135deg,var(--gold-mid),var(--gold-dark))', color: '#1a1205',
    fontSize: 12.5, fontWeight: 700, opacity: disabled ? 0.5 : 1,
  };
}

const ghostBtn: React.CSSProperties = {
  padding: '8px 16px', borderRadius: 10, cursor: 'pointer',
  background: 'transparent', color: 'var(--muted)', border: '1px solid var(--line)',
  fontSize: 12.5, fontWeight: 600,
};
