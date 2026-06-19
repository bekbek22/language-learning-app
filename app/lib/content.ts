// ── Server-side locale content registry ─────────────────────────────────────
// Datasets are grouped by language code under app/data/<locale>/<kind>.json.
// To add a new target language: drop its three JSON files into app/data/<code>/,
// import them below, and add one REGISTRY entry — nothing else changes. Until a
// locale ships real content (its array is empty), getContent() transparently
// falls back to English, so the whole pipeline is "ready" the moment data lands.

import enPhrases from '../data/en/phrases.json';
import enVocab from '../data/en/vocab.json';
import enWriting from '../data/en/writing.json';

import zhPhrases from '../data/zh/phrases.json';
import zhVocab from '../data/zh/vocab.json';
import zhWriting from '../data/zh/writing.json';

import jaPhrases from '../data/ja/phrases.json';
import jaVocab from '../data/ja/vocab.json';
import jaWriting from '../data/ja/writing.json';

export type Kind = 'phrases' | 'vocab' | 'writing';
export const LOCALES = ['en', 'zh', 'ja'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

type Dataset = Record<Kind, unknown[]>;

const REGISTRY: Record<Locale, Dataset> = {
  en: { phrases: enPhrases, vocab: enVocab, writing: enWriting },
  zh: { phrases: zhPhrases, vocab: zhVocab, writing: zhWriting },
  ja: { phrases: jaPhrases, vocab: jaVocab, writing: jaWriting },
};

export function isLocale(value: string | null | undefined): value is Locale {
  return value != null && (LOCALES as readonly string[]).includes(value);
}

// Resolve the dataset for a kind in the requested locale, falling back to the
// default locale when the locale is unknown or has no content yet.
export function getContent(kind: Kind, lang: string | null | undefined): unknown[] {
  const locale: Locale = isLocale(lang) ? lang : DEFAULT_LOCALE;
  const data = REGISTRY[locale]?.[kind];
  return data && data.length > 0 ? data : REGISTRY[DEFAULT_LOCALE][kind];
}
