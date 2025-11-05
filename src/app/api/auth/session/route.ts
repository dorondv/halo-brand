import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/libs/Supabase';

export async function GET() {
  const supabase = await createSupabaseServerClient();
  // Validate user first with getUser() for security
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ session: null }, { status: 200 });
  }
  // Get session after validating user
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ session });
}
