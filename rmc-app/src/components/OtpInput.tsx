import { useEffect, useRef, type ClipboardEvent } from 'react';

// A one-time-code input rendered as a SINGLE box: one input the user (or the
// mobile keyboard's code autofill) fills in one go — far friendlier on small
// screens than six separate digit boxes. The parent owns the value (a string
// of up to `length` digits); this component strips non-digits, caps the
// length, and fires onComplete once the full code is present. Used by the
// customer phone flow and the staff / super-admin code flows so every OTP
// entry looks and behaves alike.
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
  const ref = useRef<HTMLInputElement | null>(null);
  const digits = value.replace(/\D/g, '').slice(0, length);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  function commit(next: string) {
    const cleaned = next.replace(/\D/g, '').slice(0, length);
    onChange(cleaned);
    if (cleaned.length === length && cleaned !== digits) onComplete?.(cleaned);
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    commit(e.clipboardData.getData('text'));
  }

  return (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={length}
      disabled={disabled}
      aria-label={ariaLabel}
      placeholder={'•'.repeat(length)}
      value={digits}
      onChange={e => commit(e.target.value)}
      onPaste={handlePaste}
      style={{
        width: '100%', height: 56, boxSizing: 'border-box',
        textAlign: 'center', letterSpacing: digits ? '0.6em' : '0.35em',
        textIndent: digits ? '0.6em' : '0.35em',
        fontSize: 24, fontWeight: 800, fontFamily: 'monospace',
        color: 'var(--text)', caretColor: 'var(--gold)',
        background: 'var(--surface)',
        border: `1px solid ${digits.length === length ? 'var(--gold)' : 'var(--line)'}`,
        borderRadius: 12, outline: 'none',
        transition: 'border-color .15s', opacity: disabled ? 0.6 : 1,
      }}
    />
  );
}
