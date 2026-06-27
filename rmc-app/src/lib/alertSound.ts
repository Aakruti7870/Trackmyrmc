// Audible alert chimes for in-app notifications.
//
// Sounds are synthesised with the Web Audio API so there is no asset to ship,
// they work offline, and they stay tiny. Playback is best-effort: if the
// browser has no AudioContext (e.g. jsdom under tests) or audio is still locked
// by the autoplay policy, every call simply no-ops instead of throwing.
//
// The user can mute alert sounds; the preference lives in localStorage so it
// persists per device, mirroring how the theme preference is stored.

import type { ToastType } from './toast';

const STORAGE_KEY = 'rmc_alert_sound';

export function isAlertSoundEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setAlertSoundEnabled(on: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
  } catch {
    /* storage unavailable — preference just won't persist */
  }
}

type AudioContextCtor = typeof AudioContext;

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor: AudioContextCtor | undefined =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) {
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
  }
  return ctx;
}

// Browsers suspend the AudioContext until a user gesture. Call this from a real
// click/keydown handler (once) so later, event-driven chimes can play.
export function unlockAlertSound(): void {
  const ac = getCtx();
  if (ac && ac.state === 'suspended') {
    void ac.resume().catch(() => {});
  }
}

function tone(ac: AudioContext, freq: number, start: number, dur: number, peak: number): void {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

// Distinct chimes per severity: a gentle two-note for info, a rising arpeggio
// for success, and an urgent repeated tone for errors/critical alerts.
function notesFor(type: ToastType): Array<[freq: number, offset: number, dur: number]> {
  switch (type) {
    case 'error':
      return [
        [880, 0, 0.12],
        [880, 0.16, 0.12],
        [880, 0.32, 0.16],
      ];
    case 'success':
      return [
        [523.25, 0, 0.12],
        [659.25, 0.1, 0.12],
        [783.99, 0.2, 0.18],
      ];
    default:
      return [
        [783.99, 0, 0.13],
        [987.77, 0.12, 0.2],
      ];
  }
}

export function playAlertSound(type: ToastType = 'info'): void {
  if (!isAlertSoundEnabled()) return;
  const ac = getCtx();
  if (!ac) return;
  try {
    if (ac.state === 'suspended') void ac.resume().catch(() => {});
    const now = ac.currentTime + 0.01;
    const peak = type === 'error' ? 0.16 : 0.12;
    for (const [freq, offset, dur] of notesFor(type)) {
      tone(ac, freq, now + offset, dur, peak);
    }
  } catch {
    /* audio not permitted yet — ignore */
  }
}
