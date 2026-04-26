'use client';

import { useLocale } from 'next-intl';
import { useEffect, useRef } from 'react';
import { useCookieConsent } from '@/contexts/useCookieConsent';
import { createSupabaseBrowserClient } from '@/libs/SupabaseBrowser';

declare global {
  // For global type augmentation, interface is required by TypeScript
  // eslint-disable-next-line ts/consistent-type-definitions
  interface Window {
    chatwootSDK?: {
      run: (config: { websiteToken: string; baseUrl: string }) => void;
    };
    $chatwoot?: {
      setUser: (
        identifier: string,
        attributes: {
          email?: string;
          name?: string;
          avatar_url?: string;
          identifier_hash?: string;
        },
      ) => void;
      setCustomAttributes: (attributes: Record<string, any>) => void;
      toggle: (action?: 'open' | 'close') => void;
      reset: () => void;
    };
    chatwootSettings?: {
      hideMessageBubble?: boolean;
      position?: 'left' | 'right';
      locale?: string;
      type?: string;
      launcherTitle?: string;
    };
  }
}

type ChatwootWidgetProps = {
  websiteToken?: string;
  baseUrl?: string;
  agentName?: string;
};

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/$/, '');
}

export function ChatwootWidget({
  websiteToken,
  baseUrl = 'https://app.chatwoot.com',
  agentName = 'branda',
}: ChatwootWidgetProps) {
  const locale = useLocale();
  const { ready } = useCookieConsent();
  const hasInitializedRun = useRef(false);
  /** Skip duplicate setUser when auth refreshes with the same identity (TOKEN_REFRESHED fires often). */
  const lastIdentityKeyRef = useRef<string | null>(null);

  // Load SDK after cookie consent UI has read stored preferences (avoids hydration mismatch).
  // Support chat is not gated on "functional" cookies so users who reject non-essential still see help.
  useEffect(() => {
    const token = websiteToken;

    if (!ready || !token) {
      if (!token && process.env.NODE_ENV === 'development') {
        console.warn('Chatwoot website token not configured');
      }
      return;
    }

    const base = normalizeBaseUrl(baseUrl);
    const sdkUrl = `${base}/packs/js/sdk.js`;

    window.chatwootSettings = {
      hideMessageBubble: false,
      position: 'right',
      locale: locale === 'he' ? 'he' : 'en',
      type: 'standard',
      launcherTitle: `Chat with ${agentName}`,
    };

    const tryRun = (): boolean => {
      if (hasInitializedRun.current) {
        return true;
      }
      if (window.chatwootSDK && typeof window.chatwootSDK.run === 'function') {
        try {
          window.chatwootSDK.run({
            websiteToken: token,
            baseUrl: base,
          });
          hasInitializedRun.current = true;
          if (process.env.NODE_ENV === 'development') {
            console.warn('Chatwoot widget initialized');
          }
          return true;
        } catch (error) {
          console.error('Error initializing Chatwoot widget:', error);
        }
      }
      return false;
    };

    if (tryRun()) {
      return;
    }

    let script = document.querySelector<HTMLScriptElement>(`script[src="${sdkUrl}"]`);
    if (!script) {
      script = document.createElement('script');
      script.src = sdkUrl;
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }

    const poll = setInterval(() => {
      if (tryRun()) {
        clearInterval(poll);
      }
    }, 100);

    const timeout = setTimeout(() => {
      clearInterval(poll);
      if (!hasInitializedRun.current && !window.chatwootSDK) {
        console.error('Chatwoot SDK failed to load');
      }
    }, 10000);

    return () => {
      clearInterval(poll);
      clearTimeout(timeout);
    };
  }, [ready, websiteToken, baseUrl, agentName, locale]);

  // Set user identity when authenticated
  useEffect(() => {
    if (!ready) {
      return;
    }

    let readyPoll: ReturnType<typeof setInterval> | null = null;
    let readyPollTimeout: ReturnType<typeof setTimeout> | null = null;

    const clearReadyPoll = () => {
      if (readyPoll !== null) {
        clearInterval(readyPoll);
        readyPoll = null;
      }
      if (readyPollTimeout !== null) {
        clearTimeout(readyPollTimeout);
        readyPollTimeout = null;
      }
    };

    const setUserIdentity = async () => {
      if (!window.$chatwoot) {
        clearReadyPoll();

        // Wait for Chatwoot to be ready
        readyPoll = setInterval(() => {
          if (window.$chatwoot) {
            clearReadyPoll();
            void setUserIdentity();
          }
        }, 100);
        readyPollTimeout = setTimeout(() => {
          clearReadyPoll();
        }, 10000);
        return;
      }

      try {
        const supabase = createSupabaseBrowserClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          // Get user data from database
          const { data: userRecord } = await supabase
            .from('users')
            .select('name, avatar_url')
            .eq('id', session.user.id)
            .maybeSingle();

          const userName
            = userRecord?.name
              || session.user.user_metadata?.full_name
              || session.user.user_metadata?.name
              || session.user.email?.split('@')[0]
              || 'User';

          const userEmail = session.user.email || '';
          const avatarUrl = userRecord?.avatar_url || session.user.user_metadata?.avatar_url;

          const identityKey = `${session.user.id}|${userEmail}|${userName}|${avatarUrl ?? ''}|${agentName}`;
          if (lastIdentityKeyRef.current === identityKey) {
            return;
          }

          // Set user identity in Chatwoot
          window.$chatwoot.setUser(session.user.id, {
            email: userEmail,
            name: userName,
            avatar_url: avatarUrl,
          });

          // Set custom attributes
          window.$chatwoot.setCustomAttributes({
            user_id: session.user.id,
            agent: agentName,
          });

          lastIdentityKeyRef.current = identityKey;
        } else {
          // User is not authenticated, reset Chatwoot user
          lastIdentityKeyRef.current = null;
          window.$chatwoot.reset();
        }
      } catch (error) {
        console.error('Error setting Chatwoot user identity:', error);
      }
    };

    // Listen for Chatwoot ready event
    const handleReady = () => {
      setUserIdentity();
    };

    // Listen for auth state changes
    const supabase = createSupabaseBrowserClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setUserIdentity();
      } else if (event === 'SIGNED_OUT') {
        lastIdentityKeyRef.current = null;
        if (window.$chatwoot) {
          window.$chatwoot.reset();
        }
      }
    });

    window.addEventListener('chatwoot:ready', handleReady);

    // Also try to set identity immediately if Chatwoot is already ready
    setUserIdentity();

    return () => {
      window.removeEventListener('chatwoot:ready', handleReady);
      subscription.unsubscribe();
      clearReadyPoll();
    };
  }, [ready, agentName]);

  return null; // This component doesn't render anything
}
