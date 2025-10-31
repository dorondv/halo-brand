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
  const Schema = z.object({
    postId: z.string().uuid(),
    socialAccountId: z.string().uuid(),
    scheduledFor: z.string(),
  });
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 422 });
  }

  const { postId, socialAccountId, scheduledFor } = parsed.data;

  const { data, error } = await supabase.from('scheduled_posts').insert([
    {
      post_id: postId,
      social_account_id: socialAccountId,
      scheduled_for: scheduledFor,
      status: 'pending',
    },
  ]).select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data }, { status: 201 });
}
