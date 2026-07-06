// Audible alert chimes for in-app notifications.
//
// Sounds are synthesised with the Web Audio API so there is no asset to ship,
// they work offline, and they stay tiny. Playback is best-effort: if the
// browser has no AudioContext (e.g. jsdom under tests) or audio is still locked
// by the autoplay policy, every call simply no-ops instead of throwing.
//
// The user can mute alert sounds and pick which sound plays; both preferences
// live in localStorage so they persist per device, mirroring the theme setting.

import type { ToastType } from './toast';

const STORAGE_KEY = 'rmc_alert_sound';
const CHOICE_KEY = 'rmc_alert_sound_choice';

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

// The selectable alert sounds. Each is a distinct, deliberately loud and
// lengthy character so an alert is hard to miss even across a noisy plant.
export type AlertSoundChoice = 'chime' | 'bell' | 'alert';

export const ALERT_SOUND_CHOICES: ReadonlyArray<{
  value: AlertSoundChoice;
  label: string;
  description: string;
}> = [
  { value: 'chime', label: 'Chime', description: 'Bright rising multi-note chime' },
  { value: 'bell', label: 'Bell', description: 'Warm bell with a long ring' },
  { value: 'alert', label: 'Alert', description: 'Loud, urgent repeating tone' },
];

const DEFAULT_CHOICE: AlertSoundChoice = 'chime';

function isChoice(v: string | null): v is AlertSoundChoice {
  return v === 'chime' || v === 'bell' || v === 'alert';
}

export function getAlertSoundChoice(): AlertSoundChoice {
  try {
    const v = localStorage.getItem(CHOICE_KEY);
    return isChoice(v) ? v : DEFAULT_CHOICE;
  } catch {
    return DEFAULT_CHOICE;
  }
}

export function setAlertSoundChoice(choice: AlertSoundChoice): void {
  try {
    localStorage.setItem(CHOICE_KEY, choice);
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

// A single note. `mul` scales this note's loudness relative to the sound's peak
// (used to layer quieter harmonics under a fundamental for a fuller tone).
interface Note {
  freq: number;
  offset: number;
  dur: number;
  mul?: number;
}

interface SoundSpec {
  wave: OscillatorType;
  peak: number;
  notes: Note[];
}

function tone(ac: AudioContext, wave: OscillatorType, freq: number, start: number, dur: number, peak: number): void {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = wave;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(start);
  osc.stop(start + dur + 0.03);
}

// Each sound choice defines its own note sequence per severity. All three are
// louder (higher peak gain) and longer than the original chime so alerts are
// easy to notice; error variants add extra urgent repeats.
function specFor(choice: AlertSoundChoice, type: ToastType): SoundSpec {
  if (choice === 'bell') {
    // Warm triangle bell: a fundamental with layered octave partials and a long
    // exponential ring.
    const bell = (base: Note[]): Note[] =>
      base.flatMap(n => [
        { ...n, mul: 1 },
        { freq: n.freq * 2, offset: n.offset, dur: n.dur * 0.7, mul: 0.5 },
        { freq: n.freq * 3, offset: n.offset, dur: n.dur * 0.5, mul: 0.28 },
      ]);
    switch (type) {
      case 'error':
        return { wave: 'triangle', peak: 0.34, notes: bell([
          { freq: 466.16, offset: 0, dur: 0.6 },
          { freq: 466.16, offset: 0.34, dur: 0.6 },
          { freq: 587.33, offset: 0.68, dur: 0.9 },
        ]) };
      case 'success':
        return { wave: 'triangle', peak: 0.32, notes: bell([
          { freq: 659.25, offset: 0, dur: 0.55 },
          { freq: 987.77, offset: 0.16, dur: 0.9 },
        ]) };
      default:
        return { wave: 'triangle', peak: 0.32, notes: bell([
          { freq: 587.33, offset: 0, dur: 0.55 },
          { freq: 880, offset: 0.16, dur: 0.9 },
        ]) };
    }
  }

  if (choice === 'alert') {
    // Loud, urgent square-wave beeps that repeat.
    switch (type) {
      case 'error':
        return { wave: 'square', peak: 0.26, notes: [
          { freq: 987.77, offset: 0, dur: 0.16 },
          { freq: 987.77, offset: 0.22, dur: 0.16 },
          { freq: 987.77, offset: 0.44, dur: 0.16 },
          { freq: 1244.51, offset: 0.66, dur: 0.32 },
        ] };
      case 'success':
        return { wave: 'square', peak: 0.24, notes: [
          { freq: 783.99, offset: 0, dur: 0.16 },
          { freq: 1046.5, offset: 0.2, dur: 0.16 },
          { freq: 1318.51, offset: 0.4, dur: 0.34 },
        ] };
      default:
        return { wave: 'square', peak: 0.24, notes: [
          { freq: 880, offset: 0, dur: 0.18 },
          { freq: 880, offset: 0.26, dur: 0.18 },
          { freq: 1108.73, offset: 0.52, dur: 0.34 },
        ] };
    }
  }

  // Default: bright sine "chime" — a rising arpeggio with an echo tail.
  switch (type) {
    case 'error':
      return { wave: 'sine', peak: 0.32, notes: [
        { freq: 880, offset: 0, dur: 0.18 },
        { freq: 880, offset: 0.22, dur: 0.18 },
        { freq: 880, offset: 0.44, dur: 0.18 },
        { freq: 1046.5, offset: 0.66, dur: 0.36 },
      ] };
    case 'success':
      return { wave: 'sine', peak: 0.3, notes: [
        { freq: 523.25, offset: 0, dur: 0.22 },
        { freq: 659.25, offset: 0.13, dur: 0.22 },
        { freq: 783.99, offset: 0.26, dur: 0.22 },
        { freq: 1046.5, offset: 0.39, dur: 0.5 },
      ] };
    default:
      return { wave: 'sine', peak: 0.3, notes: [
        { freq: 783.99, offset: 0, dur: 0.24 },
        { freq: 987.77, offset: 0.15, dur: 0.24 },
        { freq: 1174.66, offset: 0.3, dur: 0.34 },
        { freq: 987.77, offset: 0.55, dur: 0.42 },
      ] };
  }
}

// Play an alert sound. `choiceOverride` lets the settings UI preview a specific
// sound regardless of the saved preference.
export function playAlertSound(type: ToastType = 'info', choiceOverride?: AlertSoundChoice): void {
  if (!isAlertSoundEnabled()) return;
  const ac = getCtx();
  if (!ac) return;
  try {
    if (ac.state === 'suspended') void ac.resume().catch(() => {});
    const now = ac.currentTime + 0.01;
    const spec = specFor(choiceOverride ?? getAlertSoundChoice(), type);
    for (const n of spec.notes) {
      tone(ac, spec.wave, n.freq, now + n.offset, n.dur, spec.peak * (n.mul ?? 1));
    }
  } catch {
    /* audio not permitted yet — ignore */
  }
}
