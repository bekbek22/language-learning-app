// Tiny WebAudio sound-effects layer for quiz feedback. Synthesizes short tones
// on the fly (no asset files), so it works offline and adds nothing to bundle
// weight. The AudioContext is created lazily on first use — browsers only allow
// it to start inside a user gesture, and every call here happens on a tap.

let ctx: AudioContext | null = null;

function audioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx = ctx ?? new AC();
  // A suspended context (autoplay policy) resumes once we're inside a gesture.
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

// One short note: a sine "blip" with a quick fade so it never clicks.
function note(c: AudioContext, freq: number, start: number, dur: number, gain = 0.18) {
  const osc = c.createOscillator();
  const env = c.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  const t = c.currentTime + start;
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(gain, t + 0.01);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(env).connect(c.destination);
  osc.start(t);
  osc.stop(t + dur);
}

// Happy little rising arpeggio (C5 → E5 → G5).
export function playCorrect(): void {
  const c = audioCtx();
  if (!c) return;
  note(c, 523.25, 0, 0.16);
  note(c, 659.25, 0.09, 0.16);
  note(c, 783.99, 0.18, 0.22);
}

// Gentle, non-punishing low "boop" (two soft descending notes).
export function playWrong(): void {
  const c = audioCtx();
  if (!c) return;
  note(c, 311.13, 0, 0.18, 0.14);
  note(c, 233.08, 0.12, 0.24, 0.14);
}
