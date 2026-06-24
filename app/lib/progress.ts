// localStorage-backed progress tracking for the scoring modules (Vocab + Writing).
// All reads/writes are SSR-safe so Next.js never throws during server render.

export type ModuleStats = { correct: number; total: number };
export type ModuleKey = 'vocab' | 'writing' | 'alphabet' | 'numbers';
export type Progress = {
  vocab: ModuleStats;
  writing: ModuleStats;
  alphabet: ModuleStats;
  numbers: ModuleStats;
  currentStreak: number; // consecutive correct answers across scoring modules
  bestStreak: number;
  // Glyphs the learner has gotten right at least once, keyed by language code
  // (e.g. mastered.en = ['A','B']). Powers the "letters collected" grid state.
  mastered: Record<string, string[]>;
};

const KEY = 'elp_progress';
const EVENT = 'elp_progress_change';

function empty(): Progress {
  return {
    vocab: { correct: 0, total: 0 },
    writing: { correct: 0, total: 0 },
    alphabet: { correct: 0, total: 0 },
    numbers: { correct: 0, total: 0 },
    currentStreak: 0,
    bestStreak: 0,
    mastered: {},
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
      alphabet: { correct: p?.alphabet?.correct ?? 0, total: p?.alphabet?.total ?? 0 },
      numbers: { correct: p?.numbers?.correct ?? 0, total: p?.numbers?.total ?? 0 },
      currentStreak: p?.currentStreak ?? 0,
      bestStreak: p?.bestStreak ?? 0,
      mastered: p?.mastered && typeof p.mastered === 'object' ? p.mastered : {},
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

// `mastery` (optional) marks a specific glyph as collected on a correct answer —
// used by the Alphabet module to light up tiles the learner has gotten right.
export function recordAnswer(
  module: ModuleKey,
  correct: boolean,
  mastery?: { lang: string; key: string },
): Progress {
  const p = getProgress();
  p[module].total += 1;
  if (correct) {
    p[module].correct += 1;
    p.currentStreak += 1;
    if (p.currentStreak > p.bestStreak) p.bestStreak = p.currentStreak;
    if (mastery) {
      const set = p.mastered[mastery.lang] ?? (p.mastered[mastery.lang] = []);
      if (!set.includes(mastery.key)) set.push(mastery.key);
    }
  } else {
    p.currentStreak = 0;
  }
  save(p);
  return p;
}

// Collect a glyph without affecting answer stats or the streak — used by games
// (e.g. Memory Match) where trial-and-error shouldn't punish the shared streak,
// but a successful match should still light up the "collected" star.
export function recordMastery(lang: string, key: string): Progress {
  const p = getProgress();
  const set = p.mastered[lang] ?? (p.mastered[lang] = []);
  if (!set.includes(key)) {
    set.push(key);
    save(p);
  }
  return p;
}

export function resetProgress(): Progress {
  const fresh = empty();
  save(fresh);
  return fresh;
}
