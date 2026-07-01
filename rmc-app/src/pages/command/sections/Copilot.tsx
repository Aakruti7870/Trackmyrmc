import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Send, Square, Sparkles, Brain } from 'lucide-react';
import { aiApi, type AiConfig, type AiPlantOption } from '@/lib/api';
import AvatarPortrait from '@/components/ai/AvatarPortrait';
import { SectionHeading, GlassPanel, Badge, SampleTag, } from '../ui';
import { mix } from '../tokens';
import { AI_PREDICTIONS, confidenceColor } from '../data';

interface Turn { role: 'user' | 'assistant'; text: string }

function sessionId(): string {
  const KEY = 'rmc_command_copilot';
  let id = sessionStorage.getItem(KEY);
  if (!id) { id = `cc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`; sessionStorage.setItem(KEY, id); }
  return id;
}

const CHIPS = [
  'Platform summary today',
  'Which plants are underperforming?',
  'Top 5 customers by volume',
  'Any fleet or fuel anomalies?',
  'Forecast tomorrow\'s demand',
];

export default function Copilot({ accent }: { accent: string }) {
  const [config, setConfig] = useState<AiConfig | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [awaiting, setAwaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plantId, setPlantId] = useState<number | null>(null);

  const sid = useMemo(() => sessionId(), []);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let alive = true;
    aiApi.config().then(c => { if (alive) setConfig(c); }).catch(() => { if (alive) setConfig(null); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, awaiting]);

  const send = useCallback(async (raw: string) => {
    const message = raw.trim();
    if (!message || sending) return;
    setError(null); setInput('');
    setTurns(prev => [...prev, { role: 'user', text: message }]);
    setSending(true); setAwaiting(true);

    let acc = ''; let started = false;
    const push = (t: string) => {
      acc += t;
      setTurns(prev => {
        if (!started) { started = true; setAwaiting(false); return [...prev, { role: 'assistant', text: acc }]; }
        const next = [...prev]; const last = next[next.length - 1];
        if (last?.role === 'assistant') next[next.length - 1] = { ...last, text: acc };
        return next;
      });
    };

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await aiApi.chatStream(
        {
          message, sessionId: sid, inputType: 'text', outputType: 'text',
          selectedPlantId: config?.requiresPlantSelection ? plantId ?? undefined : undefined,
        },
        {
          onDelta: push,
          onDone: ({ reply }) => {
            if (reply && reply !== acc) {
              setTurns(prev => {
                const next = [...prev]; const last = next[next.length - 1];
                if (last?.role === 'assistant') next[next.length - 1] = { ...last, text: reply };
                return next;
              });
            }
          },
        },
        controller.signal,
      );
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        setError(e instanceof Error ? e.message : 'Something went wrong.');
      }
    } finally {
      abortRef.current = null; setSending(false); setAwaiting(false);
    }
  }, [sending, sid, config, plantId]);

  const stop = useCallback(() => abortRef.current?.abort(), []);

  return (
    <div className="cc-in">
      <SectionHeading
        icon={<Sparkles size={20} />} accent={accent}
        title="Authority Copilot"
        subtitle="Ask anything — grounded in your live platform data"
      />

      <div className="cc-grid" style={{ gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)' }}>
        {/* Chat */}
        <GlassPanel accent={accent} style={{ display: 'flex', flexDirection: 'column', minHeight: 460, padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
            <AvatarPortrait speaking={false} thinking={sending} size={46} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14.5, fontWeight: 900, color: 'var(--text)' }}>Command Copilot</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: config?.enabled ? 'var(--green)' : 'var(--muted)' }} />
                {config?.enabled ? 'Online • privacy-scoped' : 'Assistant offline'}
              </div>
            </div>
            {config?.requiresPlantSelection && (config.plants?.length ?? 0) > 0 && (
              <select
                value={plantId ?? ''} onChange={e => setPlantId(e.target.value ? Number(e.target.value) : null)}
                style={{ padding: '6px 8px', borderRadius: 8, fontSize: 11.5, background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--line)', maxWidth: 150 }}
              >
                <option value="">All plants</option>
                {(config.plants ?? []).map((p: AiPlantOption) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
          </div>

          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {turns.length === 0 && (
              <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--muted)', fontSize: 13, maxWidth: 260 }}>
                <Brain size={30} color={accent} style={{ marginBottom: 8 }} />
                <div>Ask about performance, plants, customers, fleet or demand.</div>
              </div>
            )}
            {turns.map((t, i) => (
              <div key={i} style={{ alignSelf: t.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '88%' }}>
                <div style={{
                  padding: '9px 13px', borderRadius: 14, fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap',
                  background: t.role === 'user' ? `linear-gradient(135deg, ${accent}, ${mix(accent, 55, '#000')})` : 'var(--surface)',
                  color: t.role === 'user' ? '#160a17' : 'var(--text)',
                  border: t.role === 'user' ? 'none' : '1px solid var(--line)',
                  fontWeight: t.role === 'user' ? 600 : 500,
                }}>{t.text}</div>
              </div>
            ))}
            {awaiting && (
              <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '10px 14px' }}>
                <AvatarPortrait thinking size={22} />
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>Thinking…</span>
              </div>
            )}
            {error && (
              <div style={{ fontSize: 12.5, color: 'var(--red)', padding: '9px 11px', borderRadius: 9, background: mix('var(--red)', 10), border: '1px solid ' + mix('var(--red)', 30) }}>{error}</div>
            )}
            {turns.length === 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {CHIPS.map(c => (
                  <button key={c} onClick={() => send(c)} disabled={sending || !config?.enabled} style={{
                    padding: '6px 12px', borderRadius: 20, fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
                    background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--line)',
                    opacity: config?.enabled ? 1 : 0.5,
                  }}>{c}</button>
                ))}
              </div>
            )}
          </div>

          <div style={{ padding: 12, borderTop: '1px solid var(--line)', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea
              value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
              placeholder={config?.enabled ? 'Ask the Copilot…' : 'Assistant is offline'}
              disabled={!config?.enabled} rows={1}
              style={{ flex: 1, resize: 'none', maxHeight: 90, padding: '9px 12px', borderRadius: 10, fontSize: 13, background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--line)', fontFamily: 'inherit' }}
            />
            {sending ? (
              <button onClick={stop} aria-label="Stop" style={iconBtn(accent, true)}><Square size={16} fill="currentColor" /></button>
            ) : (
              <button onClick={() => send(input)} disabled={!input.trim() || !config?.enabled} aria-label="Send" style={iconBtn(accent, !!input.trim() && !!config?.enabled)}>
                <Send size={18} />
              </button>
            )}
          </div>
        </GlassPanel>

        {/* AI predictions */}
        <GlassPanel accent="#a78bfa">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Brain size={16} color="#a78bfa" />
              <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)' }}>AI predictions</span>
            </div>
            <SampleTag />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {AI_PREDICTIONS.map(p => {
              const col = confidenceColor(p.confidence);
              return (
                <div key={p.title} style={{ padding: 12, borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--line)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>{p.title}</span>
                    <Badge color={col}>{p.confidence}</Badge>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text)' }}>{p.value}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{p.detail}</div>
                </div>
              );
            })}
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}

function iconBtn(accent: string, active: boolean): React.CSSProperties {
  return {
    width: 40, height: 40, borderRadius: 10, flexShrink: 0, display: 'grid', placeItems: 'center',
    cursor: active ? 'pointer' : 'default',
    background: active ? mix(accent, 20) : 'var(--surface)',
    border: `1px solid ${active ? mix(accent, 45) : 'var(--line)'}`,
    color: active ? accent : 'var(--muted)',
  };
}
