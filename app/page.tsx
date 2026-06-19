import SpeakingModule from './components/SpeakingModule';
import VocabModule from './components/VocabModule';
import WritingModule from './components/WritingModule';
import ThemeToggle from './components/ThemeToggle';
import LanguageSelector from './components/LanguageSelector';

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden px-6 py-14">
      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950" />
      <div className="pointer-events-none absolute -top-32 left-1/2 -z-10 h-72 w-[44rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-blue-200/40 via-violet-200/40 to-emerald-200/40 blur-3xl dark:from-blue-500/10 dark:via-violet-500/10 dark:to-emerald-500/10" />

      <div className="mx-auto w-full max-w-6xl">
        {/* Top bar */}
        <div className="mb-2 flex flex-wrap items-center justify-end gap-2">
          <LanguageSelector />
          <ThemeToggle />
        </div>

        {/* Hero */}
        <header className="mb-12 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-xs font-medium text-slate-500 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700">
            🇬🇧 English for Thai speakers
          </span>
          <h1 className="mt-5 bg-gradient-to-r from-blue-600 via-violet-600 to-emerald-600 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl dark:from-blue-400 dark:via-violet-400 dark:to-emerald-400">
            เรียนภาษาอังกฤษ
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-slate-500 dark:text-slate-400">
            ฝึกพูด ฟัง และเขียน อย่างเป็นธรรมชาติ — Speak, listen, and write with confidence.
          </p>
        </header>

        {/* Module grid */}
        <div className="grid items-start gap-6 lg:grid-cols-3">
          <SpeakingModule />
          <VocabModule />
          <WritingModule />
        </div>

        <p className="mt-12 text-center text-xs text-slate-400 dark:text-slate-500">
          ทำงานแบบออฟไลน์ 100% • ไม่ต้องเชื่อมต่ออินเทอร์เน็ต
        </p>
      </div>
    </main>
  );
}
