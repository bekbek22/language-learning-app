'use client';

import { useEffect, useRef, useState } from 'react';
import SpeakButton from './SpeakButton';
import Ruby from './Ruby';
import { getProgress, recordAnswer, resetProgress, onProgressChange, type Progress } from '../lib/progress';
import { getLocale, onLocaleChange, type LocaleCode } from '../lib/locale';

type VocabCard = {
  word: string;
  phonetic: string;
  thai_meaning: string;
  example: string;
  example_reading?: string; // romaji (ja) / pinyin (zh) of the example sentence
  choices: string[];
  audioUrl?: string; // optional premium-clip override for the word's pronunciation
};

type Result = 'correct' | 'wrong' | null;

// ── Fallback pool (used when Gemini is unavailable) ──────────────────────────
const FALLBACK: VocabCard[] = [
  {
    word: 'resilient',
    phonetic: '/rɪˈzɪliənt/',
    thai_meaning: 'ยืดหยุ่น, ฟื้นตัวได้',
    example: 'She is very resilient and bounced back quickly.',
    choices: ['ยืดหยุ่น, ฟื้นตัวได้', 'เปราะบาง', 'ท้าทาย', 'สับสน'],
  },
  {
    word: 'emphasize',
    phonetic: '/ˈemfəsaɪz/',
    thai_meaning: 'เน้นย้ำ',
    example: 'The teacher will emphasize the important points before the exam.',
    choices: ['เน้นย้ำ', 'สรุปความ', 'วิเคราะห์', 'อธิบาย'],
  },
  {
    word: 'opportunity',
    phonetic: '/ˌɒpəˈtjuːnɪti/',
    thai_meaning: 'โอกาส',
    example: 'This job is a great opportunity for your career.',
    choices: ['โอกาส', 'อุปสรรค', 'ความเสี่ยง', 'ประสบการณ์'],
  },
  {
    word: 'enormous',
    phonetic: '/ɪˈnɔːməs/',
    thai_meaning: 'ใหญ่โต, มหึมา',
    example: 'The elephant was enormous compared to the small dog.',
    choices: ['ใหญ่โต, มหึมา', 'เล็กมาก', 'หนักมาก', 'สูงมาก'],
  },
  {
    word: 'anxious',
    phonetic: '/ˈæŋkʃəs/',
    thai_meaning: 'กังวล, วิตกกังวล',
    example: 'He felt anxious before his big presentation at work.',
    choices: ['กังวล, วิตกกังวล', 'ตื่นเต้นดีใจ', 'โกรธมาก', 'เบื่อหน่าย'],
  },
  {
    word: 'persist',
    phonetic: '/pəˈsɪst/',
    thai_meaning: 'ยืนหยัด, ทำต่อไป',
    example: 'You must persist even when the work becomes difficult.',
    choices: ['ยืนหยัด, ทำต่อไป', 'ล้มเลิก', 'รอคอย', 'หลีกเลี่ยง'],
  },
  {
    word: 'grateful',
    phonetic: '/ˈɡreɪtfʊl/',
    thai_meaning: 'ขอบคุณ, รู้สึกซาบซึ้ง',
    example: 'I am grateful for all the help you gave me.',
    choices: ['ขอบคุณ, รู้สึกซาบซึ้ง', 'โกรธเคือง', 'ประหลาดใจ', 'อ่อนเพลีย'],
  },
  {
    word: 'negotiate',
    phonetic: '/nɪˈɡəʊʃieɪt/',
    thai_meaning: 'เจรจาต่อรอง',
    example: 'They had to negotiate the price before signing the contract.',
    choices: ['เจรจาต่อรอง', 'ยอมรับทันที', 'ปฏิเสธข้อเสนอ', 'ลงนามเอกสาร'],
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

// ─────────────────────────────────────────────────────────────────────────────
export default function VocabModule() {
  const [card, setCard]           = useState<VocabCard | null>(null);
  const [choices, setChoices]     = useState<string[]>([]); // shuffled per card
  const [isLoading, setIsLoading] = useState(true); // only true on initial mount
  const [selected, setSelected]   = useState<string | null>(null);
  const [result, setResult]       = useState<Result>(null);
  const [progress, setProgress]   = useState<Progress | null>(null);
  const [lang, setLang]           = useState<LocaleCode>('en');

  // AI batch queue
  const aiQueue     = useRef<VocabCard[]>([]);
  const isRefilling = useRef(false);
  const langRef     = useRef<LocaleCode>('en'); // current locale for background refills

  // Fallback shuffle queue
  const fbQueue   = useRef<number[]>([]);
  const fbLastIdx = useRef(-1);

  function nextFallback(): VocabCard {
    if (fbQueue.current.length === 0) {
      fbQueue.current = shuffledIndices(FALLBACK.length, fbLastIdx.current);
    }
    const idx = fbQueue.current.pop()!;
    fbLastIdx.current = idx;
    return FALLBACK[idx];
  }

  async function fetchBatch(l: LocaleCode): Promise<VocabCard[]> {
    const res = await fetch(`/api/vocab?lang=${l}`, { cache: 'no-store' });
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

  function popNext(): VocabCard {
    if (aiQueue.current.length <= 2 && !isRefilling.current) {
      refillInBackground();
    }
    return aiQueue.current.length > 0
      ? aiQueue.current.shift()!
      : nextFallback();
  }

  // Load a card and randomize the position of its 4 choices (index 0 is correct)
  function showCard(next: VocabCard) {
    setCard(next);
    setChoices(fisherYates(next.choices));
  }

  // Reflect the persisted target language after mount and stay in sync when it
  // changes from the header selector.
  useEffect(() => {
    setLang(getLocale());
    return onLocaleChange(() => setLang(getLocale()));
  }, []);

  // Load (and reload on language switch): reset the queues, refetch from the
  // active locale, and show the first card. `cancelled` drops a stale in-flight
  // fetch when the language changes mid-request.
  useEffect(() => {
    langRef.current = lang;
    let cancelled = false;
    setIsLoading(true);
    aiQueue.current = [];
    fbQueue.current = [];
    fbLastIdx.current = -1;
    setSelected(null);
    setResult(null);
    (async () => {
      try {
        const batch = await fetchBatch(lang);
        if (!cancelled) aiQueue.current = fisherYates(batch);
      } catch {
        // fallback queue will serve
      }
      if (!cancelled) {
        showCard(popNext());
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

  function nextWord() {
    showCard(popNext());
    setSelected(null);
    setResult(null);
  }

  function handleChoice(choice: string) {
    if (selected) return;
    const isCorrect = choice === card?.thai_meaning;
    setSelected(choice);
    setResult(isCorrect ? 'correct' : 'wrong');
    setProgress(recordAnswer('vocab', isCorrect));
  }

  return (
    <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-200/60 sm:p-6 dark:bg-slate-900 dark:ring-slate-800 dark:hover:shadow-black/40">
      {/* Header */}
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-500 text-xl shadow-md shadow-violet-500/30">
          📖
        </div>
        <div>
          <p className="text-lg font-bold text-slate-800 dark:text-slate-100">คำศัพท์</p>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-400">Vocabulary</p>
        </div>
      </div>

      {/* Word card */}
      <div className="mb-4 flex min-h-[88px] flex-col justify-center rounded-2xl bg-gradient-to-br from-violet-50/70 to-purple-50/40 px-5 py-4 ring-1 ring-violet-100/70 dark:from-violet-950/40 dark:to-purple-950/30 dark:ring-violet-900/40">
        {isLoading ? (
          <div className="flex items-center gap-2 text-violet-400">
            <span className="h-2 w-2 animate-bounce rounded-full bg-violet-400 [animation-delay:-0.3s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-violet-400 [animation-delay:-0.15s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-violet-400" />
            <span className="ml-1 text-sm">กำลังโหลด…</span>
          </div>
        ) : card ? (
          lang === 'en' ? (
            // English: IPA reads below the word, as it did before.
            <>
              <div className="flex items-center gap-2.5">
                <p className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">{card.word}</p>
                <SpeakButton text={card.word} langCode={lang} audioUrl={card.audioUrl} />
              </div>
              <p className="mt-1 text-sm text-violet-400">{card.phonetic}</p>
            </>
          ) : (
            // zh/ja: Pinyin / Romaji sits directly above the characters.
            <div className="flex items-center gap-2.5">
              <Ruby
                segments={[{ text: card.word, reading: card.phonetic }]}
                className="text-3xl font-extrabold tracking-tight leading-loose text-slate-900 dark:text-slate-50"
                rtClassName="text-sm font-medium text-violet-400"
              />
              <SpeakButton text={card.word} langCode={lang} audioUrl={card.audioUrl} />
            </div>
          )
        ) : (
          <p className="text-sm text-slate-400">ไม่สามารถโหลดคำได้</p>
        )}
      </div>

      {/* Progress stats */}
      {progress && (
        <div className="mb-4 flex items-center gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            ✓ {progress.vocab.correct}/{progress.vocab.total}
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

      {/* Choices */}
      {card && !isLoading && (
        <div className="mb-4 space-y-2">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            คำนี้แปลว่าอะไร? — What does this mean?
          </p>
          {choices.map((choice) => {
            const isSelected = selected === choice;
            const isCorrect  = choice === card.thai_meaning;
            let style = 'bg-white text-slate-700 ring-slate-200 hover:ring-violet-300 hover:bg-violet-50/50 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700 dark:hover:ring-violet-500 dark:hover:bg-violet-950/30';
            if (selected) {
              if (isCorrect)       style = 'bg-emerald-50 text-emerald-800 ring-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800';
              else if (isSelected) style = 'bg-red-50 text-red-700 ring-red-300 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-800';
              else                 style = 'bg-slate-50 text-slate-400 ring-slate-100 dark:bg-slate-800/50 dark:text-slate-500 dark:ring-slate-800';
            }
            return (
              <button
                key={choice}
                onClick={() => handleChoice(choice)}
                disabled={!!selected}
                className={`flex min-h-[52px] w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-medium ring-1 transition-all ${style} disabled:cursor-default ${!selected ? 'active:scale-[0.99]' : ''}`}
              >
                <span>{choice}</span>
                {selected && isCorrect  && <span className="text-emerald-600 dark:text-emerald-400">✓</span>}
                {selected && isSelected && !isCorrect && <span className="text-red-500 dark:text-red-400">✗</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* Feedback */}
      {result && card && (
        <div className={`mb-4 rounded-2xl bg-white p-4 shadow-lg ring-1 dark:bg-slate-800 ${result === 'correct' ? 'shadow-emerald-100/60 ring-emerald-200 dark:ring-emerald-900/60' : 'shadow-red-100/60 ring-red-200 dark:ring-red-900/60'}`}>
          <div className="flex items-center gap-2.5">
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm ${result === 'correct' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-300' : 'bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-300'}`}>
              {result === 'correct' ? '🎉' : '✗'}
            </span>
            {result === 'correct' ? (
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">ถูกต้อง! — Correct!</p>
            ) : (
              <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                ไม่ถูก — เฉลย: <span className="underline">{card.thai_meaning}</span>
              </p>
            )}
          </div>
          <p className="mt-2 text-xs italic text-slate-500 dark:text-slate-400">&ldquo;{card.example}&rdquo;</p>
          {card.example_reading && (
            <p className="mt-0.5 text-[11px] font-medium not-italic text-violet-400">{card.example_reading}</p>
          )}
        </div>
      )}

      {/* New word button */}
      <button
        onClick={nextWord}
        disabled={isLoading}
        className="min-h-[48px] w-full rounded-2xl bg-slate-50 py-3 text-sm font-medium text-slate-500 ring-1 ring-slate-200 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-100"
      >
        ✨ คำใหม่ — New Word
      </button>
    </div>
  );
}
