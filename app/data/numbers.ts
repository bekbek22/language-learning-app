// Static data for the "Numbers & Units/Counters" module, one block per language.
// Framework-free (no imports beyond the LocaleCode type) so it can be pulled into
// client or server code, mirroring app/data/alphabet.ts.
//
// AUDIO: every spoken item exposes a `read` (romaji / pinyin / English word). The
// module builds  /audio/<lang>/n/<slug(read)>.mp3  from it (see NumbersModule's
// audioSrc). Number audio lives in its own `n/` subfolder so a key like Chinese
// 十 "shí" → "shi" never collides with the pinyin-initial file shi.mp3 in
// /audio/zh/. `read` keeps its tone marks for display; slug() strips them for the
// filename, so "yī" and the file yi.mp3 line up. scripts/fetch-audio.mjs mirrors
// these sets.

import type { LocaleCode } from '../lib/locale';

// ─────────────────────────────────────────────────────────────────────────────
// LEVEL 1 — Numbers 1–20
// ─────────────────────────────────────────────────────────────────────────────
// `glyph` is the target-script spelling (English word / kanji / hanzi); `read`
// is the spoken reading and audio key; `alt` is a common alternative reading.
export type NumberWord = { n: number; glyph: string; read: string; alt?: string };

export const EN_NUMBERS: NumberWord[] = [
  { n: 1, glyph: 'One', read: 'one' },       { n: 2, glyph: 'Two', read: 'two' },
  { n: 3, glyph: 'Three', read: 'three' },   { n: 4, glyph: 'Four', read: 'four' },
  { n: 5, glyph: 'Five', read: 'five' },     { n: 6, glyph: 'Six', read: 'six' },
  { n: 7, glyph: 'Seven', read: 'seven' },   { n: 8, glyph: 'Eight', read: 'eight' },
  { n: 9, glyph: 'Nine', read: 'nine' },     { n: 10, glyph: 'Ten', read: 'ten' },
  { n: 11, glyph: 'Eleven', read: 'eleven' },{ n: 12, glyph: 'Twelve', read: 'twelve' },
  { n: 13, glyph: 'Thirteen', read: 'thirteen' }, { n: 14, glyph: 'Fourteen', read: 'fourteen' },
  { n: 15, glyph: 'Fifteen', read: 'fifteen' },   { n: 16, glyph: 'Sixteen', read: 'sixteen' },
  { n: 17, glyph: 'Seventeen', read: 'seventeen' },{ n: 18, glyph: 'Eighteen', read: 'eighteen' },
  { n: 19, glyph: 'Nineteen', read: 'nineteen' }, { n: 20, glyph: 'Twenty', read: 'twenty' },
];

export const JA_NUMBERS: NumberWord[] = [
  { n: 1, glyph: '一', read: 'ichi' },  { n: 2, glyph: '二', read: 'ni' },
  { n: 3, glyph: '三', read: 'san' },   { n: 4, glyph: '四', read: 'yon', alt: 'shi' },
  { n: 5, glyph: '五', read: 'go' },    { n: 6, glyph: '六', read: 'roku' },
  { n: 7, glyph: '七', read: 'nana', alt: 'shichi' }, { n: 8, glyph: '八', read: 'hachi' },
  { n: 9, glyph: '九', read: 'kyuu', alt: 'ku' },     { n: 10, glyph: '十', read: 'juu' },
  { n: 11, glyph: '十一', read: 'juuichi' }, { n: 12, glyph: '十二', read: 'juuni' },
  { n: 13, glyph: '十三', read: 'juusan' },  { n: 14, glyph: '十四', read: 'juuyon' },
  { n: 15, glyph: '十五', read: 'juugo' },   { n: 16, glyph: '十六', read: 'juuroku' },
  { n: 17, glyph: '十七', read: 'juunana' }, { n: 18, glyph: '十八', read: 'juuhachi' },
  { n: 19, glyph: '十九', read: 'juukyuu' }, { n: 20, glyph: '二十', read: 'nijuu' },
];

export const ZH_NUMBERS: NumberWord[] = [
  { n: 1, glyph: '一', read: 'yī' },   { n: 2, glyph: '二', read: 'èr' },
  { n: 3, glyph: '三', read: 'sān' },  { n: 4, glyph: '四', read: 'sì' },
  { n: 5, glyph: '五', read: 'wǔ' },   { n: 6, glyph: '六', read: 'liù' },
  { n: 7, glyph: '七', read: 'qī' },   { n: 8, glyph: '八', read: 'bā' },
  { n: 9, glyph: '九', read: 'jiǔ' },  { n: 10, glyph: '十', read: 'shí' },
  { n: 11, glyph: '十一', read: 'shíyī' }, { n: 12, glyph: '十二', read: 'shí’èr' },
  { n: 13, glyph: '十三', read: 'shísān' },{ n: 14, glyph: '十四', read: 'shísì' },
  { n: 15, glyph: '十五', read: 'shíwǔ' }, { n: 16, glyph: '十六', read: 'shíliù' },
  { n: 17, glyph: '十七', read: 'shíqī' }, { n: 18, glyph: '十八', read: 'shíbā' },
  { n: 19, glyph: '十九', read: 'shíjiǔ' },{ n: 20, glyph: '二十', read: 'èrshí' },
];

export const NUMBERS_BY_LANG: Record<LocaleCode, NumberWord[]> = {
  en: EN_NUMBERS,
  ja: JA_NUMBERS,
  zh: ZH_NUMBERS,
};

// ── English plurals — singular vs plural FORMS (1 cat vs 3 cats) ──────────────
// Chosen to cover the four patterns beginners must internalise: regular +s,
// +es after sibilants, y→ies, and irregular/zero-change nouns.
export type EnPlural = { emoji: string; singular: string; plural: string; rule: string };

export const EN_PLURALS: EnPlural[] = [
  { emoji: '🐱', singular: 'cat',   plural: 'cats',     rule: '+s' },
  { emoji: '📦', singular: 'box',   plural: 'boxes',    rule: '+es' },
  { emoji: '🍓', singular: 'berry', plural: 'berries',  rule: 'y → ies' },
  { emoji: '🧒', singular: 'child', plural: 'children', rule: 'irregular' },
  { emoji: '🧑', singular: 'person',plural: 'people',   rule: 'irregular' },
  { emoji: '🐟', singular: 'fish',  plural: 'fish',     rule: 'no change' },
];

// ── Japanese counters — readings that fuse with the number ───────────────────
// 〜人 (people) and 〜つ (generic things). `read` is the romaji and audio key;
// `kana` is shown as the furigana-style gloss.
export type JaCounterItem = { n: number; kana: string; read: string };
export type JaCounter = { suffix: string; label: string; note: string; items: JaCounterItem[] };

export const JA_COUNTERS: JaCounter[] = [
  {
    suffix: '人',
    label: '〜人 (คน / people)',
    note: '1 และ 2 อ่านพิเศษ (ひとり・ふたり) จากนั้นเติม 〜にん',
    items: [
      { n: 1, kana: 'ひとり', read: 'hitori' }, { n: 2, kana: 'ふたり', read: 'futari' },
      { n: 3, kana: 'さんにん', read: 'sannin' },{ n: 4, kana: 'よにん', read: 'yonin' },
      { n: 5, kana: 'ごにん', read: 'gonin' },  { n: 6, kana: 'ろくにん', read: 'rokunin' },
      { n: 7, kana: 'ななにん', read: 'nananin' },{ n: 8, kana: 'はちにん', read: 'hachinin' },
      { n: 9, kana: 'きゅうにん', read: 'kyuunin' },{ n: 10, kana: 'じゅうにん', read: 'juunin' },
    ],
  },
  {
    suffix: 'つ',
    label: '〜つ (สิ่งของทั่วไป / things)',
    note: 'ใช้นับของทั่วไป 1–10 ด้วยการอ่านแบบญี่ปุ่นแท้ (10 = とお ไม่มี つ)',
    items: [
      { n: 1, kana: 'ひとつ', read: 'hitotsu' }, { n: 2, kana: 'ふたつ', read: 'futatsu' },
      { n: 3, kana: 'みっつ', read: 'mittsu' },  { n: 4, kana: 'よっつ', read: 'yottsu' },
      { n: 5, kana: 'いつつ', read: 'itsutsu' }, { n: 6, kana: 'むっつ', read: 'muttsu' },
      { n: 7, kana: 'ななつ', read: 'nanatsu' }, { n: 8, kana: 'やっつ', read: 'yattsu' },
      { n: 9, kana: 'ここのつ', read: 'kokonotsu' }, { n: 10, kana: 'とお', read: 'too' },
    ],
  },
];

// ── Chinese one-hand number gestures 1–10 ────────────────────────────────────
// `read` (pinyin) doubles as the audio key and reuses the ZH_NUMBERS recordings.
export type ZhGesture = { n: number; hanzi: string; read: string; emoji: string; gesture: string };

export const ZH_GESTURES: ZhGesture[] = [
  { n: 1, hanzi: '一', read: 'yī',  emoji: '☝️', gesture: 'ชี้นิ้วชี้ขึ้น — index finger up' },
  { n: 2, hanzi: '二', read: 'èr',  emoji: '✌️', gesture: 'นิ้วชี้ + นิ้วกลาง (V) — index + middle' },
  { n: 3, hanzi: '三', read: 'sān', emoji: '🤟', gesture: 'สามนิ้ว (กลาง-นาง-ก้อย) — three fingers up' },
  { n: 4, hanzi: '四', read: 'sì',  emoji: '4️⃣', gesture: 'สี่นิ้ว พับนิ้วโป้ง — four fingers, thumb folded' },
  { n: 5, hanzi: '五', read: 'wǔ',  emoji: '🖐️', gesture: 'กางมือ ห้านิ้ว — open palm' },
  { n: 6, hanzi: '六', read: 'liù', emoji: '🤙', gesture: 'นิ้วโป้ง + นิ้วก้อย — thumb + pinky (“call me”)' },
  { n: 7, hanzi: '七', read: 'qī',  emoji: '🤏', gesture: 'จีบปลายนิ้วโป้ง-ชี้-กลาง — fingertips pinched' },
  { n: 8, hanzi: '八', read: 'bā',  emoji: '👆', gesture: 'นิ้วโป้ง + นิ้วชี้ (รูปตัว L) — thumb + index, “L”' },
  { n: 9, hanzi: '九', read: 'jiǔ', emoji: '🪝', gesture: 'งอนิ้วชี้เป็นตะขอ — index finger curled (hook)' },
  { n: 10, hanzi: '十', read: 'shí', emoji: '✊', gesture: 'กำหมัด หรือไขว้นิ้วชี้สองข้าง — fist / crossed index fingers' },
];

// ── Chinese measure words (量词) — the 二 vs 两 distinction + 一 tone sandhi ───
// When you COUNT things you use 两 (liǎng), not the digit 二 (èr). And 一 (yī)
// changes tone with the following word: 一个 → yí gè (before 4th tone 个),
// 一只 → yì zhī (before 1st tone 只). `read` is the audio key; `pinyin` is the
// (sandhi-correct) display gloss. The audio is generated from the full Hanzi
// phrase so the TTS applies the sandhi for us.
export type ZhMeasure = { hanzi: string; pinyin: string; read: string; note: string };

export const ZH_MEASURES: ZhMeasure[] = [
  { hanzi: '二', pinyin: 'èr',   read: 'èr',       note: 'อ่านตัวเลข / นับเป็นชุด — the digit “two”' },
  { hanzi: '两', pinyin: 'liǎng', read: 'liǎng',    note: 'ใช้ตอนนับของ — “two” of things' },
  { hanzi: '一个', pinyin: 'yí gè', read: 'yige',    note: '1 ชิ้น · 一 → yí (สันธิหน้าเสียง 4)' },
  { hanzi: '两个', pinyin: 'liǎng gè', read: 'liangge', note: '2 ชิ้น · ใช้ 两 ไม่ใช่ 二' },
  { hanzi: '一只', pinyin: 'yì zhī', read: 'yizhi',  note: '1 ตัว (สัตว์) · 一 → yì' },
  { hanzi: '两只', pinyin: 'liǎng zhī', read: 'liangzhi', note: '2 ตัว (สัตว์) · 两只' },
];

// ─────────────────────────────────────────────────────────────────────────────
// LEVEL 2 — Large numbers & place values
// ─────────────────────────────────────────────────────────────────────────────
// `compose` is the human-readable build-up of the value IN THAT LANGUAGE'S
// grouping system — the heart of the lesson: English regroups every 1,000,
// CJK every 10,000 (万). `highlight` marks 万 as the Asian base unit.
export type PlaceForm = { glyph: string; read: string; compose: string };
export type BigNumber = {
  value: number;
  en: PlaceForm;
  ja: PlaceForm;
  zh: PlaceForm & { traditional?: string };
  highlight?: boolean;
};

export const BIG_NUMBERS: BigNumber[] = [
  {
    value: 10,
    en: { glyph: 'Ten', read: 'ten', compose: '10' },
    ja: { glyph: '十', read: 'juu', compose: '十' },
    zh: { glyph: '十', read: 'shí', compose: '十' },
  },
  {
    value: 100,
    en: { glyph: 'One Hundred', read: 'hundred', compose: '100' },
    ja: { glyph: '百', read: 'hyaku', compose: '百' },
    zh: { glyph: '百', read: 'bǎi', compose: '百' },
  },
  {
    value: 1000,
    en: { glyph: 'One Thousand', read: 'thousand', compose: '1,000 — base unit' },
    ja: { glyph: '千', read: 'sen', compose: '千' },
    zh: { glyph: '千', read: 'qiān', compose: '千' },
  },
  {
    value: 10000,
    highlight: true,
    en: { glyph: 'Ten Thousand', read: 'ten-thousand', compose: '10 × 1,000' },
    ja: { glyph: '一万', read: 'man', compose: '万 — base unit (10⁴)' },
    zh: { glyph: '一万', read: 'wàn', compose: '万 — base unit (10⁴)', traditional: '萬' },
  },
  {
    value: 100000,
    en: { glyph: 'One Hundred Thousand', read: 'hundred-thousand', compose: '100 × 1,000' },
    ja: { glyph: '十万', read: 'juuman', compose: '十 × 万 (10 × 10,000)' },
    zh: { glyph: '十万', read: 'shíwàn', compose: '十 × 万 (10 × 10,000)', traditional: '十萬' },
  },
  {
    value: 1000000,
    en: { glyph: 'One Million', read: 'million', compose: '1,000 × 1,000' },
    ja: { glyph: '百万', read: 'hyakuman', compose: '百 × 万 (100 × 10,000)' },
    zh: { glyph: '百万', read: 'bǎiwàn', compose: '百 × 万 (100 × 10,000)', traditional: '百萬' },
  },
];

export function bigFormFor(b: BigNumber, lang: LocaleCode): PlaceForm {
  return lang === 'en' ? b.en : lang === 'ja' ? b.ja : b.zh;
}

// ── Price Tag Matcher — curated price pool per language ───────────────────────
// Digits are universal; only the currency presentation differs. The audio key
// is `price-<value>` (TTS reads the numeral natively in each language).
export type PriceConfig = { currency: string; suffix: boolean; values: number[] };

export const PRICES: Record<LocaleCode, PriceConfig> = {
  // "$1,250" — symbol prefix.
  en: { currency: '$', suffix: false, values: [99, 250, 1250, 9900, 45000, 120000, 350000, 1000000] },
  // "1,250円" — 円 suffix, the classic ¥ thinking in 万 units.
  ja: { currency: '円', suffix: true, values: [500, 980, 3500, 12000, 35000, 100000, 500000, 1000000] },
  // "¥1,250" — symbol prefix (元).
  zh: { currency: '¥', suffix: false, values: [88, 200, 1500, 9999, 50000, 100000, 880000, 1000000] },
};

// Western 3-digit grouping ("100,000") — universal numeric display.
export function groupWestern(value: number): string {
  return value.toLocaleString('en-US');
}

// Format a price with its currency for the given language.
export function formatPrice(value: number, lang: LocaleCode): string {
  const cfg = PRICES[lang];
  const digits = groupWestern(value);
  return cfg.suffix ? `${digits}${cfg.currency}` : `${cfg.currency}${digits}`;
}
