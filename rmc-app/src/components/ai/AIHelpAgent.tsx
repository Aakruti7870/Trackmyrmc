import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, X, Send, Square, Mic, MicOff, Volume2, VolumeX, LifeBuoy, Loader2 } from 'lucide-react';
import { aiApi, type AiConfig, type AiPlantOption } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import AvatarPortrait from './AvatarPortrait';
import { useSpeechToText, useTextToSpeech } from './useVoice';

interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
  // True when this assistant turn arrived while voice output was on.
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

export default function AIHelpAgent() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<AiConfig | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  // True only between hitting send and the first streamed chunk, so the
  // "Thinking…" indicator gives way to the live reply as it streams in.
  const [awaitingReply, setAwaitingReply] = useState(false);
  const [voiceOut, setVoiceOut] = useState(() => {
    try { return localStorage.getItem('rmc_ai_voice_out') === '1'; } catch { return false; }
  });
  const [selectedPlantId, setSelectedPlantId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Support ticket form
  const [ticketOpen, setTicketOpen] = useState(false);
  const [ticketMsg, setTicketMsg] = useState('');
  const [ticketContact, setTicketContact] = useState('');
  const [ticketBusy, setTicketBusy] = useState(false);
  const [ticketDone, setTicketDone] = useState<string | null>(null);

  const sessionId = useMemo(() => getSessionId(), []);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  // Lets the user interrupt an in-flight streamed reply via the Stop button.
  const abortRef = useRef<AbortController | null>(null);
  const tts = useTextToSpeech();

  const sttFinal = useCallback((text: string) => {
    setInput(prev => (prev ? `${prev} ${text}` : text));
  }, []);
  const stt = useSpeechToText(sttFinal, { serverEnabled: !!config?.voiceInput });

  // Load config when first authenticated; controls whether the button shows.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    aiApi.config().then(cfg => { if (!cancelled) setConfig(cfg); }).catch(() => { if (!cancelled) setConfig(null); });
    return () => { cancelled = true; };
  }, [user]);

  // The greeting is a static opening bubble derived from config, so it never
  // needs to live in state (and disappears naturally once the chat scrolls).
  const displayTurns: ChatTurn[] = config?.greeting
    ? [{ role: 'assistant', text: config.greeting }, ...turns]
    : turns;

  // Auto-scroll to the newest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, sending, open]);

  const send = useCallback(async (raw: string, viaVoice: boolean) => {
    const message = raw.trim();
    if (!message || sending) return;
    setError(null);
    setInput('');
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
            // Reconcile with the server's canonical (trimmed) reply.
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
      // A user-initiated Stop aborts the fetch; keep the partial text, no error.
      if (e instanceof DOMException && e.name === 'AbortError') { /* stopped by user */ }
      else setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      abortRef.current = null;
      setSending(false);
      setAwaitingReply(false);
    }
  }, [sending, sessionId, voiceOut, config, selectedPlantId, tts]);

  // Interrupt an in-flight reply, keeping whatever text already streamed in.
  const stop = useCallback(() => {
    abortRef.current?.abort();
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

  // Hide entirely when no user or the agent is disabled.
  if (!user || !config?.enabled) return null;

  return (
    <>
      {/* Floating launcher */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open help assistant"
          style={{
            position: 'fixed', right: 20, bottom: 20, zIndex: 60,
            width: 56, height: 56, borderRadius: '50%', cursor: 'pointer', border: 'none',
            background: 'linear-gradient(145deg,var(--gold-hi),var(--gold-mid) 45%,var(--gold-dark))',
            display: 'grid', placeItems: 'center', color: '#1a1205',
            boxShadow: '0 12px 30px color-mix(in srgb, var(--gold) 34%, transparent), inset 0 2px 2px rgba(255,255,255,.55)',
          }}
        >
          <MessageCircle size={26} />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div
          role="dialog"
          aria-label="Help assistant"
          style={{
            position: 'fixed', zIndex: 60, right: 0, bottom: 0,
            width: 'min(420px, 100vw)', height: 'min(620px, 100dvh)',
            display: 'flex', flexDirection: 'column',
            background: 'linear-gradient(180deg, var(--panel), var(--panel2))',
            border: '1px solid var(--line)', borderTopLeftRadius: 18, borderTopRightRadius: 18,
            boxShadow: '0 -10px 50px rgba(0,0,0,.5)',
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
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                {tts.speaking ? 'Speaking…' : sending ? 'Thinking…' : 'Online'}
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
              <div key={i} style={{ alignSelf: t.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                <div style={{
                  padding: '9px 13px', borderRadius: 14, fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap',
                  background: t.role === 'user'
                    ? 'linear-gradient(135deg,var(--gold-mid),var(--gold-dark))'
                    : 'var(--surface)',
                  color: t.role === 'user' ? '#1a1205' : 'var(--text)',
                  border: t.role === 'user' ? 'none' : '1px solid var(--line)',
                  fontWeight: t.role === 'user' ? 600 : 500,
                }}>
                  {t.text}
                </div>
              </div>
            ))}
            {awaitingReply && (
              <div style={{ alignSelf: 'flex-start', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <Loader2 size={14} className="ai-spin" /> Thinking…
              </div>
            )}
            {error && (
              <div style={{
                alignSelf: 'stretch', padding: '8px 12px', borderRadius: 10, fontSize: 12,
                background: 'color-mix(in srgb, var(--red) 12%, transparent)',
                border: '1px solid color-mix(in srgb, var(--red) 35%, transparent)', color: 'var(--red)',
              }}>{error}</div>
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
                  placeholder={stt.transcribing ? 'Transcribing…' : stt.listening ? 'Listening…' : 'Type your message…'}
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
          `}</style>
        </div>
      )}
    </>
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
