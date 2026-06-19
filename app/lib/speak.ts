// Reusable wrapper around the Web Speech Synthesis API.
// Speaks text in an English locale so learners hear native pronunciation.

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

// `lang` is a BCP-47 tag (e.g. 'en-US', 'zh-CN', 'ja-JP') so the synthesizer
// picks the correct voice/script for the active target language.
export function speak(text: string, lang: string = 'en-US'): void {
  if (!isSpeechSupported()) return;
  const synth = window.speechSynthesis;
  // Cancel anything already queued/speaking so rapid clicks don't stack or get
  // stuck when synthesis is busy — the newest request always wins.
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  // Prefer a voice that actually matches the locale when one is installed; the
  // browser otherwise falls back to its default, which can mangle CJK scripts.
  const voices = synth.getVoices();
  const match = voices.find((v) => v.lang === lang)
    ?? voices.find((v) => v.lang.split('-')[0] === lang.split('-')[0]);
  if (match) utterance.voice = match;
  utterance.rate = 0.9; // slightly slower for clarity
  synth.speak(utterance);
}
