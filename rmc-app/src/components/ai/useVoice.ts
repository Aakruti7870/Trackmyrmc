import { useCallback, useEffect, useRef, useState } from 'react';
import { aiApi } from '@/lib/api';

// Voice in/out for the help agent.
//
// Speech-to-text has two paths. The preferred path records the clip with
// MediaRecorder and transcribes it server-side (Gemini) — one consistent
// recogniser on every browser, including ones with no native SpeechRecognition
// (e.g. Firefox/older mobile). When the server audio service is unavailable it
// falls back to the browser-native Web Speech API; when neither exists the
// control hides and the user simply types.
//
// Text-to-speech uses the browser's speechSynthesis. The Replit Gemini
// integration does not expose audio output, so there is no server voice to swap
// in here yet; we pick the best available English voice and tune delivery
// (rate, pitch, volume) for a calm, natural-sounding assistant experience.

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

function hasMediaRecorder(): boolean {
  return typeof window !== 'undefined'
    && typeof window.MediaRecorder !== 'undefined'
    && typeof navigator !== 'undefined'
    && !!navigator.mediaDevices?.getUserMedia;
}

// Pick a recorder container the server (Gemini) accepts; browsers disagree on
// what they can produce, so probe in preference order and let MediaRecorder
// choose its default when none match.
function pickRecorderMime(): string | undefined {
  if (typeof window === 'undefined' || typeof window.MediaRecorder === 'undefined') return undefined;
  const candidates = [
    'audio/webm;codecs=opus', 'audio/webm',
    'audio/ogg;codecs=opus', 'audio/ogg',
    'audio/mp4',
  ];
  for (const c of candidates) {
    if (window.MediaRecorder.isTypeSupported?.(c)) return c;
  }
  return undefined;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result ?? '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export interface SpeechToText {
  supported: boolean;
  listening: boolean;
  // True while a recorded clip is being transcribed by the server.
  transcribing: boolean;
  start: () => void;
  stop: () => void;
}

export function useSpeechToText(
  onFinal: (text: string) => void,
  opts?: { serverEnabled?: boolean },
): SpeechToText {
  const serverEnabled = !!opts?.serverEnabled;
  const browserSupported = typeof window !== 'undefined' && !!getRecognitionCtor();
  const useServer = serverEnabled && hasMediaRecorder();
  const supported = useServer || browserSupported;

  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);

  const onFinalRef = useRef(onFinal);
  useEffect(() => { onFinalRef.current = onFinal; }, [onFinal]);

  // Browser-native recogniser state.
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // Server recorder state.
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  // ---- Server path ----------------------------------------------------------
  const startServer = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickRecorderMime();
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stopTracks();
        const type = rec.mimeType || mime || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type });
        chunksRef.current = [];
        recorderRef.current = null;
        if (!blob.size) { setTranscribing(false); return; }
        setTranscribing(true);
        try {
          const base64 = await blobToBase64(blob);
          const { text } = await aiApi.transcribe(base64, blob.type || type);
          if (text && text.trim()) onFinalRef.current(text.trim());
        } catch {
          // Swallow — the user can still type. A toast here would be noisy for a
          // best-effort convenience feature.
        } finally {
          setTranscribing(false);
        }
      };
      rec.start();
      recorderRef.current = rec;
      setListening(true);
    } catch {
      stopTracks();
      setListening(false);
    }
  }, [stopTracks]);

  const stopServer = useCallback(() => {
    setListening(false);
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') {
      try { rec.stop(); } catch { stopTracks(); }
    } else {
      stopTracks();
    }
  }, [stopTracks]);

  // ---- Browser-native path --------------------------------------------------
  const startNative = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = 'en-IN';
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e) => {
      const transcript = Array.from({ length: e.results.length }, (_, i) => e.results[i][0].transcript).join(' ').trim();
      if (transcript) onFinalRef.current(transcript);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, []);

  const stopNative = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const start = useCallback(() => {
    if (transcribing) return;
    if (useServer) void startServer();
    else startNative();
  }, [useServer, startServer, startNative, transcribing]);

  const stop = useCallback(() => {
    if (useServer) stopServer();
    else stopNative();
  }, [useServer, stopServer, stopNative]);

  // Clean up any in-flight capture on unmount.
  useEffect(() => () => {
    recognitionRef.current?.abort();
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') { try { rec.stop(); } catch { /* ignore */ } }
    streamRef.current?.getTracks().forEach(t => t.stop());
  }, []);

  return { supported, listening, transcribing, start, stop };
}

export type VoiceGender = 'female' | 'male';

const VOICE_GENDER_KEY = 'rmc_ai_voice_gender';

// Voice matching heuristics for common TTS engines (Google, Apple, Microsoft,
// Samsung, Indian-English voices). \bmale\b does NOT match "female".
const FEMALE_RE = /\bfemale\b|Samantha|Victoria|Karen|Tessa|Veena|Fiona|Moira|Zira|Susan|Catherine|Heera|Swara|Kalpana|Google US English/i;
const MALE_RE = /\bmale\b|Daniel|Alex|Fred|David|Mark|Rishi|Aaron|George|James|Ravi|Hemant|Prabhat|Madhur/i;

// Modern engines ship high-quality neural/natural voices alongside robotic ones.
// Their names carry identifiers like "Neural", "Natural", "Online", "Enhanced".
const NEURAL_RE = /natural|neural|online|premium|enhanced|google|siri/i;
// Indian-English locale detection
const LOCALE_IN_RE = /^en[-_]IN/i;

function readGenderPref(): VoiceGender {
  if (typeof window === 'undefined') return 'female';
  try {
    return localStorage.getItem(VOICE_GENDER_KEY) === 'male' ? 'male' : 'female';
  } catch {
    return 'female';
  }
}

// Score a voice candidate. Higher = better.
// Priority: (1) neural/natural quality, (2) Indian English locale, (3) gender match.
function scoreVoice(v: SpeechSynthesisVoice, gender: VoiceGender): number {
  const wantRe = gender === 'male' ? MALE_RE : FEMALE_RE;
  const otherRe = gender === 'male' ? FEMALE_RE : MALE_RE;
  let n = 0;

  // Quality tier — neural voices sound noticeably better
  if (NEURAL_RE.test(v.name)) n += 10;

  // Indian English preferred (matches the app's audience)
  if (LOCALE_IN_RE.test(v.lang)) n += 6;
  else if (/^en/i.test(v.lang)) n += 2;

  // Gender match
  if (wantRe.test(v.name)) n += 5;
  else if (!otherRe.test(v.name)) n += 1; // neutral — not wrong gender at least

  // Cloud/non-local voices tend to be higher quality
  if (v.localService === false) n += 1;

  return n;
}

export function useTextToSpeech() {
  const [speaking, setSpeaking] = useState(false);
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const [voiceGender, setVoiceGenderState] = useState<VoiceGender>(readGenderPref);
  // Mirror gender into a ref so the stable speak callback always reads latest
  // without being recreated on every toggle.
  const genderRef = useRef(voiceGender);
  useEffect(() => { genderRef.current = voiceGender; }, [voiceGender]);

  const setVoiceGender = useCallback((g: VoiceGender) => {
    setVoiceGenderState(g);
    try { localStorage.setItem(VOICE_GENDER_KEY, g); } catch { /* ignore */ }
  }, []);

  // Choose the best English voice at speak-time (lazy — voices load async on
  // many platforms and may not be available at mount).
  const pickVoice = useCallback((gender: VoiceGender): SpeechSynthesisVoice | null => {
    if (!supported) return null;
    const all = window.speechSynthesis.getVoices();
    if (!all.length) return null;

    // Prefer English voices; fall back to all if none found
    const en = all.filter(v => /^en/i.test(v.lang));
    const pool = en.length ? en : all;

    return [...pool].sort((a, b) => scoreVoice(b, gender) - scoreVoice(a, gender))[0] ?? null;
  }, [supported]);

  const speak = useCallback((text: string) => {
    if (!supported || !text.trim()) return;
    window.speechSynthesis.cancel();

    const gender = genderRef.current;
    const utter = new SpeechSynthesisUtterance(text);
    const voice = pickVoice(gender);

    if (voice) {
      utter.voice = voice;
      utter.lang = voice.lang;
    } else {
      utter.lang = 'en-IN';
    }

    const isNeural = voice ? NEURAL_RE.test(voice.name) : false;
    const isIN = voice ? LOCALE_IN_RE.test(voice.lang) : false;
    const genderMatched = voice
      ? (gender === 'male' ? MALE_RE : FEMALE_RE).test(voice.name)
      : false;

    // Delivery tuning — aim for a calm, clear, assistant-like voice:
    // • Rate slightly under real-time is easier to follow and sounds less rushed.
    //   Neural voices already pace well; slow them only slightly.
    //   Basic voices need a gentler rate to avoid the "robot reading fast" effect.
    // • Pitch: keep natural pitch when the gender matches or it's a neural voice;
    //   nudge only when needed to preserve male/female distinction on single-voice
    //   platforms (common on Android WebView).
    // • Volume: full. Anything less causes fade-out complaints.
    if (isNeural) {
      utter.rate = isIN ? 0.92 : 0.94;   // neural voices at near-native tempo
      utter.pitch = genderMatched ? 1.0 : (gender === 'male' ? 0.90 : 1.08);
    } else {
      utter.rate = 0.88;                  // basic voices benefit from slower read
      utter.pitch = gender === 'male' ? 0.82 : 1.15;
    }
    utter.volume = 1.0;

    utter.onstart = () => setSpeaking(true);
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utter);
  }, [supported, pickVoice]);

  const cancel = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  useEffect(() => () => { if (supported) window.speechSynthesis.cancel(); }, [supported]);

  return { supported, speaking, speak, cancel, voiceGender, setVoiceGender };
}
