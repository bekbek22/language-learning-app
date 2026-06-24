'use client';

import { useEffect, useRef, useState } from 'react';
import { getProgress, recordAnswer, resetProgress, onProgressChange, type Progress } from '../lib/progress';
import { getLocale, onLocaleChange, optionFor, type LocaleCode } from '../lib/locale';

type Check = { pattern: string; message: string };
type WritingChallenge = {
  thai: string;
  answer: string;
  accept?: string[];
  anchors: string[];
  checks: Check[];
};

type Verdict = 'perfect' | 'close' | 'review';
type Result = { verdict: Verdict; issues: string[] } | null;

// ── Fallback pool (used when the API is unavailable) ─────────────────────────
const FALLBACK: WritingChallenge[] = [
  {
    thai: 'เมื่อวานนี้ฉันไปตลาดและซื้อแอปเปิ้ลมา 3 ลูก',
    answer: 'Yesterday I went to the market and bought three apples.',
    accept: ['i went to the market yesterday and bought three apples'],
    anchors: ['went', 'market', 'bought', 'apples'],
    checks: [
      { pattern: '\\bgo(es)?\\b', message: 'ใช้ went (อดีต) แทน go' },
      { pattern: '\\bbuy(s)?\\b', message: 'ใช้ bought (อดีต) แทน buy' },
      { pattern: '\\b(3|three)\\s+apple\\b', message: 'เติม s พหูพจน์ → apples' },
    ],
  },
  {
    thai: 'เธอกินข้าวเช้าทุกวัน',
    answer: 'She eats breakfast every day.',
    anchors: ['eats', 'breakfast', 'every'],
    checks: [
      { pattern: '\\bshe\\s+eat\\b', message: 'ประธานเอกพจน์ใช้ eats' },
    ],
  },
  {
    thai: 'ฉันชอบดูหนังมาก',
    answer: 'I really like watching movies.',
    accept: ['i like watching movies very much'],
    anchors: ['like', 'watching', 'movies'],
    checks: [
      { pattern: '\\bvery\\s+like\\b', message: 'ใช้ really like หรือ like ... very much' },
    ],
  },
  {
    thai: 'อากาศวันนี้ร้อนมาก',
    answer: 'The weather is very hot today.',
    accept: ['it is very hot today'],
    anchors: ['weather', 'hot', 'today'],
    checks: [
      { pattern: '\\bweather\\s+are\\b', message: 'weather เป็นเอกพจน์ ใช้ is' },
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

// ── Two-layer evaluation: acceptance + pitfall regex ─────────────────────────
// Normalization is locale-aware: English collapses to lowercase words, while CJK
// languages (zh/ja) have no word spacing and must keep their characters intact —
// stripping non-Latin would erase the whole answer.
function normalize(s: string, lang: LocaleCode): string {
  const lower = s.toLowerCase().trim();
  if (lang === 'en') {
    return lower.replace(/[^a-z0-9\s']/g, '').replace(/\s+/g, ' ').trim();
  }
  // zh/ja: drop whitespace and shared punctuation, keep CJK + latin + digits.
  return lower.replace(/\s+/g, '').replace(/[。、，．,.!！?？；;：:「」『』（）()·・…—~〜]/g, '');
}

// Romanized comparison for zh/ja so absolute beginners can answer in pinyin or
// romaji instead of typing Hanzi/Kanji. Strips tone marks (diacritics), tone
// digits, spaces and punctuation, so "nǐ hǎo", "ni3 hao3" and "ni hao" all
// collapse to the same key. Non-Latin (CJK) text → '' and is ignored.
function normalizeRoman(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
}

// CJK has no word boundaries, so anchors are matched as substrings; English keeps
// word-boundary matching to avoid partial-word false positives.
function hasAnchor(norm: string, anchor: string, lang: LocaleCode): boolean {
  const a = lang === 'en' ? anchor.toLowerCase() : normalize(anchor, lang);
  if (a === '') return false;
  if (lang === 'en') {
    const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escape(a)}\\b`, 'i').test(norm);
  }
  return norm.includes(a);
}

const ANCHOR_THRESHOLD = 0.7;
const OFF_TOPIC_MSG =
  'คำตอบของคุณดูไม่เกี่ยวข้องกับโจทย์ หรือขาดคำศัพท์สำคัญไป ลองตรวจเช็กอีกครั้ง';

function evaluate(input: string, c: WritingChallenge, lang: LocaleCode): Result {
  const norm = normalize(input, lang);
  if (norm === '') return null;

  const accepted = [c.answer, ...(c.accept ?? [])].map((a) => normalize(a, lang));
  if (accepted.includes(norm)) return { verdict: 'perfect', issues: [] };

  // zh/ja: accept a pinyin / romaji answer that matches any romanized form in
  // the accept list (CJK entries romanize to '' and are skipped).
  if (lang !== 'en') {
    const inputRoman = normalizeRoman(input);
    const acceptedRoman = [c.answer, ...(c.accept ?? [])].map(normalizeRoman).filter(Boolean);
    if (inputRoman && acceptedRoman.includes(inputRoman)) return { verdict: 'perfect', issues: [] };
  }

  // Specific pitfalls win: a matched grammar error means the answer is an on-topic
  // attempt, so always surface the targeted hint (even if it omits anchor words —
  // inflected anchors like "went"/"bought" are exactly what a tense error drops).
  const issues = c.checks
    .filter((chk) => new RegExp(chk.pattern, 'i').test(norm))
    .map((chk) => chk.message);
  if (issues.length > 0) return { verdict: 'review', issues };

  // No recognized pitfall — use anchors to tell a legit paraphrase ('close') apart
  // from nonsense / off-topic input.
  if (c.anchors.length > 0) {
    const hits = c.anchors.filter((a) => hasAnchor(norm, a, lang)).length;
    if (hits / c.anchors.length < ANCHOR_THRESHOLD) {
      return { verdict: 'review', issues: [OFF_TOPIC_MSG] };
    }
  }

  return { verdict: 'close', issues: [] };
}

// ─────────────────────────────────────────────────────────────────────────────
export default function WritingModule() {
  const [challenge, setChallenge] = useState<WritingChallenge | null>(null);
  const [isLoading, setIsLoading] = useState(true); // only true on initial mount
  const [input, setInput]         = useState('');
  const [status, setStatus]       = useState<'idle' | 'checked'>('idle');
  const [result, setResult]       = useState<Result>(null);
  const [progress, setProgress]   = useState<Progress | null>(null);
  const [lang, setLang]           = useState<LocaleCode>('en');

  // AI batch queue
  const aiQueue     = useRef<WritingChallenge[]>([]);
  const isRefilling = useRef(false);
  const langRef     = useRef<LocaleCode>('en'); // current locale for background refills

  // Fallback shuffle queue
  const fbQueue   = useRef<number[]>([]);
  const fbLastIdx = useRef(-1);

  function nextFallback(): WritingChallenge {
    if (fbQueue.current.length === 0) {
      fbQueue.current = shuffledIndices(FALLBACK.length, fbLastIdx.current);
    }
    const idx = fbQueue.current.pop()!;
    fbLastIdx.current = idx;
    return FALLBACK[idx];
  }

  async function fetchBatch(l: LocaleCode): Promise<WritingChallenge[]> {
    const res = await fetch(`/api/writing?lang=${l}`, { cache: 'no-store' });
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

  function popNext(): WritingChallenge {
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

  // Load (and reload on language switch): reset the queues, refetch from the
  // active locale, and show the first challenge. `cancelled` drops a stale
  // in-flight fetch when the language changes mid-request.
  useEffect(() => {
    langRef.current = lang;
    let cancelled = false;
    setIsLoading(true);
    aiQueue.current = [];
    fbQueue.current = [];
    fbLastIdx.current = -1;
    setInput('');
    setStatus('idle');
    setResult(null);
    (async () => {
      try {
        const batch = await fetchBatch(lang);
        if (!cancelled) aiQueue.current = fisherYates(batch);
      } catch {
        // fallback queue will serve
      }
      if (!cancelled) {
        setChallenge(popNext());
        setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  // Load saved progress after mount (client only — avoids hydration mismatch)
  // and stay in sync when the other module records an answer or resets.
  useEffect(() => {
    setProgress(getProgress());
    return onProgressChange(() => setProgress(getProgress()));
  }, []);

  function nextChallenge() {
    setChallenge(popNext());
    setInput('');
    setStatus('idle');
    setResult(null);
  }

  function check() {
    if (!challenge) return;
    const r = evaluate(input, challenge, lang);
    setResult(r);
    setStatus('checked');
    // perfect & close count as correct; review counts as incorrect
    if (r) setProgress(recordAnswer('writing', r.verdict !== 'review'));
  }

  function retry() {
    setInput('');
    setStatus('idle');
    setResult(null);
  }

  const banner =
    result?.verdict === 'perfect'
      ? { icon: '🎉', ring: 'ring-emerald-200 shadow-emerald-100/60 dark:ring-emerald-900/60', dot: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-300', title: 'text-emerald-700 dark:text-emerald-300', text: 'ถูกต้อง! — Correct!' }
      : result?.verdict === 'close'
      ? { icon: '👍', ring: 'ring-amber-200 shadow-amber-100/60 dark:ring-amber-900/60', dot: 'bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-300', title: 'text-amber-700 dark:text-amber-300', text: 'ใช้ได้! ลองเทียบกับเฉลย — Acceptable!' }
      : { icon: '✏️', ring: 'ring-red-200 shadow-red-100/60 dark:ring-red-900/60', dot: 'bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-300', title: 'text-red-700 dark:text-red-300', text: 'ลองแก้จุดนี้ — Let’s fix these' };

  return (
    <div className="rounded-3xl bg-white p-6 text-left shadow-sm ring-1 ring-slate-200/70 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-200/60 dark:bg-slate-900 dark:ring-slate-800 dark:hover:shadow-black/40">
      {/* Header */}
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-xl shadow-md shadow-emerald-500/30">
          ✍️
        </div>
        <div>
          <p className="text-lg font-bold text-slate-800 dark:text-slate-100">การเขียน</p>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">Writing</p>
        </div>
      </div>

      {/* Prompt area */}
      <div className="mb-4 flex min-h-[84px] items-center rounded-2xl bg-gradient-to-br from-emerald-50/70 to-teal-50/40 px-5 py-4 ring-1 ring-emerald-100/70 dark:from-emerald-950/40 dark:to-teal-950/30 dark:ring-emerald-900/40">
        {isLoading ? (
          <div className="flex items-center gap-2 text-emerald-400">
            <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-400 [animation-delay:-0.3s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-400 [animation-delay:-0.15s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-400" />
            <span className="ml-1 text-sm">กำลังโหลด…</span>
          </div>
        ) : challenge ? (
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              แปลเป็นภาษา{optionFor(lang).thaiName} — Translate to {optionFor(lang).label}
            </p>
            <p className="text-xl font-semibold leading-snug text-slate-800 dark:text-slate-100">{challenge.thai}</p>
          </div>
        ) : (
          <p className="text-sm text-slate-400">ไม่สามารถโหลดโจทย์ได้</p>
        )}
      </div>

      {/* Progress stats */}
      {progress && (
        <div className="mb-3 flex items-center gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            ✓ {progress.writing.correct}/{progress.writing.total}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            🔥 {progress.currentStreak}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            สูงสุด {progress.bestStreak}
          </span>
          <button
            onClick={() => setProgress(resetProgress())}
            className="ml-auto rounded-full px-2 py-1 text-xs text-slate-300 transition hover:bg-slate-100 hover:text-slate-500 dark:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            รีเซ็ต
          </button>
        </div>
      )}

      {/* Input */}
      {challenge && !isLoading && (
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={status === 'checked'}
          rows={2}
          placeholder={
            lang === 'zh' ? 'พิมพ์อักษรจีนหรือพินอินก็ได้…'
            : lang === 'ja' ? 'พิมพ์คันจิ โรมาจิ หรือฮิรางานะก็ได้…'
            : 'พิมพ์คำแปลที่นี่…'
          }
          className="w-full resize-none rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none ring-1 ring-slate-200 transition focus:bg-white focus:ring-2 focus:ring-emerald-300 disabled:text-slate-500 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700 dark:placeholder:text-slate-500 dark:focus:bg-slate-900 dark:focus:ring-emerald-500 dark:disabled:text-slate-400"
        />
      )}

      {/* Feedback — floating dashboard card */}
      {status === 'checked' && result && challenge && (
        <div className={`mt-3 rounded-2xl bg-white p-4 shadow-lg ring-1 dark:bg-slate-800 ${banner.ring}`}>
          <div className="flex items-center gap-2.5">
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm ${banner.dot}`}>
              {banner.icon}
            </span>
            <p className={`text-sm font-semibold ${banner.title}`}>{banner.text}</p>
          </div>
          {result.issues.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {result.issues.map((msg) => (
                <span key={msg} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-200">
                  {msg}
                </span>
              ))}
            </div>
          )}
          {result.verdict !== 'perfect' && (
            <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
              เฉลย — Answer: <span className="font-medium italic text-slate-700 dark:text-slate-200">&ldquo;{challenge.answer}&rdquo;</span>
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="mt-4">
        {status === 'idle' ? (
          <div className="space-y-2.5">
            <button
              onClick={check}
              disabled={isLoading || !challenge || normalize(input, lang) === ''}
              className="w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all hover:shadow-emerald-500/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              ✓ ตรวจคำตอบ — Check
            </button>
            <button
              onClick={nextChallenge}
              disabled={isLoading}
              className="w-full rounded-2xl bg-slate-50 py-3 text-sm font-medium text-slate-500 ring-1 ring-slate-200 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-100"
            >
              ✍️ ข้อใหม่ — New Challenge
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={retry}
              className="flex-1 rounded-2xl bg-emerald-50 py-3 text-sm font-semibold text-emerald-600 ring-1 ring-emerald-200 transition hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900/50 dark:hover:bg-emerald-950/60"
            >
              ลองอีกครั้ง — Try Again
            </button>
            <button
              onClick={nextChallenge}
              className="flex-1 rounded-2xl bg-slate-50 py-3 text-sm font-medium text-slate-500 ring-1 ring-slate-200 transition hover:bg-slate-100 hover:text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-100"
            >
              ✍️ ข้อใหม่ — New
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
