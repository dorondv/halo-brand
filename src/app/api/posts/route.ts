import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/libs/Supabase';

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('posts')
    .select('id,user_id,content,image_url,ai_caption,metadata,created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();

  // require authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));

  const PostSchema = z.object({
    content: z.string().min(1).max(5000).optional(),
    image_url: z.string().nullable().optional(),
    ai_caption: z.string().nullable().optional(),
    hashtags: z.array(z.string()).optional(),
    media_type: z.string().optional(),
    metadata: z.any().optional(),
  });

  const parse = PostSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.message }, { status: 422 });
  }

  const payload = parse.data;
  const { data: inserted, error } = await supabase.from('posts').insert([
    {
      user_id: user.id,
      content: payload.content ?? '',
      image_url: payload.image_url ?? null,
      ai_caption: payload.ai_caption ?? null,
      hashtags: payload.hashtags ?? [],
      media_type: payload.media_type ?? 'text',
      metadata: payload.metadata ?? null,
      status: 'draft',
    },
  ]).select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ data: inserted }, { status: 201 });
}
