// Shared input styling for the login screen, kept in a non-component module so
// the component file (loginUi.tsx) can satisfy react-refresh/only-export-components.

export const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px 11px 38px',
  background: 'var(--surface)', border: '1px solid var(--line)',
  borderRadius: 10, color: 'var(--text)', fontSize: 14, outline: 'none',
  boxSizing: 'border-box',
};
