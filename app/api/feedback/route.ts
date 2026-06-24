import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type FeedbackBody = {
  category?: string;
  message?: string;
  path?: string;
  lang?: string;
};

const CATEGORIES = ['bug', 'feature', 'typo'];

// Beta feedback sink. By default it just logs (visible in Vercel's function
// logs). Set FEEDBACK_WEBHOOK_URL (e.g. a Slack/Discord incoming webhook) in the
// Vercel project env to also forward each submission there — no code change.
export async function POST(request: Request) {
  let body: FeedbackBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }

  const message = (body.message ?? '').trim();
  const category = CATEGORIES.includes(body.category ?? '') ? body.category! : 'bug';
  if (!message) {
    return NextResponse.json({ ok: false, error: 'empty message' }, { status: 400 });
  }

  const entry = {
    category,
    message: message.slice(0, 2000), // cap length
    path: (body.path ?? '').slice(0, 200),
    lang: (body.lang ?? '').slice(0, 8),
    at: new Date().toISOString(),
  };

  console.log('[feedback]', JSON.stringify(entry));

  const webhook = process.env.FEEDBACK_WEBHOOK_URL;
  if (webhook) {
    try {
      await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🧪 *Beta feedback* (${entry.category})\n${entry.message}\n_path:_ ${entry.path || '/'} · _lang:_ ${entry.lang || '-'}`,
        }),
      });
    } catch (err) {
      // Don't fail the user's submission if the webhook is down — we already logged it.
      console.error('[feedback] webhook failed', err);
    }
  }

  return NextResponse.json({ ok: true });
}
