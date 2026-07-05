// Shared input styling for the login screen, kept in a non-component module so
// the component file (loginUi.tsx) can satisfy react-refresh/only-export-components.

export const inputStyle: React.CSSProperties = {
  width: '100%', padding: '13px 14px 13px 40px',
  background: 'var(--surface)',
  border: '1.5px solid color-mix(in srgb, var(--gold) 32%, var(--line))',
  borderRadius: 11, color: 'var(--text)', fontSize: 15, fontWeight: 500, outline: 'none',
  boxSizing: 'border-box',
  boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.22)',
};
