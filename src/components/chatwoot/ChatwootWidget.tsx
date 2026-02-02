'use client';

import { useEffect, useRef } from 'react';
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

export function ChatwootWidget({
  websiteToken,
  baseUrl = 'https://app.chatwoot.com',
  agentName = 'branda',
}: ChatwootWidgetProps) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const readyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const readyIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Get configuration from environment or props
    const token = websiteToken || process.env.NEXT_PUBLIC_CHATWOOT_WEBSITE_TOKEN;

    if (!token) {
      console.warn('Chatwoot website token not configured');
      return;
    }

    // Set widget settings before loading SDK
    window.chatwootSettings = {
      hideMessageBubble: false,
      position: 'right',
      locale: 'en',
      type: 'standard',
      launcherTitle: `Chat with ${agentName}`,
    };

    // Check if SDK is already loaded
    if (window.chatwootSDK && window.$chatwoot) {
      initializeWidget(token, baseUrl);
      return;
    }

    // Load Chatwoot SDK
    const script = document.createElement('script');
    script.src = `${baseUrl}/packs/js/sdk.js`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      // Wait for SDK to be available
      const checkSDK = setInterval(() => {
        if (window.chatwootSDK && typeof window.chatwootSDK.run === 'function') {
          clearInterval(checkSDK);
          initializeWidget(token, baseUrl);
        }
      }, 100);
      intervalRef.current = checkSDK;

      // Timeout after 10 seconds
      timeoutRef.current = setTimeout(() => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        if (!window.chatwootSDK) {
          console.error('Chatwoot SDK failed to load');
        }
      }, 10000);
    };

    script.onerror = () => {
      console.error('Failed to load Chatwoot SDK script');
    };

    document.body.appendChild(script);

    // Cleanup function
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [websiteToken, baseUrl, agentName]);

  // Set user identity when authenticated
  useEffect(() => {
    // Clear any existing interval/timeout on mount/unmount
    if (readyIntervalRef.current) {
      clearInterval(readyIntervalRef.current);
      readyIntervalRef.current = null;
    }
    if (readyTimeoutRef.current) {
      clearTimeout(readyTimeoutRef.current);
      readyTimeoutRef.current = null;
    }

    const setUserIdentity = async () => {
      if (!window.$chatwoot) {
        // Clear any existing interval/timeout before creating new ones
        if (readyIntervalRef.current) {
          clearInterval(readyIntervalRef.current);
          readyIntervalRef.current = null;
        }
        if (readyTimeoutRef.current) {
          clearTimeout(readyTimeoutRef.current);
          readyTimeoutRef.current = null;
        }

        // Wait for Chatwoot to be ready
        const checkReady = setInterval(() => {
          if (window.$chatwoot) {
            if (readyIntervalRef.current) {
              clearInterval(readyIntervalRef.current);
              readyIntervalRef.current = null;
            }
            if (readyTimeoutRef.current) {
              clearTimeout(readyTimeoutRef.current);
              readyTimeoutRef.current = null;
            }
            setUserIdentity();
          }
        }, 100);
        readyIntervalRef.current = checkReady;
        readyTimeoutRef.current = setTimeout(() => {
          if (readyIntervalRef.current) {
            clearInterval(readyIntervalRef.current);
            readyIntervalRef.current = null;
          }
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

          // User identity set successfully (no need to log in production)
          if (process.env.NODE_ENV === 'development') {
            console.warn('Chatwoot user identity set:', userName);
          }
        } else {
          // User is not authenticated, reset Chatwoot user
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
      // Cleanup timeouts/intervals if still running
      if (readyTimeoutRef.current) {
        clearTimeout(readyTimeoutRef.current);
        readyTimeoutRef.current = null;
      }
      if (readyIntervalRef.current) {
        clearInterval(readyIntervalRef.current);
        readyIntervalRef.current = null;
      }
    };
  }, [agentName]);

  return null; // This component doesn't render anything
}

function initializeWidget(token: string, baseUrl: string) {
  try {
    window.chatwootSDK?.run({
      websiteToken: token,
      baseUrl,
    });
    // Widget initialized successfully (no need to log in production)
    if (process.env.NODE_ENV === 'development') {
      console.warn('Chatwoot widget initialized');
    }
  } catch (error) {
    console.error('Error initializing Chatwoot widget:', error);
  }
}
