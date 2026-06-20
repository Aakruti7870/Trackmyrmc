import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useLocation } from 'wouter';
import {
  Search, CornerDownLeft, LayoutDashboard, ClipboardList, Truck, Users, CarFront,
  UserCheck, FileText, FlaskConical, BarChart3, ShieldCheck, Settings, LogOut,
  PackageSearch, Route as RouteIcon, Monitor, Plus, UserPlus,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { canAccess } from '@/lib/permissions';

type Group = 'Quick Actions' | 'Navigate' | 'Account';

interface Cmd {
  id: string;
  label: string;
  group: Group;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  keywords?: string;
  path?: string; // used for role gating + navigation
  run: () => void;
}

/* Global command palette (⌘K / Ctrl+K) — fuzzy search across actions & pages, role-gated. */
export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [, navigate] = useLocation();
  const { user, logout } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => { setOpen(false); setQuery(''); setActive(0); }, []);

  // ⌘K / Ctrl+K toggles; a window event lets other UI open it too.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('open-command-palette', onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('open-command-palette', onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) { const t = setTimeout(() => inputRef.current?.focus(), 20); return () => clearTimeout(t); }
  }, [open]);

  const go = useCallback((path: string) => { navigate(path); close(); }, [navigate, close]);

  const allCommands = useMemo<Cmd[]>(() => {
    if (!user) return [];
    const actions: Cmd[] = [
      { id: 'a-challan', label: 'New Challan', keywords: 'create dispatch deliver', group: 'Quick Actions', icon: Plus, path: '/dispatch', run: () => go('/dispatch') },
      { id: 'a-order', label: 'New Order', keywords: 'create booking', group: 'Quick Actions', icon: ClipboardList, path: '/orders', run: () => go('/orders') },
      { id: 'a-client', label: 'Add Client', keywords: 'create company customer', group: 'Quick Actions', icon: UserPlus, path: '/clients', run: () => go('/clients') },
      { id: 'a-kiosk', label: 'Open Control Room', keywords: 'kiosk big screen wall tv live mode', group: 'Quick Actions', icon: Monitor, path: '/kiosk', run: () => go('/kiosk') },
    ];
    const nav: Cmd[] = [
      { id: 'n-dash', label: 'Dashboard', group: 'Navigate', icon: LayoutDashboard, path: '/', run: () => go('/') },
      { id: 'n-myorders', label: 'My Orders', group: 'Navigate', icon: PackageSearch, path: '/my-orders', run: () => go('/my-orders') },
      { id: 'n-mytrips', label: 'My Trips', group: 'Navigate', icon: RouteIcon, path: '/my-trips', run: () => go('/my-trips') },
      { id: 'n-orders', label: 'Orders', group: 'Navigate', icon: ClipboardList, path: '/orders', run: () => go('/orders') },
      { id: 'n-dispatch', label: 'Dispatch', group: 'Navigate', icon: Truck, path: '/dispatch', run: () => go('/dispatch') },
      { id: 'n-clients', label: 'Clients', group: 'Navigate', icon: Users, path: '/clients', run: () => go('/clients') },
      { id: 'n-fleet', label: 'Fleet', group: 'Navigate', icon: CarFront, path: '/vehicles', run: () => go('/vehicles') },
      { id: 'n-drivers', label: 'Drivers', group: 'Navigate', icon: UserCheck, path: '/drivers', run: () => go('/drivers') },
      { id: 'n-prod', label: 'Production', group: 'Navigate', icon: FileText, path: '/batch-report', run: () => go('/batch-report') },
      { id: 'n-mix', label: 'Mix Design', group: 'Navigate', icon: FlaskConical, path: '/mix-design', run: () => go('/mix-design') },
      { id: 'n-reports', label: 'Reports', group: 'Navigate', icon: BarChart3, path: '/reports', run: () => go('/reports') },
      { id: 'n-users', label: 'Users', group: 'Navigate', icon: ShieldCheck, path: '/users', run: () => go('/users') },
    ];
    const account: Cmd[] = [
      { id: 'ac-profile', label: 'Account Settings', keywords: 'theme profile preferences', group: 'Account', icon: Settings, path: '/profile', run: () => go('/profile') },
      { id: 'ac-logout', label: 'Sign Out', keywords: 'logout exit', group: 'Account', icon: LogOut, run: () => { logout(); close(); } },
    ];
    return [...actions, ...nav, ...account].filter(c => !c.path || canAccess(user.role, c.path));
  }, [user, go, logout, close]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allCommands;
    return allCommands.filter(c => `${c.label} ${c.keywords || ''} ${c.group}`.toLowerCase().includes(q));
  }, [query, allCommands]);

  // Reset the highlighted row whenever the query changes (done at the event
  // source instead of in an effect to avoid a cascading re-render).
  const onQueryChange = (value: string) => { setQuery(value); setActive(0); };

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${active}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); filtered[active]?.run(); }
  };

  if (!open || !user) return null;

  const groups: Group[] = ['Quick Actions', 'Navigate', 'Account'];
  let runningIndex = -1; // flat index aligned with `filtered` order for keyboard nav

  return (
    <div
      onClick={close}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'var(--overlay)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '12vh',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="glass-card"
        style={{ width: 'min(620px, 92vw)', maxHeight: '70vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
          <Search size={18} style={{ color: 'var(--muted)' }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => onQueryChange(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Search actions and pages…"
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text)', fontSize: 15, fontWeight: 500 }}
          />
          <span style={{ fontSize: 11, color: 'var(--muted)', border: '1px solid var(--line)', borderRadius: 6, padding: '2px 6px' }}>ESC</span>
        </div>

        <div ref={listRef} style={{ overflowY: 'auto', padding: 8 }}>
          {filtered.length === 0 && (
            <div style={{ padding: '28px 12px', textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>No results for “{query}”</div>
          )}
          {groups.map(group => {
            const items = filtered.filter(c => c.group === group);
            if (items.length === 0) return null;
            return (
              <div key={group} style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.6px', textTransform: 'uppercase', color: 'var(--muted)', padding: '8px 10px 4px' }}>{group}</div>
                {items.map(c => {
                  runningIndex++;
                  const idx = runningIndex;
                  const isActive = idx === active;
                  const Icon = c.icon;
                  return (
                    <div
                      key={c.id}
                      data-idx={idx}
                      onMouseEnter={() => setActive(idx)}
                      onClick={() => c.run()}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                        background: isActive ? 'color-mix(in srgb, var(--gold) 12%, transparent)' : 'transparent',
                        border: `1px solid ${isActive ? 'color-mix(in srgb, var(--gold) 26%, transparent)' : 'transparent'}`,
                      }}
                    >
                      <div style={{ width: 30, height: 30, borderRadius: 8, display: 'grid', placeItems: 'center', background: 'var(--chip-bg)', flexShrink: 0 }}>
                        <Icon size={15} style={{ color: isActive ? 'var(--gold)' : 'var(--muted)' }} />
                      </div>
                      <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{c.label}</span>
                      {isActive && <CornerDownLeft size={14} style={{ color: 'var(--muted)' }} />}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
