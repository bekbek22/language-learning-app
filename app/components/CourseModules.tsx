'use client';

import { useEffect } from 'react';
import SpeakingModule from './SpeakingModule';
import VocabModule from './VocabModule';
import WritingModule from './WritingModule';
import { setLocale, type LocaleCode } from '../lib/locale';

// Bridges the URL's [lang] segment to the locale store the learning modules
// read from. Setting it here (and on every lang change) makes the route the
// single source of truth while leaving the modules' existing locale wiring
// untouched.
export default function CourseModules({ lang }: { lang: LocaleCode }) {
  useEffect(() => {
    setLocale(lang); // persists + broadcasts → modules load this locale
  }, [lang]);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-3">
      <SpeakingModule />
      <VocabModule />
      <WritingModule />
    </div>
  );
}
