// Shared page chrome: full-height surface, ambient gradient background, and the
// centered max-width container. Used by the homepage and every course page so
// the backdrop and layout stay identical across routes.
export default function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative min-h-screen overflow-x-clip px-4 py-10 sm:px-6 sm:py-14">
      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950" />
      <div className="pointer-events-none absolute -top-32 left-1/2 -z-10 h-72 w-[44rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-blue-200/40 via-violet-200/40 to-emerald-200/40 blur-3xl dark:from-blue-500/10 dark:via-violet-500/10 dark:to-emerald-500/10" />

      <div className="mx-auto w-full max-w-6xl">{children}</div>
    </main>
  );
}
