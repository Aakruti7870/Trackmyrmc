import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, RefreshCw, Clock, CheckCheck, AlertTriangle, User as UserIcon, ChevronLeft } from 'lucide-react';
import { api, ApiError } from '@/lib/api';

interface ChatSummary {
  phone: string;
  lastBody: string | null;
  lastDirection: string;
  lastAt: string;
  lastInboundAt: string | null;
  profileName: string | null;
  clientName: string | null;
  windowOpen: boolean;
}

interface ChatMessage {
  id: number;
  direction: string;
  event: string;
  body: string | null;
  status: string;
  errorCode: string | null;
  channel: string;
  profileName: string | null;
  orderNo: string | null;
  challanNo: string | null;
  createdAt: string;
}

interface ThreadResponse {
  phone: string;
  messages: ChatMessage[];
  lastInboundAt: string | null;
  windowOpen: boolean;
}

// Canned replies staff use most; clicking prefills the composer for editing.
const QUICK_REPLIES = [
  'Your order is confirmed. Thank you for choosing us!',
  'Production has started on your order.',
  'Your transit mixer has been dispatched and is on the way.',
  'Your concrete has been delivered. Thank you!',
  'Please find your invoice details. Let us know if you have any questions.',
];

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// A template notification (order/dispatch/delivery) shown inside the thread —
// it has no stored body, so we describe what was sent instead.
function templateLabel(m: ChatMessage): string {
  if (m.event === 'order') return `Order notification${m.orderNo ? ` — ${m.orderNo}` : ''}`;
  if (m.event === 'dispatch') return `Dispatch notification${m.challanNo ? ` — ${m.challanNo}` : ''}`;
  if (m.event === 'delivery') return `Delivery notification${m.challanNo ? ` — ${m.challanNo}` : ''}`;
  return 'Notification';
}

export default function WhatsAppChat() {
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [chatsLoading, setChatsLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [thread, setThread] = useState<ThreadResponse | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [isNarrow, setIsNarrow] = useState(() => window.innerWidth < 800);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const selectedRef = useRef<string | null>(null);
  useEffect(() => { selectedRef.current = selected; }, [selected]);

  const loadChats = useCallback(() => {
    return api.get<ChatSummary[]>('/whatsapp/chats')
      .then((rows) => { setChats(rows); setPageError(''); })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 403) {
          setPageError('The WhatsApp inbox is available to platform staff only.');
        } else {
          setPageError(err instanceof Error ? err.message : 'Failed to load conversations');
        }
      })
      .finally(() => setChatsLoading(false));
  }, []);

  const loadThread = useCallback((phone: string, opts?: { silent?: boolean }) => {
    if (!opts?.silent) setThreadLoading(true);
    return api.get<ThreadResponse>(`/whatsapp/chats/${encodeURIComponent(phone)}/messages`)
      .then((data) => {
        // Ignore a stale response if the user has switched conversations.
        if (selectedRef.current === phone) setThread(data);
      })
      .catch(() => { /* transient poll failure — keep showing the last thread */ })
      .finally(() => { if (!opts?.silent) setThreadLoading(false); });
  }, []);

  // Initial load + light polling keeps the inbox live even without SSE focus.
  useEffect(() => {
    loadChats();
    const t = setInterval(() => {
      loadChats();
      const phone = selectedRef.current;
      if (phone) loadThread(phone, { silent: true });
    }, 12000);
    return () => clearInterval(t);
  }, [loadChats, loadThread]);

  // A live inbound message (SSE toast re-dispatched by Layout) refreshes now.
  useEffect(() => {
    const onMsg = () => {
      loadChats();
      const phone = selectedRef.current;
      if (phone) loadThread(phone, { silent: true });
    };
    window.addEventListener('whatsapp-message', onMsg);
    return () => window.removeEventListener('whatsapp-message', onMsg);
  }, [loadChats, loadThread]);

  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth < 800);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread?.messages.length, selected]);

  function openChat(phone: string) {
    setSelected(phone);
    setThread(null);
    setSendError('');
    setDraft('');
    loadThread(phone);
  }

  function sendReply() {
    if (!selected || !draft.trim() || sending) return;
    setSending(true);
    setSendError('');
    api.post<{ ok: boolean; message: ChatMessage }>(`/whatsapp/chats/${encodeURIComponent(selected)}/reply`, { body: draft.trim() })
      .then(() => {
        setDraft('');
        return Promise.all([loadThread(selected, { silent: true }), loadChats()]);
      })
      .catch((err: unknown) => {
        setSendError(err instanceof Error ? err.message : 'Failed to send message');
      })
      .finally(() => setSending(false));
  }

  const current = chats.find((c) => c.phone === selected);
  const windowOpen = thread ? thread.windowOpen : (current?.windowOpen ?? false);

  const listPane = (
    <div style={{
      width: isNarrow ? '100%' : 320, flexShrink: 0, display: 'flex', flexDirection: 'column',
      background: 'var(--glass-1)', border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden',
    }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)' }}>Conversations</span>
        <button type="button" onClick={() => { setChatsLoading(true); loadChats(); }} title="Refresh"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'inline-flex', padding: 4 }}>
          <RefreshCw size={15} />
        </button>
      </div>
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {chatsLoading ? (
          <div style={{ padding: 30, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Loading…</div>
        ) : chats.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
            No conversations yet. When a customer messages your WhatsApp business number, it will appear here.
          </div>
        ) : chats.map((c) => {
          const active = c.phone === selected;
          return (
            <button key={c.phone} type="button" onClick={() => openChat(c.phone)} style={{
              display: 'block', width: '100%', textAlign: 'left', padding: '12px 16px', cursor: 'pointer',
              background: active ? 'color-mix(in srgb, var(--gold) 12%, transparent)' : 'none',
              border: 'none', borderBottom: '1px solid var(--line)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                <span style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.clientName || c.profileName || c.phone}
                </span>
                <span style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0 }}>{timeAgo(c.lastAt)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 3, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.lastDirection === 'outbound' ? 'You: ' : ''}{c.lastBody || '—'}
                </span>
                {c.windowOpen && (
                  <span title="Reply window open" style={{ width: 8, height: 8, borderRadius: 8, background: 'var(--green)', flexShrink: 0 }} />
                )}
              </div>
              {(c.clientName || c.profileName) && (
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{c.phone}</div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  const threadPane = (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0,
      background: 'var(--glass-1)', border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden',
    }}>
      {!selected ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 14, padding: 30, textAlign: 'center' }}>
          Select a conversation to view messages
        </div>
      ) : (
        <>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10 }}>
            {isNarrow && (
              <button type="button" onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'inline-flex', padding: 2 }}>
                <ChevronLeft size={18} />
              </button>
            )}
            <div style={{
              width: 34, height: 34, borderRadius: 34, background: 'color-mix(in srgb, var(--gold) 18%, transparent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gold)', flexShrink: 0,
            }}>
              <UserIcon size={17} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {current?.clientName || current?.profileName || selected}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{selected}</div>
            </div>
            <span style={{
              marginLeft: 'auto', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap',
              color: windowOpen ? 'var(--green)' : 'var(--muted)',
              background: windowOpen ? 'rgba(34,197,94,.12)' : 'var(--chip-bg)',
              border: `1px solid ${windowOpen ? 'rgba(34,197,94,.35)' : 'var(--line)'}`,
              display: 'inline-flex', alignItems: 'center', gap: 5,
            }}>
              <Clock size={11} /> {windowOpen ? 'Reply window open' : 'Window closed'}
            </span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {threadLoading ? (
              <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, padding: 30 }}>Loading…</div>
            ) : thread?.messages.map((m) => {
              const mine = m.direction === 'outbound';
              const isTemplate = m.event !== 'chat';
              const failed = m.status === 'failed' || m.status === 'undelivered';
              return (
                <div key={m.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '78%', padding: '8px 12px', borderRadius: 14, fontSize: 13.5, lineHeight: 1.45,
                    borderBottomRightRadius: mine ? 4 : 14, borderBottomLeftRadius: mine ? 14 : 4,
                    background: mine
                      ? 'color-mix(in srgb, var(--gold) 18%, transparent)'
                      : 'var(--chip-bg)',
                    border: `1px solid ${mine ? 'color-mix(in srgb, var(--gold) 35%, transparent)' : 'var(--line)'}`,
                    color: 'var(--text)',
                  }}>
                    {isTemplate ? (
                      <span style={{ fontStyle: 'italic', color: 'var(--muted)', fontSize: 12.5 }}>
                        📋 {templateLabel(m)}
                      </span>
                    ) : (
                      <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.body}</span>
                    )}
                    <div style={{ display: 'flex', gap: 5, alignItems: 'center', justifyContent: 'flex-end', marginTop: 4, fontSize: 10.5, color: failed ? 'var(--red)' : 'var(--muted)' }}>
                      {fmtTime(m.createdAt)}
                      {mine && (failed
                        ? <AlertTriangle size={11} />
                        : (m.status === 'read' || m.status === 'delivered') ? <CheckCheck size={12} style={{ color: m.status === 'read' ? 'var(--blue)' : undefined }} /> : null)}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          <div style={{ borderTop: '1px solid var(--line)', padding: '10px 14px' }}>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8 }}>
              {QUICK_REPLIES.map((q) => (
                <button key={q} type="button" onClick={() => setDraft(q)} style={{
                  fontSize: 11.5, padding: '5px 11px', borderRadius: 20, whiteSpace: 'nowrap', cursor: 'pointer',
                  background: 'var(--chip-bg)', border: '1px solid var(--line)', color: 'var(--text)', flexShrink: 0,
                }}>
                  {q.length > 38 ? `${q.slice(0, 38)}…` : q}
                </button>
              ))}
            </div>
            {!windowOpen && (
              <div style={{ fontSize: 12, color: 'var(--muted)', padding: '4px 2px 8px', display: 'flex', gap: 6, alignItems: 'center' }}>
                <AlertTriangle size={13} style={{ color: '#f59e0b', flexShrink: 0 }} />
                The 24-hour reply window has closed — WhatsApp only allows free-text replies within 24 hours of the customer's last message. Order/dispatch/delivery template notifications still go through automatically.
              </div>
            )}
            {sendError && (
              <div style={{ fontSize: 12.5, color: 'var(--red)', padding: '4px 2px 8px' }}>{sendError}</div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                placeholder={windowOpen ? 'Type a reply…' : 'Reply window closed'}
                disabled={!windowOpen || sending}
                rows={1}
                style={{
                  flex: 1, resize: 'none', padding: '10px 12px', borderRadius: 12, fontSize: 13.5,
                  background: 'var(--chip-bg)', border: '1px solid var(--line)', color: 'var(--text)',
                  outline: 'none', fontFamily: 'inherit', minHeight: 40, maxHeight: 120,
                }}
              />
              <button type="button" onClick={sendReply} disabled={!windowOpen || sending || !draft.trim()} style={{
                width: 42, height: 42, borderRadius: 12, border: 'none', cursor: (!windowOpen || sending || !draft.trim()) ? 'not-allowed' : 'pointer',
                background: (!windowOpen || !draft.trim()) ? 'var(--chip-bg)' : 'var(--gold)',
                color: (!windowOpen || !draft.trim()) ? 'var(--muted)' : '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, alignSelf: 'flex-end',
              }}>
                <Send size={17} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', minHeight: 480 }}>
      <div style={{ marginBottom: 14 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', margin: 0, letterSpacing: '-.3px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <MessageCircle size={24} style={{ color: 'var(--gold)' }} /> WhatsApp
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: 13, margin: '6px 0 0' }}>
          Two-way chat with customers on your WhatsApp business number. Free-text replies are limited to 24 hours after the customer's last message.
        </p>
      </div>
      {pageError ? (
        <div style={{
          padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 14,
          background: 'var(--glass-1)', border: '1px solid var(--line)', borderRadius: 16,
        }}>
          {pageError}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 14, flex: 1, minHeight: 0 }}>
          {(!isNarrow || !selected) && listPane}
          {(!isNarrow || selected) && threadPane}
        </div>
      )}
    </div>
  );
}
