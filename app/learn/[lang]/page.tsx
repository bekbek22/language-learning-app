import Link from 'next/link';
import { notFound } from 'next/navigation';
import PageShell from '../../components/PageShell';
import ThemeToggle from '../../components/ThemeToggle';
import LanguageSelector from '../../components/LanguageSelector';
import CourseModules from '../../components/CourseModules';
import ResetProgressButton from '../../components/ResetProgressButton';
import { isLocaleCode, optionFor, LOCALES } from '../../lib/locale';

// Prerender one course page per known language.
export function generateStaticParams() {
  return LOCALES.map((l) => ({ lang: l.code }));
}

// Course page for a single target language. The [lang] segment is the source of
// truth: it's validated here and handed to CourseModules, which syncs it into
// the locale store the learning modules read from.
export default async function CoursePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocaleCode(lang)) notFound();

  const active = optionFor(lang);

  return (
    <PageShell>
      {/* Top bar */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-sm font-medium text-slate-600 shadow-sm ring-1 ring-slate-200 transition-all hover:shadow-md hover:ring-slate-300 active:scale-95 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700 dark:hover:ring-slate-600"
        >
          <span className="text-base leading-none">←</span>
          <span className="hidden sm:inline">เปลี่ยนภาษา</span>
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <LanguageSelector />
          <ThemeToggle />
        </div>
      </div>

      {/* Hero — rendered from the route param, no client round-trip */}
      <header className="mb-12 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-xs font-medium text-slate-500 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700">
          {active.flag} {active.native} • สำหรับคนไทย
        </span>
        <h1 className="mt-5 bg-gradient-to-r from-blue-600 via-violet-600 to-emerald-600 bg-clip-text text-2xl font-extrabold tracking-tight text-transparent sm:text-4xl md:text-5xl dark:from-blue-400 dark:via-violet-400 dark:to-emerald-400">
          เรียนภาษา{active.thaiName}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-slate-500 dark:text-slate-400">
          ฝึกพูด ฟัง และเขียน อย่างเป็นธรรมชาติ — Speak, listen, and write with confidence.
        </p>
      </header>

      {/* Beginner on-ramps */}
      <div className="mb-6 flex flex-wrap justify-center gap-3">
        <Link
          href={`/learn/${lang}/alphabet`}
          className="group inline-flex items-center gap-2.5 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 transition-all hover:-translate-y-0.5 hover:shadow-md hover:ring-violet-200 active:scale-[0.98] dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-800 dark:hover:ring-violet-900"
        >
          <span className="text-lg">🔤</span>
          เริ่มจากพื้นฐาน — Alphabet &amp; Phonics
          <span className="text-slate-400 transition-transform group-hover:translate-x-0.5">→</span>
        </Link>
        <Link
          href={`/learn/${lang}/numbers`}
          className="group inline-flex items-center gap-2.5 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 transition-all hover:-translate-y-0.5 hover:shadow-md hover:ring-blue-200 active:scale-[0.98] dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-800 dark:hover:ring-blue-900"
        >
          <span className="text-lg">🔢</span>
          ตัวเลข & หน่วยนับ — Numbers &amp; Counters
          <span className="text-slate-400 transition-transform group-hover:translate-x-0.5">→</span>
        </Link>
      </div>

      <CourseModules lang={lang} />

      <div className="mt-12 flex flex-col items-center gap-3">
        <ResetProgressButton />
        <p className="text-center text-xs text-slate-400 dark:text-slate-500">
          ทำงานแบบออฟไลน์ 100% • ไม่ต้องเชื่อมต่ออินเทอร์เน็ต
        </p>
      </div>
    </PageShell>
  );
}
