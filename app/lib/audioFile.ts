// Maps a spoken string (a vocab word or a conversation sentence) to a stable
// audio-clip URL under /public/audio/<lang>/tts/<hash>.mp3.
//
// Vocab & Conversation can't key clips by letter like the Alphabet module — the
// text is whole CJK words/sentences, which slug() would reduce to an empty
// string. Instead we hash the EXACT text the client speaks. scripts/fetch-audio.mjs
// renders the same files using a byte-for-byte copy of ttsHash(), so the file the
// browser requests always lines up with one on disk.

import { type LocaleCode } from './locale';

// cyrb53 — fast, well-distributed 53-bit string hash, no deps. Math.imul and the
// unsigned shifts behave identically in the browser and in Node, so the hash is
// stable across both. Keep this in sync with ttsHash() in scripts/fetch-audio.mjs.
export function ttsHash(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** Public URL of the pre-rendered native clip for `text` in `lang`. */
export function speechFileUrl(lang: LocaleCode, text: string): string {
  return `/audio/${lang}/tts/${ttsHash(text.trim())}.mp3`;
}
