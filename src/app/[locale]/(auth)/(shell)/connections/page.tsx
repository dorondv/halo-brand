'use client';

import { motion } from 'framer-motion';
import {
  Briefcase,
  Building2,
  CheckCircle2,
  Facebook,
  Info,
  Instagram,
  Linkedin,
  Loader2,
  Play,
  Plus,
  Settings,
  Trash2,
  User,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { useBrand } from '@/contexts/BrandContext';
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
  getlate_account_id?: string;
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
    color: 'text-pink-500',
    description: t('platform_facebook_desc'),
  },
  x: {
    name: 'X (Twitter)',
    icon: XIconComponent,
    color: 'text-pink-500',
    description: t('platform_x_desc'),
  },
  twitter: {
    name: 'X (Twitter)',
    icon: XIconComponent,
    color: 'text-pink-500',
    description: t('platform_x_desc'),
  },
  linkedin: {
    name: 'LinkedIn',
    icon: Linkedin,
    color: 'text-pink-500',
    description: t('platform_linkedin_desc'),
  },
  tiktok: {
    name: 'TikTok',
    icon: TikTokIcon,
    color: 'text-pink-500',
    description: t('platform_tiktok_desc'),
  },
  youtube: {
    name: 'YouTube',
    icon: Play,
    color: 'text-pink-500',
    description: t('platform_youtube_desc'),
  },
  threads: {
    name: 'Threads',
    icon: ThreadsIcon,
    color: 'text-pink-500',
    description: t('platform_threads_desc'),
  },
});

export default function ConnectionsPage() {
  const t = useTranslations('Integrations');
  const tLinkedIn = useTranslations('CreatePost.LinkedIn');
  const locale = useLocale();
  const isRTL = locale === 'he';
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const { selectedBrandId, setSelectedBrandId } = useBrand();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);

  // Get the selected brand object from brands array
  const selectedBrand = selectedBrandId ? brands.find(b => b.id === selectedBrandId) || null : null;
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingBrand, setIsCreatingBrand] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  const [brandLogoFile, setBrandLogoFile] = useState<File | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [accountToDisconnect, setAccountToDisconnect] = useState<SocialAccount | null>(null);
  const [isConnectingOAuth, setIsConnectingOAuth] = useState<string | null>(null);
  const [brandToDelete, setBrandToDelete] = useState<Brand | null>(null);
  const [isDeletingBrand, setIsDeletingBrand] = useState(false);

  // Facebook pages dialog state
  const [facebookAccountForPages, setFacebookAccountForPages] = useState<SocialAccount | null>(null);
  const [facebookPages, setFacebookPages] = useState<Array<{ id: string; name: string; pageId?: string }>>([]);
  const [isLoadingFacebookPages, setIsLoadingFacebookPages] = useState(false);
  const [isSavingFacebookPage, setIsSavingFacebookPage] = useState(false);
  const [selectedFacebookPageId, setSelectedFacebookPageId] = useState<string | null>(null);

  // LinkedIn organizations dialog state
  const [linkedinAccountForOrgs, setLinkedinAccountForOrgs] = useState<SocialAccount | null>(null);
  const [linkedinAccountName, setLinkedinAccountName] = useState<string | null>(null); // Store personal account name
  const [linkedinOrganizations, setLinkedinOrganizations] = useState<Array<{ id: string; name: string; urn?: string }>>([]);
  const [isLoadingLinkedInOrgs, setIsLoadingLinkedInOrgs] = useState(false);
  const [isSavingLinkedInOrg, setIsSavingLinkedInOrg] = useState(false);
  const [selectedLinkedInOrgId, setSelectedLinkedInOrgId] = useState<string | null>(null);
  // LinkedIn posting configuration type
  type LinkedInPostingType = 'personal' | 'organization';
  type LinkedInPageType = 'company' | 'showcase';
  type LinkedInPostingConfig = {
    postingType: LinkedInPostingType;
    pageType?: LinkedInPageType;
    organizationUrl?: string;
    organizationUrn?: string;
    organizationName?: string;
  };

  const [linkedInPostingConfig, setLinkedInPostingConfig] = useState<LinkedInPostingConfig>({
    postingType: 'personal',
  });

  // Headless mode OAuth state
  const [headlessModeData, setHeadlessModeData] = useState<{
    step: string;
    platform: string;
    profileId: string;
    tempToken: string;
    userProfile: string;
    connectToken: string;
    organizations?: string; // LinkedIn organizations (URL-encoded JSON)
    brandId?: string;
  } | null>(null);
  const [isLoadingHeadlessPages, setIsLoadingHeadlessPages] = useState(false);
  const [headlessFacebookPages, setHeadlessFacebookPages] = useState<Array<{ id: string; name: string; pageId?: string }>>([]);
  const [selectedHeadlessFacebookPageId, setSelectedHeadlessFacebookPageId] = useState<string | null>(null);
  const [isSavingHeadlessSelection, setIsSavingHeadlessSelection] = useState(false);

  const platformConfigs = getPlatformConfigs(t as any);

  const loadBrands = useCallback(async () => {
    setIsLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('[Connections] Error getting session:', sessionError);
        setIsLoading(false);
        return;
      }

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
        // Don't auto-select - let context handle brand selection
        // If no brand is selected in context and we have brands, context will handle it
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[Connections] Error loading brands:', errorMessage);

      // Check if it's a network/fetch error
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        console.error('[Connections] Network error - Supabase may be unreachable. Check your internet connection and Supabase project status.');
      }

      setBrands([]);
    }
    setIsLoading(false);
  }, []);

  const loadAccountsFromDB = useCallback(async (skipSync = false, forceSync = false) => {
    if (!selectedBrandId) {
      setAccounts([]);
      return;
    }
    try {
      const supabase = createSupabaseBrowserClient();

      // Get current user to filter accounts by user_id
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('[Connections] Error getting session:', sessionError);
        setAccounts([]);
        return;
      }

      if (!session) {
        setAccounts([]);
        return;
      }

      // Get user ID from users table
      const { data: userRecord } = await supabase
        .from('users')
        .select('id')
        .eq('email', session.user.email)
        .maybeSingle();

      const userId = userRecord?.id || session.user.id;

      // Load accounts from database (show data from DB immediately - no waiting for Getlate)
      // Filter by both user_id and brand_id to ensure only current user's accounts are shown
      const { data, error } = await supabase
        .from('social_accounts')
        .select('id,brand_id,platform,account_name,account_id,platform_specific_data,getlate_account_id')
        .eq('user_id', userId)
        .eq('brand_id', selectedBrandId)
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

          // For Facebook, use page name if available, otherwise use account name
          let displayName = (platformSpecific?.display_name as string) || acc.account_name || '';
          let handle = acc.account_name || '';

          if (acc.platform === 'facebook' && platformSpecific?.facebookPage) {
            const facebookPage = platformSpecific.facebookPage as Record<string, unknown> | undefined;
            if (facebookPage?.name) {
              // Use page name for Facebook accounts with selected page
              displayName = facebookPage.name as string;
              handle = facebookPage.name as string;
            }
          }

          // For LinkedIn, use organization name if posting as organization, otherwise use account name
          if (acc.platform === 'linkedin') {
            if (platformSpecific?.linkedinPostingType === 'organization') {
              const linkedinOrg = platformSpecific.linkedinOrganization as Record<string, unknown> | undefined;

              // Prioritize company name over ID
              if (linkedinOrg?.name && String(linkedinOrg.name).trim()) {
                // Use the company name if available
                displayName = String(linkedinOrg.name).trim();
                handle = String(linkedinOrg.name).trim();
              } else {
                // Fallback to company ID if name is not available
                let companyId: string | undefined;

                if (linkedinOrg?.id) {
                  companyId = String(linkedinOrg.id);
                } else if (linkedinOrg?.urn) {
                  // Extract ID from URN format: urn:li:organization:123456 or urn:li:organizationBrand:123456
                  const urnMatch = String(linkedinOrg.urn).match(/urn:li:organization(?:Brand)?:(\d+)/);
                  if (urnMatch) {
                    companyId = urnMatch[1];
                  }
                } else if (platformSpecific?.linkedinOrganizationUrl) {
                  // Extract ID from URL format: linkedin.com/company/123456
                  const urlMatch = String(platformSpecific.linkedinOrganizationUrl).match(/\/company\/(\d+)/);
                  if (urlMatch) {
                    companyId = urlMatch[1];
                  }
                }

                if (companyId) {
                  // Display company ID as fallback if name not available
                  displayName = companyId;
                  handle = companyId;
                }
              }
            } else {
              // For personal mode, explicitly use account name
              displayName = acc.account_name || '';
              handle = acc.account_name || '';
            }
          }

          return {
            id: acc.id,
            brand_id: acc.brand_id,
            platform: normalizedPlatform,
            handle,
            display_name: displayName,
            avatar_url: (platformSpecific?.avatar_url as string) || undefined,
            follower_count: (platformSpecific?.follower_count as number) || 0,
            is_connected: true,
            last_sync: (platformSpecific?.last_sync as string) || undefined,
            getlate_account_id: acc.getlate_account_id || undefined,
          };
        });

        setAccounts(accountsData);
      }

      // Only sync from Getlate if explicitly requested (e.g., after OAuth connection)
      // This prevents automatic polling/interval fetching
      const currentBrand = selectedBrandId ? brands.find(b => b.id === selectedBrandId) : null;
      if (forceSync && !skipSync && currentBrand?.getlate_profile_id) {
        // Don't await - let it run in background
        fetch(`/api/getlate/accounts?brandId=${selectedBrandId}`)
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
    } catch {
      setAccounts([]);
    }
  }, [selectedBrandId, brands]);

  const syncNow = useCallback(async (silent = false) => {
    if (!selectedBrandId || !selectedBrand?.getlate_profile_id) {
      if (!silent) {
        showToast(
          t('sync_error_no_brand') || 'No brand selected or brand not linked to Getlate profile',
          'error',
        );
      }
      return;
    }

    try {
      const response = await fetch(`/api/getlate/accounts?brandId=${selectedBrandId}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to sync accounts');
      }

      // Small delay to ensure database write is complete
      await new Promise(resolve => setTimeout(resolve, 500));

      // Reload accounts from DB to show updated follower counts
      await loadAccountsFromDB(true, false);

      if (!silent) {
        showToast(
          t('sync_success_description') || 'Accounts synced successfully. Follower counts updated.',
          'success',
        );
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to sync accounts';
      console.error('[Connections] Sync error:', errorMessage);
      // Only show error toast if not silent (silent mode for background sync)
      if (!silent) {
        showToast(errorMessage, 'error');
      }
    }
  }, [selectedBrandId, selectedBrand, loadAccountsFromDB, showToast, t]);

  useEffect(() => {
    // Load brands on mount - using setTimeout to avoid cascading renders warning
    const timeoutId = setTimeout(() => {
      void loadBrands();
    }, 0);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [loadBrands]);

  // Track last synced brand to avoid redundant syncs
  const lastSyncedBrandId = useRef<string | null>(null);

  useEffect(() => {
    // Load accounts when selected brand changes - only when brand actually changes
    if (selectedBrandId) {
      // Load accounts from DB first (immediate, shows existing data)
      void loadAccountsFromDB(false, false);

      // If brand has Getlate profile and hasn't been synced yet, sync in background
      const currentBrand = brands.find(b => b.id === selectedBrandId);
      if (currentBrand?.getlate_profile_id && lastSyncedBrandId.current !== selectedBrandId) {
        lastSyncedBrandId.current = selectedBrandId;
        // Trigger sync in background (silent mode - no toast notifications)
        void syncNow(true);
      }
    } else {
      // Clear accounts when no brand is selected
      setAccounts([]);
      lastSyncedBrandId.current = null; // Reset when brand is cleared
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBrandId, brands]); // Depend on brand ID and brands array

  // Handle headless mode OAuth callback
  useEffect(() => {
    const headless = searchParams.get('headless');
    const step = searchParams.get('step');
    const platform = searchParams.get('platform');
    const profileId = searchParams.get('profileId');
    const tempToken = searchParams.get('tempToken');
    const userProfile = searchParams.get('userProfile');
    const connectToken = searchParams.get('connect_token');
    const organizations = searchParams.get('organizations');
    const brandId = searchParams.get('brandId');

    // Check if this is a headless mode callback
    if (headless === 'true' && step && platform && profileId && tempToken && userProfile && connectToken) {
      // Clean up URL immediately
      window.history.replaceState({}, '', window.location.pathname);

      // Set headless mode data to trigger selection dialog
      setHeadlessModeData({
        step,
        platform,
        profileId,
        tempToken,
        userProfile,
        connectToken,
        organizations: organizations || undefined,
        brandId: brandId || undefined,
      });

      // If brandId is in URL, sync it to context
      if (brandId && brands.length > 0) {
        const brandToSelect = brands.find(b => b.id === brandId);
        if (brandToSelect && selectedBrandId !== brandId) {
          setSelectedBrandId(brandId);
        }
      }

      // For Facebook, fetch pages immediately
      if (platform === 'facebook' && step === 'select_page') {
        setIsLoadingHeadlessPages(true);
        fetch(`/api/getlate/facebook/select-page?profileId=${encodeURIComponent(profileId)}&tempToken=${encodeURIComponent(tempToken)}`, {
          headers: {
            'X-Connect-Token': connectToken,
          },
        })
          .then(async (response) => {
            if (response.ok) {
              const data = await response.json();
              setHeadlessFacebookPages(data.pages || []);
            } else {
              const error = await response.json().catch(() => ({ error: 'Failed to fetch pages' }));
              showToast(error.error || 'Failed to fetch Facebook pages', 'error');
              setHeadlessModeData(null);
            }
          })
          .catch((error) => {
            console.error('Error fetching Facebook pages:', error);
            showToast('Failed to fetch Facebook pages', 'error');
            setHeadlessModeData(null);
          })
          .finally(() => {
            setIsLoadingHeadlessPages(false);
          });
      }

      // For LinkedIn, parse organizations from URL-encoded JSON
      if (platform === 'linkedin' && step === 'select_organization' && organizations) {
        try {
          const decodedOrgs = JSON.parse(decodeURIComponent(organizations));
          if (Array.isArray(decodedOrgs) && decodedOrgs.length > 0) {
            setLinkedinOrganizations(decodedOrgs.map((org: any) => ({
              id: org.id || org._id,
              name: org.name || org.organizationName,
              urn: org.urn || org.organizationUrn,
            })));
          }
        } catch (error) {
          console.error('Error parsing LinkedIn organizations:', error);
        }
      }
    }
  }, [searchParams, brands, selectedBrandId, setSelectedBrandId, showToast]);

  // Handle OAuth callback - check for success, cancellation, or error messages
  // Use a ref to track processed callbacks and prevent duplicate toasts
  const processedCallbackRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const cancelled = searchParams.get('cancelled');
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');
    const headless = searchParams.get('headless'); // Skip standard mode if headless mode is active

    // Only process if there's a callback parameter and it's not headless mode
    if ((!cancelled && !connected && !error) || headless === 'true') {
      return undefined;
    }

    // Only process if there's a callback parameter
    if (!cancelled && !connected && !error) {
      return undefined;
    }

    // Build a unique key for this callback using the full search params BEFORE cleaning URL
    const callbackKey = searchParams.toString();

    // Check if we've already processed this exact callback
    if (processedCallbackRef.current.has(callbackKey)) {
      // URL might still have params, clean it up
      if (cancelled || connected || error) {
        window.history.replaceState({}, '', window.location.pathname);
      }
      return undefined;
    }

    // Mark as processed immediately to prevent duplicate processing
    processedCallbackRef.current.add(callbackKey);

    // Clean up URL immediately to prevent duplicate processing
    window.history.replaceState({}, '', window.location.pathname);

    if (cancelled === 'true') {
      showToast(t('connection_cancelled'), 'info');
      // Reset ref after a delay to allow for new callbacks
      const cancelTimeout = setTimeout(() => {
        processedCallbackRef.current.delete(callbackKey);
      }, 2000);
      return () => {
        clearTimeout(cancelTimeout);
      };
    } else if (connected) {
      // connected might be 'true' or the platform name (e.g., 'facebook')
      // Both indicate success
      showToast(t('connection_success'), 'success');

      // Check if sync completed successfully (get from original params before cleanup)
      const synced = searchParams.get('synced') === 'true';

      // Reset ref after a delay to allow for new callbacks
      const successTimeout = setTimeout(() => {
        processedCallbackRef.current.delete(callbackKey);
      }, 2000);

      // Reload accounts immediately after successful connection
      // The callback route already synced accounts, so we need to reload from DB
      const brandIdFromUrl = searchParams.get('brandId');

      // If brandId is in URL, sync it to context
      if (brandIdFromUrl && brands.length > 0) {
        const brandToSelect = brands.find(b => b.id === brandIdFromUrl);
        if (brandToSelect && selectedBrandId !== brandIdFromUrl) {
          setSelectedBrandId(brandIdFromUrl);
        }
      }

      // Wait a bit for database commit, then reload accounts
      // Use a longer delay to ensure sync completed on server
      const reloadTimeout = setTimeout(async () => {
        const currentBrandId = brandIdFromUrl || selectedBrandId;

        if (currentBrandId) {
          // Clear accounts first to force a fresh load
          setAccounts([]);

          // Wait a bit more to ensure database is fully updated
          await new Promise(resolve => setTimeout(resolve, 500));

          // Reload from DB - sync already completed on server side
          await loadAccountsFromDB(true, false); // skipSync=true to avoid double sync, forceSync=false

          // Sync follower counts to ensure latest data and reload accounts
          const currentBrand = brands.find(b => b.id === currentBrandId);
          if (currentBrand?.getlate_profile_id) {
            // Wait a bit before syncing to ensure DB is ready
            await new Promise(resolve => setTimeout(resolve, 500));
            await syncNow(true);
          }
        }
      }, 1500); // Wait 1.5 seconds for DB commit

      // If sync failed on server, retry sync once
      let retryTimeout: NodeJS.Timeout | undefined;
      if (!synced) {
        retryTimeout = setTimeout(async () => {
          const currentBrandId = brandIdFromUrl || selectedBrandId;

          if (currentBrandId) {
            // Clear accounts to force refresh
            setAccounts([]);

            // Wait a bit before retry
            await new Promise(resolve => setTimeout(resolve, 500));

            // Retry sync from Getlate
            await loadAccountsFromDB(false, true); // skipSync=false, forceSync=true to force sync

            // Also sync follower counts after retry and reload accounts
            const currentBrand = brands.find(b => b.id === currentBrandId);
            if (currentBrand?.getlate_profile_id) {
              await new Promise(resolve => setTimeout(resolve, 500));
              await syncNow(true);
            }
          }
        }, 2000);
      }

      return () => {
        clearTimeout(successTimeout);
        clearTimeout(reloadTimeout);
        if (retryTimeout) {
          clearTimeout(retryTimeout);
        }
      };
    } else if (error) {
      showToast(t('connection_error'), 'error');
      // Reset ref after a delay to allow for new callbacks
      const errorTimeout = setTimeout(() => {
        processedCallbackRef.current.delete(callbackKey);
      }, 2000);
      // Reload accounts even on error to ensure UI is up to date
      if (selectedBrandId) {
        void loadAccountsFromDB(false, false);
      }
      return () => {
        clearTimeout(errorTimeout);
      };
    }

    return undefined;
  }, [searchParams, selectedBrandId, brands, loadAccountsFromDB, showToast, t, setSelectedBrandId]);

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
            throw new Error(t('logo_upload_invalid_file'));
          }

          // Validate file size (5MB limit)
          const maxSize = 5 * 1024 * 1024; // 5MB
          if (brandLogoFile.size > maxSize) {
            throw new Error(t('logo_upload_size_error'));
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
            throw new Error(t('logo_upload_failed', { error: uploadError.message }));
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
        const error = await brandResponse.json().catch(() => ({ error: t('brand_creation_error') }));
        console.error('Error creating brand:', error);
        showToast(error.error || t('brand_creation_error'), 'error');
        return;
      }

      const { brand: newBrandData } = await brandResponse.json();

      const newBrand: Brand = {
        id: newBrandData.id,
        name: newBrandData.name,
        logo_url: newBrandData.logo_url || undefined,
      };

      setBrands(prev => [...prev, newBrand]);
      setSelectedBrandId(newBrand.id);
      setNewBrandName('');
      setBrandLogoFile(null);
      setIsCreatingBrand(false);
      showToast(t('brand_created_success'), 'success');
      // Reload brands to ensure consistency
      await loadBrands();
    } catch (error) {
      console.error('Error creating brand:', error);
      const errorMessage = error instanceof Error ? error.message : t('brand_creation_error');
      showToast(errorMessage, 'error');
      // Error will be handled by reloading brands - if creation failed, it won't appear
    }
  };

  const handleOAuthConnect = async (platform: Platform) => {
    if (!selectedBrandId || !selectedBrand) {
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
        .eq('id', selectedBrandId)
        .eq('user_id', userId)
        .maybeSingle();

      // If the error is about the column not existing, try again without getlate_profile_id
      if (brandError && brandError.message && brandError.message.includes('does not exist')) {
        // Column doesn't exist yet - select without it
        const { data: brandDataWithoutGetlate, error: brandErrorWithoutGetlate } = await supabase
          .from('brands')
          .select('id, name, user_id')
          .eq('id', selectedBrandId)
          .eq('user_id', userId)
          .maybeSingle();

        if (brandErrorWithoutGetlate && (brandErrorWithoutGetlate.message || brandErrorWithoutGetlate.code)) {
          console.error('Error fetching brand:', brandErrorWithoutGetlate.message || brandErrorWithoutGetlate.code);
          setIsConnectingOAuth(null);
          return;
        }

        if (!brandDataWithoutGetlate) {
          console.error('Brand not found or does not belong to current user', {
            brandId: selectedBrandId,
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
          brandId: selectedBrandId,
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
            name: brandData.name || selectedBrand?.name || '',
            brandId: selectedBrandId,
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
            .eq('id', selectedBrandId)
            .maybeSingle(); // Use maybeSingle to avoid throwing if not found

          if (!reloadError && updatedBrand?.getlate_profile_id) {
            profileIdToUse = updatedBrand.getlate_profile_id;
          }
        }

        if (!profileIdToUse) {
          console.error('Failed to get Getlate profile ID after creation', {
            responseData,
            brandId: selectedBrandId,
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
          brandId: selectedBrandId,
          redirectUrl: `${window.location.origin}/api/getlate/callback?brandId=${selectedBrandId}`,
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

  const handleDisconnect = async () => {
    if (!accountToDisconnect) {
      return;
    }

    // Store account info before closing modal
    const accountIdToDisconnect = accountToDisconnect.id;

    try {
      const supabase = createSupabaseBrowserClient();

      // Get current user to ensure we only disconnect user's own accounts
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        showToast(t('connection_error'), 'error');
        setAccountToDisconnect(null);
        return;
      }

      // Get user ID from users table
      const { data: userRecord } = await supabase
        .from('users')
        .select('id')
        .eq('email', session.user.email)
        .maybeSingle();

      const userId = userRecord?.id || session.user.id;

      // Get Getlate account ID if available
      // First, fetch the account with getlate_account_id to ensure we have it
      const { data: accountWithGetlate } = await supabase
        .from('social_accounts')
        .select('id, getlate_account_id, platform, account_name')
        .eq('id', accountIdToDisconnect)
        .eq('user_id', userId)
        .single();

      const getlateAccountId = accountWithGetlate?.getlate_account_id;

      // First, disconnect from Getlate if account is linked
      if (getlateAccountId) {
        try {
          const disconnectResponse = await fetch('/api/getlate/disconnect', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              accountId: accountIdToDisconnect,
              getlateAccountId,
            }),
          });

          const disconnectResult = await disconnectResponse.json();

          if (!disconnectResponse.ok) {
            console.error('[Disconnect] ❌ Failed to disconnect from Getlate:', disconnectResult);
            const errorMsg = disconnectResult.error || t('unknown_error');
            showToast(
              t('disconnect_getlate_failed', { error: errorMsg }),
              'error',
            );
            setAccountToDisconnect(null); // Close modal on error
            // Continue with local disconnect even if Getlate disconnect fails
          } else if (disconnectResult.warning) {
            console.warn('[Disconnect] ⚠️ Getlate disconnect warning:', disconnectResult.warning);
            showToast(t('disconnect_getlate_warning'), 'info');
          }
        } catch (getlateError) {
          console.error('[Disconnect] ❌ Error calling Getlate disconnect API:', getlateError);
          showToast(
            t('disconnect_getlate_error'),
            'error',
          );
          setAccountToDisconnect(null); // Close modal on error
          // Continue with local disconnect even if Getlate API call fails
        }
      }

      // Get current platform data before updating
      const { data: currentAccount } = await supabase
        .from('social_accounts')
        .select('platform_specific_data')
        .eq('id', accountIdToDisconnect)
        .eq('user_id', userId)
        .single();

      // Deactivate account instead of deleting (soft delete)
      // Also set a flag to prevent Getlate sync from reactivating it
      // Filter by both id and user_id to ensure user can only disconnect their own accounts
      const currentPlatformData = (currentAccount?.platform_specific_data as Record<string, unknown>) || {};
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
        .eq('id', accountIdToDisconnect)
        .eq('user_id', userId);

      if (error) {
        console.error('Error disconnecting account:', error);
        showToast(t('connection_error'), 'error');
        setAccountToDisconnect(null); // Close modal on error
        return;
      }

      setAccountToDisconnect(null);
      showToast(t('account_disconnected_success'), 'success');

      // Reload accounts with skipSync=true to prevent Getlate sync from reactivating it
      await loadAccountsFromDB(true, false);

      // Sync follower counts for remaining accounts and reload
      if (selectedBrand?.getlate_profile_id) {
        await syncNow(true);
      }
    } catch (error) {
      console.error('Error disconnecting account:', error);
      showToast(t('connection_error'), 'error');
      setAccountToDisconnect(null); // Close modal on error
    }
  };

  const handleOpenFacebookPages = async (account: SocialAccount) => {
    if (!account.getlate_account_id) {
      showToast(t('account_not_linked') || 'Account not linked to Getlate', 'error');
      return;
    }

    setFacebookAccountForPages(account);
    setSelectedFacebookPageId(null);
    setIsLoadingFacebookPages(true);

    try {
      // Fetch current account data to get platform_specific_data
      const supabase = createSupabaseBrowserClient();
      const { data: accountData } = await supabase
        .from('social_accounts')
        .select('platform_specific_data')
        .eq('id', account.id)
        .maybeSingle();

      const response = await fetch(`/api/getlate/facebook-pages?accountId=${encodeURIComponent(account.getlate_account_id)}`);
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to fetch pages' }));
        throw new Error(error.error || 'Failed to fetch pages');
      }

      const data = await response.json();
      setFacebookPages(data.pages || []);

      // Pre-select current page if available
      const platformData = accountData?.platform_specific_data as Record<string, unknown> | null;
      const currentPageId = (platformData?.facebookPage as Record<string, unknown> | undefined)?.id as string | undefined;
      if (currentPageId && data.pages && data.pages.length > 0) {
        // Find matching page by ID (check both id and pageId fields)
        const matchingPage = data.pages.find(
          (p: any) => p.id === currentPageId || p.pageId === currentPageId,
        );
        if (matchingPage) {
          setSelectedFacebookPageId(matchingPage.pageId || matchingPage.id);
        }
      }
    } catch (error) {
      console.error('Error fetching Facebook pages:', error);
      showToast(
        error instanceof Error ? error.message : (t('fetch_pages_error') || 'Failed to fetch pages'),
        'error',
      );
      setFacebookAccountForPages(null);
    } finally {
      setIsLoadingFacebookPages(false);
    }
  };

  const handleSaveFacebookPage = async () => {
    if (!facebookAccountForPages || !selectedFacebookPageId) {
      return;
    }

    setIsSavingFacebookPage(true);
    try {
      const selectedPage = facebookPages.find(
        p => p.id === selectedFacebookPageId || p.pageId === selectedFacebookPageId,
      );
      if (!selectedPage) {
        throw new Error(t('facebook_page_not_found') || 'Selected page not found');
      }

      // Use pageId if available, otherwise fall back to id
      const pageIdToSave = selectedPage.pageId || selectedPage.id;

      const response = await fetch('/api/getlate/facebook-pages', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId: facebookAccountForPages.getlate_account_id,
          pageId: pageIdToSave,
          pageName: selectedPage.name,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to save page selection' }));
        throw new Error(error.error || 'Failed to save page selection');
      }

      showToast(t('facebook_page_updated') || 'Facebook page updated successfully', 'success');
      setFacebookAccountForPages(null);
      setSelectedFacebookPageId(null);
      setFacebookPages([]);
      // Small delay to ensure database write is complete, then sync accounts from Getlate to get updated followers count
      await new Promise(resolve => setTimeout(resolve, 500));
      await loadAccountsFromDB(false, true); // Force sync to get updated followers count

      // Also sync follower counts to ensure latest data and reload accounts
      if (selectedBrand?.getlate_profile_id) {
        await syncNow(true);
      }
    } catch (error) {
      console.error('Error saving Facebook page:', error);
      showToast(
        error instanceof Error ? error.message : (t('save_page_error') || 'Failed to save page selection'),
        'error',
      );
    } finally {
      setIsSavingFacebookPage(false);
    }
  };

  const handleOpenLinkedInOrganizations = async (account: SocialAccount) => {
    if (!account.getlate_account_id) {
      showToast(t('account_not_linked') || 'Account not linked to Getlate', 'error');
      return;
    }

    setLinkedinAccountForOrgs(account);
    setSelectedLinkedInOrgId(null);
    setIsLoadingLinkedInOrgs(true);

    try {
      // Fetch current account data to get platform_specific_data and account_name
      let accountData = null;
      let accountName = null;
      try {
        const supabase = createSupabaseBrowserClient();
        const { data, error: accountError } = await supabase
          .from('social_accounts')
          .select('platform_specific_data, account_name')
          .eq('id', account.id)
          .maybeSingle();

        if (accountError) {
          console.error('[Connections] Error fetching account data:', accountError);
          // Continue anyway - we can still fetch organizations
        } else {
          accountData = data;
          accountName = data?.account_name || null;
          setLinkedinAccountName(accountName);
        }
      } catch (supabaseError) {
        console.error('[Connections] Failed to create Supabase client or fetch account data:', supabaseError);
        // Continue anyway - we can still fetch organizations
      }

      const response = await fetch(`/api/getlate/linkedin-organizations?accountId=${encodeURIComponent(account.getlate_account_id)}`);
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to fetch organizations' }));
        throw new Error(error.error || 'Failed to fetch organizations');
      }

      const data = await response.json();
      setLinkedinOrganizations(data.organizations || []);

      // Load current posting config and organization selection from platform_specific_data
      const platformData = accountData?.platform_specific_data as Record<string, unknown> | null;
      const linkedinOrg = platformData?.linkedinOrganization as Record<string, unknown> | undefined;
      const currentOrgId = linkedinOrg?.id as string | undefined;

      // Load posting config
      const currentPostingType = (platformData?.linkedinPostingType as string) || 'personal';
      const isOrganizationMode = currentPostingType === 'organization';
      const currentConfig: LinkedInPostingConfig = {
        postingType: isOrganizationMode ? 'organization' : 'personal',
        pageType: platformData?.linkedinPageType as 'company' | 'showcase' | undefined,
        // Only load organization data if posting type is organization
        organizationUrl: isOrganizationMode ? (platformData?.linkedinOrganizationUrl as string | undefined) : undefined,
        organizationUrn: isOrganizationMode ? (platformData?.linkedinOrganizationUrn as string | undefined) : undefined,
        organizationName: isOrganizationMode ? (linkedinOrg?.name as string | undefined) : undefined,
      };
      setLinkedInPostingConfig(currentConfig);

      // Pre-select current organization if available
      if (currentOrgId && data.organizations && data.organizations.length > 0) {
        // Find matching organization by ID
        const matchingOrg = data.organizations.find((o: any) => o.id === currentOrgId);
        if (matchingOrg) {
          setSelectedLinkedInOrgId(matchingOrg.id);
        }
      }
    } catch (error) {
      console.error('Error fetching LinkedIn organizations:', error);
      showToast(
        error instanceof Error ? error.message : (t('fetch_orgs_error') || 'Failed to fetch organizations'),
        'error',
      );
      setLinkedinAccountForOrgs(null);
    } finally {
      setIsLoadingLinkedInOrgs(false);
    }
  };

  const handleSaveHeadlessFacebookPage = async () => {
    if (!headlessModeData || !selectedHeadlessFacebookPageId) {
      return;
    }

    setIsSavingHeadlessSelection(true);
    try {
      let userProfileObj: any;
      try {
        userProfileObj = JSON.parse(decodeURIComponent(headlessModeData.userProfile));
      } catch {
        userProfileObj = {};
      }

      const response = await fetch('/api/getlate/facebook/select-page', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Connect-Token': headlessModeData.connectToken,
        },
        body: JSON.stringify({
          profileId: headlessModeData.profileId,
          pageId: selectedHeadlessFacebookPageId,
          tempToken: headlessModeData.tempToken,
          userProfile: userProfileObj,
          redirectUrl: `${window.location.origin}/connections`,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to save page selection' }));
        throw new Error(error.error || 'Failed to save page selection');
      }

      showToast(t('connection_success'), 'success');
      setHeadlessModeData(null);
      setSelectedHeadlessFacebookPageId(null);
      setHeadlessFacebookPages([]);

      // Reload accounts after a delay
      setTimeout(async () => {
        const brandId = headlessModeData.brandId || selectedBrandId;
        if (brandId) {
          await loadAccountsFromDB(false, true);

          // Sync follower counts and reload accounts
          const currentBrand = brands.find(b => b.id === brandId);
          if (currentBrand?.getlate_profile_id) {
            await syncNow(true);
          }
        }
      }, 1000);
    } catch (error) {
      console.error('Error saving Facebook page:', error);
      showToast(
        error instanceof Error ? error.message : 'Failed to save page selection',
        'error',
      );
    } finally {
      setIsSavingHeadlessSelection(false);
    }
  };

  const handleSaveHeadlessLinkedInOrganization = async (accountType: 'personal' | 'organization', selectedOrg?: { id: string; name: string; vanityName?: string }) => {
    if (!headlessModeData) {
      return;
    }

    setIsSavingHeadlessSelection(true);
    try {
      let userProfileObj: any;
      try {
        userProfileObj = JSON.parse(decodeURIComponent(headlessModeData.userProfile));
      } catch {
        userProfileObj = {};
      }

      const response = await fetch('/api/getlate/linkedin/select-organization', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Connect-Token': headlessModeData.connectToken,
        },
        body: JSON.stringify({
          profileId: headlessModeData.profileId,
          tempToken: headlessModeData.tempToken,
          userProfile: userProfileObj,
          accountType,
          selectedOrganization: selectedOrg,
          redirectUrl: `${window.location.origin}/connections`,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to save organization selection' }));
        throw new Error(error.error || 'Failed to save organization selection');
      }

      showToast(t('connection_success'), 'success');
      setHeadlessModeData(null);
      setLinkedinOrganizations([]);
      setSelectedLinkedInOrgId(null);

      // Reload accounts after a delay
      setTimeout(async () => {
        const brandId = headlessModeData.brandId || selectedBrandId;
        if (brandId) {
          await loadAccountsFromDB(false, true);

          // Sync follower counts and reload accounts
          const currentBrand = brands.find(b => b.id === brandId);
          if (currentBrand?.getlate_profile_id) {
            await syncNow(true);
          }
        }
      }, 1000);
    } catch (error) {
      console.error('Error saving LinkedIn organization:', error);
      showToast(
        error instanceof Error ? error.message : 'Failed to save organization selection',
        'error',
      );
    } finally {
      setIsSavingHeadlessSelection(false);
    }
  };

  const handleSaveLinkedInOrganization = async () => {
    if (!linkedinAccountForOrgs) {
      return;
    }

    // Validate organization posting config if posting as organization
    if (linkedInPostingConfig.postingType === 'organization') {
      if (!linkedInPostingConfig.organizationUrl || !linkedInPostingConfig.organizationUrl.trim()) {
        showToast(
          (tLinkedIn('missing_url') as string) || 'Please provide a LinkedIn organization URL or URN',
          'error',
        );
        return;
      }

      // Validate that URL contains numeric ID
      const urlOrUrn = linkedInPostingConfig.organizationUrl.trim();
      const hasNumericId = urlOrUrn.match(/\/company\/(\d+)/) || urlOrUrn.match(/urn:li:organization(?:Brand)?:(\d+)/);
      if (!hasNumericId) {
        showToast(
          (tLinkedIn('invalid_url_toast') as string)
          || 'LinkedIn organization URL must contain a numeric ID. Please check the URL format.',
          'error',
        );
        return;
      }

      // Validate that company name is provided
      if (!linkedInPostingConfig.organizationName || !linkedInPostingConfig.organizationName.trim()) {
        showToast(
          (tLinkedIn('missing_company_name') as string) || 'Please provide the company name',
          'error',
        );
        return;
      }
    }

    setIsSavingLinkedInOrg(true);
    try {
      const supabase = createSupabaseBrowserClient();

      // Track resolved organization references locally to avoid mutating state
      let organizationId: string | undefined;
      let organizationName: string | undefined;
      let organizationUrn: string | undefined;
      let organizationUrlValue = linkedInPostingConfig.organizationUrl?.trim();

      if (linkedInPostingConfig.postingType === 'organization') {
        // If an organization was selected from the list, use it (prioritize this)
        if (selectedLinkedInOrgId) {
          const selectedOrg = linkedinOrganizations.find(o => o.id === selectedLinkedInOrgId);
          if (selectedOrg) {
            organizationId = selectedOrg.id;
            organizationName = selectedOrg.name; // Use the name from the selected organization
            organizationUrn = selectedOrg.urn;
            if (!organizationUrlValue && selectedOrg.urn) {
              organizationUrlValue = selectedOrg.urn;
              setLinkedInPostingConfig(prev => ({
                ...prev,
                organizationUrl: prev.organizationUrl || selectedOrg.urn || '',
                organizationUrn: prev.organizationUrn || selectedOrg.urn,
                organizationName: prev.organizationName || selectedOrg.name || '',
              }));
            }
          }
        }

        // If no organization selected from list but URL is provided, use URL/URN
        if (!organizationId && organizationUrlValue) {
          organizationUrn = linkedInPostingConfig.organizationUrn;
          // Extract ID from URL or URN
          const urlMatch = organizationUrlValue.match(/\/company\/(\d+)/);
          const urnMatch = organizationUrlValue.match(/urn:li:organization(?:Brand)?:(\d+)/);
          organizationId = urlMatch?.[1] || urnMatch?.[1];
          // Use the manually entered company name
          organizationName = linkedInPostingConfig.organizationName?.trim();
          if (!organizationName) {
            // Fallback: use ID if name not provided (shouldn't happen due to validation)
            organizationName = organizationId || organizationUrlValue;
          }

          // If still no ID, try to extract from URN if available
          if (!organizationId && organizationUrn) {
            const urnIdMatch = organizationUrn.match(/urn:li:organization(?:Brand)?:(\d+)/);
            if (urnIdMatch) {
              organizationId = urnIdMatch[1];
            }
          }
        }

        // If we have organization info and getlate_account_id, update via API
        if (organizationId && linkedinAccountForOrgs.getlate_account_id) {
          const response = await fetch('/api/getlate/linkedin-organizations', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              accountId: linkedinAccountForOrgs.getlate_account_id,
              organizationId,
              organizationName: organizationName || linkedInPostingConfig.organizationName || organizationUrlValue || 'LinkedIn Organization',
              organizationUrn,
              sourceUrl: organizationUrlValue || organizationUrn,
            }),
          });

          if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Failed to save organization selection' }));
            throw new Error(error.error || 'Failed to save organization selection');
          }

          // Update organization name from API response if available
          const responseData = await response.json();
          if (responseData.organization?.name && responseData.organization.name !== organizationName) {
            organizationName = responseData.organization.name;
          }
        }
      } else {
        // If posting as personal, clear organization data and update Getlate API
        organizationId = undefined;
        organizationName = undefined;
        organizationUrn = undefined;

        // If switching to personal, update Getlate API with account name
        if (linkedinAccountForOrgs.getlate_account_id) {
          // Fetch account name from social_accounts table
          const { data: accountData } = await supabase
            .from('social_accounts')
            .select('account_name')
            .eq('id', linkedinAccountForOrgs.id)
            .maybeSingle();

          const accountName = accountData?.account_name;

          if (accountName) {
            const response = await fetch('/api/getlate/linkedin-organizations', {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                accountId: linkedinAccountForOrgs.getlate_account_id,
                accountType: 'personal',
                accountName,
              }),
            });

            if (!response.ok) {
              const error = await response.json().catch(() => ({ error: 'Failed to update to personal mode' }));
              throw new Error(error.error || 'Failed to update to personal mode');
            }
          }
        }
      }

      // Update platform_specific_data with posting config
      const { data: currentAccount } = await supabase
        .from('social_accounts')
        .select('platform_specific_data')
        .eq('id', linkedinAccountForOrgs.id)
        .maybeSingle();

      const platformData = (currentAccount?.platform_specific_data as Record<string, unknown>) || {};
      const updatedData: Record<string, unknown> = {
        ...platformData,
        linkedinPostingType: linkedInPostingConfig.postingType,
      };

      if (linkedInPostingConfig.postingType === 'organization' && organizationId) {
        updatedData.linkedinPageType = linkedInPostingConfig.pageType;
        updatedData.linkedinOrganizationUrl = organizationUrlValue;
        updatedData.linkedinOrganizationUrn = organizationUrn;
        updatedData.linkedinOrganization = {
          id: organizationId,
          name: organizationName || linkedInPostingConfig.organizationName || organizationId || organizationUrlValue || 'LinkedIn Organization',
          urn: organizationUrn,
          sourceUrl: organizationUrlValue || organizationUrn,
          updatedAt: new Date().toISOString(),
        };
      } else {
        // Clear organization-related data when posting as personal
        delete updatedData.linkedinPageType;
        delete updatedData.linkedinOrganizationUrl;
        delete updatedData.linkedinOrganizationUrn;
        delete updatedData.linkedinOrganization;
      }

      const { error: updateError } = await supabase
        .from('social_accounts')
        .update({ platform_specific_data: updatedData })
        .eq('id', linkedinAccountForOrgs.id);

      if (updateError) {
        throw new Error(updateError.message || 'Failed to save LinkedIn settings');
      }

      showToast(t('linkedin_settings_updated') as string || 'LinkedIn settings updated successfully', 'success');
      setLinkedinAccountForOrgs(null);
      setLinkedinAccountName(null);
      setSelectedLinkedInOrgId(null);
      setLinkedinOrganizations([]);
      setLinkedInPostingConfig({ postingType: 'personal' });
      // Small delay to ensure database write is complete, then sync accounts from Getlate to get updated followers count
      await new Promise(resolve => setTimeout(resolve, 500));
      await loadAccountsFromDB(false, true); // Force sync to get updated followers count

      // Also sync follower counts to ensure latest data and reload accounts
      if (selectedBrand?.getlate_profile_id) {
        await syncNow(true);
      }
    } catch (error) {
      console.error('Error saving LinkedIn settings:', error);
      showToast(
        error instanceof Error ? error.message : (t('save_org_error') || 'Failed to save LinkedIn settings'),
        'error',
      );
    } finally {
      setIsSavingLinkedInOrg(false);
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
        const errorData = await response.json().catch(() => ({ error: 'Failed to delete brand' }));
        console.error('Error deleting brand:', errorData);

        // Show user-friendly error message
        if (errorData.error === 'Cannot delete brand with connected accounts') {
          showToast(
            errorData.message || t('delete_brand_has_accounts'),
            'error',
          );
        } else {
          showToast(
            errorData.error || errorData.message || t('delete_brand_failed'),
            'error',
          );
        }

        setIsDeletingBrand(false);
        setBrandToDelete(null); // Close modal on error
        return;
      }

      // Remove brand from state
      setBrands(prev => prev.filter(b => b.id !== brandToDelete.id));

      // If deleted brand was selected, select another one or clear selection
      if (selectedBrandId === brandToDelete.id) {
        const remainingBrands = brands.filter(b => b.id !== brandToDelete.id);
        if (remainingBrands.length > 0 && remainingBrands[0]) {
          setSelectedBrandId(remainingBrands[0].id);
        } else {
          setSelectedBrandId(null);
        }
      }

      setBrandToDelete(null);
      // Reload brands to ensure consistency
      await loadBrands();
    } catch (error) {
      console.error('Error deleting brand:', error);
      showToast(t('delete_brand_failed'), 'error');
      setBrandToDelete(null); // Close modal on error
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
                              selectedBrandId === brand.id
                                ? 'border-pink-500 bg-pink-50'
                                : 'border-gray-200 bg-white/50 hover:border-pink-300'
                            }`}
                          >
                            <div
                              onClick={() => setSelectedBrandId(brand.id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  setSelectedBrandId(brand.id);
                                }
                              }}
                              role="button"
                              tabIndex={0}
                              className="cursor-pointer"
                            >
                              <div className={cn('flex items-center gap-3', isRTL ? 'flex-row' : '')}>
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
                                isRTL ? 'left-2' : 'right-2',
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
                <span className="text-pink-600">{selectedBrand?.name || ''}</span>
              </CardTitle>
              <CardDescription className={isRTL ? 'text-right' : 'text-left'}>
                {t('connect_accounts_description')}
              </CardDescription>
              <div className={cn('mt-2 flex items-start gap-2 rounded-md bg-blue-50 p-3', isRTL ? 'flex-row-reverse text-right' : 'text-left')}>
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                <p className="text-xs text-blue-800">
                  {t('follower_count_disclaimer')}
                </p>
              </div>
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
                      const brandMatch = acc.brand_id === selectedBrandId;

                      return platformMatch && brandMatch;
                    },
                  );

                  return (
                    <div
                      key={platform}
                      className="rounded-xl border border-gray-200 bg-white/50 p-4 shadow-sm transition-shadow hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pink-50">
                            <Icon className={`h-6 w-6 ${config.color}`} />
                          </div>
                          <div className={cn('flex-1 min-w-0', isRTL ? 'text-right' : 'text-left')}>
                            <h3 className="truncate font-semibold text-slate-800">{config.name}</h3>
                            {connectedAccount
                              ? (
                                  <>
                                    <p className="truncate text-sm font-medium text-slate-700">
                                      {connectedAccount.handle}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                      {connectedAccount.follower_count?.toLocaleString()}
                                      {' '}
                                      {t('followers')}
                                    </p>
                                  </>
                                )
                              : (
                                  <p className="text-sm text-slate-500">{t('not_connected')}</p>
                                )}
                          </div>
                        </div>
                        <div className={cn('flex flex-col gap-2 shrink-0', isRTL ? 'items-start' : 'items-end')}>
                          {connectedAccount
                            ? (
                                <>
                                  {/* Facebook: Show "Change Pages" button */}
                                  {platform === 'facebook' && connectedAccount.getlate_account_id && (
                                    <Button
                                      onClick={() => handleOpenFacebookPages(connectedAccount)}
                                      variant="outline"
                                      size="sm"
                                      className="w-full border-gray-300 bg-white text-xs text-gray-700 hover:bg-gray-50"
                                    >
                                      <Settings className={cn('h-3.5 w-3.5', isRTL ? 'ml-1.5' : 'mr-1.5')} />
                                      {t('change_pages') || 'Change Pages'}
                                    </Button>
                                  )}
                                  {/* LinkedIn: Show "Manage Settings" button */}
                                  {platform === 'linkedin' && connectedAccount.getlate_account_id && (
                                    <Button
                                      onClick={() => handleOpenLinkedInOrganizations(connectedAccount)}
                                      variant="outline"
                                      size="sm"
                                      className="w-full border-gray-300 bg-white text-xs text-gray-700 hover:bg-gray-50"
                                    >
                                      <Settings className={cn('h-3.5 w-3.5', isRTL ? 'ml-1.5' : 'mr-1.5')} />
                                      {(t('manage_linkedin_settings') as string) || 'Manage Settings'}
                                    </Button>
                                  )}
                                  <Button
                                    onClick={() => setAccountToDisconnect(connectedAccount)}
                                    variant="secondary"
                                    size="sm"
                                    className="w-full text-xs"
                                  >
                                    {t('disconnect')}
                                  </Button>
                                </>
                              )
                            : (
                                <Button
                                  onClick={() => handleOAuthConnect(platform)}
                                  disabled={isConnectingOAuth === platform}
                                  size="sm"
                                  className="bg-gradient-to-r from-pink-500 to-pink-600 text-xs text-white hover:from-pink-600 hover:to-pink-700"
                                >
                                  {isConnectingOAuth === platform
                                    ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      )
                                    : (
                                        t('connect_oauth')
                                      )}
                                </Button>
                              )}
                        </div>
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
                        <Trash2 className={cn('h-4 w-4', isRTL ? 'mr-2' : 'mr-2')} />
                        {t('delete')}
                      </>
                    )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Disconnect Confirmation Dialog */}
        <Dialog
          open={!!accountToDisconnect}
          onOpenChange={() => setAccountToDisconnect(null)}
        >
          <DialogContent dir={isRTL ? 'rtl' : 'ltr'} className="sm:max-w-md">
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

        {/* Facebook Pages Selection Dialog */}
        <Dialog
          open={!!facebookAccountForPages}
          onOpenChange={open => !open && setFacebookAccountForPages(null)}
        >
          <DialogContent dir={isRTL ? 'rtl' : 'ltr'} className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t('select_facebook_page') || 'Select Facebook Page'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {isLoadingFacebookPages
                ? (
                    <div className="py-8 text-center">
                      <Loader2 className="mx-auto h-8 w-8 animate-spin text-pink-500" />
                      <p className="mt-2 text-sm text-gray-500">{t('loading') || 'Loading pages...'}</p>
                    </div>
                  )
                : facebookPages.length === 0
                  ? (
                      <p className="py-4 text-center text-sm text-gray-500">
                        {t('no_pages_available') || 'No pages available. Please reconnect your Facebook account.'}
                      </p>
                    )
                  : (
                      <div className="max-h-64 space-y-2 overflow-y-auto">
                        {facebookPages.map((page) => {
                          const pageIdentifier = page.pageId || page.id;
                          const isSelected = selectedFacebookPageId === page.id || selectedFacebookPageId === page.pageId;
                          return (
                            <button
                              key={pageIdentifier}
                              type="button"
                              onClick={() => setSelectedFacebookPageId(pageIdentifier)}
                              className={cn(
                                'w-full rounded-lg border-2 p-3 text-left transition-all',
                                isSelected
                                  ? 'border-pink-500 bg-pink-50'
                                  : 'border-gray-200 bg-white hover:border-pink-300',
                              )}
                            >
                              <p className="font-semibold text-gray-800">{page.name}</p>
                            </button>
                          );
                        })}
                      </div>
                    )}
            </div>
            <DialogFooter className={cn('gap-2', isRTL ? 'flex-row-reverse' : '')}>
              <Button
                variant="outline"
                onClick={() => setFacebookAccountForPages(null)}
                disabled={isSavingFacebookPage}
                className="border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              >
                {t('cancel')}
              </Button>
              <Button
                onClick={handleSaveFacebookPage}
                disabled={!selectedFacebookPageId || isSavingFacebookPage}
                className="bg-pink-600 text-white hover:bg-pink-700"
              >
                {isSavingFacebookPage
                  ? (
                      <>
                        <Loader2 className={cn('h-4 w-4 animate-spin', isRTL ? 'ml-2' : 'mr-2')} />
                        {t('saving') || 'Saving...'}
                      </>
                    )
                  : (
                      t('save') || 'Save'
                    )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* LinkedIn Posting Settings Dialog */}
        <Dialog
          open={!!linkedinAccountForOrgs}
          onOpenChange={(open) => {
            if (!open) {
              setLinkedinAccountForOrgs(null);
              setLinkedinAccountName(null);
              setLinkedInPostingConfig({ postingType: 'personal' });
              setSelectedLinkedInOrgId(null);
            }
          }}
        >
          <DialogContent dir={isRTL ? 'rtl' : 'ltr'} className="max-h-[90vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{(t('manage_linkedin_settings') as string) || 'Manage LinkedIn Account'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {isLoadingLinkedInOrgs
                ? (
                    <div className="py-8 text-center">
                      <Loader2 className="mx-auto h-8 w-8 animate-spin text-pink-500" />
                      <p className="mt-2 text-sm text-gray-500">{t('loading') || 'Loading...'}</p>
                    </div>
                  )
                : (
                    <div className="space-y-4">
                      {/* Posting Type Selection */}
                      <div className="space-y-3">
                        <Label className="text-sm font-medium text-gray-900">
                          {(tLinkedIn('choose_posting_type') as string) || 'Choose how you want to post'}
                        </Label>

                        {/* Personal Option */}
                        <label
                          htmlFor="linkedin-posting-type-personal"
                          className={cn(
                            'flex cursor-pointer items-start gap-3 rounded-lg border-2 p-4 transition-all',
                            linkedInPostingConfig.postingType === 'personal'
                              ? 'border-pink-500 bg-pink-50'
                              : 'border-gray-200 hover:border-pink-200 hover:bg-gray-50',
                          )}
                        >
                          <input
                            id="linkedin-posting-type-personal"
                            type="radio"
                            name="linkedin-posting-type"
                            value="personal"
                            checked={linkedInPostingConfig.postingType === 'personal'}
                            onChange={() => setLinkedInPostingConfig({
                              postingType: 'personal',
                              organizationName: undefined, // Clear company name when switching to personal
                              organizationUrl: undefined,
                              organizationUrn: undefined,
                            })}
                            aria-label={(tLinkedIn('post_as_yourself') as string) || 'Post as yourself'}
                            className="mt-1 h-4 w-4 cursor-pointer border-gray-300 text-pink-500 focus:ring-pink-500"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <User className="h-5 w-5 text-gray-600" />
                              <span className="font-medium text-gray-900">
                                {(tLinkedIn('post_as_yourself') as string) || 'Post as yourself'}
                              </span>
                            </div>
                            {linkedinAccountName && (
                              <p className="mt-1 text-sm text-gray-600">{linkedinAccountName}</p>
                            )}
                          </div>
                        </label>

                        {/* Organization Option */}
                        <label
                          htmlFor="linkedin-posting-type-organization"
                          className={cn(
                            'flex cursor-pointer items-start gap-3 rounded-lg border-2 p-4 transition-all',
                            linkedInPostingConfig.postingType === 'organization'
                              ? 'border-pink-500 bg-pink-50'
                              : 'border-gray-200 hover:border-pink-200 hover:bg-gray-50',
                          )}
                        >
                          <input
                            id="linkedin-posting-type-organization"
                            type="radio"
                            name="linkedin-posting-type"
                            value="organization"
                            checked={linkedInPostingConfig.postingType === 'organization'}
                            onChange={() => setLinkedInPostingConfig({ postingType: 'organization' })}
                            aria-label={(tLinkedIn('post_as_organization') as string) || 'Post as Organization (Company or Showcase)'}
                            className="mt-1 h-4 w-4 cursor-pointer border-gray-300 text-pink-500 focus:ring-pink-500"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-5 w-5 text-gray-600" />
                              <span className="font-medium text-gray-900">
                                {(tLinkedIn('post_as_organization') as string) || 'Post as Organization (Company or Showcase)'}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-gray-500">
                              {(tLinkedIn('requires_admin_access') as string) || 'Requires organization admin access'}
                            </p>
                          </div>
                        </label>
                      </div>

                      {/* Organization Details */}
                      {linkedInPostingConfig.postingType === 'organization' && (
                        <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                          {/* Page Type Selector */}
                          <div className="space-y-2">
                            <Label htmlFor="linkedin-page-type" className="text-sm font-medium text-gray-900">
                              {(tLinkedIn('page_type') as string) || 'Page type:'}
                            </Label>
                            <Select
                              value={linkedInPostingConfig.pageType || 'company'}
                              onValueChange={value =>
                                setLinkedInPostingConfig({ ...linkedInPostingConfig, pageType: value as LinkedInPageType })}
                            >
                              <SelectTrigger id="linkedin-page-type" dir={isRTL ? 'rtl' : 'ltr'}>
                                <SelectValue
                                  selectedLabel={
                                    linkedInPostingConfig.pageType === 'showcase'
                                      ? (tLinkedIn('showcase_page') as string) || 'Showcase Page'
                                      : (tLinkedIn('company_page') as string) || 'Company Page'
                                  }
                                  placeholder={(tLinkedIn('select_page_type') as string) || 'Select page type'}
                                />
                              </SelectTrigger>
                              <SelectContent dir={isRTL ? 'rtl' : 'ltr'}>
                                <SelectItem value="company" dir={isRTL ? 'rtl' : 'ltr'}>
                                  {(tLinkedIn('company_page') as string) || 'Company Page'}
                                </SelectItem>
                                <SelectItem value="showcase" dir={isRTL ? 'rtl' : 'ltr'}>
                                  {(tLinkedIn('showcase_page') as string) || 'Showcase Page'}
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* URL/URN Input */}
                          <div className="space-y-2">
                            <Label htmlFor="linkedin-org-url" className="text-sm font-medium text-gray-900">
                              {(tLinkedIn('url_label') as string) || 'LinkedIn Page URL or URN (Numeric ID Required):'}
                            </Label>
                            <Input
                              id="linkedin-org-url"
                              type="text"
                              placeholder={(tLinkedIn('url_placeholder') as string) || 'https://www.linkedin.com/company/69179664'}
                              value={linkedInPostingConfig.organizationUrl || ''}
                              onChange={(e) => {
                                const url = e.target.value;
                                let urn: string | undefined;
                                if (url.startsWith('urn:li:organization:') || url.startsWith('urn:li:organizationBrand:')) {
                                  urn = url;
                                } else {
                                  const match = url.match(/\/company\/(\d+)/);
                                  if (match) {
                                    urn = `urn:li:organization:${match[1]}`;
                                  }
                                }
                                setLinkedInPostingConfig({
                                  ...linkedInPostingConfig,
                                  organizationUrl: url,
                                  organizationUrn: urn,
                                });
                              }}
                              className={cn(
                                'border-gray-300 focus:border-pink-500',
                                linkedInPostingConfig.organizationUrl && !linkedInPostingConfig.organizationUrl.match(/\/company\/(\d+)/) && !linkedInPostingConfig.organizationUrl.match(/urn:li:organization(?:Brand)?:(\d+)/)
                                  ? 'border-red-300 focus:border-red-500'
                                  : '',
                              )}
                              dir={isRTL ? 'rtl' : 'ltr'}
                            />
                            {linkedInPostingConfig.organizationUrl && !linkedInPostingConfig.organizationUrl.match(/\/company\/(\d+)/) && !linkedInPostingConfig.organizationUrl.match(/urn:li:organization(?:Brand)?:(\d+)/) && (
                              <p className="text-xs text-red-600">
                                {(tLinkedIn('invalid_url') as string) || 'Invalid URL format. Please provide a URL with numeric ID or a URN.'}
                              </p>
                            )}
                          </div>

                          {/* Company Name Input */}
                          <div className="space-y-2">
                            <Label htmlFor="linkedin-org-name" className="text-sm font-medium text-gray-900">
                              {(tLinkedIn('company_name_label') as string) || 'Company Name:'}
                              {' '}
                              <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              id="linkedin-org-name"
                              type="text"
                              placeholder={(tLinkedIn('company_name_placeholder') as string) || 'Enter company name'}
                              value={linkedInPostingConfig.organizationName || ''}
                              onChange={(e) => {
                                setLinkedInPostingConfig({
                                  ...linkedInPostingConfig,
                                  organizationName: e.target.value,
                                });
                              }}
                              className="border-gray-300 focus:border-pink-500"
                              dir={isRTL ? 'rtl' : 'ltr'}
                              required
                            />
                            <p className="text-xs text-gray-500">
                              {(tLinkedIn('company_name_hint') as string) || 'Enter the official name of the LinkedIn company page'}
                            </p>
                          </div>

                          {/* Help Text */}
                          <div className="rounded-md border border-blue-200 bg-blue-50 p-3">
                            <div className="flex gap-2">
                              <Info className="h-5 w-5 shrink-0 text-blue-600" />
                              <div className="space-y-2 text-xs text-blue-900">
                                <p className="font-medium">{(tLinkedIn('how_to_get_url') as string) || '📌 How to get the correct URL:'}</p>
                                <ol className="ml-4 list-decimal space-y-1">
                                  <li>{(tLinkedIn('step_1') as string) || 'Navigate to your LinkedIn Company or Showcase Page'}</li>
                                  <li>{(tLinkedIn('step_2') as string) || 'Open the admin area; copy a URL that contains the NUMERIC ID'}</li>
                                  <li>{(tLinkedIn('step_3') as string) || 'Or paste a full URN like urn:li:organization:123 or urn:li:organizationBrand:456'}</li>
                                </ol>
                                <div className="mt-2 space-y-1">
                                  <p className="font-medium">{(tLinkedIn('valid_examples') as string) || '✅ Valid:'}</p>
                                  <p className="font-mono text-xs">
                                    ✅
                                    {(tLinkedIn('valid_example_1') as string) || 'linkedin.com/company/107655573/'}
                                  </p>
                                  <p className="font-mono text-xs">
                                    ✅
                                    {(tLinkedIn('valid_example_2') as string) || 'urn:li:organizationBrand:123456'}
                                  </p>
                                  <p className="font-mono text-xs">
                                    ❌
                                    {(tLinkedIn('invalid_example') as string) || 'Invalid: vanity URLs like linkedin.com/company/company-name/'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
            </div>
            <DialogFooter className={cn('gap-2', isRTL ? 'flex-row-reverse' : '')}>
              <Button
                variant="outline"
                onClick={() => {
                  setLinkedinAccountForOrgs(null);
                  setLinkedInPostingConfig({ postingType: 'personal' });
                  setSelectedLinkedInOrgId(null);
                }}
                disabled={isSavingLinkedInOrg}
                className="border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              >
                {t('cancel')}
              </Button>
              <Button
                onClick={handleSaveLinkedInOrganization}
                disabled={isSavingLinkedInOrg}
                className="bg-pink-600 text-white hover:bg-pink-700"
              >
                {isSavingLinkedInOrg
                  ? (
                      <>
                        <Loader2 className={cn('h-4 w-4 animate-spin', isRTL ? 'ml-2' : 'mr-2')} />
                        {t('saving') || 'Saving...'}
                      </>
                    )
                  : (
                      t('save') || 'Save'
                    )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Headless Mode: Facebook Page Selection Dialog */}
        <Dialog
          open={headlessModeData?.platform === 'facebook' && headlessModeData?.step === 'select_page'}
          onOpenChange={(open) => {
            if (!open) {
              setHeadlessModeData(null);
              setSelectedHeadlessFacebookPageId(null);
              setHeadlessFacebookPages([]);
            }
          }}
        >
          <DialogContent dir={isRTL ? 'rtl' : 'ltr'} className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t('select_facebook_page') || 'Select Facebook Page'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {isLoadingHeadlessPages
                ? (
                    <div className="py-8 text-center">
                      <Loader2 className="mx-auto h-8 w-8 animate-spin text-pink-500" />
                      <p className="mt-2 text-sm text-gray-500">{t('loading') || 'Loading pages...'}</p>
                    </div>
                  )
                : headlessFacebookPages.length === 0
                  ? (
                      <p className="py-4 text-center text-sm text-gray-500">
                        {t('no_pages_available') || 'No pages available. Please reconnect your Facebook account.'}
                      </p>
                    )
                  : (
                      <div className="max-h-64 space-y-2 overflow-y-auto">
                        {headlessFacebookPages.map((page) => {
                          const pageIdentifier = page.pageId || page.id;
                          const isSelected = selectedHeadlessFacebookPageId === page.id || selectedHeadlessFacebookPageId === page.pageId;
                          return (
                            <button
                              key={pageIdentifier}
                              type="button"
                              onClick={() => setSelectedHeadlessFacebookPageId(pageIdentifier)}
                              className={cn(
                                'w-full rounded-lg border-2 p-3 text-left transition-all',
                                isSelected
                                  ? 'border-pink-500 bg-pink-50'
                                  : 'border-gray-200 bg-white hover:border-pink-300',
                              )}
                            >
                              <p className="font-semibold text-gray-800">{page.name}</p>
                            </button>
                          );
                        })}
                      </div>
                    )}
            </div>
            <DialogFooter className={cn('gap-2', isRTL ? 'flex-row-reverse' : '')}>
              <Button
                variant="outline"
                onClick={() => {
                  setHeadlessModeData(null);
                  setSelectedHeadlessFacebookPageId(null);
                  setHeadlessFacebookPages([]);
                }}
                disabled={isSavingHeadlessSelection}
                className="border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              >
                {t('cancel')}
              </Button>
              <Button
                onClick={handleSaveHeadlessFacebookPage}
                disabled={!selectedHeadlessFacebookPageId || isSavingHeadlessSelection}
                className="bg-pink-600 text-white hover:bg-pink-700"
              >
                {isSavingHeadlessSelection
                  ? (
                      <>
                        <Loader2 className={cn('h-4 w-4 animate-spin', isRTL ? 'ml-2' : 'mr-2')} />
                        {t('saving') || 'Saving...'}
                      </>
                    )
                  : (
                      t('save') || 'Save'
                    )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Headless Mode: LinkedIn Organization Selection Dialog */}
        <Dialog
          open={headlessModeData?.platform === 'linkedin' && headlessModeData?.step === 'select_organization'}
          onOpenChange={(open) => {
            if (!open) {
              setHeadlessModeData(null);
              setSelectedLinkedInOrgId(null);
              setLinkedinOrganizations([]);
            }
          }}
        >
          <DialogContent dir={isRTL ? 'rtl' : 'ltr'} className="max-w-md">
            <DialogHeader>
              <DialogTitle>{(t('select_linkedin_organization') as string) || 'Select LinkedIn Account'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {linkedinOrganizations.length === 0
                ? (
                    <div className="space-y-3">
                      <p className="text-sm text-gray-600">
                        {(t('linkedin_personal_only') as string) || 'You can post as your personal account. No organizations available.'}
                      </p>
                      <Button
                        onClick={() => handleSaveHeadlessLinkedInOrganization('personal')}
                        disabled={isSavingHeadlessSelection}
                        className="w-full bg-pink-600 text-white hover:bg-pink-700"
                      >
                        {isSavingHeadlessSelection
                          ? (
                              <>
                                <Loader2 className={cn('h-4 w-4 animate-spin', isRTL ? 'ml-2' : 'mr-2')} />
                                {t('saving') || 'Saving...'}
                              </>
                            )
                          : (
                              <>
                                <User className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
                                {(t('connect_as_personal') as string) || 'Connect as Personal Account'}
                              </>
                            )}
                      </Button>
                    </div>
                  )
                : (
                    <div className="space-y-3">
                      <p className="text-sm text-gray-600">
                        {(t('select_posting_account') as string) || 'Select how you want to post:'}
                      </p>
                      {/* Personal Option */}
                      <button
                        type="button"
                        onClick={() => handleSaveHeadlessLinkedInOrganization('personal')}
                        disabled={isSavingHeadlessSelection}
                        className={cn(
                          'w-full rounded-lg border-2 p-4 text-left transition-all',
                          'border-gray-200 bg-white hover:border-pink-300 hover:bg-gray-50',
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <User className="h-5 w-5 text-gray-600" />
                          <span className="font-medium text-gray-900">
                            {(t('post_as_personal') as string) || 'Post as Personal Account'}
                          </span>
                        </div>
                      </button>
                      {/* Organization Options */}
                      <div className="max-h-64 space-y-2 overflow-y-auto">
                        {linkedinOrganizations.map((org) => {
                          const isSelected = selectedLinkedInOrgId === org.id;
                          return (
                            <button
                              key={org.id}
                              type="button"
                              onClick={() => handleSaveHeadlessLinkedInOrganization('organization', {
                                id: org.id,
                                name: org.name,
                                vanityName: org.urn,
                              })}
                              disabled={isSavingHeadlessSelection}
                              className={cn(
                                'w-full rounded-lg border-2 p-3 text-left transition-all',
                                isSelected
                                  ? 'border-pink-500 bg-pink-50'
                                  : 'border-gray-200 bg-white hover:border-pink-300',
                              )}
                            >
                              <div className="flex items-center gap-2">
                                <Building2 className="h-5 w-5 text-gray-600" />
                                <div>
                                  <p className="font-semibold text-gray-800">{org.name}</p>
                                  {org.urn && (
                                    <p className="text-xs text-gray-500">{org.urn}</p>
                                  )}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
            </div>
            <DialogFooter className={cn('gap-2', isRTL ? 'flex-row-reverse' : '')}>
              <Button
                variant="outline"
                onClick={() => {
                  setHeadlessModeData(null);
                  setSelectedLinkedInOrgId(null);
                  setLinkedinOrganizations([]);
                }}
                disabled={isSavingHeadlessSelection}
                className="border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              >
                {t('cancel')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
