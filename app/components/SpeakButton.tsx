'use client';

import { useEffect, useState } from 'react';
import { speak, hasVoiceFor, isSpeechSupported } from '../lib/speak';
import { bcp47For, type LocaleCode } from '../lib/locale';

type Props = {
  text: string;
  /** Active target-language code; selects the matching TTS voice/script. */
  langCode?: LocaleCode;
  className?: string;
};

// Minimalist circular speaker button — reads `text` aloud using the voice that
// matches the active target language (handles Latin and CJK scripts cleanly).
// When no voice for the language is installed on the device, it shows a muted
// state and explains why, instead of failing silently.
export default function SpeakButton({ text, langCode = 'en', className = '' }: Props) {
  const lang = bcp47For(langCode);
  const [available, setAvailable] = useState(true); // assume yes until checked

  // Voices load asynchronously, so re-check on mount, on language change, and
  // when the browser fires `voiceschanged`.
  useEffect(() => {
    if (!isSpeechSupported()) return;
    const update = () => setAvailable(hasVoiceFor(lang));
    update();
    window.speechSynthesis.addEventListener('voiceschanged', update);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', update);
  }, [lang]);

  const title = available
    ? 'ฟังเสียง — Listen'
    : 'ยังไม่มีเสียงภาษานี้ในอุปกรณ์ — No voice for this language installed';

  return (
    <button
      type="button"
      onClick={() => speak(text, lang)}
      disabled={!available}
      aria-label={`ฟังเสียง — Listen to "${text}"`}
      title={title}
      className={`group inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-base text-slate-500 shadow-sm ring-1 ring-slate-200 transition-all duration-200 hover:scale-110 hover:text-slate-800 hover:shadow-md hover:ring-slate-300 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100 disabled:hover:text-slate-500 disabled:hover:shadow-sm disabled:hover:ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-100 ${className}`}
    >
      <span className="transition-transform duration-200 group-hover:scale-110">{available ? '🔊' : '🔇'}</span>
    </button>
  );
}
