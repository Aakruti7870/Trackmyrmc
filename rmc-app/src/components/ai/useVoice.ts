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
// in here yet; we pick a stable English voice and fixed delivery so the spoken
// reply is as consistent as the platform allows.

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

export function useTextToSpeech() {
  const [speaking, setSpeaking] = useState(false);
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  // Choose a stable English voice once so the spoken reply is as consistent as
  // the browser allows. Voices load asynchronously, so resolve lazily at speak
  // time rather than caching a possibly-empty list.
  const pickVoice = useCallback((): SpeechSynthesisVoice | null => {
    if (!supported) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;
    const byName = (re: RegExp) => voices.find(v => re.test(v.name));
    return (
      byName(/Google US English/i)
      || byName(/Google UK English Female/i)
      || voices.find(v => /^en[-_]IN/i.test(v.lang))
      || voices.find(v => /^en[-_]GB/i.test(v.lang))
      || voices.find(v => /^en[-_]US/i.test(v.lang))
      || voices.find(v => /^en/i.test(v.lang))
      || voices[0]
      || null
    );
  }, [supported]);

  const speak = useCallback((text: string) => {
    if (!supported || !text.trim()) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    const voice = pickVoice();
    if (voice) { utter.voice = voice; utter.lang = voice.lang; }
    else utter.lang = 'en-IN';
    utter.rate = 1;
    utter.pitch = 1;
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

  return { supported, speaking, speak, cancel };
}
