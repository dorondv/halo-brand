import { NextResponse } from 'next/server';
import { ADMIN_EMAIL } from '@/config/admin';
import { createSupabaseServerClient } from '@/libs/Supabase';

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ isAdmin: false }, { status: 401 });
    }

    // Check if user email is the admin email (server-side only)
    const isAdmin = user.email === ADMIN_EMAIL;

    return NextResponse.json({ isAdmin });
  } catch (error: any) {
    console.error('Error checking admin status:', error);
    return NextResponse.json({ isAdmin: false }, { status: 500 });
  }
}
