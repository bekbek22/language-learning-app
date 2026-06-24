#!/usr/bin/env node
/**
 * fetch-audio.mjs — download alphabet / kana / pinyin pronunciation clips into
 * the paths the Alphabet module expects:  public/audio/<lang>/<slug>.mp3
 *
 * Default provider is the *unofficial* Google Translate TTS endpoint: zero setup,
 * neural quality (far better than the browser's robotic voice), returns .mp3.
 * It is fine for prototyping but is undocumented and rate-limited — for a real
 * product use native recordings (Forvo/Wiktionary) or a licensed TTS (Google
 * Cloud / Azure / Amazon Polly / local Piper). See the README notes in chat.
 *
 * Usage:
 *   node scripts/fetch-audio.mjs            # all languages, skip existing files
 *   node scripts/fetch-audio.mjs en         # only English
 *   node scripts/fetch-audio.mjs zh ja      # Chinese + Japanese
 *   node scripts/fetch-audio.mjs --force    # re-download even if file exists
 *
 * Requires Node 18+ (uses global fetch). No dependencies.
 */

import { mkdir, writeFile, access, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public', 'audio');

// BCP-47 codes for the TTS endpoint.
const TL = { en: 'en', ja: 'ja', zh: 'zh-CN' };

// Politeness: pause between requests so we don't hammer the endpoint.
const DELAY_MS = 350;
const MAX_RETRIES = 2;

// ── Data — mirrors app/data/alphabet.ts ──────────────────────────────────────
// Each entry: { key, text }. `key` decides the filename (via slug); `text` is
// what gets synthesized. English → letter name; Japanese → the kana; Chinese
// tones → the hanzi (so the tone is correct); initials/finals → teaching syllable.
const EN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((L) => ({ key: L, text: L }));

const KANA = [
  ['a', 'あ'], ['i', 'い'], ['u', 'う'], ['e', 'え'], ['o', 'お'],
  ['ka', 'か'], ['ki', 'き'], ['ku', 'く'], ['ke', 'け'], ['ko', 'こ'],
  ['sa', 'さ'], ['shi', 'し'], ['su', 'す'], ['se', 'せ'], ['so', 'そ'],
  ['ta', 'た'], ['chi', 'ち'], ['tsu', 'つ'], ['te', 'て'], ['to', 'と'],
  ['na', 'な'], ['ni', 'に'], ['nu', 'ぬ'], ['ne', 'ね'], ['no', 'の'],
  ['ha', 'は'], ['hi', 'ひ'], ['fu', 'ふ'], ['he', 'へ'], ['ho', 'ほ'],
  ['ma', 'ま'], ['mi', 'み'], ['mu', 'む'], ['me', 'め'], ['mo', 'も'],
  ['ya', 'や'], ['yu', 'ゆ'], ['yo', 'よ'],
  ['ra', 'ら'], ['ri', 'り'], ['ru', 'る'], ['re', 'れ'], ['ro', 'ろ'],
  ['wa', 'わ'], ['wo', 'を'], ['n', 'ん'],
].map(([key, text]) => ({ key, text }));

const ZH_TONES = [
  ['ma1', '妈'], ['ma2', '麻'], ['ma3', '马'], ['ma4', '骂'],
].map(([key, text]) => ({ key, text }));

// NOTE: TTS reads bare pinyin imperfectly. Tones (hanzi above) are accurate;
// for crisp initials/finals prefer native recordings (Forvo / a pinyin chart).
const ZH_INITIALS = [
  ['b', 'bo'], ['p', 'po'], ['m', 'mo'], ['f', 'fo'], ['d', 'de'], ['t', 'te'],
  ['n', 'ne'], ['l', 'le'], ['g', 'ge'], ['k', 'ke'], ['h', 'he'], ['j', 'ji'],
  ['q', 'qi'], ['x', 'xi'], ['zh', 'zhi'], ['ch', 'chi'], ['sh', 'shi'], ['r', 'ri'],
  ['z', 'zi'], ['c', 'ci'], ['s', 'si'],
].map(([key, text]) => ({ key, text }));

const ZH_FINALS = [
  ['a', 'a'], ['o', 'o'], ['e', 'e'], ['i', 'yi'], ['u', 'wu'], ['ü', 'yu'],
  ['ai', 'ai'], ['ei', 'ei'], ['ui', 'wei'], ['ao', 'ao'], ['ou', 'ou'], ['iu', 'you'],
  ['ie', 'ye'], ['üe', 'yue'], ['er', 'er'], ['an', 'an'], ['en', 'en'], ['in', 'yin'],
  ['un', 'wen'], ['ün', 'yun'], ['ang', 'ang'], ['eng', 'eng'], ['ing', 'ying'], ['ong', 'ong'],
].map(([key, text]) => ({ key, text }));

const SETS = {
  en: EN,
  ja: KANA,
  zh: [...ZH_TONES, ...ZH_INITIALS, ...ZH_FINALS],
};

// ── Numbers data — mirrors app/data/numbers.ts. Files go to /audio/<lang>/n/ ──
// `key` MUST equal the module's `read` verbatim (incl. tone marks) so slug() on
// both sides yields the same filename. `text` is what gets synthesized.
const EN_NUM = [
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty',
].map((w) => ({ key: w, text: w }));
EN_NUM.push(
  { key: 'hundred', text: 'one hundred' },
  { key: 'thousand', text: 'one thousand' },
  { key: 'ten-thousand', text: 'ten thousand' },
  { key: 'hundred-thousand', text: 'one hundred thousand' },
  { key: 'million', text: 'one million' },
);

// NOTE: send HIRAGANA, never kanji. TTS reads e.g. 四 ambiguously as "shi"
// (we want よん "yon"), 七 as "shichi" (we want なな "nana"), 九 as "ku" (want
// きゅう), and 一万 as "ichiman" (the unit reads まん). Hiragana forces the exact
// spoken reading shown on each tile.
const JA_NUM = [
  ['ichi', 'いち'], ['ni', 'に'], ['san', 'さん'], ['yon', 'よん'], ['go', 'ご'],
  ['roku', 'ろく'], ['nana', 'なな'], ['hachi', 'はち'], ['kyuu', 'きゅう'], ['juu', 'じゅう'],
  ['juuichi', 'じゅういち'], ['juuni', 'じゅうに'], ['juusan', 'じゅうさん'], ['juuyon', 'じゅうよん'], ['juugo', 'じゅうご'],
  ['juuroku', 'じゅうろく'], ['juunana', 'じゅうなな'], ['juuhachi', 'じゅうはち'], ['juukyuu', 'じゅうきゅう'], ['nijuu', 'にじゅう'],
  // counters 〜人 / 〜つ — already hiragana so the native readings are exact
  ['hitori', 'ひとり'], ['futari', 'ふたり'], ['sannin', 'さんにん'], ['yonin', 'よにん'], ['gonin', 'ごにん'],
  ['rokunin', 'ろくにん'], ['nananin', 'ななにん'], ['hachinin', 'はちにん'], ['kyuunin', 'きゅうにん'], ['juunin', 'じゅうにん'],
  ['hitotsu', 'ひとつ'], ['futatsu', 'ふたつ'], ['mittsu', 'みっつ'], ['yottsu', 'よっつ'], ['itsutsu', 'いつつ'],
  ['muttsu', 'むっつ'], ['nanatsu', 'ななつ'], ['yattsu', 'やっつ'], ['kokonotsu', 'ここのつ'], ['too', 'とお'],
  // big numbers (juu reused from 10)
  ['hyaku', 'ひゃく'], ['sen', 'せん'], ['man', 'まん'], ['juuman', 'じゅうまん'], ['hyakuman', 'ひゃくまん'],
].map(([key, text]) => ({ key, text }));

const ZH_NUM = [
  ['yī', '一'], ['èr', '二'], ['sān', '三'], ['sì', '四'], ['wǔ', '五'],
  ['liù', '六'], ['qī', '七'], ['bā', '八'], ['jiǔ', '九'], ['shí', '十'],
  ['shíyī', '十一'], ['shí’èr', '十二'], ['shísān', '十三'], ['shísì', '十四'], ['shíwǔ', '十五'],
  ['shíliù', '十六'], ['shíqī', '十七'], ['shíbā', '十八'], ['shíjiǔ', '十九'], ['èrshí', '二十'],
  // big numbers (shí reused from 10)
  ['bǎi', '百'], ['qiān', '千'], ['wàn', '万'], ['shíwàn', '十万'], ['bǎiwàn', '百万'],
].map(([key, text]) => ({ key, text }));

// Measure words — send the full Hanzi PHRASE so zh-CN TTS applies tone sandhi:
// 一个 → "yí gè" (一 yī→yí before 4th tone), 一只 → "yì zhī", and counting "two"
// is 两 liǎng, never 二. (èr already comes from ZH_NUM → er.mp3.)
const ZH_MEASURE = [
  ['liǎng', '两'], ['yige', '一个'], ['liangge', '两个'], ['yizhi', '一只'], ['liangzhi', '两只'],
].map(([key, text]) => ({ key, text }));

// Prices: TTS reads the bare numeral natively in each language.
const PRICE_VALUES = {
  en: [99, 250, 1250, 9900, 45000, 120000, 350000, 1000000],
  ja: [500, 980, 3500, 12000, 35000, 100000, 500000, 1000000],
  zh: [88, 200, 1500, 9999, 50000, 100000, 880000, 1000000],
};

const NUM_SETS = {
  en: [...EN_NUM, ...PRICE_VALUES.en.map((v) => ({ key: `price-${v}`, text: String(v) }))],
  ja: [...JA_NUM, ...PRICE_VALUES.ja.map((v) => ({ key: `price-${v}`, text: String(v) }))],
  zh: [...ZH_NUM, ...ZH_MEASURE, ...PRICE_VALUES.zh.map((v) => ({ key: `price-${v}`, text: String(v) }))],
};

// ── Must match slug() in app/components/AlphabetModule.tsx ────────────────────
function slug(s) {
  return s
    .toLowerCase()
    .replace(/ü/g, 'v')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ── Vocab & Conversation speech clips ────────────────────────────────────────
// Unlike letters/numbers, these modules speak whole words and sentences via
// SpeakButton. On a device with no zh/ja TTS voice the browser stays silent, so
// we pre-render native clips keyed by a hash of the EXACT text the client will
// request. English keeps using the (universal) browser voice, so we only render
// zh/ja here. Files: public/audio/<lang>/tts/<hash>.mp3.
const SPEECH_LANGS = ['zh', 'ja'];

// cyrb53 — MUST stay byte-for-byte identical to ttsHash() in app/lib/audioFile.ts
// so the file the browser requests matches the one written here.
function ttsHash(text) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

async function loadJson(relPath) {
  return JSON.parse(await readFile(join(ROOT, relPath), 'utf8'));
}

// The exact strings SpeakButton speaks: vocab `word` + conversation `sentence`.
// De-duped (identical text → identical hash → one file).
async function speechItems(lang) {
  const vocab = await loadJson(`app/data/${lang}/vocab.json`);
  const phrases = await loadJson(`app/data/${lang}/phrases.json`);
  const texts = [...vocab.map((v) => v.word), ...phrases.map((p) => p.sentence)]
    .filter((t) => typeof t === 'string' && t.trim())
    .map((t) => t.trim());
  return [...new Set(texts)].map((text) => ({ hash: ttsHash(text), text }));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const exists = (p) => access(p).then(() => true).catch(() => false);

async function fetchTts(text, lang) {
  const url =
    `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob` +
    `&tl=${TL[lang]}&q=${encodeURIComponent(text)}`;
  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (audio-fetch-script)' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 512) throw new Error('suspiciously small response');
      return buf;
    } catch (err) {
      if (attempt > MAX_RETRIES) throw err;
      await sleep(DELAY_MS * attempt * 2);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const langs = args.filter((a) => a in SETS);
  const targets = langs.length ? langs : Object.keys(SETS);

  let done = 0, skipped = 0, failed = 0;

  for (const lang of targets) {
    const dir = join(OUT_DIR, lang);
    await mkdir(dir, { recursive: true });
    console.log(`\n▶ ${lang} — ${SETS[lang].length} files → public/audio/${lang}/`);

    for (const { key, text } of SETS[lang]) {
      const file = join(dir, `${slug(key)}.mp3`);
      if (!force && (await exists(file))) {
        skipped++;
        continue;
      }
      try {
        const buf = await fetchTts(text, lang);
        await writeFile(file, buf);
        done++;
        process.stdout.write(`  ✓ ${slug(key)}.mp3 (${text})\n`);
      } catch (err) {
        failed++;
        process.stdout.write(`  ✗ ${slug(key)}.mp3 — ${err.message}\n`);
      }
      await sleep(DELAY_MS);
    }
  }

  // Numbers module audio → public/audio/<lang>/n/
  for (const lang of targets) {
    const ndir = join(OUT_DIR, lang, 'n');
    await mkdir(ndir, { recursive: true });
    console.log(`\n▶ ${lang} numbers — ${NUM_SETS[lang].length} files → public/audio/${lang}/n/`);

    for (const { key, text } of NUM_SETS[lang]) {
      const file = join(ndir, `${slug(key)}.mp3`);
      if (!force && (await exists(file))) {
        skipped++;
        continue;
      }
      try {
        const buf = await fetchTts(text, lang);
        await writeFile(file, buf);
        done++;
        process.stdout.write(`  ✓ n/${slug(key)}.mp3 (${text})\n`);
      } catch (err) {
        failed++;
        process.stdout.write(`  ✗ n/${slug(key)}.mp3 — ${err.message}\n`);
      }
      await sleep(DELAY_MS);
    }
  }

  // Vocab & Conversation speech → public/audio/<lang>/tts/<hash>.mp3
  for (const lang of targets) {
    if (!SPEECH_LANGS.includes(lang)) continue;
    const items = await speechItems(lang);
    const sdir = join(OUT_DIR, lang, 'tts');
    await mkdir(sdir, { recursive: true });
    console.log(`\n▶ ${lang} speech — ${items.length} files → public/audio/${lang}/tts/`);

    for (const { hash, text } of items) {
      const file = join(sdir, `${hash}.mp3`);
      if (!force && (await exists(file))) {
        skipped++;
        continue;
      }
      try {
        const buf = await fetchTts(text, lang);
        await writeFile(file, buf);
        done++;
        process.stdout.write(`  ✓ tts/${hash}.mp3 (${text})\n`);
      } catch (err) {
        failed++;
        process.stdout.write(`  ✗ tts/${hash}.mp3 — ${err.message}\n`);
      }
      await sleep(DELAY_MS);
    }
  }

  console.log(`\nDone. downloaded=${done} skipped=${skipped} failed=${failed}`);
  if (failed) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
