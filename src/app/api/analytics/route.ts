import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/libs/Supabase';

export async function GET(req: Request) {
  const supabase = await createSupabaseServerClient();
  const url = new URL(req.url);
  const postId = url.searchParams.get('postId');
  const start = url.searchParams.get('start');
  const end = url.searchParams.get('end');

  const QuerySchema = z.object({
    postId: z.string().optional(),
    start: z.string().optional(),
    end: z.string().optional(),
  });
  const parsed = QuerySchema.parse({ postId, start, end });

  if (parsed.postId) {
    const { data, error } = await supabase.from('post_analytics').select('*').eq('post_id', parsed.postId).order('date', { ascending: true });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ data });
  }

  let query = supabase.from('post_analytics').select('post_id,likes,comments,shares,impressions,date');
  if (parsed.start) {
    query = query.gte('date', parsed.start);
  }
  if (parsed.end) {
    query = query.lte('date', parsed.end);
  }

  const { data, error } = await query.order('date', { ascending: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}
