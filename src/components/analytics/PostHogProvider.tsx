'use client';

import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { useEffect, useRef, useState } from 'react';
import { useCookieConsent } from '@/contexts/useCookieConsent';
import { Env } from '@/libs/Env';
import { SuspendedPostHogPageView } from './PostHogPageView';

export const PostHogProvider = (props: { children: React.ReactNode }) => {
  const { ready, analyticsAllowed } = useCookieConsent();
  const initializedRef = useRef(false);
  const [posthogClientReady, setPosthogClientReady] = useState(false);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const syncReady = (next: boolean) => {
      if (timeoutId !== undefined) {
        globalThis.clearTimeout(timeoutId);
      }
      timeoutId = globalThis.setTimeout(() => {
        timeoutId = undefined;
        setPosthogClientReady(next);
      }, 0);
    };

    if (!ready || !analyticsAllowed || !Env.NEXT_PUBLIC_POSTHOG_KEY) {
      syncReady(false);
      if (initializedRef.current) {
        try {
          posthog.opt_out_capturing();
        } catch {
          // ignore
        }
        initializedRef.current = false;
      }
    } else {
      if (!initializedRef.current) {
        posthog.init(Env.NEXT_PUBLIC_POSTHOG_KEY, {
          api_host: Env.NEXT_PUBLIC_POSTHOG_HOST,
          capture_pageview: false, // Disable automatic pageview capture, as we capture manually
          capture_pageleave: true, // Enable pageleave capture
        });
        initializedRef.current = true;
      }
      syncReady(true);
    }

    return () => {
      if (timeoutId !== undefined) {
        globalThis.clearTimeout(timeoutId);
      }
    };
  }, [ready, analyticsAllowed]);

  if (!Env.NEXT_PUBLIC_POSTHOG_KEY) {
    return props.children;
  }

  if (!ready || !analyticsAllowed || !posthogClientReady) {
    return props.children;
  }

  return (
    <PHProvider client={posthog}>
      <SuspendedPostHogPageView />
      {props.children}
    </PHProvider>
  );
};
