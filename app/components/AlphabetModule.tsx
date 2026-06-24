'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Volume2, Loader2, AlertTriangle, Check, X, Sparkles, RefreshCw, Headphones, Star, Play, Eye } from 'lucide-react';
import { type LocaleCode } from '../lib/locale';
import { getProgress, recordAnswer, recordMastery, onProgressChange, type Progress } from '../lib/progress';
import { playCorrect, playWrong } from '../lib/sfx';
import {
  ENGLISH_LETTERS,
  KANA,
  PINYIN_INITIALS,
  PINYIN_FINALS,
  TONES,
} from '../data/alphabet';

// ── Audio files ──────────────────────────────────────────────────────────────
// This module plays ONLY real recordings — never browser TTS, which mangles
// isolated letters/phonics/pinyin. Drop high-quality .mp3s under /public and
// point AUDIO_BASE at them; the module builds a conventional path per character,
// and any item's `audioUrl` (in alphabet.ts) overrides it. A missing file fails
// gracefully with a small warning (no robotic fallback).
//
// File layout for the default AUDIO_BASE = '/audio' (put files in /public/audio):
//   English  A  → /audio/en/a.mp3
//   Hiragana あ → /audio/ja/a.mp3   (keyed by romaji)
//   Pinyin   zh → /audio/zh/zh.mp3
//   Tone     mā → /audio/zh/ma1.mp3
// Or serve from a CDN: AUDIO_BASE = 'https://cdn.yoursite.com/audio'
const AUDIO_BASE = '/audio';

function slug(s: string): string {
  // Pinyin 'ü' → 'v' (so it doesn't collide with 'u'), other tone marks stripped,
  // spaces → '-'. Must match scripts/fetch-audio.mjs so files line up on disk.
  return s
    .toLowerCase()
    .replace(/ü/g, 'v')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function audioSrc(lang: LocaleCode, key: string, explicit?: string): string {
  if (explicit) return explicit;
  if (!AUDIO_BASE) return '';
  return `${AUDIO_BASE}/${lang}/${slug(key)}.mp3`;
}

// Per-language accent palette (literal class strings so Tailwind keeps them).
const THEME: Record<LocaleCode, { grad: string; soft: string; ring: string; text: string; chip: string; quiz: string }> = {
  en: {
    grad: 'from-blue-500 to-indigo-500',
    soft: 'from-blue-50/70 to-indigo-50/40 dark:from-blue-950/40 dark:to-indigo-950/30',
    ring: 'ring-blue-100/70 dark:ring-blue-900/40',
    text: 'text-blue-500 dark:text-blue-300',
    chip: 'bg-blue-600',
    quiz: 'from-blue-600 to-indigo-600',
  },
  ja: {
    grad: 'from-rose-500 to-pink-500',
    soft: 'from-rose-50/70 to-pink-50/40 dark:from-rose-950/40 dark:to-pink-950/30',
    ring: 'ring-rose-100/70 dark:ring-rose-900/40',
    text: 'text-rose-500 dark:text-rose-300',
    chip: 'bg-rose-600',
    quiz: 'from-rose-600 to-pink-600',
  },
  zh: {
    grad: 'from-amber-500 to-orange-500',
    soft: 'from-amber-50/70 to-orange-50/40 dark:from-amber-950/40 dark:to-orange-950/30',
    ring: 'ring-amber-100/70 dark:ring-amber-900/40',
    text: 'text-amber-600 dark:text-amber-300',
    chip: 'bg-amber-600',
    quiz: 'from-amber-600 to-orange-600',
  },
};

type Theme = (typeof THEME)[LocaleCode];
type PlayState = 'idle' | 'loading' | 'playing';
export type PlayTarget = { key: string; audioUrl?: string };
type Tile = PlayTarget & { glyph: string; sub: string };

function fisherYates<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Shared audio player ──────────────────────────────────────────────────────
// One reused <audio> element. `current` tracks which target is loading/playing
// so a button can swap its speaker icon for a spinner. A missing/slow recording
// must never leave a spinner stuck: on top of onerror/onplaying, a per-call
// watchdog forces the loading state to resolve (and warns) if playback hasn't
// begun within WATCHDOG_MS — covers stalled requests and silent timeouts that
// never fire an error event. `warn` surfaces failures via the parent's toast.
//
// Each call site that must NOT share playback highlighting gets its own instance
// — notably the quiz, so playing the prompt never pops the matching glyph in the
// always-visible practice grid (that visual cue was spoiling the answer).
function useAudioPlayer(warn: (msg: string) => void) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const watchdog = useRef<ReturnType<typeof setTimeout> | null>(null); // cancels the previous load
  const [current, setCurrent] = useState<{ key: string; status: PlayState } | null>(null);

  useEffect(() => () => {
    audioRef.current?.pause();
    if (watchdog.current) clearTimeout(watchdog.current);
  }, []);

  const WATCHDOG_MS = 6000;
  function play(t: PlayTarget) {
    audioRef.current?.pause();
    if (watchdog.current) clearTimeout(watchdog.current); // cancel any in-flight load

    if (!t.audioUrl) {
      setCurrent(null);
      warn('ยังไม่มีไฟล์เสียงสำหรับตัวนี้ — No audio file yet');
      return;
    }

    const a = audioRef.current ?? new Audio();
    audioRef.current = a;
    a.src = t.audioUrl;
    setCurrent({ key: t.key, status: 'loading' });

    // `myTimer` is captured per call so a stale, late-firing handler from an
    // earlier tap can't clear THIS load's watchdog.
    const myTimer = setTimeout(() => {
      try { a.pause(); } catch { /* ignore */ }
      setCurrent((c) => (c?.key === t.key ? null : c));
      warn('เครือข่ายช้า โหลดเสียงไม่ทัน — Audio timed out');
    }, WATCHDOG_MS);
    watchdog.current = myTimer;

    // Clear state only if this target is still the active one (guards races when
    // the user taps another tile mid-load).
    const settle = (status: PlayState | null) => {
      clearTimeout(myTimer);
      setCurrent((c) => (c?.key === t.key ? (status ? { key: t.key, status } : null) : c));
    };

    a.onplaying = () => settle('playing');
    a.onended = () => settle(null);
    a.onerror = () => { settle(null); warn('เล่นเสียงไม่สำเร็จ — ไฟล์เสียงหายหรือโหลดไม่ได้ (404)'); };
    a.play().catch(() => { settle(null); warn('เล่นเสียงไม่สำเร็จ — Audio could not play'); });
  }

  function stateFor(key: string): PlayState {
    return current?.key === key ? current.status : 'idle';
  }

  return { play, stateFor };
}

export default function AlphabetModule({ lang }: { lang: LocaleCode }) {
  const theme = THEME[lang];

  // Transient, auto-dismissing toast shown when a recording is missing or fails.
  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  useEffect(() => () => { if (warnTimer.current) clearTimeout(warnTimer.current); }, []);
  function warn(msg: string) {
    setWarning(msg);
    if (warnTimer.current) clearTimeout(warnTimer.current);
    warnTimer.current = setTimeout(() => setWarning(null), 3500);
  }

  // Audio for the practice grid / tone board / memory match. The quiz uses its
  // OWN player instance (see <Quiz>), so playing the quiz prompt never lights up
  // (pops) the matching glyph tile in the always-visible grid.
  const { play, stateFor } = useAudioPlayer(warn);

  // Per-language view toggles.
  const [enMode, setEnMode] = useState<'names' | 'phonics'>('names');
  const [jaScript, setJaScript] = useState<'hira' | 'kata'>('hira');
  const [zhTab, setZhTab] = useState<'initials' | 'finals' | 'tones'>('initials');

  // Tiles currently on screen — also the pool the quiz draws from.
  const tiles: Tile[] = useMemo(() => {
    if (lang === 'en') {
      return ENGLISH_LETTERS.map((l) => ({
        key: l.letter,
        glyph: l.letter,
        sub: enMode === 'names' ? l.name : `${l.phonics} · ${l.example}`,
        audioUrl: audioSrc('en', l.letter, l.audioUrl),
      }));
    }
    if (lang === 'ja') {
      return KANA.map((k) => ({
        key: k.romaji,
        glyph: jaScript === 'hira' ? k.hira : k.kata,
        sub: k.romaji,
        audioUrl: audioSrc('ja', k.romaji, k.audioUrl),
      }));
    }
    if (zhTab === 'tones') {
      return TONES.map((t) => ({
        key: t.pinyin,
        glyph: t.pinyin,
        sub: t.meaning,
        audioUrl: audioSrc('zh', `ma${t.num}`, t.audioUrl),
      }));
    }
    const set = zhTab === 'initials' ? PINYIN_INITIALS : PINYIN_FINALS;
    return set.map((p) => ({
      key: p.sym,
      glyph: p.sym,
      sub: p.sound,
      audioUrl: audioSrc('zh', p.sym, p.audioUrl),
    }));
  }, [lang, enMode, jaScript, zhTab]);

  const hasAudio = tiles.some((t) => !!t.audioUrl);

  // Persisted progress (shared with Vocab/Writing via lib/progress). Loaded after
  // mount to avoid hydration mismatch; re-read whenever any module records.
  const [progress, setProgress] = useState<Progress | null>(null);
  useEffect(() => {
    setProgress(getProgress());
    return onProgressChange(() => setProgress(getProgress()));
  }, []);

  // Which glyphs in the current view the learner has already gotten right.
  const mastered = useMemo(
    () => new Set(progress?.mastered[lang] ?? []),
    [progress, lang],
  );
  const collected = tiles.reduce((n, t) => n + (mastered.has(t.key) ? 1 : 0), 0);

  // Practice (listen + quiz) vs. the Memory Match game.
  const [mode, setMode] = useState<'practice' | 'match'>('practice');

  return (
    <div className="relative rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${theme.grad} text-white shadow-md`}>
          <Headphones className="h-5 w-5" />
        </div>
        <div>
          <p className="text-lg font-bold text-slate-800 dark:text-slate-100">พื้นฐานตัวอักษร</p>
          <p className={`text-[11px] font-semibold uppercase tracking-wider ${theme.text}`}>Alphabet &amp; Phonics</p>
        </div>

        <div className="ml-auto">
          {lang === 'en' && (
            <SegToggle
              options={[{ k: 'names', label: 'ชื่อตัวอักษร' }, { k: 'phonics', label: 'เสียงโฟนิกส์' }]}
              value={enMode}
              onChange={(v) => setEnMode(v as 'names' | 'phonics')}
              chip={theme.chip}
            />
          )}
          {lang === 'ja' && (
            <SegToggle
              options={[{ k: 'hira', label: 'ひらがな' }, { k: 'kata', label: 'カタカナ' }]}
              value={jaScript}
              onChange={(v) => setJaScript(v as 'hira' | 'kata')}
              chip={theme.chip}
            />
          )}
          {lang === 'zh' && (
            <SegToggle
              options={[{ k: 'initials', label: '声母' }, { k: 'finals', label: '韵母' }, { k: 'tones', label: '声调' }]}
              value={zhTab}
              onChange={(v) => setZhTab(v as 'initials' | 'finals' | 'tones')}
              chip={theme.chip}
            />
          )}
        </div>
      </div>

      {/* Mode switch: Practice (listen + quiz) ⇄ Memory Match game */}
      {hasAudio && (
        <div className="mb-4">
          <SegToggle
            options={[{ k: 'practice', label: '🎧 ฝึกฟัง' }, { k: 'match', label: '🃏 เกมจับคู่' }]}
            value={mode}
            onChange={(v) => setMode(v as 'practice' | 'match')}
            chip={theme.chip}
          />
        </div>
      )}

      {/* Collected progress + shared streak (shared across both modes) */}
      {hasAudio && (
        <div className="mb-4 flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <Star className={`h-3.5 w-3.5 ${theme.text}`} /> สะสมแล้ว {collected}/{tiles.length}
          </span>
          {progress && progress.currentStreak > 0 && (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              🔥 {progress.currentStreak}
            </span>
          )}
        </div>
      )}

      {mode === 'match' ? (
        <MemoryMatch pool={tiles} lang={lang} onPlay={play} stateFor={stateFor} theme={theme} />
      ) : (
        <>
          {/* Banner */}
          {hasAudio ? (
            <div className={`mb-4 flex items-center gap-2 rounded-2xl bg-gradient-to-r ${theme.soft} px-4 py-2.5 text-xs font-medium text-slate-600 ring-1 ${theme.ring} dark:text-slate-300`}>
              <Volume2 className={`h-4 w-4 shrink-0 ${theme.text}`} />
              แตะตัวอักษรเพื่อฟังเสียงเจ้าของภาษา — Click to hear the authentic pronunciation.
            </div>
          ) : (
            <div className="mb-4 flex items-center gap-2 rounded-2xl bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900/50">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              ยังไม่ได้เชื่อมไฟล์เสียง — เพิ่มไฟล์ .mp3 แล้วตั้งค่า AUDIO_BASE (Add .mp3 files to enable audio)
            </div>
          )}

          {lang === 'zh' && zhTab === 'tones' ? (
            <ToneBoard onPlay={play} stateFor={stateFor} theme={theme} />
          ) : (
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6">
              {tiles.map((t) => (
                <GlyphTile key={t.key} tile={t} state={stateFor(t.key)} onPlay={play} theme={theme} mastered={mastered.has(t.key)} />
              ))}
            </div>
          )}

          {/* Mini-quiz (only meaningful once recordings are wired up) */}
          {hasAudio && <Quiz pool={tiles} lang={lang} warn={warn} theme={theme} />}
        </>
      )}

      {/* Transient warning toast */}
      {warning && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-amber-500 px-4 py-2 text-xs font-semibold text-white shadow-lg">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {warning}
        </div>
      )}
    </div>
  );
}

// ── Speaker / spinner icon ───────────────────────────────────────────────────
function AudioIcon({ state, className = '' }: { state: PlayState; className?: string }) {
  if (state === 'loading') return <Loader2 className={`${className} animate-spin`} />;
  return <Volume2 className={`${className} ${state === 'playing' ? 'animate-pulse' : ''}`} />;
}

// ── Segmented toggle (Duolingo-style pill switch) ────────────────────────────
function SegToggle({
  options,
  value,
  onChange,
  chip,
}: {
  options: { k: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  chip: string;
}) {
  return (
    <div className="inline-flex rounded-full bg-slate-100 p-1 dark:bg-slate-800">
      {options.map((o) => (
        <button
          key={o.k}
          type="button"
          onClick={() => onChange(o.k)}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
            value === o.k
              ? `${chip} text-white shadow`
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── A single character tile with an audio button ─────────────────────────────
function GlyphTile({
  tile,
  state,
  onPlay,
  theme,
  mastered,
}: {
  tile: Tile;
  state: PlayState;
  onPlay: (t: PlayTarget) => void;
  theme: Theme;
  mastered: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onPlay(tile)}
      title="ฟังเสียง — Listen"
      className={`group relative flex flex-col items-center justify-center gap-0.5 rounded-2xl bg-gradient-to-br ${theme.soft} px-2 py-4 ring-1 ${theme.ring} transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.97] ${
        state !== 'idle' ? 'ring-2 ring-offset-1 ring-offset-white dark:ring-offset-slate-900' : ''
      } ${state === 'playing' ? 'animate-pop' : ''}`}
    >
      <span className="text-3xl font-extrabold leading-none text-slate-800 dark:text-slate-100">{tile.glyph}</span>
      <span className={`mt-1 text-[11px] font-medium ${theme.text}`}>{tile.sub}</span>
      <span className={`absolute right-1.5 top-1.5 transition-opacity ${state === 'idle' ? 'text-slate-300 opacity-0 group-hover:opacity-100 dark:text-slate-500' : `${theme.text} opacity-100`}`}>
        <AudioIcon state={state} className="h-3.5 w-3.5" />
      </span>
      {/* "Collected" gold star — earned by getting this glyph right in the quiz */}
      {mastered && (
        <Star className="absolute left-1.5 top-1.5 h-3.5 w-3.5 fill-amber-400 text-amber-400 drop-shadow-sm" />
      )}
    </button>
  );
}

// ── Chinese tone board with pitch-contour glyphs ─────────────────────────────
function ToneBoard({
  onPlay,
  stateFor,
  theme,
}: {
  onPlay: (t: PlayTarget) => void;
  stateFor: (key: string) => PlayState;
  theme: Theme;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {TONES.map((t) => {
        const target: PlayTarget = { key: t.pinyin, audioUrl: audioSrc('zh', `ma${t.num}`, t.audioUrl) };
        const state = stateFor(t.pinyin);
        return (
          <button
            key={t.num}
            type="button"
            onClick={() => onPlay(target)}
            className={`group flex flex-col items-center gap-2 rounded-2xl bg-gradient-to-br ${theme.soft} p-4 ring-1 ${theme.ring} transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.97] ${
              state !== 'idle' ? 'ring-2' : ''
            }`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">เสียง {t.num}</span>
            <svg viewBox="0 0 40 42" className="h-10 w-14">
              <path d={t.contour} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={theme.text} />
            </svg>
            <span className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">{t.pinyin}</span>
            <span className="text-xl text-slate-600 dark:text-slate-300">{t.hanzi}</span>
            <span className="text-[11px] text-slate-400">{t.meaning}</span>
            <span className={state === 'idle' ? 'text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 dark:text-slate-500' : theme.text}>
              <AudioIcon state={state} className="h-4 w-4" />
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── Memory Match game (flip cards to find identical letter pairs) ─────────────
// Each chosen tile becomes two identical cards that show the letter and play its
// sound when flipped (tap an open card again to replay). A fair visual memory
// game with audio reinforcement on every flip. Draws straight from the same
// `pool` the practice grid uses, so it works for every language/script.
type MemCard = { id: number; key: string; glyph: string; audioUrl?: string };

function MemoryMatch({
  pool,
  lang,
  onPlay,
  stateFor,
  theme,
}: {
  pool: Tile[];
  lang: LocaleCode;
  onPlay: (t: PlayTarget) => void;
  stateFor: (key: string) => PlayState;
  theme: Theme;
}) {
  const pairCount = Math.min(6, pool.length);
  const PREVIEW_MS = 2500; // how long all cards stay face-up to memorize

  // Game flow: idle (Start button) → preview (all cards up) → playing.
  const [phase, setPhase] = useState<'idle' | 'preview' | 'playing'>('idle');
  const [cards, setCards] = useState<MemCard[]>([]);
  const [flipped, setFlipped] = useState<number[]>([]); // card ids face-up, unmatched
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [moves, setMoves] = useState(0);
  const [locked, setLocked] = useState(false); // true while a mismatched pair is shown
  const flipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearTimers() {
    if (flipTimer.current) clearTimeout(flipTimer.current);
    if (previewTimer.current) clearTimeout(previewTimer.current);
  }

  // Start a round: deal a fresh shuffle, show every card face-up for a beat so
  // the player can memorize, then auto-flip them down into play. Used by both
  // the Start button and Play-again / Shuffle, so the sequence is identical.
  function start() {
    clearTimers();
    const chosen = fisherYates(pool).slice(0, pairCount);
    const deck: MemCard[] = [];
    chosen.forEach((t, i) => {
      deck.push({ id: i * 2,     key: t.key, glyph: t.glyph, audioUrl: t.audioUrl });
      deck.push({ id: i * 2 + 1, key: t.key, glyph: t.glyph, audioUrl: t.audioUrl });
    });
    setCards(fisherYates(deck));
    setFlipped([]);
    setMatched(new Set());
    setMoves(0);
    setLocked(false);
    setPhase('preview');
    previewTimer.current = setTimeout(() => setPhase('playing'), PREVIEW_MS);
  }

  // Reset to the Start screen whenever the source set changes (language/script
  // switch). Never auto-starts — the player taps Start.
  useEffect(() => {
    clearTimers();
    setPhase('idle');
    setCards([]);
    setFlipped([]);
    setMatched(new Set());
    setMoves(0);
    setLocked(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool]);
  useEffect(() => () => clearTimers(), []);

  const won = phase === 'playing' && pairCount > 0 && matched.size === pairCount;

  function flip(card: MemCard) {
    if (phase !== 'playing' || locked || won || matched.has(card.key)) return;
    // Tapping an already-open card just replays its sound.
    if (flipped.includes(card.id)) { onPlay({ key: card.key, audioUrl: card.audioUrl }); return; }
    if (flipped.length === 2) return;

    onPlay({ key: card.key, audioUrl: card.audioUrl }); // hear the sound on every flip

    const next = [...flipped, card.id];
    setFlipped(next);
    if (next.length < 2) return;

    setMoves((m) => m + 1);
    const [a, b] = next.map((id) => cards.find((c) => c.id === id)!);
    if (a.key === b.key) {
      playCorrect();
      setMatched((prev) => new Set(prev).add(a.key));
      recordMastery(lang, a.key); // collect the glyph → lights its star in Practice
      setFlipped([]); // matched cards stay face-up via the `matched` set
    } else {
      playWrong();
      setLocked(true);
      flipTimer.current = setTimeout(() => { setFlipped([]); setLocked(false); }, 900);
    }
  }

  return (
    <div className="relative">
      {won && <Confetti />}

      <div className="mb-3 flex items-center gap-2">
        <Sparkles className={`h-4 w-4 ${theme.text}`} />
        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">จับคู่ตัวอักษรที่เหมือนกัน — Match the pairs</p>
        {phase !== 'idle' && (
          <>
            <span className="ml-auto rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              ✓ {matched.size}/{pairCount}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {moves} ครั้ง
            </span>
          </>
        )}
      </div>

      {phase === 'idle' ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-200 px-6 py-8 text-center dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            ดูตำแหน่งการ์ดสักครู่ แล้วจับคู่ให้ครบ — peek at the cards, then match every pair.
          </p>
          <button
            type="button"
            onClick={start}
            className={`flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r ${theme.quiz} px-6 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl active:scale-[0.98]`}
          >
            <Play className="h-4 w-4" /> เริ่มเล่น — Start Game
          </button>
        </div>
      ) : (
        <>
          {phase === 'preview' && (
            <div className={`mb-3 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r ${theme.soft} px-4 py-2.5 text-xs font-semibold text-slate-600 ring-1 ${theme.ring} dark:text-slate-300`}>
              <Eye className={`h-4 w-4 ${theme.text}`} /> จำตำแหน่งให้ได้! — Memorize the cards…
            </div>
          )}

          {won && (
            <div className="mb-3 flex flex-col items-center gap-2 rounded-2xl bg-emerald-50 p-4 text-center ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:ring-emerald-800">
              <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                🎉 เก่งมาก! จับคู่ครบใน {moves} ครั้ง — All matched in {moves} moves!
              </p>
              <button
                type="button"
                onClick={start}
                className={`flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r ${theme.quiz} px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl active:scale-[0.98]`}
              >
                <RefreshCw className="h-4 w-4" /> เล่นอีกครั้ง — Play again
              </button>
            </div>
          )}

          <div className="grid grid-cols-4 gap-2.5">
            {cards.map((c) => (
              <MemTile
                key={c.id}
                card={c}
                up={phase === 'preview' || flipped.includes(c.id) || matched.has(c.key)}
                matched={matched.has(c.key)}
                state={stateFor(c.key)}
                theme={theme}
                onFlip={() => flip(c)}
              />
            ))}
          </div>

          {phase === 'playing' && !won && (
            <button
              type="button"
              onClick={start}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-50 py-2.5 text-sm font-medium text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-700"
            >
              <RefreshCw className="h-4 w-4" /> สับไพ่ใหม่ — Shuffle
            </button>
          )}
        </>
      )}
    </div>
  );
}

// A single flip card: a 3D rotateY swaps the gradient back for the face.
function MemTile({
  card,
  up,
  matched,
  state,
  theme,
  onFlip,
}: {
  card: MemCard;
  up: boolean;
  matched: boolean;
  state: PlayState;
  theme: Theme;
  onFlip: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onFlip}
      disabled={matched}
      aria-label={up ? card.key : 'การ์ดคว่ำ — face-down card'}
      className="relative aspect-square w-full [perspective:700px] disabled:cursor-default"
    >
      <div
        className="relative h-full w-full transition-transform duration-300 [transform-style:preserve-3d]"
        style={{ transform: up ? 'rotateY(180deg)' : undefined }}
      >
        {/* Back (face-down) */}
        <div className={`absolute inset-0 flex items-center justify-center rounded-2xl bg-gradient-to-br ${theme.grad} text-white shadow-md [backface-visibility:hidden]`}>
          <Sparkles className="h-6 w-6 opacity-80" />
        </div>
        {/* Front (face-up): glyph or speaker */}
        <div
          className={`absolute inset-0 flex items-center justify-center rounded-2xl ring-1 [backface-visibility:hidden] [transform:rotateY(180deg)] ${
            matched
              ? 'bg-emerald-50 ring-emerald-300 dark:bg-emerald-950/40 dark:ring-emerald-800'
              : 'bg-white ring-slate-200 shadow-sm dark:bg-slate-800 dark:ring-slate-700'
          }`}
        >
          <span className="text-3xl font-extrabold text-slate-800 dark:text-slate-100">{card.glyph}</span>
          <AudioIcon state={state} className={`absolute bottom-1.5 left-1.5 h-3.5 w-3.5 ${matched ? 'text-emerald-500' : theme.text}`} />
          {matched && <Check className="absolute right-1.5 top-1.5 h-4 w-4 text-emerald-500" />}
        </div>
      </div>
    </button>
  );
}

// ── Confetti burst (pure CSS, no deps) ───────────────────────────────────────
// A handful of colored squares fall from the top-center on a correct answer.
// Each piece gets a random horizontal drift, rotation, color and delay via
// inline CSS vars consumed by the `elp-confetti` keyframes in globals.css.
const CONFETTI_COLORS = ['#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#a855f7', '#ec4899'];

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        id: i,
        dx: `${Math.round(Math.random() * 160 - 80)}px`,
        rot: `${Math.round(Math.random() * 540 - 270)}deg`,
        delay: `${Math.random() * 0.15}s`,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        left: `${Math.round(Math.random() * 60 + 20)}%`,
      })),
    [],
  );
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-full">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="animate-confetti absolute top-1 h-2 w-2 rounded-[1px]"
          style={{
            left: p.left,
            backgroundColor: p.color,
            animationDelay: p.delay,
            ['--dx' as string]: p.dx,
            ['--rot' as string]: p.rot,
          }}
        />
      ))}
    </div>
  );
}

// ── "Listen & Choose" mini-quiz ──────────────────────────────────────────────
function Quiz({
  pool,
  lang,
  warn,
  theme,
}: {
  pool: Tile[];
  lang: LocaleCode;
  warn: (msg: string) => void;
  theme: Theme;
}) {
  // Dedicated player: keeps quiz playback state separate from the practice grid,
  // so hearing the prompt never highlights/pops the answer tile in the grid.
  const { play, stateFor } = useAudioPlayer(warn);
  const [target, setTarget] = useState<Tile | null>(null);
  const [options, setOptions] = useState<Tile[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [burst, setBurst] = useState(0); // bump to replay the confetti

  useEffect(() => {
    setTarget(null);
    setOptions([]);
    setPicked(null);
  }, [pool]);

  function newRound() {
    if (pool.length < 4) return;
    const t = pool[Math.floor(Math.random() * pool.length)];
    const distractors = fisherYates(pool.filter((p) => p.key !== t.key)).slice(0, 3);
    setOptions(fisherYates([t, ...distractors]));
    setTarget(t);
    setPicked(null);
    // Do NOT auto-play here. Auto-playing on every new round (or any state change)
    // spoils the answer before the learner chooses — audio is played only when
    // they tap the dedicated "Listen to Question" button below.
  }

  function choose(opt: Tile) {
    if (picked || !target) return;
    const isCorrect = opt.key === target.key;
    setPicked(opt.key);
    setScore((s) => ({ correct: s.correct + (isCorrect ? 1 : 0), total: s.total + 1 }));
    // Feed the shared progress/streak and "collect" the glyph on a correct pick.
    recordAnswer('alphabet', isCorrect, { lang, key: target.key });
    if (isCorrect) {
      playCorrect();
      setBurst((b) => b + 1);
    } else {
      playWrong();
    }
  }

  return (
    <div className="relative mt-6 overflow-hidden rounded-2xl border border-dashed border-slate-200 p-4 dark:border-slate-700">
      {burst > 0 && <Confetti key={burst} />}
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className={`h-4 w-4 ${theme.text}`} />
        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">ฟังแล้วเลือก — Listen &amp; Choose</p>
        {score.total > 0 && (
          <span className="ml-auto rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            ✓ {score.correct}/{score.total}
          </span>
        )}
      </div>

      {!target ? (
        <button
          type="button"
          onClick={newRound}
          className={`flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r ${theme.quiz} py-3 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl active:scale-[0.98]`}
        >
          <Sparkles className="h-4 w-4" /> เริ่มแบบทดสอบ — Start
        </button>
      ) : (
        <>
          <div className="mb-3 flex flex-col items-center justify-center gap-1.5">
            <button
              type="button"
              onClick={() => play(target)}
              className={`inline-flex items-center gap-2 rounded-full bg-gradient-to-r ${theme.quiz} px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:scale-105 hover:shadow-lg active:scale-95`}
              aria-label="ฟังคำถาม — Listen to the question"
            >
              <AudioIcon state={stateFor(target.key)} className="h-5 w-5" />
              ฟังคำถาม — Listen to Question
            </button>
            <span className="text-xs text-slate-400">แตะเพื่อฟังเสียง แล้วเลือกคำตอบ — Tap to hear, then choose</span>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {options.map((o) => {
              const isTarget = o.key === target.key;
              const isPicked = o.key === picked;
              let style = 'bg-white text-slate-700 ring-slate-200 hover:ring-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700';
              if (picked) {
                if (isTarget) style = 'bg-emerald-50 text-emerald-700 ring-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800';
                else if (isPicked) style = 'bg-red-50 text-red-600 ring-red-300 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-800';
                else style = 'bg-slate-50 text-slate-400 ring-slate-100 dark:bg-slate-800/50 dark:text-slate-500 dark:ring-slate-800';
              }
              return (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => choose(o)}
                  disabled={!!picked}
                  className={`relative flex items-center justify-center rounded-2xl py-4 text-2xl font-extrabold ring-1 transition-all ${style} ${!picked ? 'active:scale-95' : ''}`}
                >
                  {o.glyph}
                  {picked && isTarget && <Check className="absolute right-1.5 top-1.5 h-4 w-4 text-emerald-500" />}
                  {picked && isPicked && !isTarget && <X className="absolute right-1.5 top-1.5 h-4 w-4 text-red-500" />}
                </button>
              );
            })}
          </div>

          {picked && (
            <button
              type="button"
              onClick={newRound}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-50 py-2.5 text-sm font-medium text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-700"
            >
              <RefreshCw className="h-4 w-4" /> ข้อต่อไป — Next
            </button>
          )}
        </>
      )}
    </div>
  );
}
