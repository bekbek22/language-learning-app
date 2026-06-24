'use client';

// App Router global error boundary. Catches uncaught runtime errors anywhere in
// the tree (including the root layout) so beta testers get a friendly recovery
// screen instead of a blank page. Logs to the console for debugging; in
// production Vercel captures these logs, and you can forward `error.digest` to
// an error-tracking service here later.
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Minimal, dependency-free logging. Swap for Sentry/LogRocket when ready.
    console.error('[GlobalError]', error.digest ?? '', error);
  }, [error]);

  return (
    <html lang="th">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif' }}>
        <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-6 text-center dark:bg-slate-950">
          <div className="text-4xl">😵‍💫</div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">
            เกิดข้อผิดพลาด — Something went wrong
          </h1>
          <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
            ขออภัยในความไม่สะดวก ลองโหลดใหม่อีกครั้ง — Sorry about that. Please try again.
          </p>
          <button
            type="button"
            onClick={reset}
            className="rounded-2xl bg-gradient-to-r from-blue-600 to-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl active:scale-[0.98]"
          >
            ↻ ลองใหม่ — Reload
          </button>
          {error.digest && (
            <p className="text-[11px] text-slate-400">รหัสข้อผิดพลาด — Error ID: {error.digest}</p>
          )}
        </main>
      </body>
    </html>
  );
}
