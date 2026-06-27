---
name: RMC in-app alert sounds
description: How audible alert chimes hook into toasts and the constraints that keep tests/autoplay working.
---

In-app alert chimes are synthesised with the Web Audio API (no asset file) and play from
`ToastProvider.showToast` for EVERY toast, so any SSE-driven alert routed through `showToast`
chimes automatically. User mute toggle persists in localStorage `rmc_alert_sound` (`'off'` = muted).

**Why / constraints (non-obvious):**
- **jsdom has no `AudioContext`** — the sound layer MUST feature-detect (`window.AudioContext || webkitAudioContext`) and no-op when absent, or the whole toast/Layout test suite crashes. Never assume audio APIs exist.
- **Autoplay policy** locks audio until a real user gesture. ToastProvider registers one-time
  `pointerdown`/`keydown` listeners that call an `unlock` (resume the context); event-driven chimes
  before any gesture stay silent by design.
- Reading the persisted toggle into state must use lazy `useState(() => ...)`, NOT a `useEffect`
  setState — the latter trips the enforced `react-hooks/set-state-in-effect` lint error.
- Sound plays on confirmation toasts too (UX tradeoff, accepted); if noise complaints arise, add an
  optional `silent` flag to `showToast`.
- Web push (out-of-app) sound is OS-controlled; we can only add `vibrate` to `showNotification`
  options in `push-sw.js`. A custom push ringtone needs the native app.
