'use client';

import { useEffect, useState } from 'react';

// Light/dark toggle. The initial theme is applied pre-paint by the inline script
// in layout.tsx; this just reflects and flips it, persisting the choice.
export default function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
    setMounted(true);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light');
    } catch {
      // storage disabled — theme still applies for this session
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'สลับเป็นโหมดสว่าง — Switch to light mode' : 'สลับเป็นโหมดมืด — Switch to dark mode'}
      title={dark ? 'โหมดสว่าง — Light mode' : 'โหมดมืด — Dark mode'}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-lg shadow-sm ring-1 ring-slate-200 transition-all hover:scale-110 hover:shadow-md active:scale-95 dark:bg-slate-800 dark:ring-slate-700"
    >
      {/* Avoid hydration mismatch: render neutral until mounted */}
      {mounted ? (dark ? '☀️' : '🌙') : '🌙'}
    </button>
  );
}
