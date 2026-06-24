'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Volume2, Loader2, AlertTriangle, Check, X, Sparkles, RefreshCw,
  Hash, Layers, Coins, Plus, Minus,
} from 'lucide-react';
import { type LocaleCode } from '../lib/locale';
import { recordAnswer } from '../lib/progress';
import { playCorrect, playWrong } from '../lib/sfx';
import {
  NUMBERS_BY_LANG, EN_PLURALS, JA_COUNTERS, ZH_GESTURES, ZH_MEASURES,
  BIG_NUMBERS, bigFormFor, PRICES, formatPrice, groupWestern,
  type BigNumber,
} from '../data/numbers';

// ── Audio (mp3 only, namespaced under /audio/<lang>/n/) ───────────────────────
// Numbers live in their own `n/` subfolder so a key like Chinese 十 "shí" → "shi"
// never collides with the pinyin-initial file shi.mp3 in /audio/zh/.
const AUDIO_BASE = '/audio';

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/ü/g, 'v')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function audioSrc(lang: LocaleCode, key: string): string {
  return `${AUDIO_BASE}/${lang}/n/${slug(key)}.mp3`;
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
type PlayTarget = { key: string; audioUrl: string };

function fisherYates<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─────────────────────────────────────────────────────────────────────────────
export default function NumbersModule({ lang }: { lang: LocaleCode }) {
  const theme = THEME[lang];

  // Audio playback — one reused <audio> element (mirrors AlphabetModule).
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const watchdog = useRef<ReturnType<typeof setTimeout> | null>(null); // cancels the previous load
  const [current, setCurrent] = useState<{ key: string; status: PlayState } | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => () => {
    audioRef.current?.pause();
    if (warnTimer.current) clearTimeout(warnTimer.current);
    if (watchdog.current) clearTimeout(watchdog.current);
  }, []);

  function warn(msg: string) {
    setWarning(msg);
    if (warnTimer.current) clearTimeout(warnTimer.current);
    warnTimer.current = setTimeout(() => setWarning(null), 3500);
  }

  // A network 404/stall must never leave the spinner hanging. Besides the
  // onerror/onplaying events, a watchdog forces the loading state to resolve
  // (and warns) if playback hasn't begun within WATCHDOG_MS.
  const WATCHDOG_MS = 6000;
  function play(t: PlayTarget) {
    audioRef.current?.pause();
    if (watchdog.current) clearTimeout(watchdog.current); // cancel any in-flight load
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

    const settle = (status: PlayState | null) => {
      clearTimeout(myTimer);
      setCurrent((c) => (c?.key === t.key ? (status ? { key: t.key, status } : null) : c));
    };
    a.onplaying = () => settle('playing');
    a.onended = () => settle(null);
    a.onerror = () => { settle(null); warn('ยังไม่มีไฟล์เสียงสำหรับตัวนี้ — No audio file yet'); };
    a.play().catch(() => { settle(null); warn('เล่นเสียงไม่สำเร็จ — Audio could not play'); });
  }

  function stateFor(key: string): PlayState {
    return current?.key === key ? current.status : 'idle';
  }

  const [level, setLevel] = useState<'basics' | 'big'>('basics');

  return (
    <div className="relative rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${theme.grad} text-white shadow-md`}>
          <Hash className="h-5 w-5" />
        </div>
        <div>
          <p className="text-lg font-bold text-slate-800 dark:text-slate-100">ตัวเลขและลักษณนาม</p>
          <p className={`text-[11px] font-semibold uppercase tracking-wider ${theme.text}`}>Numbers &amp; Counters</p>
        </div>
      </div>

      {/* Level selector */}
      <div className="mb-5">
        <SegTabs
          options={[
            { k: 'basics', label: '1–20 พื้นฐาน & หน่วยนับ' },
            { k: 'big', label: 'จำนวนใหญ่ & หลักหน่วย' },
          ]}
          value={level}
          onChange={(v) => setLevel(v as 'basics' | 'big')}
          chip={theme.chip}
        />
      </div>

      {level === 'basics' ? (
        <BasicsView lang={lang} theme={theme} play={play} stateFor={stateFor} />
      ) : (
        <BigView lang={lang} theme={theme} play={play} stateFor={stateFor} />
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

// ── Shared bits ──────────────────────────────────────────────────────────────
function AudioIcon({ state, className = '' }: { state: PlayState; className?: string }) {
  if (state === 'loading') return <Loader2 className={`${className} animate-spin`} />;
  return <Volume2 className={`${className} ${state === 'playing' ? 'animate-pulse' : ''}`} />;
}

function SegTabs({
  options, value, onChange, chip,
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
          className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
            value === o.k ? `${chip} text-white shadow` : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

type AudioProps = {
  lang: LocaleCode;
  theme: Theme;
  play: (t: PlayTarget) => void;
  stateFor: (key: string) => PlayState;
};

// ═════════════════════════════ LEVEL 1 — BASICS ═════════════════════════════
function BasicsView({ lang, theme, play, stateFor }: AudioProps) {
  const numbers = NUMBERS_BY_LANG[lang];

  return (
    <div className="space-y-6">
      {/* Hint */}
      <div className={`flex items-center gap-2 rounded-2xl bg-gradient-to-r ${theme.soft} px-4 py-2.5 text-xs font-medium text-slate-600 ring-1 ${theme.ring} dark:text-slate-300`}>
        <Volume2 className={`h-4 w-4 shrink-0 ${theme.text}`} />
        แตะตัวเลขเพื่อฟังเสียง — Tap a number to hear it.
      </div>

      {/* Numbers 1–20 */}
      <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-5 md:grid-cols-7">
        {numbers.map((num) => {
          const key = num.read;
          const state = stateFor(key);
          return (
            <button
              key={num.n}
              type="button"
              onClick={() => play({ key, audioUrl: audioSrc(lang, key) })}
              className={`group relative flex flex-col items-center justify-center gap-0.5 rounded-2xl bg-gradient-to-br ${theme.soft} px-1 py-3 ring-1 ${theme.ring} transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.97] ${
                state !== 'idle' ? 'ring-2' : ''
              }`}
            >
              <span className="text-xl font-extrabold leading-none text-slate-800 dark:text-slate-100">{num.n}</span>
              <span className={`text-base font-bold leading-tight ${theme.text}`}>{num.glyph}</span>
              <span className="text-[10px] font-medium text-slate-400">{num.read}</span>
              <span className={`absolute right-1 top-1 transition-opacity ${state === 'idle' ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'} ${theme.text}`}>
                <AudioIcon state={state} className="h-3 w-3" />
              </span>
            </button>
          );
        })}
      </div>

      {/* Language-specific counter / units panel */}
      {lang === 'en' && <PluralExplorer theme={theme} />}
      {lang === 'ja' && <JaCounters theme={theme} play={play} stateFor={stateFor} lang={lang} />}
      {lang === 'zh' && (
        <>
          <ZhGestures theme={theme} play={play} stateFor={stateFor} lang={lang} />
          <ZhMeasures theme={theme} play={play} stateFor={stateFor} lang={lang} />
        </>
      )}

      {/* Mini-game: Count & Match */}
      <CountMatch theme={theme} />
    </div>
  );
}

// ── English: singular / plural explorer ──────────────────────────────────────
function PluralExplorer({ theme }: { theme: Theme }) {
  const [idx, setIdx] = useState(0);
  const [count, setCount] = useState(3);
  const noun = EN_PLURALS[idx];
  const word = count === 1 ? noun.singular : noun.plural;

  return (
    <section>
      <SectionTitle theme={theme} icon={<Layers className="h-4 w-4" />}>
        เอกพจน์ / พหูพจน์ — Singular &amp; Plural
      </SectionTitle>

      {/* Noun picker */}
      <div className="mb-3 flex flex-wrap gap-2">
        {EN_PLURALS.map((p, i) => (
          <button
            key={p.singular}
            type="button"
            onClick={() => setIdx(i)}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ring-1 transition ${
              i === idx ? `${theme.chip} text-white ring-transparent` : 'bg-white text-slate-600 ring-slate-200 hover:ring-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700'
            }`}
          >
            {p.emoji} {p.singular}
          </button>
        ))}
      </div>

      <div className={`rounded-2xl bg-gradient-to-br ${theme.soft} p-4 ring-1 ${theme.ring}`}>
        {/* Stepper */}
        <div className="mb-3 flex items-center justify-center gap-3">
          <StepBtn onClick={() => setCount((c) => Math.max(1, c - 1))}><Minus className="h-4 w-4" /></StepBtn>
          <span className="min-w-[2ch] text-center text-2xl font-extrabold text-slate-800 dark:text-slate-100">{count}</span>
          <StepBtn onClick={() => setCount((c) => Math.min(8, c + 1))}><Plus className="h-4 w-4" /></StepBtn>
        </div>

        {/* Visual count */}
        <div className="mb-3 flex flex-wrap justify-center gap-1.5 text-2xl">
          {Array.from({ length: count }, (_, i) => <span key={i}>{noun.emoji}</span>)}
        </div>

        {/* Sentence */}
        <p className="text-center text-lg font-bold text-slate-800 dark:text-slate-100">
          {count} <span className={theme.text}>{word}</span>
        </p>
        <p className="mt-1 text-center text-xs text-slate-500 dark:text-slate-400">
          {count === 1
            ? `เอกพจน์ — singular: “${noun.singular}”`
            : `พหูพจน์ (${noun.rule}) — plural: “${noun.plural}”`}
        </p>
      </div>
    </section>
  );
}

function StepBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 transition hover:scale-110 active:scale-95 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700"
    >
      {children}
    </button>
  );
}

// ── Japanese: 〜人 / 〜つ counter tables ──────────────────────────────────────
function JaCounters({ theme, play, stateFor }: AudioProps) {
  return (
    <section>
      <SectionTitle theme={theme} icon={<Layers className="h-4 w-4" />}>
        ลักษณนาม — Counters (readings change!)
      </SectionTitle>
      <div className="space-y-4">
        {JA_COUNTERS.map((counter) => (
          <div key={counter.suffix}>
            <div className="mb-2 flex items-baseline gap-2">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{counter.label}</span>
            </div>
            <p className="mb-2 text-[11px] text-slate-400">{counter.note}</p>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
              {counter.items.map((item) => {
                const key = item.read;
                const state = stateFor(key);
                return (
                  <button
                    key={item.n}
                    type="button"
                    onClick={() => play({ key, audioUrl: audioSrc('ja', key) })}
                    className={`group relative flex flex-col items-center gap-0.5 rounded-2xl bg-gradient-to-br ${theme.soft} px-1 py-2.5 ring-1 ${theme.ring} transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.97] ${state !== 'idle' ? 'ring-2' : ''}`}
                  >
                    <span className="text-[10px] font-bold text-slate-400">{item.n}</span>
                    <span className="text-base font-bold leading-tight text-slate-800 dark:text-slate-100">{item.kana}</span>
                    <span className={`text-[10px] font-medium ${theme.text}`}>{item.read}</span>
                    <span className={`absolute right-1 top-1 ${state === 'idle' ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'} ${theme.text}`}>
                      <AudioIcon state={state} className="h-3 w-3" />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Chinese: one-hand number gestures 1–10 ───────────────────────────────────
function ZhGestures({ theme, play, stateFor }: AudioProps) {
  return (
    <section>
      <SectionTitle theme={theme} icon={<Layers className="h-4 w-4" />}>
        ท่ามือนับเลขจีน — Hand Gestures (1–10)
      </SectionTitle>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {ZH_GESTURES.map((g) => {
          const key = g.read;
          const state = stateFor(key);
          return (
            <button
              key={g.n}
              type="button"
              onClick={() => play({ key, audioUrl: audioSrc('zh', key) })}
              className={`group flex items-center gap-3 rounded-2xl bg-gradient-to-br ${theme.soft} px-3 py-2.5 text-left ring-1 ${theme.ring} transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] ${state !== 'idle' ? 'ring-2' : ''}`}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/70 text-xl dark:bg-slate-800/70">{g.emoji}</span>
              <span className="flex items-baseline gap-2">
                <span className="text-xl font-extrabold text-slate-800 dark:text-slate-100">{g.hanzi}</span>
                <span className={`text-xs font-semibold ${theme.text}`}>{g.read}</span>
              </span>
              <span className="ml-1 grow text-[11px] leading-tight text-slate-500 dark:text-slate-400">{g.gesture}</span>
              <span className={`shrink-0 ${state === 'idle' ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'} ${theme.text}`}>
                <AudioIcon state={state} className="h-3.5 w-3.5" />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ── Chinese: measure words — 二 vs 两 and 一 tone sandhi ──────────────────────
function ZhMeasures({ theme, play, stateFor }: AudioProps) {
  return (
    <section>
      <SectionTitle theme={theme} icon={<Layers className="h-4 w-4" />}>
        量词 — Measure Words (二 vs 两!)
      </SectionTitle>
      <div className={`mb-3 rounded-2xl bg-gradient-to-r ${theme.soft} px-4 py-2.5 text-xs font-medium text-slate-600 ring-1 ${theme.ring} dark:text-slate-300`}>
        💡 นับของให้ใช้ <b className="font-bold">两 (liǎng)</b> ไม่ใช่ <b className="font-bold">二 (èr)</b> — say 两, not 二, when counting things.
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {ZH_MEASURES.map((m) => {
          const key = m.read;
          const state = stateFor(key);
          return (
            <button
              key={m.hanzi}
              type="button"
              onClick={() => play({ key, audioUrl: audioSrc('zh', key) })}
              className={`group relative flex flex-col items-start gap-0.5 rounded-2xl bg-gradient-to-br ${theme.soft} px-3 py-2.5 text-left ring-1 ${theme.ring} transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] ${state !== 'idle' ? 'ring-2' : ''}`}
            >
              <span className="flex items-baseline gap-1.5">
                <span className="text-xl font-extrabold text-slate-800 dark:text-slate-100">{m.hanzi}</span>
                <span className={`text-xs font-semibold ${theme.text}`}>{m.pinyin}</span>
              </span>
              <span className="text-[10px] leading-tight text-slate-500 dark:text-slate-400">{m.note}</span>
              <span className={`absolute right-1.5 top-1.5 ${state === 'idle' ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'} ${theme.text}`}>
                <AudioIcon state={state} className="h-3 w-3" />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ── Mini-game: Count & Match (see N items → pick the number) ──────────────────
const COUNT_EMOJIS = ['🍎', '⭐', '🐟', '🎈', '🚗', '🍪', '🌸', '🐤'];

function CountMatch({ theme }: { theme: Theme }) {
  const make = () => {
    const count = 1 + Math.floor(Math.random() * 10);
    const emoji = COUNT_EMOJIS[Math.floor(Math.random() * COUNT_EMOJIS.length)];
    const opts = new Set<number>([count]);
    while (opts.size < 4) opts.add(1 + Math.floor(Math.random() * 10));
    return { count, emoji, options: fisherYates([...opts]) };
  };

  const [round, setRound] = useState(make);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [burst, setBurst] = useState(0);

  function choose(opt: number) {
    if (picked != null) return;
    const ok = opt === round.count;
    setPicked(opt);
    setScore((s) => ({ correct: s.correct + (ok ? 1 : 0), total: s.total + 1 }));
    recordAnswer('numbers', ok);
    if (ok) { playCorrect(); setBurst((b) => b + 1); } else playWrong();
  }

  return (
    <section className="relative overflow-hidden rounded-2xl border border-dashed border-slate-200 p-4 dark:border-slate-700">
      {burst > 0 && <Confetti key={burst} />}
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className={`h-4 w-4 ${theme.text}`} />
        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">นับแล้วเลือก — Count &amp; Match</p>
        {score.total > 0 && (
          <span className="ml-auto rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            ✓ {score.correct}/{score.total}
          </span>
        )}
      </div>

      <div className="mb-3 flex min-h-[56px] flex-wrap items-center justify-center gap-1.5 rounded-xl bg-slate-50 p-3 text-2xl dark:bg-slate-800/50">
        {Array.from({ length: round.count }, (_, i) => <span key={i}>{round.emoji}</span>)}
      </div>

      <div className="grid grid-cols-4 gap-2">
        {round.options.map((o) => {
          const isCount = o === round.count;
          let style = 'bg-white text-slate-700 ring-slate-200 hover:ring-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700';
          if (picked != null) {
            if (isCount) style = 'bg-emerald-50 text-emerald-700 ring-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800';
            else if (o === picked) style = 'bg-red-50 text-red-600 ring-red-300 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-800';
            else style = 'bg-slate-50 text-slate-400 ring-slate-100 dark:bg-slate-800/50 dark:text-slate-500 dark:ring-slate-800';
          }
          return (
            <button
              key={o}
              type="button"
              onClick={() => choose(o)}
              disabled={picked != null}
              className={`relative flex items-center justify-center rounded-2xl py-3 text-xl font-extrabold ring-1 transition-all ${style} ${picked == null ? 'active:scale-95' : ''}`}
            >
              {o}
              {picked != null && isCount && <Check className="absolute right-1 top-1 h-4 w-4 text-emerald-500" />}
              {picked != null && o === picked && !isCount && <X className="absolute right-1 top-1 h-4 w-4 text-red-500" />}
            </button>
          );
        })}
      </div>

      {picked != null && (
        <button
          type="button"
          onClick={() => { setRound(make()); setPicked(null); }}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-50 py-2.5 text-sm font-medium text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-700"
        >
          <RefreshCw className="h-4 w-4" /> ข้อต่อไป — Next
        </button>
      )}
    </section>
  );
}

// ═════════════════════════════ LEVEL 2 — BIG NUMBERS ════════════════════════
function BigView({ lang, theme, play, stateFor }: AudioProps) {
  const [selected, setSelected] = useState<BigNumber>(
    BIG_NUMBERS.find((b) => b.value === 100000) ?? BIG_NUMBERS[0],
  );

  return (
    <div className="space-y-6">
      {/* Milestone tiles */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {BIG_NUMBERS.map((b) => {
          const form = bigFormFor(b, lang);
          const key = form.read;
          const state = stateFor(key);
          const active = b.value === selected.value;
          return (
            <button
              key={b.value}
              type="button"
              onClick={() => { setSelected(b); play({ key, audioUrl: audioSrc(lang, key) }); }}
              className={`group relative flex flex-col items-start gap-0.5 rounded-2xl bg-gradient-to-br ${theme.soft} px-3 py-3 text-left ring-1 ${theme.ring} transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] ${
                active ? 'ring-2' : ''
              } ${b.highlight ? 'outline outline-2 outline-offset-2 outline-amber-400/70' : ''}`}
            >
              <span className="text-[11px] font-semibold text-slate-400">{groupWestern(b.value)}</span>
              <span className="text-xl font-extrabold leading-tight text-slate-800 dark:text-slate-100">{form.glyph}</span>
              <span className={`text-[11px] font-medium ${theme.text}`}>{form.read}</span>
              {b.highlight && (
                <span className="mt-1 rounded-full bg-amber-400/90 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-950">
                  ฐานเอเชีย · base unit
                </span>
              )}
              <span className={`absolute right-1.5 top-1.5 ${state === 'idle' ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'} ${theme.text}`}>
                <AudioIcon state={state} className="h-3.5 w-3.5" />
              </span>
            </button>
          );
        })}
      </div>

      {/* Place-value breakdown — the centrepiece */}
      <PlaceValueBreakdown value={selected} lang={lang} theme={theme} />

      {/* Mini-game: Price Tag Matcher */}
      <PriceTagMatcher lang={lang} theme={theme} play={play} stateFor={stateFor} />
    </div>
  );
}

// Chunk a number's digits from the right into groups of `size`.
function groupBy(value: number, size: number): string[] {
  const s = String(value);
  const out: string[] = [];
  for (let i = s.length; i > 0; i -= size) out.unshift(s.slice(Math.max(0, i - size), i));
  return out;
}

// Side-by-side: the SAME digits chunked the Western way (every 1,000) vs the
// Asian way (every 10,000 / 万) — the core "why 100,000 = 十万" insight.
function PlaceValueBreakdown({ value, lang, theme }: { value: BigNumber; lang: LocaleCode; theme: Theme }) {
  const western = groupBy(value.value, 3);
  const asian = groupBy(value.value, 4);
  const form = bigFormFor(value, lang);

  return (
    <section>
      <SectionTitle theme={theme} icon={<Layers className="h-4 w-4" />}>
        แยกหลักหน่วย — Place-Value Break-down
      </SectionTitle>

      <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200 dark:bg-slate-800/50 dark:ring-slate-700">
        <p className="mb-3 text-center text-2xl font-extrabold text-slate-800 dark:text-slate-100">{groupWestern(value.value)}</p>

        <div className="grid gap-3 sm:grid-cols-2">
          {/* Western grouping */}
          <DigitGroups
            title="ตะวันตก — Western"
            subtitle="จัดกลุ่มทุก 1,000 (thousand → million)"
            chunks={western}
            sep=","
            accent="bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
            compose={value.en.compose}
            word={value.en.glyph}
          />
          {/* Asian grouping */}
          <DigitGroups
            title="เอเชีย — Asian (万)"
            subtitle="จัดกลุ่มทุก 10,000 (万 = หมื่น)"
            chunks={asian}
            sep="·"
            accent="bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
            compose={lang === 'zh' ? value.zh.compose : value.ja.compose}
            word={lang === 'en' ? value.ja.glyph : form.glyph}
            traditional={lang === 'zh' ? value.zh.traditional : undefined}
            highlightLast={value.value >= 10000}
          />
        </div>

        <p className="mt-3 rounded-xl bg-white/70 px-3 py-2 text-center text-[11px] text-slate-500 ring-1 ring-slate-200 dark:bg-slate-900/50 dark:text-slate-400 dark:ring-slate-700">
          💡 จำนวนเดียวกัน แต่จัดกลุ่มต่างกัน — same number, different grouping. นี่คือจุดที่ผู้เรียนสับสนบ่อยที่สุด!
        </p>
      </div>
    </section>
  );
}

function DigitGroups({
  title, subtitle, chunks, sep, accent, compose, word, traditional, highlightLast,
}: {
  title: string; subtitle: string; chunks: string[]; sep: string; accent: string;
  compose: string; word: string; traditional?: string; highlightLast?: boolean;
}) {
  return (
    <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
      <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{title}</p>
      <p className="mb-2 text-[10px] text-slate-400">{subtitle}</p>
      <div className="mb-2 flex flex-wrap items-center gap-1">
        {chunks.map((c, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <span className="text-slate-400">{sep}</span>}
            <span className={`rounded-md px-1.5 py-1 font-mono text-sm font-bold ${
              highlightLast && i === chunks.length - 1 ? 'bg-amber-200 text-amber-900 dark:bg-amber-800/60 dark:text-amber-200' : accent
            }`}>{c}</span>
          </span>
        ))}
      </div>
      <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">{word}</p>
      <p className="text-[11px] text-slate-400">{compose}</p>
      {traditional && <p className="text-[10px] text-slate-400">繁體 (traditional): {traditional}</p>}
    </div>
  );
}

// ── Mini-game: Price Tag Matcher (hear a price → pick the digits) ─────────────
function PriceTagMatcher({ lang, theme, play, stateFor }: AudioProps) {
  const cfg = PRICES[lang];

  const make = () => {
    const value = cfg.values[Math.floor(Math.random() * cfg.values.length)];
    const opts = new Set<number>([value]);
    // The teaching trap: a same-digits value off by one zero (×10 / ÷10).
    if (value * 10 <= 99999999) opts.add(value * 10);
    if (value % 10 === 0) opts.add(value / 10);
    // Top up from the pool until we have four choices.
    let guard = 0;
    while (opts.size < 4 && guard++ < 50) {
      opts.add(cfg.values[Math.floor(Math.random() * cfg.values.length)]);
    }
    return { value, options: fisherYates([...opts].slice(0, 4)) };
  };

  const [round, setRound] = useState(make);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [burst, setBurst] = useState(0);

  const target: PlayTarget = { key: `price-${round.value}`, audioUrl: audioSrc(lang, `price-${round.value}`) };

  // Audio must NEVER autoplay (e.g. when this mounts on a tab switch). It plays
  // only on explicit user action: the Listen button, or advancing to a new round.
  function nextRound() {
    const r = make();
    setRound(r);
    setPicked(null);
    play({ key: `price-${r.value}`, audioUrl: audioSrc(lang, `price-${r.value}`) });
  }

  function choose(opt: number) {
    if (picked != null) return;
    const ok = opt === round.value;
    setPicked(opt);
    setScore((s) => ({ correct: s.correct + (ok ? 1 : 0), total: s.total + 1 }));
    recordAnswer('numbers', ok);
    if (ok) { playCorrect(); setBurst((b) => b + 1); } else playWrong();
  }

  return (
    <section className="relative overflow-hidden rounded-2xl border border-dashed border-slate-200 p-4 dark:border-slate-700">
      {burst > 0 && <Confetti key={burst} />}
      <div className="mb-3 flex items-center gap-2">
        <Coins className={`h-4 w-4 ${theme.text}`} />
        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">ทายราคา — Price Tag Matcher</p>
        {score.total > 0 && (
          <span className="ml-auto rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            ✓ {score.correct}/{score.total}
          </span>
        )}
      </div>

      <div className="mb-3 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => play(target)}
          className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 transition hover:scale-110 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700"
          aria-label="เล่นเสียงราคา — Play price"
        >
          <AudioIcon state={stateFor(target.key)} className="h-5 w-5" />
        </button>
        <span className="text-xs text-slate-400">แตะเพื่อฟังราคาอีกครั้ง — tap to hear the price</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {round.options.map((o) => {
          const isTarget = o === round.value;
          let style = 'bg-white text-slate-700 ring-slate-200 hover:ring-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700';
          if (picked != null) {
            if (isTarget) style = 'bg-emerald-50 text-emerald-700 ring-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800';
            else if (o === picked) style = 'bg-red-50 text-red-600 ring-red-300 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-800';
            else style = 'bg-slate-50 text-slate-400 ring-slate-100 dark:bg-slate-800/50 dark:text-slate-500 dark:ring-slate-800';
          }
          return (
            <button
              key={o}
              type="button"
              onClick={() => choose(o)}
              disabled={picked != null}
              className={`relative flex items-center justify-center rounded-2xl py-3 text-base font-extrabold ring-1 transition-all ${style} ${picked == null ? 'active:scale-95' : ''}`}
            >
              {formatPrice(o, lang)}
              {picked != null && isTarget && <Check className="absolute right-1.5 top-1.5 h-4 w-4 text-emerald-500" />}
              {picked != null && o === picked && !isTarget && <X className="absolute right-1.5 top-1.5 h-4 w-4 text-red-500" />}
            </button>
          );
        })}
      </div>

      {picked != null && (
        <button
          type="button"
          onClick={nextRound}
          className={`mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r ${theme.quiz} py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl active:scale-[0.98]`}
        >
          <RefreshCw className="h-4 w-4" /> ราคาต่อไป — Next price
        </button>
      )}
    </section>
  );
}

// ── Small shared section header ──────────────────────────────────────────────
function SectionTitle({ theme, icon, children }: { theme: Theme; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className={theme.text}>{icon}</span>
      <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">{children}</h3>
    </div>
  );
}

// ── Confetti burst (pure CSS, keyframes in globals.css) ──────────────────────
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
