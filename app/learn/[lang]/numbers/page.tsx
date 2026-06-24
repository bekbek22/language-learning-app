import Link from 'next/link';
import { notFound } from 'next/navigation';
import PageShell from '../../../components/PageShell';
import ThemeToggle from '../../../components/ThemeToggle';
import NumbersModule from '../../../components/NumbersModule';
import { isLocaleCode, optionFor, LOCALES } from '../../../lib/locale';

export function generateStaticParams() {
  return LOCALES.map((l) => ({ lang: l.code }));
}

// Beginner "Numbers & Units/Counters" page, one per language.
export default async function NumbersPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocaleCode(lang)) notFound();

  const active = optionFor(lang);

  return (
    <PageShell>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Link
          href={`/learn/${lang}`}
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-sm font-medium text-slate-600 shadow-sm ring-1 ring-slate-200 transition-all hover:shadow-md hover:ring-slate-300 active:scale-95 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700 dark:hover:ring-slate-600"
        >
          <span className="text-base leading-none">←</span>
          <span className="hidden sm:inline">กลับไปบทเรียน</span>
        </Link>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </div>

      <header className="mb-10 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-xs font-medium text-slate-500 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700">
          {active.flag} {active.native} • สำหรับผู้เริ่มต้น
        </span>
        <h1 className="mt-5 bg-gradient-to-r from-blue-600 via-violet-600 to-emerald-600 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent sm:text-4xl dark:from-blue-400 dark:via-violet-400 dark:to-emerald-400">
          ตัวเลข{active.thaiName}
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-slate-500 dark:text-slate-400">
          นับ 1–20 ลักษณนาม และจำนวนใหญ่ถึงหลักล้าน — Counting, counters, and big numbers up to millions.
        </p>
      </header>

      <div className="mx-auto max-w-3xl">
        <NumbersModule lang={lang} />
      </div>
    </PageShell>
  );
}
