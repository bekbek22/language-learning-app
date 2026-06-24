'use client';

import { useEffect, useRef, useState } from 'react';
import SpeakButton from './SpeakButton';
import Ruby, { type ReadingSegment } from './Ruby';
import { getLocale, onLocaleChange, bcp47For, type LocaleCode } from '../lib/locale';

type Status = 'idle' | 'listening' | 'processing' | 'done';

type Target = { word: string; reduced: string[]; sound: string };
// `segments` carries the per-word reading (Pinyin / Furigana) for zh/ja so
// beginners can read the sentence aloud. `romaji` is a full Latin-alphabet
// transcription (Japanese) for learners who can't yet read kana. Both are
// absent for English (plain rendering).
type Phrase = { sentence: string; targets: Target[]; segments?: ReadingSegment[]; romaji?: string };

// ── Fallback pool (used when Gemini is unavailable) ──────────────────────────
const FALLBACK: Phrase[] = [
  {
    sentence: 'He likes to walk past the market.',
    targets: [
      { word: 'likes',  reduced: ['like'],        sound: '-s'  },
      { word: 'past',   reduced: ['pass', 'pas'], sound: '-t'  },
      { word: 'market', reduced: ['marke'],        sound: '-t'  },
    ],
  },
  {
    sentence: 'She watched the movie last night.',
    targets: [
      { word: 'watched', reduced: ['watch'],       sound: '-ed' },
      { word: 'last',    reduced: ['las', 'lass'], sound: '-t'  },
    ],
  },
  {
    sentence: 'The girls read the right books.',
    targets: [
      { word: 'girls', reduced: ['girl'],          sound: '-s'  },
      { word: 'read',  reduced: ['lead', 'led'],   sound: 'R→L' },
      { word: 'right', reduced: ['light', 'lite'], sound: 'R→L' },
      { word: 'books', reduced: ['book'],          sound: '-s'  },
    ],
  },
  {
    sentence: 'The kids played outside in the cold wind.',
    targets: [
      { word: 'kids',   reduced: ['kid'],  sound: '-s'  },
      { word: 'played', reduced: ['play'], sound: '-ed' },
      { word: 'cold',   reduced: ['col'],  sound: '-d'  },
      { word: 'wind',   reduced: ['win'],  sound: '-d'  },
    ],
  },
  {
    sentence: 'He rode a red bike past the lake.',
    targets: [
      { word: 'rode', reduced: ['lode'],        sound: 'R→L' },
      { word: 'red',  reduced: ['led'],         sound: 'R→L' },
      { word: 'past', reduced: ['pass', 'pas'], sound: '-t'  },
    ],
  },
  {
    sentence: 'She called her friends and laughed all night.',
    targets: [
      { word: 'called',  reduced: ['call'],   sound: '-d'  },
      { word: 'friends', reduced: ['friend'], sound: '-s'  },
      { word: 'laughed', reduced: ['laugh'],  sound: '-t'  },
      { word: 'night',   reduced: ['nigh'],   sound: '-t'  },
    ],
  },
];

// ── Fisher-Yates shuffle of indices with seam-guard ──────────────────────────
function shuffledIndices(len: number, avoidLast: number): number[] {
  const arr = Array.from({ length: len }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  if (arr.length > 1 && arr[arr.length - 1] === avoidLast) {
    [arr[arr.length - 1], arr[arr.length - 2]] = [arr[arr.length - 2], arr[arr.length - 1]];
  }
  return arr;
}

function fisherYates<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Analysis ─────────────────────────────────────────────────────────────────
type WordResult = { word: string; sound: string; status: 'correct' | 'dropped' | 'unclear' };

function analyze(transcript: string, targets: Target[], lang: LocaleCode): WordResult[] {
  // English: word-level match with reduced-form detection for dropped sounds.
  if (lang === 'en') {
    const words = transcript.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/);
    return targets.map(({ word, reduced, sound }) => {
      if (words.includes(word)) return { word, sound, status: 'correct' };
      if (reduced.some((r) => words.includes(r))) return { word, sound, status: 'dropped' };
      return { word, sound, status: 'unclear' };
    });
  }
  // zh/ja: no word spacing, so match each target as a substring of the transcript.
  const norm = transcript.toLowerCase().replace(/\s+/g, '');
  return targets.map(({ word, sound }) => {
    const w = word.toLowerCase().replace(/\s+/g, '');
    return { word, sound, status: norm.includes(w) ? 'correct' : 'unclear' };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
export default function SpeakingModule() {
  const [currentPhrase, setCurrentPhrase] = useState<Phrase | null>(null);
  const [isLoading, setIsLoading]         = useState(true); // only true on initial mount
  const [status, setStatus]               = useState<Status>('idle');
  const [transcript, setTranscript]       = useState('');
  const [results, setResults]             = useState<WordResult[]>([]);
  const [isStarting, setIsStarting]       = useState(false); // true between tap and mic going live
  const [hint, setHint]                   = useState<string | null>(null); // transient mic feedback / errors
  const [lang, setLang]                   = useState<LocaleCode>('en');
  const langRef       = useRef<LocaleCode>('en'); // current locale for background refills + mic

  // Live SpeechRecognition instance + manual-toggle bookkeeping. Kept in refs so
  // the unmount / phrase-change cleanup can abort and fully release the mic.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const transcriptRef  = useRef('');    // aggregated transcript across all final results
  const isStopping     = useRef(false); // guards the explicit-stop transition

  // Hard-release the mic: drop handlers, abort the session, reset toggle state.
  // Safe to call repeatedly and when nothing is active.
  function teardownRecognition() {
    isStopping.current = false;
    const r = recognitionRef.current;
    if (r) {
      r.onstart = r.onspeechstart = r.onresult = r.onerror = r.onend = null;
      try { r.abort(); } catch { /* already stopped */ }
      recognitionRef.current = null;
    }
  }

  // AI batch queue
  const aiQueue       = useRef<Phrase[]>([]);
  const isRefilling   = useRef(false);

  // Fallback shuffle queue
  const fbQueue       = useRef<number[]>([]);
  const fbLastIdx     = useRef(-1);

  function nextFallback(): Phrase {
    if (fbQueue.current.length === 0) {
      fbQueue.current = shuffledIndices(FALLBACK.length, fbLastIdx.current);
    }
    const idx = fbQueue.current.pop()!;
    fbLastIdx.current = idx;
    return FALLBACK[idx];
  }

  async function fetchBatch(l: LocaleCode): Promise<Phrase[]> {
    const res = await fetch(`/api/phrase?lang=${l}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('batch fetch failed');
    return res.json();
  }

  async function refillInBackground() {
    if (isRefilling.current) return;
    isRefilling.current = true;
    try {
      const batch = await fetchBatch(langRef.current);
      aiQueue.current.push(...fisherYates(batch));
    } catch {
      // silent — fallback handles empty queue
    } finally {
      isRefilling.current = false;
    }
  }

  function popNext(): Phrase {
    // Trigger background refill when queue runs low
    if (aiQueue.current.length <= 2 && !isRefilling.current) {
      refillInBackground();
    }
    return aiQueue.current.length > 0
      ? aiQueue.current.shift()!
      : nextFallback();
  }

  // Reflect the persisted target language after mount and stay in sync when it
  // changes from the header selector.
  useEffect(() => {
    setLang(getLocale());
    return onLocaleChange(() => setLang(getLocale()));
  }, []);

  // Load (and reload on language switch): release any live mic, reset the
  // queues, refetch from the active locale, and show the first phrase.
  // `cancelled` drops a stale in-flight fetch when the language changes mid-request.
  useEffect(() => {
    langRef.current = lang;
    let cancelled = false;
    teardownRecognition();
    setIsStarting(false);
    setStatus('idle');
    setHint(null);
    setTranscript('');
    setResults([]);
    setIsLoading(true);
    aiQueue.current = [];
    fbQueue.current = [];
    fbLastIdx.current = -1;
    (async () => {
      try {
        const batch = await fetchBatch(lang);
        if (!cancelled) aiQueue.current = fisherYates(batch);
      } catch {
        // fallback queue will serve
      }
      if (!cancelled) {
        setCurrentPhrase(popNext());
        setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  // Release the mic whenever the phrase changes or the component unmounts, so a
  // started session never leaks into the next phrase or lingers in the background.
  useEffect(() => {
    return () => teardownRecognition();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPhrase]);

  function nextPhrase() {
    teardownRecognition();
    setIsStarting(false);
    setCurrentPhrase(popNext());
    setStatus('idle');
    setHint(null);
    setTranscript('');
    setResults([]);
  }

  function startListening() {
    if (!currentPhrase) return;
    // Guard against double-taps and taps during a start/stop transition: a
    // session is being created (isStarting), is live (status), or hasn't been
    // torn down yet (ref). Any of these means "ignore this tap".
    if (isStarting || status === 'listening' || recognitionRef.current) return;

    const SR =
      typeof window !== 'undefined' &&
      ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    if (!SR) {
      alert('Speech Recognition is not supported. Please use Chrome or Edge.');
      return;
    }

    setIsStarting(true);
    setHint(null);
    isStopping.current = false;
    transcriptRef.current = '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition = new SR() as any;
    recognitionRef.current = recognition;
    // Strictly bind the recognizer to the active module's sub-tag (en-US / ja-JP /
    // zh-CN) so it never falls back to the OS default language and mis-hears.
    recognition.lang = bcp47For(langRef.current);
    // Manual toggle: keep capturing through pauses and hesitations. The browser
    // will not auto-stop on silence — only an explicit stopListening() ends it.
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1; // we only score the top transcript

    recognition.onstart = () => {
      setIsStarting(false);
      setStatus('listening');
      setHint('🎧 กำลังฟัง… พูดได้เลย — Listening… speak now');
    };
    recognition.onspeechstart = () => {
      setHint('🗣️ ได้ยินแล้ว… — Got it, keep going');
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (e: any) => {
      // Rebuild the full transcript from every final segment so nothing the
      // learner said is lost across the multiple result events of a long take.
      let full = '';
      for (let i = 0; i < e.results.length; i++) full += e.results[i][0].transcript;
      transcriptRef.current = full.trim();
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (e: any) => {
      // onend always follows and is the single commit point. Capture a friendly,
      // specific reason here so the learner knows whether the mic even heard them.
      setIsStarting(false);
      const err = e?.error;
      if (err === 'not-allowed' || err === 'service-not-allowed') {
        setHint('🔒 ไมโครโฟนถูกปิดกั้น — Microphone blocked. Allow mic access in the address bar, then try again.');
      } else if (err === 'audio-capture') {
        setHint('🎙️ ไม่พบไมโครโฟน — No microphone found. Check your device, or move on with “New Sentence”.');
      } else if (err === 'no-speech') {
        setHint('🤔 ไม่ได้ยินเสียงพูด ลองพูดให้ชัดขึ้น — No speech detected, try speaking clearly.');
      } else if (err === 'network') {
        // Chrome streams audio to Google's speech servers; this fires (usually
        // within ~1s) when that endpoint is unreachable — common on Brave, on
        // Firefox/Safari (no real support), or behind a restrictive network/VPN.
        setHint('📡 เชื่อมต่อบริการเสียงไม่ได้ — Speech service unreachable. Use Chrome or Edge with a normal internet connection, or tap “Skip”.');
      } else if (err !== 'aborted') {
        // Surface the raw code so any unhandled case is diagnosable at a glance.
        setHint(`⚠️ การฟังขัดข้อง (${err ?? 'unknown'}) — Recognition error. Please try again, or tap “Skip”.`);
      }
    };
    recognition.onend = () => {
      // Single commit point: fires after the explicit stop() (or if the engine
      // ends for any reason). Score the aggregated transcript, else return to idle
      // and keep any hint set above so the learner gets clear next-step guidance.
      recognitionRef.current = null;
      isStopping.current = false;
      setIsStarting(false);
      const text = transcriptRef.current;
      if (text) {
        setTranscript(text);
        setResults(analyze(text, currentPhrase.targets, langRef.current));
        setStatus('done');
        setHint(null);
      } else {
        setStatus('idle');
        setHint((h) => h ?? '🤔 ไม่ได้ยินเสียงพูด — Didn’t catch that. Tap to speak again, or pick a new sentence.');
      }
    };

    try {
      recognition.start();
    } catch {
      // start() throws if a prior session is still tearing down — reset cleanly.
      teardownRecognition();
      setIsStarting(false);
      setStatus('idle');
    }
  }

  function stopListening() {
    // Second click — explicit "I'm done". Guard against double-stops and against
    // stopping before the session is actually live.
    if (isStopping.current || !recognitionRef.current || status !== 'listening') return;
    isStopping.current = true;
    setStatus('processing'); // brief beat while the engine flushes final audio
    setHint('⏳ กำลังประมวลผล… — Processing…');
    try {
      recognitionRef.current.stop(); // flush final audio → onresult → onend commits
    } catch {
      teardownRecognition();
      setStatus('idle');
      setHint(null);
    }
  }

  function retry() {
    teardownRecognition();
    setTranscript('');
    setResults([]);
    setStatus('idle');
    setHint(null);
  }

  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-200/60 dark:bg-slate-900 dark:ring-slate-800 dark:hover:shadow-black/40">
      {/* Header */}
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 text-xl shadow-md shadow-blue-500/30">
          🗣️
        </div>
        <div>
          <p className="text-lg font-bold text-slate-800 dark:text-slate-100">การสนทนา</p>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-400">Conversation</p>
        </div>
      </div>

      {/* Phrase area */}
      <div className="mb-5 flex min-h-[84px] items-center rounded-2xl bg-gradient-to-br from-blue-50/70 to-indigo-50/40 px-5 py-4 ring-1 ring-blue-100/70 dark:from-blue-950/40 dark:to-indigo-950/30 dark:ring-blue-900/40">
        {isLoading ? (
          <div className="flex items-center gap-2 text-blue-400">
            <span className="h-2 w-2 animate-bounce rounded-full bg-blue-400 [animation-delay:-0.3s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-blue-400 [animation-delay:-0.15s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-blue-400" />
            <span className="ml-1 text-sm">กำลังสร้างประโยค…</span>
          </div>
        ) : currentPhrase ? (
          <div className="flex w-full items-center gap-3">
            <div className="min-w-0">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Read this aloud
              </p>
              {currentPhrase.segments?.length ? (
                <Ruby
                  segments={currentPhrase.segments}
                  className="text-xl font-semibold leading-loose text-slate-800 dark:text-slate-100"
                  rtClassName="text-[11px] font-medium text-blue-400 dark:text-blue-300"
                />
              ) : (
                <p className="text-xl font-semibold leading-snug text-slate-800 dark:text-slate-100">{currentPhrase.sentence}</p>
              )}
              {currentPhrase.romaji && (
                <p className="mt-1 text-sm italic text-slate-400 dark:text-slate-500">{currentPhrase.romaji}</p>
              )}
            </div>
            <SpeakButton text={currentPhrase.sentence} langCode={lang} className="ml-auto" />
          </div>
        ) : (
          <p className="text-sm text-slate-400">ไม่สามารถโหลดประโยคได้</p>
        )}
      </div>

      {/* Live mic feedback so the learner always knows whether they were heard. */}
      {hint && (status === 'idle' || status === 'listening' || status === 'processing') && (
        <p className="mb-2.5 rounded-2xl bg-slate-50 px-4 py-2.5 text-center text-xs font-medium text-slate-600 ring-1 ring-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">
          {hint}
        </p>
      )}

      {/* idle */}
      {status === 'idle' && (
        <div className="space-y-2.5">
          <button
            onClick={startListening}
            disabled={isLoading || !currentPhrase || isStarting}
            className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition-all hover:shadow-blue-500/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            {isStarting ? '⏳ กำลังเปิดไมค์…' : '🎙️ กดเพื่อพูด — Tap to Speak'}
          </button>
          <button
            onClick={nextPhrase}
            disabled={isLoading}
            className="w-full rounded-2xl bg-slate-50 py-3 text-sm font-medium text-slate-500 ring-1 ring-slate-200 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-100"
          >
            ✨ ประโยคใหม่ — New Sentence
          </button>
        </div>
      )}

      {/* listening — tap again to explicitly stop and commit */}
      {status === 'listening' && (
        <div className="space-y-2.5">
          <button
            onClick={stopListening}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-500 to-rose-500 py-3.5 text-sm font-semibold text-white shadow-lg shadow-red-500/25 transition-all hover:shadow-red-500/40 active:scale-[0.98]"
          >
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-white" />
            ⏹ กำลังฟัง… กดเพื่อหยุด — Listening… Tap to Stop
          </button>
          {/* Bypass: if the mic stalls or won't pick up this learner's voice, let
              them move on instead of being stuck on the Stop button. */}
          <button
            onClick={nextPhrase}
            className="w-full rounded-2xl py-2 text-xs font-medium text-slate-400 transition hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
          >
            ข้ามประโยคนี้ — Skip / Tap to bypass
          </button>
        </div>
      )}

      {/* processing — brief beat while the engine flushes the final audio */}
      {status === 'processing' && (
        <div className="space-y-2.5">
          <div className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-100 py-3.5 text-sm font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
            <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" />
            <span className="ml-1">⏳ กำลังประมวลผล… — Processing…</span>
          </div>
          <button
            onClick={nextPhrase}
            className="w-full rounded-2xl py-2 text-xs font-medium text-slate-400 transition hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
          >
            ข้ามประโยคนี้ — Skip / Tap to bypass
          </button>
        </div>
      )}

      {/* done */}
      {status === 'done' && (
        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              สิ่งที่ได้ยิน — What we heard
            </p>
            <p className="rounded-2xl bg-slate-50 px-4 py-2.5 text-sm italic text-slate-700 ring-1 ring-slate-100 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700">
              &ldquo;{transcript}&rdquo;
            </p>
          </div>
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              ผลการออกเสียง — Pronunciation results
            </p>
            <div className="flex flex-wrap gap-2">
              {results.map((r) => (
                <div
                  key={r.word}
                  className={`rounded-xl px-3 py-2 text-sm font-medium ring-1 ${
                    r.status === 'correct'
                      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-900/50'
                      : r.status === 'dropped'
                      ? 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/40 dark:text-red-400 dark:ring-red-900/50'
                      : 'bg-slate-100 text-slate-500 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700'
                  }`}
                >
                  <span className="font-semibold">{r.word}</span>
                  <span className="ml-1 text-xs opacity-70">({r.sound})</span>
                  <span className="ml-2">
                    {r.status === 'correct' ? '✓' : r.status === 'dropped' ? '✗' : '—'}
                  </span>
                  {r.status === 'dropped' && (
                    <span className="ml-1 text-xs opacity-60">
                      {r.sound === 'R→L' ? 'R sounds like L' : 'final sound missing'}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={retry}
              className="flex-1 rounded-2xl bg-blue-50 py-3 text-sm font-semibold text-blue-600 ring-1 ring-blue-200 transition hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900/50 dark:hover:bg-blue-950/60"
            >
              ลองอีกครั้ง — Try Again
            </button>
            <button
              onClick={nextPhrase}
              className="flex-1 rounded-2xl bg-slate-50 py-3 text-sm font-medium text-slate-500 ring-1 ring-slate-200 transition hover:bg-slate-100 hover:text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-100"
            >
              ✨ ประโยคใหม่ — New
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
