// Static "Alphabet & Phonics Basics" data for the beginner module, one block per
// language. Kept framework-free so it can be imported by client or server code.
//
// Every item has an optional `audioUrl` pointing to a high-quality recording.
// When set, the module plays that .mp3 via an HTML5 <audio> object; when unset,
// it builds a path from AUDIO_BASE (see AlphabetModule.tsx) or falls back to TTS.
// Example of wiring real files:
//   { letter: 'A', name: 'ay', phonics: '/æ/', example: 'Apple', audioUrl: '/audio/en/a.mp3' }
//   { romaji: 'a', hira: 'あ', kata: 'ア', audioUrl: 'https://cdn.example.com/ja/a.mp3' }
//   { num: 1, pinyin: 'mā', hanzi: '妈', meaning: 'แม่', contour: '…', audioUrl: '/audio/zh/ma1.mp3' }

// ── English: letter name + phonics sound + example word ──────────────────────
export type EnglishLetter = { letter: string; name: string; phonics: string; example: string; audioUrl?: string };

export const ENGLISH_LETTERS: EnglishLetter[] = [
  { letter: 'A', name: 'ay',       phonics: '/æ/',  example: 'Apple' },
  { letter: 'B', name: 'bee',      phonics: '/b/',  example: 'Ball' },
  { letter: 'C', name: 'see',      phonics: '/k/',  example: 'Cat' },
  { letter: 'D', name: 'dee',      phonics: '/d/',  example: 'Dog' },
  { letter: 'E', name: 'ee',       phonics: '/e/',  example: 'Egg' },
  { letter: 'F', name: 'ef',       phonics: '/f/',  example: 'Fish' },
  { letter: 'G', name: 'jee',      phonics: '/g/',  example: 'Goat' },
  { letter: 'H', name: 'aitch',    phonics: '/h/',  example: 'Hat' },
  { letter: 'I', name: 'eye',      phonics: '/ɪ/',  example: 'Igloo' },
  { letter: 'J', name: 'jay',      phonics: '/dʒ/', example: 'Jam' },
  { letter: 'K', name: 'kay',      phonics: '/k/',  example: 'Kite' },
  { letter: 'L', name: 'el',       phonics: '/l/',  example: 'Lion' },
  { letter: 'M', name: 'em',       phonics: '/m/',  example: 'Moon' },
  { letter: 'N', name: 'en',       phonics: '/n/',  example: 'Nest' },
  { letter: 'O', name: 'oh',       phonics: '/ɒ/',  example: 'Orange' },
  { letter: 'P', name: 'pee',      phonics: '/p/',  example: 'Pig' },
  { letter: 'Q', name: 'cue',      phonics: '/kw/', example: 'Queen' },
  { letter: 'R', name: 'ar',       phonics: '/r/',  example: 'Rabbit' },
  { letter: 'S', name: 'ess',      phonics: '/s/',  example: 'Sun' },
  { letter: 'T', name: 'tee',      phonics: '/t/',  example: 'Tiger' },
  { letter: 'U', name: 'you',      phonics: '/ʌ/',  example: 'Umbrella' },
  { letter: 'V', name: 'vee',      phonics: '/v/',  example: 'Van' },
  { letter: 'W', name: 'double-u', phonics: '/w/',  example: 'Water' },
  { letter: 'X', name: 'ex',       phonics: '/ks/', example: 'Box' },
  { letter: 'Y', name: 'why',      phonics: '/j/',  example: 'Yo-yo' },
  { letter: 'Z', name: 'zee',      phonics: '/z/',  example: 'Zebra' },
];

// ── Japanese: gojūon — parallel Hiragana / Katakana with romaji ──────────────
export type Kana = { romaji: string; hira: string; kata: string; audioUrl?: string };

export const KANA: Kana[] = [
  { romaji: 'a',  hira: 'あ', kata: 'ア' }, { romaji: 'i',  hira: 'い', kata: 'イ' }, { romaji: 'u',  hira: 'う', kata: 'ウ' }, { romaji: 'e',  hira: 'え', kata: 'エ' }, { romaji: 'o',  hira: 'お', kata: 'オ' },
  { romaji: 'ka', hira: 'か', kata: 'カ' }, { romaji: 'ki', hira: 'き', kata: 'キ' }, { romaji: 'ku', hira: 'く', kata: 'ク' }, { romaji: 'ke', hira: 'け', kata: 'ケ' }, { romaji: 'ko', hira: 'こ', kata: 'コ' },
  { romaji: 'sa', hira: 'さ', kata: 'サ' }, { romaji: 'shi', hira: 'し', kata: 'シ' }, { romaji: 'su', hira: 'す', kata: 'ス' }, { romaji: 'se', hira: 'せ', kata: 'セ' }, { romaji: 'so', hira: 'そ', kata: 'ソ' },
  { romaji: 'ta', hira: 'た', kata: 'タ' }, { romaji: 'chi', hira: 'ち', kata: 'チ' }, { romaji: 'tsu', hira: 'つ', kata: 'ツ' }, { romaji: 'te', hira: 'て', kata: 'テ' }, { romaji: 'to', hira: 'と', kata: 'ト' },
  { romaji: 'na', hira: 'な', kata: 'ナ' }, { romaji: 'ni', hira: 'に', kata: 'ニ' }, { romaji: 'nu', hira: 'ぬ', kata: 'ヌ' }, { romaji: 'ne', hira: 'ね', kata: 'ネ' }, { romaji: 'no', hira: 'の', kata: 'ノ' },
  { romaji: 'ha', hira: 'は', kata: 'ハ' }, { romaji: 'hi', hira: 'ひ', kata: 'ヒ' }, { romaji: 'fu', hira: 'ふ', kata: 'フ' }, { romaji: 'he', hira: 'へ', kata: 'ヘ' }, { romaji: 'ho', hira: 'ほ', kata: 'ホ' },
  { romaji: 'ma', hira: 'ま', kata: 'マ' }, { romaji: 'mi', hira: 'み', kata: 'ミ' }, { romaji: 'mu', hira: 'む', kata: 'ム' }, { romaji: 'me', hira: 'め', kata: 'メ' }, { romaji: 'mo', hira: 'も', kata: 'モ' },
  { romaji: 'ya', hira: 'や', kata: 'ヤ' }, { romaji: 'yu', hira: 'ゆ', kata: 'ユ' }, { romaji: 'yo', hira: 'よ', kata: 'ヨ' },
  { romaji: 'ra', hira: 'ら', kata: 'ラ' }, { romaji: 'ri', hira: 'り', kata: 'リ' }, { romaji: 'ru', hira: 'る', kata: 'ル' }, { romaji: 're', hira: 'れ', kata: 'レ' }, { romaji: 'ro', hira: 'ろ', kata: 'ロ' },
  { romaji: 'wa', hira: 'わ', kata: 'ワ' }, { romaji: 'wo', hira: 'を', kata: 'ヲ' },
  { romaji: 'n',  hira: 'ん', kata: 'ン' },
];

// ── Chinese: Pinyin initials, finals, and the four tones ─────────────────────
// `sound` is a teaching syllable spoken aloud (the bare initial isn't audible),
// matching how Pinyin is taught in class (bo po mo fo …).
export type PinyinItem = { sym: string; sound: string; audioUrl?: string };

export const PINYIN_INITIALS: PinyinItem[] = [
  { sym: 'b', sound: 'bo' }, { sym: 'p', sound: 'po' }, { sym: 'm', sound: 'mo' }, { sym: 'f', sound: 'fo' },
  { sym: 'd', sound: 'de' }, { sym: 't', sound: 'te' }, { sym: 'n', sound: 'ne' }, { sym: 'l', sound: 'le' },
  { sym: 'g', sound: 'ge' }, { sym: 'k', sound: 'ke' }, { sym: 'h', sound: 'he' },
  { sym: 'j', sound: 'ji' }, { sym: 'q', sound: 'qi' }, { sym: 'x', sound: 'xi' },
  { sym: 'zh', sound: 'zhi' }, { sym: 'ch', sound: 'chi' }, { sym: 'sh', sound: 'shi' }, { sym: 'r', sound: 'ri' },
  { sym: 'z', sound: 'zi' }, { sym: 'c', sound: 'ci' }, { sym: 's', sound: 'si' },
];

export const PINYIN_FINALS: PinyinItem[] = [
  { sym: 'a', sound: 'a' }, { sym: 'o', sound: 'o' }, { sym: 'e', sound: 'e' }, { sym: 'i', sound: 'yi' }, { sym: 'u', sound: 'wu' }, { sym: 'ü', sound: 'yu' },
  { sym: 'ai', sound: 'ai' }, { sym: 'ei', sound: 'ei' }, { sym: 'ui', sound: 'wei' }, { sym: 'ao', sound: 'ao' }, { sym: 'ou', sound: 'ou' }, { sym: 'iu', sound: 'you' },
  { sym: 'ie', sound: 'ye' }, { sym: 'üe', sound: 'yue' }, { sym: 'er', sound: 'er' },
  { sym: 'an', sound: 'an' }, { sym: 'en', sound: 'en' }, { sym: 'in', sound: 'yin' }, { sym: 'un', sound: 'wen' }, { sym: 'ün', sound: 'yun' },
  { sym: 'ang', sound: 'ang' }, { sym: 'eng', sound: 'eng' }, { sym: 'ing', sound: 'ying' }, { sym: 'ong', sound: 'ong' },
];

// The classic "mā má mǎ mà" minimal set — one syllable, four meanings.
export type Tone = {
  num: number;
  pinyin: string;
  hanzi: string;
  meaning: string;     // Thai gloss
  contour: string;     // SVG path for a small pitch-contour glyph (0..40 box)
  audioUrl?: string;
};

export const TONES: Tone[] = [
  { num: 1, pinyin: 'mā', hanzi: '妈', meaning: 'แม่',    contour: 'M2 8 L38 8' },          // high & flat
  { num: 2, pinyin: 'má', hanzi: '麻', meaning: 'ป่าน',   contour: 'M2 34 L38 6' },         // rising
  { num: 3, pinyin: 'mǎ', hanzi: '马', meaning: 'ม้า',    contour: 'M2 10 L20 36 L38 14' }, // dip
  { num: 4, pinyin: 'mà', hanzi: '骂', meaning: 'ด่า',    contour: 'M2 6 L38 36' },         // falling
];
