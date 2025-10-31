import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/libs/Supabase';

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const Schema = z.object({ content: z.string().min(1) });
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 422 });
  }

  // Placeholder AI logic — replace with OpenAI call in production
  const aiCaption = `${String(parsed.data.content).slice(0, 80)}... (AI suggested caption)`;
  return NextResponse.json({ aiCaption });
}
