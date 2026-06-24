'use client';

import { useEffect, useState } from 'react';
import { MessageSquarePlus, X, Send, Bug, Lightbulb, SpellCheck, Loader2, Check, ExternalLink } from 'lucide-react';
import { getLocale } from '../lib/locale';

// Floating beta-feedback button + modal. Visible everywhere via the root layout.
// Hide it for a clean production build by setting NEXT_PUBLIC_FEEDBACK_ENABLED=false.
// If NEXT_PUBLIC_FEEDBACK_FORM_URL is set, a "Google Form" link is offered too.
const ENABLED = process.env.NEXT_PUBLIC_FEEDBACK_ENABLED !== 'false';
const FORM_URL = process.env.NEXT_PUBLIC_FEEDBACK_FORM_URL;

type Category = 'bug' | 'feature' | 'typo';
type Status = 'idle' | 'sending' | 'sent' | 'error';

const CATEGORIES: { key: Category; label: string; icon: typeof Bug }[] = [
  { key: 'bug', label: 'บั๊ก · Bug', icon: Bug },
  { key: 'feature', label: 'ฟีเจอร์ · Feature', icon: Lightbulb },
  { key: 'typo', label: 'คำผิด/เสียง · Typo', icon: SpellCheck },
];

export default function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<Category>('bug');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<Status>('idle');

  // Close on Escape for keyboard users.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!ENABLED) return null;

  function close() {
    setOpen(false);
    // Reset after the modal fades so the next open is fresh.
    setTimeout(() => { setStatus('idle'); setMessage(''); setCategory('bug'); }, 200);
  }

  async function submit() {
    if (!message.trim() || status === 'sending') return;
    setStatus('sending');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          message: message.trim(),
          path: typeof window !== 'undefined' ? window.location.pathname : '',
          lang: getLocale(),
        }),
      });
      setStatus(res.ok ? 'sent' : 'error');
    } catch {
      setStatus('error');
    }
  }

  return (
    <>
      {/* Floating launcher */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/30 transition-all hover:-translate-y-0.5 hover:shadow-xl active:scale-95"
        aria-label="ส่งคำติชม — Send feedback"
      >
        <MessageSquarePlus className="h-5 w-5" />
        <span className="hidden sm:inline">ส่งคำติชม</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 backdrop-blur-sm sm:items-center"
          onClick={close}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-violet-500 text-white shadow-md">
                <MessageSquarePlus className="h-5 w-5" />
              </div>
              <div className="grow">
                <p className="text-base font-bold text-slate-800 dark:text-slate-100">ส่งคำติชม</p>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-400">Beta Feedback</p>
              </div>
              <button
                type="button"
                onClick={close}
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-label="ปิด — Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {status === 'sent' ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-300">
                  <Check className="h-6 w-6" />
                </div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">ขอบคุณสำหรับคำติชม! — Thank you!</p>
                <button
                  type="button"
                  onClick={close}
                  className="rounded-2xl bg-slate-100 px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  ปิด — Close
                </button>
              </div>
            ) : (
              <>
                {/* Category picker */}
                <div className="mb-3 grid grid-cols-3 gap-2">
                  {CATEGORIES.map((c) => {
                    const Icon = c.icon;
                    const active = category === c.key;
                    return (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => setCategory(c.key)}
                        className={`flex flex-col items-center gap-1 rounded-2xl px-2 py-2.5 text-[11px] font-semibold ring-1 transition ${
                          active
                            ? 'bg-violet-50 text-violet-700 ring-violet-300 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-800'
                            : 'bg-white text-slate-500 ring-slate-200 hover:ring-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {c.label}
                      </button>
                    );
                  })}
                </div>

                {/* Message */}
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  placeholder="เล่าให้เราฟัง… — Tell us what you think…"
                  className="w-full resize-none rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none ring-1 ring-slate-200 transition focus:bg-white focus:ring-2 focus:ring-violet-300 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700 dark:placeholder:text-slate-500 dark:focus:bg-slate-900 dark:focus:ring-violet-500"
                />

                {status === 'error' && (
                  <p className="mt-2 text-xs text-red-500">ส่งไม่สำเร็จ ลองอีกครั้ง — Couldn’t send, please try again.</p>
                )}

                {/* Submit */}
                <button
                  type="button"
                  onClick={submit}
                  disabled={!message.trim() || status === 'sending'}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-violet-600 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition-all hover:shadow-violet-500/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                >
                  {status === 'sending' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {status === 'sending' ? 'กำลังส่ง…' : 'ส่ง — Send'}
                </button>

                {FORM_URL && (
                  <a
                    href={FORM_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 flex items-center justify-center gap-1.5 text-xs font-medium text-slate-400 transition hover:text-violet-500"
                  >
                    หรือกรอกแบบฟอร์มยาว — or open the full form <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
