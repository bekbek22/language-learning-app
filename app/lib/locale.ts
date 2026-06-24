// localStorage-backed active target-language selection, shared across the header
// selector and every learning module. Same broadcast pattern as progress.ts: a
// custom event keeps mounted components in sync within the tab, and the native
// 'storage' event syncs other tabs. All reads/writes are SSR-safe.

export type LocaleCode = 'en' | 'zh' | 'ja';

export type LocaleOption = {
  code: LocaleCode;
  flag: string;
  label: string;    // English name
  native: string;   // endonym shown in the dropdown
  thaiName: string; // Thai name, for the Thai-facing hero ("เรียนภาษา…")
  /** BCP-47 tag for SpeechSynthesis / SpeechRecognition. */
  bcp47: string;
};

export const LOCALES: readonly LocaleOption[] = [
  { code: 'en', flag: '🇬🇧', label: 'English',  native: 'English', thaiName: 'อังกฤษ', bcp47: 'en-US' },
  { code: 'zh', flag: '🇨🇳', label: 'Chinese',  native: '中文',     thaiName: 'จีน',    bcp47: 'zh-CN' },
  { code: 'ja', flag: '🇯🇵', label: 'Japanese', native: '日本語',   thaiName: 'ญี่ปุ่น', bcp47: 'ja-JP' },
];

export const DEFAULT_LOCALE: LocaleCode = 'en';

const KEY = 'elp_lang';
const EVENT = 'elp_lang_change';

export function isLocaleCode(value: string | null | undefined): value is LocaleCode {
  return value === 'en' || value === 'zh' || value === 'ja';
}

export function getLocale(): LocaleCode {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  try {
    const raw = window.localStorage.getItem(KEY);
    return isLocaleCode(raw) ? raw : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

export function setLocale(code: LocaleCode): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, code);
  } catch {
    // storage disabled — selection still applies for this session
  }
  // Broadcast so the selector and all modules re-read and refetch.
  window.dispatchEvent(new Event(EVENT));
}

// Subscribe to locale changes (same tab via EVENT, other tabs via 'storage').
// Returns an unsubscribe function. SSR-safe no-op on the server.
export function onLocaleChange(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('storage', cb);
  };
}

/** BCP-47 tag for a locale code, for speech APIs. */
export function bcp47For(code: LocaleCode): string {
  return LOCALES.find((l) => l.code === code)?.bcp47 ?? 'en-US';
}

/** Full option record for a locale code (falls back to the default locale). */
export function optionFor(code: LocaleCode): LocaleOption {
  return LOCALES.find((l) => l.code === code) ?? LOCALES[0];
}
