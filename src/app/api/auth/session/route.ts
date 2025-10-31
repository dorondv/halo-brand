import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/libs/Supabase';

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ session });
}
