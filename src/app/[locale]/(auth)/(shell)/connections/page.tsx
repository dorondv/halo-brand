'use client';

import { motion } from 'framer-motion';
import {
  Briefcase,
  CheckCircle2,
  Facebook,
  Instagram,
  Linkedin,
  Link as LinkIcon,
  Loader2,
  Play,
  Plus,
  Trash2,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/libs/cn';
import { createSupabaseBrowserClient } from '@/libs/SupabaseBrowser';

// Force dynamic rendering - this page requires authentication

export const dynamic = 'force-dynamic';

// Custom icon components
const XIconComponent = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="currentColor"
    {...props}
  >
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const TikTokIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="currentColor"
    {...props}
  >
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
  </svg>
);

const ThreadsIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="currentColor"
    {...props}
  >
    <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.5 12.5c0-3.086.85-5.94 2.495-8.491C5.845 1.205 8.598.024 12.179 0h.014c3.581.024 6.334 1.205 8.184 3.509C21.65 5.56 22.5 8.414 22.5 11.5c0 3.086-.85 5.94-2.495 8.491C18.361 21.795 15.608 22.976 12.186 24zM12.179 2c-2.944.02-5.028.97-6.346 2.83C4.516 6.69 3.5 9.268 3.5 12.5s1.016 5.81 2.333 7.67c1.318 1.86 3.402 2.81 6.346 2.83h.014c2.944-.02 5.028-.97 6.346-2.83 1.317-1.86 2.333-4.438 2.333-7.67s-1.016-5.81-2.333-7.67C17.221 2.97 15.137 2.02 12.193 2h-.014z" />
  </svg>
);

type Platform
  = | 'instagram'
    | 'x'
    | 'twitter'
    | 'facebook'
    | 'linkedin'
    | 'youtube'
    | 'tiktok'
    | 'threads';

type Brand = {
  id: string;
  name: string;
  logo_url?: string;
  getlate_profile_id?: string | null;
};

type SocialAccount = {
  id: string;
  brand_id: string;
  platform: Platform;
  handle: string;
  display_name: string;
  avatar_url?: string;
  follower_count?: number;
  is_connected: boolean;
  last_sync?: string;
};

const getPlatformConfigs = (t: (key: string) => string): Record<
  Platform,
  { name: string; icon: React.ComponentType<React.SVGProps<SVGSVGElement>>; color: string; description: string }
> => ({
  instagram: {
    name: 'Instagram',
    icon: Instagram,
    color: 'text-pink-500',
    description: t('platform_instagram_desc'),
  },
  facebook: {
    name: 'Facebook',
    icon: Facebook,
    color: 'text-blue-600',
    description: t('platform_facebook_desc'),
  },
  x: {
    name: 'X (Twitter)',
    icon: XIconComponent,
    color: 'text-gray-800',
    description: t('platform_x_desc'),
  },
  twitter: {
    name: 'X (Twitter)',
    icon: XIconComponent,
    color: 'text-gray-800',
    description: t('platform_x_desc'),
  },
  linkedin: {
    name: 'LinkedIn',
    icon: Linkedin,
    color: 'text-sky-700',
    description: t('platform_linkedin_desc'),
  },
  tiktok: {
    name: 'TikTok',
    icon: TikTokIcon,
    color: 'text-black',
    description: t('platform_tiktok_desc'),
  },
  youtube: {
    name: 'YouTube',
    icon: Play,
    color: 'text-red-600',
    description: t('platform_youtube_desc'),
  },
  threads: {
    name: 'Threads',
    icon: ThreadsIcon,
    color: 'text-black',
    description: t('platform_threads_desc'),
  },
});

export default function ConnectionsPage() {
  const t = useTranslations('Integrations');
  const locale = useLocale();
  const isRTL = locale === 'he';
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showManualDialog, setShowManualDialog] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);
  const [manualAccountData, setManualAccountData] = useState({ handle: '', display_name: '' });
  const [isCreatingBrand, setIsCreatingBrand] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  const [brandLogoFile, setBrandLogoFile] = useState<File | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [accountToDisconnect, setAccountToDisconnect] = useState<SocialAccount | null>(null);
  const [isConnectingOAuth, setIsConnectingOAuth] = useState<string | null>(null);
  const [brandToDelete, setBrandToDelete] = useState<Brand | null>(null);
  const [isDeletingBrand, setIsDeletingBrand] = useState(false);

  const platformConfigs = getPlatformConfigs(t as any);

  const loadBrands = useCallback(async () => {
    setIsLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsLoading(false);
        return;
      }

      // Get or create user in users table
      const { data: userRecord } = await supabase
        .from('users')
        .select('id')
        .eq('email', session.user.email)
        .maybeSingle();

      let userId = userRecord?.id;

      // If user doesn't exist in users table, create it
      if (!userId) {
        const { data: newUser } = await supabase
          .from('users')
          .insert([
            {
              id: session.user.id,
              email: session.user.email || '',
              name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
              plan: 'free',
              is_active: true,
            },
          ])
          .select('id')
          .single();

        userId = newUser?.id || session.user.id;
      }

      // Fetch brands for this user (including Getlate profile ID)
      const { data, error } = await supabase
        .from('brands')
        .select('id,name,description,logo_url,getlate_profile_id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('Error fetching brands:', error);
        setBrands([]);
      } else {
        const brandsData: Brand[] = (data || []).map(brand => ({
          id: brand.id,
          name: brand.name,
          logo_url: brand.logo_url || undefined,
          getlate_profile_id: brand.getlate_profile_id || undefined,
        }));
        setBrands(brandsData);
        if (brandsData.length > 0 && !selectedBrand && brandsData[0]) {
          setSelectedBrand(brandsData[0]);
        }
      }
    } catch (error) {
      console.error('Error loading brands:', error);
      setBrands([]);
    }
    setIsLoading(false);
  }, [selectedBrand]);

  const loadAccountsFromDB = useCallback(async (skipSync = false, forceSync = false) => {
    if (!selectedBrand) {
      setAccounts([]);
      return;
    }
    try {
      const supabase = createSupabaseBrowserClient();

      // Load accounts from database (show data from DB immediately - no waiting for Getlate)
      const { data, error } = await supabase
        .from('social_accounts')
        .select('id,brand_id,platform,account_name,account_id,platform_specific_data,getlate_account_id')
        .eq('brand_id', selectedBrand.id)
        .eq('is_active', true)
        .order('platform', { ascending: true });

      if (error) {
        console.error('[Connections] Error loading accounts:', error);
        setAccounts([]);
      } else {
        const accountsData: SocialAccount[] = (data || []).map((acc) => {
          const platformSpecific = acc.platform_specific_data as Record<string, unknown> | null;
          // Normalize platform: 'twitter' -> 'x' for display, but keep original for matching
          const normalizedPlatform = (acc.platform === 'twitter' ? 'x' : acc.platform) as Platform;

          return {
            id: acc.id,
            brand_id: acc.brand_id,
            platform: normalizedPlatform,
            handle: acc.account_name || '',
            display_name: (platformSpecific?.display_name as string) || acc.account_name || '',
            avatar_url: (platformSpecific?.avatar_url as string) || undefined,
            follower_count: (platformSpecific?.follower_count as number) || 0,
            is_connected: true,
            last_sync: (platformSpecific?.last_sync as string) || undefined,
          };
        });

        setAccounts(accountsData);
      }

      // Sync accounts from Getlate in the background (non-blocking)
      // Only sync if not already syncing and brand has Getlate profile
      // Throttle syncs to prevent excessive API calls (max once per 5 minutes per brand)
      // forceSync bypasses the throttle (e.g., after OAuth connection)
      if (!skipSync && selectedBrand.getlate_profile_id) {
        const syncKey = `synced_brand_${selectedBrand.id}`;
        const lastSynced = typeof window !== 'undefined' ? sessionStorage.getItem(syncKey) : null;
        const now = Date.now();

        // Only sync if not synced in the last 5 minutes, or if forceSync is true
        if (forceSync || !lastSynced || (now - Number.parseInt(lastSynced, 10)) > 5 * 60 * 1000) {
          if (typeof window !== 'undefined') {
            sessionStorage.setItem(syncKey, now.toString());
          }

          // Don't await - let it run in background
          fetch(`/api/getlate/accounts?brandId=${selectedBrand.id}`)
            .then(async (response) => {
              if (response.ok) {
                // Small delay to ensure database write is complete
                await new Promise(resolve => setTimeout(resolve, 500));
                // Reload accounts from DB after sync completes (skip sync to avoid loop)
                void loadAccountsFromDB(true);
              }
            })
            .catch(() => {
              // Silently fail - DB data is already shown
            });
        }
      }
    } catch {
      setAccounts([]);
    }
  }, [selectedBrand]);

  const loadAccounts = useCallback(() => {
    void loadAccountsFromDB(false);
  }, [loadAccountsFromDB]);

  useEffect(() => {
    // Load brands on mount - using setTimeout to avoid cascading renders warning
    const timeoutId = setTimeout(() => {
      void loadBrands();
    }, 0);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [loadBrands]);

  useEffect(() => {
    // Load accounts when selected brand changes - using setTimeout to avoid cascading renders warning
    const timeoutId = setTimeout(() => {
      void loadAccounts();
    }, 0);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [loadAccounts]);

  // Handle OAuth callback - check for success, cancellation, or error messages
  // Use a ref to track processed callbacks and prevent duplicate toasts
  const processedCallbackRef = useRef<string | null>(null);

  useEffect(() => {
    const cancelled = searchParams.get('cancelled');
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');

    // Build a unique key for this callback using the full search params
    const callbackKey = searchParams.toString();

    // Only process if there's a callback parameter and we haven't processed this exact URL yet
    if ((!cancelled && !connected && !error) || processedCallbackRef.current === callbackKey) {
      return;
    }

    // Mark as processed immediately to prevent duplicate processing
    processedCallbackRef.current = callbackKey;

    if (cancelled === 'true') {
      showToast(t('connection_cancelled'), 'info');
      // Clean up URL immediately to prevent duplicate processing
      window.history.replaceState({}, '', window.location.pathname);
      // Reset ref after a delay to allow for new callbacks
      setTimeout(() => {
        processedCallbackRef.current = null;
      }, 1000);
    } else if (connected) {
      // connected might be 'true' or the platform name (e.g., 'facebook')
      // Both indicate success
      showToast(t('connection_success'), 'success');

      // Check if sync completed successfully
      const synced = searchParams.get('synced') === 'true';

      // Clean up URL immediately to prevent duplicate processing
      window.history.replaceState({}, '', window.location.pathname);
      // Reset ref after a delay to allow for new callbacks
      setTimeout(() => {
        processedCallbackRef.current = null;
      }, 1000);

      // Reload accounts immediately after successful connection
      // The callback route already synced accounts, so we just need to reload from DB
      if (selectedBrand) {
        // Clear accounts first to force a fresh load
        setAccounts([]);
        // Reload immediately - sync already completed on server side
        // Use forceSync to bypass throttle and ensure fresh data
        void loadAccountsFromDB(false, true);

        // If sync failed on server, retry once
        if (!synced) {
          // Small delay just for DB commit, then retry sync
          setTimeout(() => {
            void loadAccountsFromDB(false, true);
          }, 300);
        }
      }
    } else if (error) {
      showToast(t('connection_error'), 'error');
      // Clean up URL immediately to prevent duplicate processing
      window.history.replaceState({}, '', window.location.pathname);
      // Reset ref after a delay to allow for new callbacks
      setTimeout(() => {
        processedCallbackRef.current = null;
      }, 1000);
      // Reload accounts even on error to ensure UI is up to date
      if (selectedBrand) {
        void loadAccountsFromDB(false, false);
      }
    }
  }, [searchParams, selectedBrand, loadAccountsFromDB, showToast, t]);

  const handleCreateBrand = async () => {
    if (!newBrandName.trim()) {
      return;
    }

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return;
      }

      // Get user ID
      const { data: userRecord } = await supabase
        .from('users')
        .select('id')
        .eq('email', session.user.email)
        .maybeSingle();

      const userId = userRecord?.id || session.user.id;

      let logoUrl: string | null = null;

      // Upload logo if provided
      if (brandLogoFile) {
        setIsUploadingLogo(true);
        try {
          // Validate file type (only images)
          if (!brandLogoFile.type.startsWith('image/')) {
            throw new Error('Please upload an image file');
          }

          // Validate file size (5MB limit)
          const maxSize = 5 * 1024 * 1024; // 5MB
          if (brandLogoFile.size > maxSize) {
            throw new Error('Image size exceeds 5MB limit');
          }

          // Generate unique file name
          const fileExt = brandLogoFile.name.split('.').pop();
          const fileName = `${userId}/brands/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

          // Upload to Supabase Storage (using post-media bucket or create a brands bucket)
          const { error: uploadError } = await supabase.storage
            .from('post-media')
            .upload(fileName, brandLogoFile, {
              cacheControl: '3600',
              upsert: false,
            });

          if (uploadError) {
            console.error('Logo upload error:', uploadError);
            throw new Error(`Failed to upload logo: ${uploadError.message}`);
          }

          // Get public URL
          const { data: { publicUrl } } = supabase.storage
            .from('post-media')
            .getPublicUrl(fileName);

          logoUrl = publicUrl;
        } catch (error) {
          console.error('Error uploading logo:', error);
          // Continue with brand creation even if logo upload fails
        } finally {
          setIsUploadingLogo(false);
        }
      }

      // Create brand via API to handle Getlate profile automatically
      const brandResponse = await fetch('/api/brands', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newBrandName,
          description: null,
          logo_url: logoUrl,
        }),
      });

      if (!brandResponse.ok) {
        const error = await brandResponse.json().catch(() => ({ error: 'Failed to create brand' }));
        console.error('Error creating brand:', error);
        return;
      }

      const { brand: newBrandData } = await brandResponse.json();

      const newBrand: Brand = {
        id: newBrandData.id,
        name: newBrandData.name,
        logo_url: newBrandData.logo_url || undefined,
      };

      setBrands(prev => [...prev, newBrand]);
      setSelectedBrand(newBrand);
      setNewBrandName('');
      setBrandLogoFile(null);
      setIsCreatingBrand(false);
      // Reload brands to ensure consistency
      await loadBrands();
    } catch (error) {
      console.error('Error creating brand:', error);
      // Error will be handled by reloading brands - if creation failed, it won't appear
    }
  };

  const handleManualConnect = (platform: Platform) => {
    setSelectedPlatform(platform);
    setManualAccountData({ handle: '', display_name: '' });
    setShowManualDialog(true);
  };

  const handleOAuthConnect = async (platform: Platform) => {
    if (!selectedBrand) {
      return;
    }

    setIsConnectingOAuth(platform);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsConnectingOAuth(null);
        return;
      }

      // Get or create user in users table (same pattern as loadBrands)
      const { data: userRecord } = await supabase
        .from('users')
        .select('id')
        .eq('email', session.user.email)
        .maybeSingle();

      let userId = userRecord?.id;

      // If user doesn't exist in users table, create it
      if (!userId) {
        const { data: newUser } = await supabase
          .from('users')
          .insert([
            {
              id: session.user.id,
              email: session.user.email || '',
              name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
              plan: 'free',
              is_active: true,
            },
          ])
          .select('id')
          .single();

        userId = newUser?.id || session.user.id;
      }

      // Check if brand has a Getlate profile, create if not
      // First, try to select all columns including getlate_profile_id
      let { data: brandData, error: brandError } = await supabase
        .from('brands')
        .select('id, getlate_profile_id, name, user_id')
        .eq('id', selectedBrand.id)
        .eq('user_id', userId)
        .maybeSingle();

      // If the error is about the column not existing, try again without getlate_profile_id
      if (brandError && brandError.message && brandError.message.includes('does not exist')) {
        // Column doesn't exist yet - select without it
        const { data: brandDataWithoutGetlate, error: brandErrorWithoutGetlate } = await supabase
          .from('brands')
          .select('id, name, user_id')
          .eq('id', selectedBrand.id)
          .eq('user_id', userId)
          .maybeSingle();

        if (brandErrorWithoutGetlate && (brandErrorWithoutGetlate.message || brandErrorWithoutGetlate.code)) {
          console.error('Error fetching brand:', brandErrorWithoutGetlate.message || brandErrorWithoutGetlate.code);
          setIsConnectingOAuth(null);
          return;
        }

        if (!brandDataWithoutGetlate) {
          console.error('Brand not found or does not belong to current user', {
            brandId: selectedBrand.id,
            userId,
          });
          setIsConnectingOAuth(null);
          return;
        }

        // Add getlate_profile_id as null since column doesn't exist
        brandData = { ...brandDataWithoutGetlate, getlate_profile_id: null };
        brandError = null;
      } else if (brandError && (brandError.message || brandError.code)) {
        // Other error
        console.error('Error fetching brand:', brandError.message || brandError.code || brandError);
        setIsConnectingOAuth(null);
        return;
      }

      if (!brandData) {
        console.error('Brand not found or does not belong to current user', {
          brandId: selectedBrand.id,
          userId,
        });
        setIsConnectingOAuth(null);
        return;
      }

      // If brand doesn't have a Getlate profile, create one
      // Note: getlate_profile_id might be null if the column doesn't exist yet
      if (!brandData.getlate_profile_id) {
        const profileResponse = await fetch('/api/getlate/profiles', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: brandData.name || selectedBrand.name,
            brandId: selectedBrand.id,
          }),
        });

        if (!profileResponse.ok) {
          const error = await profileResponse.json().catch(() => ({ error: 'Failed to create profile' }));
          console.error('Error creating Getlate profile:', error);
          setIsConnectingOAuth(null);
          return;
        }

        // Get the profile ID from the response
        const responseData = await profileResponse.json();

        const { profile, profileId } = responseData;

        // Use profile ID from response, or try to extract from profile object
        let profileIdToUse = profileId || profile?.id;

        // Debug logging
        if (!profileIdToUse) {
          console.warn('Profile ID not found in response:', {
            hasProfileId: !!profileId,
            hasProfile: !!profile,
            profileIdValue: profileId,
            profileIdFromProfile: profile?.id,
            fullResponse: responseData,
          });
        }

        if (!profileIdToUse) {
          // Fallback: reload brand data to get the new profile ID
          // Wait a bit for the database update to complete
          await new Promise(resolve => setTimeout(resolve, 500));

          const { data: updatedBrand, error: reloadError } = await supabase
            .from('brands')
            .select('id, getlate_profile_id')
            .eq('id', selectedBrand.id)
            .maybeSingle(); // Use maybeSingle to avoid throwing if not found

          if (!reloadError && updatedBrand?.getlate_profile_id) {
            profileIdToUse = updatedBrand.getlate_profile_id;
          }
        }

        if (!profileIdToUse) {
          console.error('Failed to get Getlate profile ID after creation', {
            responseData,
            brandId: selectedBrand.id,
          });
          setIsConnectingOAuth(null);
          return;
        }

        brandData = { ...brandData, getlate_profile_id: profileIdToUse };
      }

      // Initiate OAuth flow
      const connectResponse = await fetch('/api/getlate/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          platform: platform === 'x' ? 'twitter' : platform,
          brandId: selectedBrand.id,
          redirectUrl: `${window.location.origin}/api/getlate/callback?brandId=${selectedBrand.id}`,
        }),
      });

      if (!connectResponse.ok) {
        const error = await connectResponse.json().catch(() => ({ error: 'Failed to initiate connection' }));
        console.error('Error initiating OAuth:', error);
        setIsConnectingOAuth(null);
        return;
      }

      const responseData = await connectResponse.json();
      const { authUrl } = responseData;

      // Validate authUrl before redirecting
      if (!authUrl || typeof authUrl !== 'string' || authUrl === 'undefined') {
        console.error('Invalid authUrl received:', authUrl, 'Full response:', responseData);
        setIsConnectingOAuth(null);
        return;
      }

      // Redirect to OAuth URL immediately
      // Don't set state after this - we're leaving the page
      window.location.href = authUrl;
    } catch (error) {
      console.error('Error connecting with OAuth:', error);
      setIsConnectingOAuth(null);
    }
  };

  const handleManualSubmit = async () => {
    if (!manualAccountData.handle.trim() || !manualAccountData.display_name.trim() || !selectedPlatform || !selectedBrand) {
      return;
    }

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return;
      }

      // Get user ID
      const { data: userRecord } = await supabase
        .from('users')
        .select('id')
        .eq('email', session.user.email)
        .maybeSingle();

      const userId = userRecord?.id || session.user.id;

      // Create social account in database
      const { data: newAccountData, error } = await supabase
        .from('social_accounts')
        .insert([
          {
            user_id: userId,
            brand_id: selectedBrand.id,
            platform: selectedPlatform === 'x' ? 'twitter' : selectedPlatform, // Store as 'twitter' in DB
            account_name: manualAccountData.handle,
            account_id: `${selectedPlatform}-${Date.now()}`,
            access_token: 'manual-account', // In production, this would be real OAuth token
            platform_specific_data: {
              display_name: manualAccountData.display_name,
              follower_count: 0,
              last_sync: new Date().toISOString(),
            },
            is_active: true,
          },
        ])
        .select('id,brand_id,platform,account_name,platform_specific_data')
        .single();

      if (error) {
        console.error('Error creating account:', error);
        // Error will be handled by not adding account to state
        return;
      }

      const platformSpecific = newAccountData.platform_specific_data as Record<string, unknown> | null;
      const newAccount: SocialAccount = {
        id: newAccountData.id,
        brand_id: newAccountData.brand_id,
        platform: selectedPlatform,
        handle: newAccountData.account_name || '',
        display_name: (platformSpecific?.display_name as string) || newAccountData.account_name || '',
        follower_count: (platformSpecific?.follower_count as number) || 0,
        is_connected: true,
        last_sync: (platformSpecific?.last_sync as string) || undefined,
      };

      setAccounts(prev => [...prev, newAccount]);
      setShowManualDialog(false);
      setManualAccountData({ handle: '', display_name: '' });
      // Reload accounts to ensure consistency
      await loadAccounts();
    } catch (error) {
      console.error('Error creating account:', error);
      // Error will be handled by not adding account to state
    }
  };

  const handleDisconnect = async () => {
    if (!accountToDisconnect) {
      return;
    }

    try {
      const supabase = createSupabaseBrowserClient();

      // Deactivate account instead of deleting (soft delete)
      // Also set a flag to prevent Getlate sync from reactivating it
      const currentPlatformData = (accountToDisconnect as any).platform_specific_data || {};
      const { error } = await supabase
        .from('social_accounts')
        .update({
          is_active: false,
          // Store disconnect timestamp in metadata to track manual disconnects
          platform_specific_data: {
            ...currentPlatformData,
            manually_disconnected_at: new Date().toISOString(),
            manually_disconnected: true,
          },
        })
        .eq('id', accountToDisconnect.id);

      if (error) {
        console.error('Error disconnecting account:', error);
        // Error will be handled by not removing account from state
        return;
      }

      // Remove from UI immediately
      setAccounts(prev => prev.filter(acc => acc.id !== accountToDisconnect.id));
      setAccountToDisconnect(null);

      // Reload accounts with skipSync=true to prevent Getlate sync from reactivating it
      await loadAccountsFromDB(true);
    } catch (error) {
      console.error('Error disconnecting account:', error);
      // Error will be handled by not removing account from state
    }
  };

  const handleDeleteBrand = async () => {
    if (!brandToDelete) {
      return;
    }

    setIsDeletingBrand(true);
    try {
      const response = await fetch(`/api/brands?brandId=${brandToDelete.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to delete brand' }));
        console.error('Error deleting brand:', error);
        setIsDeletingBrand(false);
        return;
      }

      // Remove brand from state
      setBrands(prev => prev.filter(b => b.id !== brandToDelete.id));

      // If deleted brand was selected, select another one or clear selection
      if (selectedBrand?.id === brandToDelete.id) {
        const remainingBrands = brands.filter(b => b.id !== brandToDelete.id);
        if (remainingBrands.length > 0 && remainingBrands[0]) {
          setSelectedBrand(remainingBrands[0]);
        } else {
          setSelectedBrand(null);
        }
      }

      setBrandToDelete(null);
      // Reload brands to ensure consistency
      await loadBrands();
    } catch (error) {
      console.error('Error deleting brand:', error);
    } finally {
      setIsDeletingBrand(false);
    }
  };

  const allPlatforms: Platform[] = ['instagram', 'x', 'facebook', 'linkedin', 'youtube', 'tiktok', 'threads'];

  return (
    <div className="min-h-screen p-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn('flex flex-col gap-6 md:flex-row md:items-center', isRTL ? 'items-start justify-between' : 'items-start justify-between')}
        >
          <div className={isRTL ? 'text-right' : 'text-left'}>
            <h1 className="bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-4xl font-bold text-transparent">
              {t('title')}
            </h1>
            <p className="mt-2 text-lg text-slate-500">{t('subtitle')}</p>
          </div>
        </motion.div>

        {/* Brands Section */}
        <Card className="border-white/20 bg-white/70 shadow-xl backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className={cn(isRTL ? 'text-right flex-1' : 'text-left flex-1')}>
                <CardTitle>{t('your_brands')}</CardTitle>
                <CardDescription>{t('select_or_create_brand')}</CardDescription>
              </div>
              <Button
                onClick={() => setIsCreatingBrand(true)}
                className={cn(
                  'shrink-0 text-white',
                  isRTL
                    ? 'bg-gradient-to-l from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700'
                    : 'bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700',
                )}
              >
                {isRTL
                  ? (
                      <>
                        {t('new_brand')}
                        <Plus className="mr-2 h-4 w-4" />
                      </>
                    )
                  : (
                      <>
                        <Plus className="ml-2 h-4 w-4" />
                        {t('new_brand')}
                      </>
                    )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading
              ? (
                  <div className="py-8 text-center">
                    <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-pink-500"></div>
                    <p className="text-slate-500">{t('loading_brands')}</p>
                  </div>
                )
              : isCreatingBrand
                ? (
                    <div className="space-y-6 rounded-xl border border-pink-200/50 bg-gradient-to-br from-pink-50 to-pink-100/50 p-6">
                      <div className="space-y-2">
                        <Label htmlFor="brandName">{t('brand_name')}</Label>
                        <Input
                          id="brandName"
                          placeholder={t('brand_name_placeholder')}
                          value={newBrandName}
                          onChange={e => setNewBrandName(e.target.value)}
                          className="bg-white"
                          dir={isRTL ? 'rtl' : 'ltr'}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="brandLogo">{t('logo_optional')}</Label>
                        <div className="relative">
                          <input
                            type="file"
                            id="brandLogo"
                            accept="image/*"
                            onChange={e => setBrandLogoFile(e.target.files?.[0] || null)}
                            className={cn(
                              'block w-full text-sm bg-white rounded-md border border-gray-300',
                              'file:border-0 file:bg-white file:text-gray-700 file:text-sm file:font-medium',
                              'file:cursor-pointer hover:file:bg-gray-50',
                              'text-gray-500',
                              isRTL ? 'file:ml-4 file:py-2 file:px-4' : 'file:mr-4 file:py-2 file:px-4',
                            )}
                            dir={isRTL ? 'rtl' : 'ltr'}
                          />
                        </div>
                      </div>
                      <div className={cn('flex gap-3 pt-2', isRTL ? 'justify-start' : 'justify-end')}>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setIsCreatingBrand(false);
                            setNewBrandName('');
                            setBrandLogoFile(null);
                          }}
                          className="border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                          disabled={isUploadingLogo}
                        >
                          {t('cancel')}
                        </Button>
                        <Button
                          onClick={handleCreateBrand}
                          className="bg-pink-600 text-white hover:bg-pink-700"
                          disabled={!newBrandName.trim() || isUploadingLogo}
                        >
                          {isRTL
                            ? (
                                <>
                                  {t('create_brand')}
                                  <CheckCircle2 className="mr-2 h-4 w-4" />
                                </>
                              )
                            : (
                                <>
                                  <CheckCircle2 className="ml-2 h-4 w-4" />
                                  {t('create_brand')}
                                </>
                              )}
                        </Button>
                      </div>
                    </div>
                  )
                : brands.length === 0
                  ? (
                      <div className="py-8 text-center">
                        <Briefcase className="mx-auto mb-4 h-12 w-12 text-gray-400" />
                        <p className="mb-4 text-slate-500">{t('no_brands')}</p>
                      </div>
                    )
                  : (
                      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                        {brands.map(brand => (
                          <div
                            key={brand.id}
                            dir={isRTL ? 'rtl' : 'ltr'}
                            className={`relative rounded-lg border-2 p-4 transition-all duration-300 ${
                              selectedBrand?.id === brand.id
                                ? 'border-pink-500 bg-pink-50'
                                : 'border-gray-200 bg-white/50 hover:border-pink-300'
                            }`}
                          >
                            <div
                              onClick={() => setSelectedBrand(brand)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  setSelectedBrand(brand);
                                }
                              }}
                              role="button"
                              tabIndex={0}
                              className="cursor-pointer"
                            >
                              <div className={cn('flex items-center gap-3', isRTL ? 'flex-row-reverse' : '')}>
                                {brand.logo_url
                                  ? (
                                      <Image
                                        src={brand.logo_url}
                                        alt={brand.name}
                                        width={40}
                                        height={40}
                                        className="h-10 w-10 rounded-full object-cover"
                                      />
                                    )
                                  : (
                                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-pink-100">
                                        <Briefcase className="h-5 w-5 text-pink-500" />
                                      </div>
                                    )}
                                <div className="flex-1">
                                  <p className="font-semibold text-slate-800">{brand.name}</p>
                                </div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setBrandToDelete(brand);
                              }}
                              className={cn(
                                'absolute top-2 rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600',
                                isRTL ? 'right-2' : 'right-2',
                              )}
                              aria-label={`Delete ${brand.name}`}
                              title={`Delete ${brand.name}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
          </CardContent>
        </Card>

        {/* Connected Accounts Section */}
        {selectedBrand && (
          <Card className="border-white/20 bg-white/70 shadow-xl backdrop-blur-sm">
            <CardHeader>
              <CardTitle className={isRTL ? 'text-right' : 'text-left'}>
                {t('connected_accounts_for')}
                {' '}
                <span className="text-pink-600">{selectedBrand.name}</span>
              </CardTitle>
              <CardDescription className={isRTL ? 'text-right' : 'text-left'}>
                {t('connect_accounts_description')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {allPlatforms.map((platform) => {
                  const config = platformConfigs[platform];
                  if (!config) {
                    return null;
                  }
                  const Icon = config.icon;
                  const normalizedPlatform = platform === 'twitter' ? 'x' : platform;
                  // Find account - handle both platform name formats and case variations
                  // Also handle 'twitter' -> 'x' normalization
                  const connectedAccount = accounts.find(
                    (acc) => {
                      const accPlatform = (acc.platform || '').toLowerCase();
                      const searchPlatform = platform.toLowerCase();
                      const searchNormalized = normalizedPlatform.toLowerCase();
                      // Also check for 'twitter' if searching for 'x' or vice versa
                      const isTwitterMatch = (searchPlatform === 'x' && accPlatform === 'twitter')
                        || (searchPlatform === 'twitter' && accPlatform === 'x');
                      const platformMatch = accPlatform === searchPlatform
                        || accPlatform === searchNormalized
                        || isTwitterMatch;
                      const brandMatch = acc.brand_id === selectedBrand.id;

                      return platformMatch && brandMatch;
                    },
                  );

                  return (
                    <div
                      key={platform}
                      className="flex items-center justify-between rounded-xl border border-gray-200 bg-white/50 p-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-pink-50">
                          <Icon className={`h-6 w-6 ${config.color}`} />
                        </div>
                        <div className={isRTL ? 'text-right' : 'text-left'}>
                          <h3 className="font-semibold text-slate-800">{config.name}</h3>
                          <p className="text-sm text-slate-500">
                            {connectedAccount
                              ? `${connectedAccount.handle} (${connectedAccount.follower_count?.toLocaleString()} ${t('followers')})`
                              : t('not_connected')}
                          </p>
                        </div>
                      </div>
                      <div className={cn('flex gap-2', isRTL ? 'flex-row-reverse' : '')}>
                        {connectedAccount
                          ? (
                              <Button
                                onClick={() => setAccountToDisconnect(connectedAccount)}
                                variant="secondary"
                                size="sm"
                              >
                                {t('disconnect')}
                              </Button>
                            )
                          : (
                              <>
                                <Button
                                  onClick={() => handleOAuthConnect(platform)}
                                  disabled={isConnectingOAuth === platform}
                                  size="sm"
                                  className="bg-gradient-to-r from-pink-500 to-pink-600 text-white hover:from-pink-600 hover:to-pink-700"
                                >
                                  {isConnectingOAuth === platform
                                    ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      )
                                    : (
                                        t('connect_oauth')
                                      )}
                                </Button>
                                <Button
                                  onClick={() => handleManualConnect(platform)}
                                  variant="outline"
                                  size="sm"
                                >
                                  <LinkIcon className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
                                  {t('manual')}
                                </Button>
                              </>
                            )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Delete Brand Confirmation Dialog */}
        <Dialog open={!!brandToDelete} onOpenChange={open => !open && setBrandToDelete(null)}>
          <DialogContent dir={isRTL ? 'rtl' : 'ltr'}>
            <DialogHeader>
              <DialogTitle>{t('delete_brand_title')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-slate-600">
                {t('delete_brand_message', { name: brandToDelete?.name || '' })}
              </p>
            </div>
            <DialogFooter className={cn('gap-2', isRTL ? 'flex-row-reverse' : '')}>
              <Button
                variant="outline"
                onClick={() => setBrandToDelete(null)}
                disabled={isDeletingBrand}
                className="border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              >
                {t('cancel')}
              </Button>
              <Button
                onClick={handleDeleteBrand}
                disabled={isDeletingBrand}
                className="bg-red-600 text-white hover:bg-red-700"
              >
                {isDeletingBrand
                  ? (
                      <>
                        <Loader2 className={cn('h-4 w-4 animate-spin', isRTL ? 'ml-2' : 'mr-2')} />
                        {t('deleting')}
                      </>
                    )
                  : (
                      <>
                        <Trash2 className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
                        {t('delete')}
                      </>
                    )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Manual Connection Dialog */}
        <Dialog open={showManualDialog} onOpenChange={setShowManualDialog}>
          <DialogContent dir={isRTL ? 'rtl' : 'ltr'}>
            <DialogHeader>
              <DialogTitle>
                {t('manual_connection_to')}
                {selectedPlatform && platformConfigs[selectedPlatform]?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="handle">{t('username_handle')}</Label>
                <Input
                  id="handle"
                  placeholder={t('username_placeholder')}
                  value={manualAccountData.handle}
                  onChange={e =>
                    setManualAccountData(prev => ({ ...prev, handle: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="displayName">{t('display_name')}</Label>
                <Input
                  id="displayName"
                  placeholder={t('display_name_placeholder')}
                  value={manualAccountData.display_name}
                  onChange={e =>
                    setManualAccountData(prev => ({ ...prev, display_name: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter className={cn(isRTL ? 'flex-row-reverse' : '')}>
              <Button variant="outline" onClick={() => setShowManualDialog(false)}>
                {t('cancel')}
              </Button>
              <Button onClick={handleManualSubmit} className="bg-pink-600 text-white">
                {t('connect_account')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Disconnect Confirmation Dialog */}
        <Dialog
          open={!!accountToDisconnect}
          onOpenChange={() => setAccountToDisconnect(null)}
        >
          <DialogContent dir={isRTL ? 'rtl' : 'ltr'}>
            <DialogHeader>
              <DialogTitle>{t('are_you_sure')}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-gray-600">
              {t('disconnect_warning', { handle: accountToDisconnect?.handle || '' })}
            </p>
            <DialogFooter className={cn(isRTL ? 'flex-row-reverse' : '')}>
              <Button variant="outline" onClick={() => setAccountToDisconnect(null)}>
                {t('cancel')}
              </Button>
              <Button onClick={handleDisconnect} className="bg-red-600 text-white hover:bg-red-700">
                {t('yes_disconnect')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
