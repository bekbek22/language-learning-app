import { NextResponse } from 'next/server';
import { getContent } from '../../lib/content';

export const dynamic = 'force-dynamic';

function fisherYates<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function GET(request: Request) {
  const lang = new URL(request.url).searchParams.get('lang');
  return NextResponse.json(fisherYates(getContent('phrases', lang)).slice(0, 20));
}
