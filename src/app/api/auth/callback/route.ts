import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/libs/Supabase';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const requestedNext = requestUrl.searchParams.get('next') || '/dashboard';

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return NextResponse.redirect(new URL(`/sign-in?error=${encodeURIComponent(error.message)}`, request.url));
    }
  }

  const safeNext = requestedNext.startsWith('/') ? requestedNext : '/dashboard';
  const redirectUrl = new URL(safeNext, request.url);

  if (redirectUrl.origin !== requestUrl.origin) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.redirect(redirectUrl);
}
