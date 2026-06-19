// localStorage-backed progress tracking for the scoring modules (Vocab + Writing).
// All reads/writes are SSR-safe so Next.js never throws during server render.

export type ModuleStats = { correct: number; total: number };
export type ModuleKey = 'vocab' | 'writing';
export type Progress = {
  vocab: ModuleStats;
  writing: ModuleStats;
  currentStreak: number; // consecutive correct answers across scoring modules
  bestStreak: number;
};

const KEY = 'elp_progress';
const EVENT = 'elp_progress_change';

function empty(): Progress {
  return {
    vocab: { correct: 0, total: 0 },
    writing: { correct: 0, total: 0 },
    currentStreak: 0,
    bestStreak: 0,
  };
}

export function getProgress(): Progress {
  if (typeof window === 'undefined') return empty();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return empty();
    const p = JSON.parse(raw);
    // Defensive merge — tolerate older/partial saved shapes.
    return {
      vocab: { correct: p?.vocab?.correct ?? 0, total: p?.vocab?.total ?? 0 },
      writing: { correct: p?.writing?.correct ?? 0, total: p?.writing?.total ?? 0 },
      currentStreak: p?.currentStreak ?? 0,
      bestStreak: p?.bestStreak ?? 0,
    };
  } catch {
    return empty();
  }
}

function save(p: Progress): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // storage full / disabled — fail silently, stats just won't persist
  }
  // Broadcast so every mounted module re-reads — keeps the shared streak and
  // reset in sync across cards without lifting state to a common parent.
  window.dispatchEvent(new Event(EVENT));
}

// Subscribe to progress changes (same tab via EVENT, other tabs via 'storage').
// Returns an unsubscribe function. SSR-safe no-op on the server.
export function onProgressChange(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('storage', cb);
  };
}

export function recordAnswer(module: ModuleKey, correct: boolean): Progress {
  const p = getProgress();
  p[module].total += 1;
  if (correct) {
    p[module].correct += 1;
    p.currentStreak += 1;
    if (p.currentStreak > p.bestStreak) p.bestStreak = p.currentStreak;
  } else {
    p.currentStreak = 0;
  }
  save(p);
  return p;
}

export function resetProgress(): Progress {
  const fresh = empty();
  save(fresh);
  return fresh;
}
