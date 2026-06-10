import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, X, Check } from 'lucide-react';

export type SelectOption = { id: number; name: string };

type Props = {
  value: number | null;
  onChange: (id: number | null) => void;
  options: SelectOption[];
  placeholder?: string;
  emptyLabel?: string;
  noneLabel?: string;
};

const fieldStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', boxSizing: 'border-box',
  background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)',
  borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  gap: 8, cursor: 'pointer', textAlign: 'left',
};

export default function SearchableSelect({
  value, onChange, options,
  placeholder = 'Select…',
  emptyLabel = 'No matches',
  noneLabel = '— None —',
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => options.find(o => o.id === value) ?? null,
    [options, value]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o => o.name.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setHighlight(0);
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [open]);

  function pick(id: number | null) {
    onChange(id);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight(h => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight(h => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const opt = filtered[highlight];
      if (opt) pick(opt.id);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={fieldStyle}
      >
        <span style={{
          color: selected ? 'var(--text)' : 'var(--muted)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {selected ? selected.name : placeholder}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {selected && (
            <span
              role="button"
              tabIndex={-1}
              onClick={(e) => { e.stopPropagation(); pick(null); }}
              style={{ display: 'inline-flex', color: 'var(--muted)', cursor: 'pointer' }}
            >
              <X size={14} />
            </span>
          )}
          <ChevronDown size={15} style={{ color: 'var(--muted)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
        </span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 200,
          background: 'linear-gradient(145deg,var(--panel),var(--bg))',
          border: '1px solid rgba(255,255,255,.12)', borderRadius: 10,
          boxShadow: '0 12px 32px rgba(0,0,0,.45)', overflow: 'hidden',
        }}>
          <div style={{ padding: 8, borderBottom: '1px solid rgba(255,255,255,.07)' }}>
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
              <input
                ref={inputRef}
                value={query}
                onChange={e => { setQuery(e.target.value); setHighlight(0); }}
                onKeyDown={onKeyDown}
                placeholder="Search…"
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '7px 10px 7px 28px',
                  background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)',
                  borderRadius: 7, color: 'var(--text)', fontSize: 13, outline: 'none',
                }}
              />
            </div>
          </div>

          <div style={{ maxHeight: 220, overflowY: 'auto', padding: 4 }}>
            <button
              type="button"
              onClick={() => pick(null)}
              style={{
                width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 7,
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--muted)', fontSize: 13, fontStyle: 'italic',
              }}
            >
              {noneLabel}
            </button>

            {filtered.length === 0 ? (
              <div style={{ padding: '12px 10px', color: 'var(--muted)', fontSize: 12, textAlign: 'center' }}>
                {emptyLabel}
              </div>
            ) : (
              filtered.map((o, i) => {
                const isSel = o.id === value;
                const isHi = i === highlight;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => pick(o.id)}
                    onMouseEnter={() => setHighlight(i)}
                    style={{
                      width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 7,
                      background: isHi ? 'rgba(255,255,255,.07)' : 'transparent',
                      border: 'none', cursor: 'pointer',
                      color: isSel ? 'var(--gold)' : 'var(--text)', fontSize: 13,
                      fontWeight: isSel ? 700 : 500,
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.name}</span>
                    {isSel && <Check size={14} style={{ flexShrink: 0 }} />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
