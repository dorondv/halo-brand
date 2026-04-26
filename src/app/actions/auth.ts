'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import * as z from 'zod';
import { createSupabaseServerClient } from '@/libs/Supabase';
import { getAuthCallbackUrl } from '@/utils/Helpers';

const signInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const signUpSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  fullName: z.string().min(1, 'Full name is required').max(200, 'Full name is too long'),
});

// Lazy load Arcjet only when needed (avoids bundling in middleware)
async function protectWithArcjet(isSignup: boolean) {
  // Only load if Arcjet key is configured
  if (!process.env.ARCJET_KEY) {
    return null;
  }

  try {
    // Dynamic import to avoid bundling Arcjet in server actions bundle
    const arcjetModule = await import('@arcjet/next');
    const { default: arcjet, detectBot, fixedWindow, shield, slidingWindow } = arcjetModule;

    const headersList = await headers();
    const protocol = headersList.get('x-forwarded-proto') || 'https';
    const host = headersList.get('host') || '';
    const url = `${protocol}://${host}/sign-up`;

    // Create request for Arcjet
    const req = new Request(url, {
      method: 'POST',
      headers: Object.fromEntries(headersList.entries()),
    });

    // Create appropriate Arcjet instance
    const aj = arcjet({
      key: process.env.ARCJET_KEY,
      characteristics: ['ip.src', 'http.request.uri.path'],
      rules: [
        shield({ mode: 'LIVE' }),
        detectBot({
          mode: 'LIVE',
          allow: ['CATEGORY:SEARCH_ENGINE', 'CATEGORY:MONITOR'],
        }),
        isSignup
          ? fixedWindow({ mode: 'LIVE', window: '15m', max: 5 })
          : fixedWindow({ mode: 'LIVE', window: '1m', max: 30 }),
        isSignup
          ? slidingWindow({ mode: 'LIVE', interval: '1h', max: 10 })
          : slidingWindow({ mode: 'LIVE', interval: '1h', max: 1000 }),
      ],
    });

    const decision = await aj.protect(req);

    if (decision.isDenied()) {
      const isRateLimit = decision.reason.isRateLimit();
      const isBot = decision.reason.isBot();

      if (isRateLimit) {
        return isSignup
          ? 'Too many signup attempts. Please try again later.'
          : 'Too many sign-in attempts. Please try again later.';
      }
      if (isBot) {
        return 'Bot detected. Access denied.';
      }
      return 'Access denied.';
    }

    return null;
  } catch (error) {
    // If Arcjet fails, log but don't block (fail open for availability)
    console.error('Arcjet protection error:', error);
    return null;
  }
}

export async function signIn(_prevState: unknown, formData: FormData) {
  // Apply Arcjet protection
  const arcjetError = await protectWithArcjet(false);
  if (arcjetError) {
    return { error: arcjetError };
  }

  // Validate input
  const parsed = signInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Invalid input' };
  }

  const { email, password } = parsed.data;
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return {
      error: error.message,
    };
  }

  redirect('/dashboard');
}

export async function signUp(_prevState: unknown, formData: FormData) {
  // Apply stricter Arcjet protection for signup
  const arcjetError = await protectWithArcjet(true);
  if (arcjetError) {
    return { error: arcjetError };
  }

  // Validate input
  const parsed = signUpSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    fullName: formData.get('fullName'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Invalid input' };
  }

  const { email, password, fullName } = parsed.data;
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  });

  if (error) {
    return {
      error: error.message,
    };
  }

  return {
    message: 'Check your email for a confirmation link.',
  };
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/sign-in');
}

export async function signInWithGoogle() {
  const supabase = await createSupabaseServerClient();
  const headersList = await headers();
  const callbackUrl = await getAuthCallbackUrl(headersList);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: callbackUrl,
    },
  });

  if (error) {
    return {
      error: error.message,
    };
  }

  if (data?.url) {
    redirect(data.url);
  }

  return {
    error: 'Failed to initiate Google sign in',
  };
}

export async function signInWithFacebook() {
  const supabase = await createSupabaseServerClient();
  const headersList = await headers();
  const callbackUrl = await getAuthCallbackUrl(headersList);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'facebook',
    options: {
      redirectTo: callbackUrl,
    },
  });

  if (error) {
    return {
      error: error.message,
    };
  }

  if (data?.url) {
    redirect(data.url);
  }

  return {
    error: 'Failed to initiate Facebook sign in',
  };
}
