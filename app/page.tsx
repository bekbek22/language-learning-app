import Link from 'next/link';
import PageShell from './components/PageShell';
import ThemeToggle from './components/ThemeToggle';
import { LOCALES } from './lib/locale';

// Homepage — the front door. Pick a language to study; each card links to its
// course route (/learn/<code>). A static Server Component: no client state, just
// links, so it prerenders cleanly.
export default function Home() {
  return (
    <PageShell>
      <div className="mb-2 flex items-center justify-end">
        <ThemeToggle />
      </div>

      <header className="mb-12 mt-6 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-xs font-medium text-slate-500 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700">
          🌏 สำหรับคนไทย — for Thai speakers
        </span>
        <h1 className="mt-5 bg-gradient-to-r from-blue-600 via-violet-600 to-emerald-600 bg-clip-text text-2xl font-extrabold tracking-tight text-transparent sm:text-4xl md:text-5xl dark:from-blue-400 dark:via-violet-400 dark:to-emerald-400">
          อยากเรียนภาษาอะไร?
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-slate-500 dark:text-slate-400">
          เลือกภาษาที่อยากฝึก แล้วเริ่มพูด ฟัง และเขียนได้เลย — Pick a language to start.
        </p>
      </header>

      <div className="mx-auto grid max-w-3xl gap-5 sm:grid-cols-3">
        {LOCALES.map((l) => (
          <Link
            key={l.code}
            href={`/learn/${l.code}`}
            className="group flex flex-col items-center gap-3 rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200/70 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-200/60 hover:ring-violet-200 active:scale-[0.98] dark:bg-slate-900 dark:ring-slate-800 dark:hover:shadow-black/40 dark:hover:ring-violet-900"
          >
            <span className="text-5xl transition-transform duration-300 group-hover:scale-110">{l.flag}</span>
            <span className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">{l.native}</span>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              ภาษา{l.thaiName} • {l.label}
            </span>
            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-1.5 text-xs font-semibold text-white opacity-0 shadow-md transition-opacity duration-300 group-hover:opacity-100">
              เริ่มเรียน →
            </span>
          </Link>
        ))}
      </div>

      <p className="mt-12 text-center text-xs text-slate-400 dark:text-slate-500">
        ทำงานแบบออฟไลน์ 100% • ไม่ต้องเชื่อมต่ออินเทอร์เน็ต
      </p>
    </PageShell>
  );
}
