'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LOCALES, getLocale, onLocaleChange, type LocaleCode } from '../lib/locale';

// Sleek target-language picker for the header. Switching navigates to the chosen
// language's course route (/learn/<code>); that route then syncs the locale store
// so every module refetches from the matching locale API.
export default function LanguageSelector() {
  const [code, setCode]     = useState<LocaleCode>('en');
  const [open, setOpen]     = useState(false);
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Reflect the persisted choice after mount (avoids hydration mismatch) and
  // stay in sync if another surface changes it.
  useEffect(() => {
    setCode(getLocale());
    setMounted(true);
    return onLocaleChange(() => setCode(getLocale()));
  }, []);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('mousedown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const active = LOCALES.find((l) => l.code === code) ?? LOCALES[0];

  function choose(next: LocaleCode) {
    setOpen(false);
    if (next !== code) router.push(`/learn/${next}`); // route syncs the locale
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="เลือกภาษา — Choose language"
        className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-sm font-medium text-slate-600 shadow-sm ring-1 ring-slate-200 transition-all hover:shadow-md hover:ring-slate-300 active:scale-95 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700 dark:hover:ring-slate-600"
      >
        <span className="text-base leading-none">{mounted ? active.flag : '🌐'}</span>
        <span className="hidden sm:inline">{mounted ? active.native : '…'}</span>
        <span className={`text-[10px] text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-2xl bg-white p-1.5 shadow-xl shadow-slate-200/70 ring-1 ring-slate-200 dark:bg-slate-800 dark:shadow-black/40 dark:ring-slate-700"
        >
          {LOCALES.map((l) => {
            const isActive = l.code === code;
            return (
              <li key={l.code} role="option" aria-selected={isActive}>
                <button
                  type="button"
                  onClick={() => choose(l.code)}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition ${
                    isActive
                      ? 'bg-slate-100 font-semibold text-slate-800 dark:bg-slate-700 dark:text-slate-100'
                      : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700/60'
                  }`}
                >
                  <span className="text-base leading-none">{l.flag}</span>
                  <span className="flex-1">{l.native}</span>
                  <span className="text-[11px] text-slate-400">{l.label}</span>
                  {isActive && <span className="text-emerald-500">✓</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
