'use client';

import { useState } from 'react';
import { RotateCcw, Check } from 'lucide-react';
import { resetProgress } from '../lib/progress';

// Wipes ALL localStorage-backed progress — per-module scores, streaks, and the
// "Letters Collected" gold stars (progress.ts `mastered`) — so a beta tester can
// run the complete beginner experience from zero again. Two-step to avoid an
// accidental wipe; resetProgress() broadcasts so every mounted module re-reads.
export default function ResetProgressButton() {
  const [phase, setPhase] = useState<'idle' | 'confirm' | 'done'>('idle');

  function doReset() {
    resetProgress();
    setPhase('done');
    setTimeout(() => setPhase('idle'), 2000);
  }

  if (phase === 'done') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-500">
        <Check className="h-3.5 w-3.5" /> ล้างข้อมูลแล้ว — Progress reset
      </span>
    );
  }

  if (phase === 'confirm') {
    return (
      <span className="inline-flex items-center gap-2 text-xs">
        <span className="text-slate-500 dark:text-slate-400">แน่ใจไหม? — Sure?</span>
        <button
          type="button"
          onClick={doReset}
          className="rounded-full bg-red-500 px-3 py-1 font-semibold text-white transition hover:bg-red-600"
        >
          ล้างเลย — Yes, reset
        </button>
        <button
          type="button"
          onClick={() => setPhase('idle')}
          className="rounded-full px-2 py-1 font-medium text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200"
        >
          ยกเลิก
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPhase('confirm')}
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
    >
      <RotateCcw className="h-3.5 w-3.5" /> ล้างข้อมูลการเรียนใหม่ — Reset Progress
    </button>
  );
}
