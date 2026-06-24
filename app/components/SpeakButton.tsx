'use client';

import { useEffect, useRef, useState } from 'react';
import { speak } from '../lib/speak';
import { bcp47For, type LocaleCode } from '../lib/locale';
import { speechFileUrl } from '../lib/audioFile';

type Props = {
  text: string;
  /** Active target-language code; selects the matching clip / TTS voice. */
  langCode?: LocaleCode;
  className?: string;
};

// Circular speaker button.
//
// For zh/ja it plays a pre-rendered native recording
// (public/audio/<lang>/tts/<hash>.mp3) so pronunciation is correct even on
// devices that have no Chinese/Japanese TTS voice installed — that missing-voice
// case is why Vocab/Conversation audio silently failed in production. English
// uses the browser's (universally available) voice directly. Any clip that is
// missing or fails to load falls back to browser speech synthesis.
export default function SpeakButton({ text, langCode = 'en', className = '' }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  // Release audio on unmount.
  useEffect(() => () => { audioRef.current?.pause(); }, []);

  function play() {
    // English: the browser voice is always present and accurate — skip the file
    // round-trip entirely.
    if (langCode === 'en') {
      speak(text, bcp47For(langCode));
      return;
    }

    const a = audioRef.current ?? new Audio();
    audioRef.current = a;
    a.pause();
    a.src = speechFileUrl(langCode, text);

    let settled = false;
    const fallback = () => {
      if (settled) return;
      settled = true;
      setPlaying(false);
      speak(text, bcp47For(langCode)); // clip missing / failed → browser TTS
    };

    a.onended = () => setPlaying(false);
    a.onerror = fallback;
    setPlaying(true);
    a.play().then(() => { settled = true; }).catch(fallback);
  }

  return (
    <button
      type="button"
      onClick={play}
      aria-label={`ฟังเสียง — Listen to "${text}"`}
      title="ฟังเสียง — Listen"
      className={`group inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-base text-slate-500 shadow-sm ring-1 ring-slate-200 transition-all duration-200 hover:scale-110 hover:text-slate-800 hover:shadow-md hover:ring-slate-300 active:scale-95 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-100 ${className}`}
    >
      <span className={`transition-transform duration-200 group-hover:scale-110 ${playing ? 'animate-pulse' : ''}`}>🔊</span>
    </button>
  );
}
