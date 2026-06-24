import { Fragment } from 'react';

// One chunk of text with an optional pronunciation reading shown above it.
// For Chinese the reading is Pinyin (nǐ hǎo); for Japanese it's Furigana —
// hiragana over the kanji (にほんご over 日本語). Chunks without a reading
// (kana, punctuation, spaces) render as plain base text.
export type ReadingSegment = { text: string; reading?: string };

// Renders multi-layer text with native <ruby>/<rt>: base characters on the
// baseline, the reading typeset above. Used wherever a beginner must read
// target-language script aloud (Speaking sentences, Vocab words).
export default function Ruby({
  segments,
  className = '',
  rtClassName = '',
}: {
  segments: ReadingSegment[];
  className?: string;
  rtClassName?: string;
}) {
  return (
    <ruby className={className}>
      {segments.map((s, i) => (
        <Fragment key={i}>
          {s.text}
          {/* Empty <rt> keeps unannotated chunks (kana/punctuation) on the
              baseline without reserving a reading slot. */}
          <rt className={rtClassName}>{s.reading ?? ''}</rt>
        </Fragment>
      ))}
    </ruby>
  );
}
