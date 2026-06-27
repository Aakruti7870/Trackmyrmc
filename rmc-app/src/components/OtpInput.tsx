import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react';

// A segmented one-time-code input rendered as N single-digit boxes. The parent
// owns the value (a string of up to `length` digits); this component just keeps
// the boxes in sync, auto-advances on type, supports paste/backspace/arrows, and
// fires onComplete once every box is filled. Used by the customer phone flow and
// the staff / super-admin code flows so every OTP entry looks and behaves alike.
export default function OtpInput({
  value,
  onChange,
  length = 6,
  autoFocus = false,
  disabled = false,
  onComplete,
  ariaLabel = 'One-time code',
}: {
  value: string;
  onChange: (next: string) => void;
  length?: number;
  autoFocus?: boolean;
  disabled?: boolean;
  onComplete?: (code: string) => void;
  ariaLabel?: string;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.split('').slice(0, length);

  function focusBox(i: number) {
    const clamped = Math.max(0, Math.min(length - 1, i));
    refs.current[clamped]?.focus();
    refs.current[clamped]?.select();
  }

  function commit(next: string) {
    const cleaned = next.replace(/\D/g, '').slice(0, length);
    onChange(cleaned);
    if (cleaned.length === length) onComplete?.(cleaned);
  }

  function handleChange(i: number, raw: string) {
    const d = raw.replace(/\D/g, '');
    if (!d) return;
    // Typing into a box overwrites that position, then advances. Multi-char
    // input (e.g. mobile autofill of the whole code) fans out across the boxes.
    const arr = value.split('');
    if (d.length > 1) {
      commit((value.slice(0, i) + d).slice(0, length));
      focusBox(i + d.length);
      return;
    }
    arr[i] = d;
    const next = arr.join('').slice(0, length);
    commit(next);
    focusBox(i + 1);
  }

  function handleKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const arr = value.split('');
      if (arr[i]) {
        arr[i] = '';
        commit(arr.join(''));
      } else {
        focusBox(i - 1);
        const prev = value.split('');
        prev[i - 1] = '';
        commit(prev.join(''));
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focusBox(i - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      focusBox(i + 1);
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text');
    commit(pasted);
    const filled = pasted.replace(/\D/g, '').slice(0, length).length;
    focusBox(filled);
  }

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}
    >
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={el => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={length}
          disabled={disabled}
          aria-label={`${ariaLabel} digit ${i + 1}`}
          value={digits[i] ?? ''}
          autoFocus={autoFocus && i === 0}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={e => e.target.select()}
          style={{
            flex: 1, minWidth: 0, height: 52, textAlign: 'center',
            fontSize: 22, fontWeight: 800, fontFamily: 'monospace',
            color: 'var(--text)', caretColor: 'var(--gold)',
            background: 'var(--surface)',
            border: `1px solid ${digits[i] ? 'var(--gold)' : 'var(--line)'}`,
            borderRadius: 12, outline: 'none', boxSizing: 'border-box',
            transition: 'border-color .15s', opacity: disabled ? 0.6 : 1,
          }}
        />
      ))}
    </div>
  );
}
