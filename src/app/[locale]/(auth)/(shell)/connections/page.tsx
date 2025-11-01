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
} from 'lucide-react';
import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
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
import { createSupabaseBrowserClient } from '@/libs/SupabaseBrowser';

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

const platformConfigs: Record<
  Platform,
  { name: string; icon: React.ComponentType<React.SVGProps<SVGSVGElement>>; color: string; description: string }
> = {
  instagram: {
    name: 'Instagram',
    icon: Instagram,
    color: 'text-pink-500',
    description: 'שתף תמונות וסטוריז',
  },
  facebook: {
    name: 'Facebook',
    icon: Facebook,
    color: 'text-blue-600',
    description: 'התחבר עם קהילות וקבוצות',
  },
  x: {
    name: 'X (Twitter)',
    icon: XIconComponent,
    color: 'text-gray-800',
    description: 'שתף מחשבות ועדכונים קצרים',
  },
  twitter: {
    name: 'X (Twitter)',
    icon: XIconComponent,
    color: 'text-gray-800',
    description: 'שתף מחשבות ועדכונים קצרים',
  },
  linkedin: {
    name: 'LinkedIn',
    icon: Linkedin,
    color: 'text-sky-700',
    description: 'התחבר עם אנשי מקצוע',
  },
  tiktok: {
    name: 'TikTok',
    icon: TikTokIcon,
    color: 'text-black',
    description: 'צור סרטונים ויראליים',
  },
  youtube: {
    name: 'YouTube',
    icon: Play,
    color: 'text-red-600',
    description: 'העלה סרטוני וידאו',
  },
  threads: {
    name: 'Threads',
    icon: ThreadsIcon,
    color: 'text-black',
    description: 'שתף בקהילת Meta',
  },
};

export default function ConnectionsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showManualDialog, setShowManualDialog] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);
  const [manualAccountData, setManualAccountData] = useState({ handle: '', display_name: '' });
  const [isCreatingBrand, setIsCreatingBrand] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  const [accountToDisconnect, setAccountToDisconnect] = useState<SocialAccount | null>(null);
  const [isConnectingDemo, setIsConnectingDemo] = useState<string | null>(null);

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

      // Fetch brands for this user
      const { data, error } = await supabase
        .from('brands')
        .select('id,name,description,logo_url')
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

  const loadAccounts = useCallback(async () => {
    if (!selectedBrand) {
      setAccounts([]);
      return;
    }
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from('social_accounts')
        .select('id,brand_id,platform,account_name,account_id,platform_specific_data')
        .eq('brand_id', selectedBrand.id)
        .eq('is_active', true);

      if (error) {
        console.error('Error fetching accounts:', error);
        setAccounts([]);
      } else {
        const accountsData: SocialAccount[] = (data || []).map((acc) => {
          const platformSpecific = acc.platform_specific_data as Record<string, unknown> | null;
          return {
            id: acc.id,
            brand_id: acc.brand_id,
            platform: (acc.platform === 'twitter' ? 'x' : acc.platform) as Platform,
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
    } catch (error) {
      console.error('Error loading accounts:', error);
      setAccounts([]);
    }
  }, [selectedBrand]);

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

      // Create brand
      const { data: newBrandData, error } = await supabase
        .from('brands')
        .insert([
          {
            user_id: userId,
            name: newBrandName,
            description: null,
            logo_url: null,
            is_active: true,
          },
        ])
        .select('id,name,logo_url')
        .single();

      if (error) {
        console.error('Error creating brand:', error);
        // Error will be handled by reloading brands - if creation failed, it won't appear
        return;
      }

      const newBrand: Brand = {
        id: newBrandData.id,
        name: newBrandData.name,
        logo_url: newBrandData.logo_url || undefined,
      };

      setBrands(prev => [...prev, newBrand]);
      setSelectedBrand(newBrand);
      setNewBrandName('');
      setIsCreatingBrand(false);
      // Reload brands to ensure consistency
      await loadBrands();
    } catch (error) {
      console.error('Error creating brand:', error);
      // Error will be handled by reloading brands - if creation failed, it won't appear
    }
  };

  const handleDemoConnect = async (platform: Platform) => {
    if (!selectedBrand) {
      return;
    }

    setIsConnectingDemo(platform);

    // Simulate API call
    await new Promise<void>((resolve) => {
      const timeoutId = setTimeout(resolve, 1500);
      return () => clearTimeout(timeoutId);
    });

    // Generate realistic demo data - using deterministic values based on platform and brand ID
    // This avoids using Math.random() during render
    const getDeterministicNumber = (seed: number, min: number, max: number): number => {
      // Simple deterministic "random" based on seed
      const pseudoRandom = ((seed * 9301) + 49297) % 233280;
      const normalized = pseudoRandom / 233280;
      return Math.floor(normalized * (max - min + 1)) + min;
    };

    const brandSeed = Number.parseInt(selectedBrand.id.slice(-8), 16) || 0;
    const platformSeeds: Record<Platform, number> = {
      instagram: 1,
      facebook: 2,
      x: 3,
      twitter: 3,
      linkedin: 4,
      tiktok: 5,
      youtube: 6,
      threads: 7,
    };
    const seed = brandSeed + (platformSeeds[platform] || 0);

    const demoData = {
      instagram: {
        handle: `@${selectedBrand.name.toLowerCase().replace(/\s+/g, '_')}_official`,
        display_name: `${selectedBrand.name} Official`,
        follower_count: getDeterministicNumber(seed, 10000, 60000),
        avatar_url: `https://i.pravatar.cc/300?u=${platform}${selectedBrand.id}`,
      },
      facebook: {
        handle: `${selectedBrand.name} - דף רשמי`,
        display_name: selectedBrand.name,
        follower_count: getDeterministicNumber(seed + 1, 5000, 35000),
        avatar_url: `https://i.pravatar.cc/300?u=${platform}${selectedBrand.id}`,
      },
      x: {
        handle: `@${selectedBrand.name.toLowerCase().replace(/\s+/g, '')}_il`,
        display_name: `${selectedBrand.name} ישראל`,
        follower_count: getDeterministicNumber(seed + 2, 3000, 23000),
        avatar_url: `https://i.pravatar.cc/300?u=${platform}${selectedBrand.id}`,
      },
      twitter: {
        handle: `@${selectedBrand.name.toLowerCase().replace(/\s+/g, '')}_il`,
        display_name: `${selectedBrand.name} ישראל`,
        follower_count: getDeterministicNumber(seed + 2, 3000, 23000),
        avatar_url: `https://i.pravatar.cc/300?u=${platform}${selectedBrand.id}`,
      },
      linkedin: {
        handle: `${selectedBrand.name} - חברה`,
        display_name: selectedBrand.name,
        follower_count: getDeterministicNumber(seed + 3, 1000, 11000),
        avatar_url: `https://i.pravatar.cc/300?u=${platform}${selectedBrand.id}`,
      },
      tiktok: {
        handle: `@${selectedBrand.name.toLowerCase().replace(/\s+/g, '_')}il`,
        display_name: `${selectedBrand.name} IL`,
        follower_count: getDeterministicNumber(seed + 4, 5000, 105000),
        avatar_url: `https://i.pravatar.cc/300?u=${platform}${selectedBrand.id}`,
      },
      youtube: {
        handle: `${selectedBrand.name} - ערוץ רשמי`,
        display_name: `${selectedBrand.name} Channel`,
        follower_count: getDeterministicNumber(seed + 5, 2000, 27000),
        avatar_url: `https://i.pravatar.cc/300?u=${platform}${selectedBrand.id}`,
      },
      threads: {
        handle: `@${selectedBrand.name.toLowerCase().replace(/\s+/g, '_')}_threads`,
        display_name: selectedBrand.name,
        follower_count: getDeterministicNumber(seed + 6, 500, 8500),
        avatar_url: `https://i.pravatar.cc/300?u=${platform}${selectedBrand.id}`,
      },
    };

    const data = demoData[platform] || demoData.x;
    const supabase = createSupabaseBrowserClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setIsConnectingDemo(null);
      return;
    }

    // Get user ID
    const { data: userRecord } = await supabase
      .from('users')
      .select('id')
      .eq('email', session.user.email)
      .maybeSingle();

    const userId = userRecord?.id || session.user.id;

    // Use current timestamp for account_id - create Date object first to avoid impure function warning
    const now = new Date();
    const accountIdTimestamp = now.getTime();

    // Create social account in database
    const { data: newAccountData, error } = await supabase
      .from('social_accounts')
      .insert([
        {
          user_id: userId,
          brand_id: selectedBrand.id,
          platform: platform === 'x' ? 'twitter' : platform, // Store as 'twitter' in DB, normalize later
          account_name: data.handle,
          account_id: `${platform}-${accountIdTimestamp}`,
          access_token: 'demo-token', // In production, this would be real OAuth token
          platform_specific_data: {
            display_name: data.display_name,
            avatar_url: data.avatar_url,
            follower_count: data.follower_count,
            last_sync: now.toISOString(),
          },
          is_active: true,
        },
      ])
      .select('id,brand_id,platform,account_name,platform_specific_data')
      .single();

    if (error) {
      console.error('Error creating account:', error);
      // Error will be handled by not adding account to state
      setIsConnectingDemo(null);
      return;
    }

    const platformSpecific = newAccountData.platform_specific_data as Record<string, unknown> | null;
    const newAccount: SocialAccount = {
      id: newAccountData.id,
      brand_id: newAccountData.brand_id,
      platform,
      handle: newAccountData.account_name || '',
      display_name: (platformSpecific?.display_name as string) || newAccountData.account_name || '',
      avatar_url: (platformSpecific?.avatar_url as string) || undefined,
      follower_count: (platformSpecific?.follower_count as number) || 0,
      is_connected: true,
      last_sync: (platformSpecific?.last_sync as string) || undefined,
    };

    setAccounts(prev => [...prev, newAccount]);
    setIsConnectingDemo(null);
    // Reload accounts to ensure consistency
    await loadAccounts();
  };

  const handleManualConnect = (platform: Platform) => {
    setSelectedPlatform(platform);
    setManualAccountData({ handle: '', display_name: '' });
    setShowManualDialog(true);
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
      const { error } = await supabase
        .from('social_accounts')
        .update({ is_active: false })
        .eq('id', accountToDisconnect.id);

      if (error) {
        console.error('Error disconnecting account:', error);
        // Error will be handled by not removing account from state
        return;
      }

      setAccounts(prev => prev.filter(acc => acc.id !== accountToDisconnect.id));
      setAccountToDisconnect(null);
      // Reload accounts to ensure consistency
      await loadAccounts();
    } catch (error) {
      console.error('Error disconnecting account:', error);
      // Error will be handled by not removing account from state
    }
  };

  const allPlatforms: Platform[] = ['instagram', 'x', 'facebook', 'linkedin', 'youtube', 'tiktok', 'threads'];

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center"
        >
          <div>
            <h1 className="bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-4xl font-bold text-transparent">
              חיבורים
            </h1>
            <p className="mt-2 text-lg text-slate-500">נהל את החיבורים שלך לרשתות החברתיות</p>
          </div>
        </motion.div>

        {/* Brands Section */}
        <Card className="border-white/20 bg-white/70 shadow-xl backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>המותגים שלך</CardTitle>
                <CardDescription>בחר מותג או צור מותג חדש</CardDescription>
              </div>
              <Button
                onClick={() => setIsCreatingBrand(true)}
                className="bg-gradient-to-r from-pink-500 to-pink-600 text-white"
              >
                <Plus className="mr-2 h-4 w-4" />
                מותג חדש
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading
              ? (
                  <div className="py-8 text-center">
                    <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-pink-500"></div>
                    <p className="text-slate-500">טוען מותגים...</p>
                  </div>
                )
              : isCreatingBrand
                ? (
                    <div className="space-y-4 rounded-lg bg-pink-50 p-4">
                      <div>
                        <Label htmlFor="brandName">שם המותג</Label>
                        <Input
                          id="brandName"
                          placeholder="הכנס שם המותג"
                          value={newBrandName}
                          onChange={e => setNewBrandName(e.target.value)}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={handleCreateBrand} className="bg-pink-600 text-white">
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          צור מותג
                        </Button>
                        <Button variant="outline" onClick={() => setIsCreatingBrand(false)}>
                          ביטול
                        </Button>
                      </div>
                    </div>
                  )
                : brands.length === 0
                  ? (
                      <div className="py-8 text-center">
                        <Briefcase className="mx-auto mb-4 h-12 w-12 text-gray-400" />
                        <p className="mb-4 text-slate-500">אין מותגים. צור מותג חדש כדי להתחיל.</p>
                      </div>
                    )
                  : (
                      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                        {brands.map(brand => (
                          <div
                            key={brand.id}
                            onClick={() => setSelectedBrand(brand)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setSelectedBrand(brand);
                              }
                            }}
                            role="button"
                            tabIndex={0}
                            className={`cursor-pointer rounded-lg border-2 p-4 transition-all duration-300 ${
                              selectedBrand?.id === brand.id
                                ? 'border-pink-500 bg-pink-50'
                                : 'border-gray-200 bg-white/50 hover:border-pink-300'
                            }`}
                          >
                            <div className="flex items-center gap-3">
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
                              <div>
                                <p className="font-semibold text-slate-800">{brand.name}</p>
                              </div>
                            </div>
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
              <CardTitle>
                חשבונות מקושרים עבור:
                {' '}
                <span className="text-pink-600">{selectedBrand.name}</span>
              </CardTitle>
              <CardDescription>
                חבר חשבונות דמו לבדיקת האפליקציה או הכנס פרטי חשבונות באופן ידני.
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
                  const connectedAccount = accounts.find(
                    acc =>
                      (acc.platform === platform || acc.platform === normalizedPlatform)
                      && acc.brand_id === selectedBrand.id,
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
                        <div>
                          <h3 className="font-semibold text-slate-800">{config.name}</h3>
                          <p className="text-sm text-slate-500">
                            {connectedAccount
                              ? `${connectedAccount.handle} (${connectedAccount.follower_count?.toLocaleString()} עוקבים)`
                              : 'לא מחובר'}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {connectedAccount
                          ? (
                              <Button
                                onClick={() => setAccountToDisconnect(connectedAccount)}
                                variant="secondary"
                                size="sm"
                              >
                                נתק
                              </Button>
                            )
                          : (
                              <>
                                <Button
                                  onClick={() => handleDemoConnect(platform)}
                                  disabled={isConnectingDemo === platform}
                                  size="sm"
                                  className="bg-gradient-to-r from-pink-500 to-pink-600 text-white"
                                >
                                  {isConnectingDemo === platform
                                    ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      )
                                    : (
                                        'חבר דמו'
                                      )}
                                </Button>
                                <Button
                                  onClick={() => handleManualConnect(platform)}
                                  variant="outline"
                                  size="sm"
                                >
                                  <LinkIcon className="mr-2 h-4 w-4" />
                                  ידני
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

        {/* Manual Connection Dialog */}
        <Dialog open={showManualDialog} onOpenChange={setShowManualDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                חיבור ידני ל-
                {selectedPlatform && platformConfigs[selectedPlatform]?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="handle">שם משתמש/כינוי</Label>
                <Input
                  id="handle"
                  placeholder="@example_account"
                  value={manualAccountData.handle}
                  onChange={e =>
                    setManualAccountData(prev => ({ ...prev, handle: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="displayName">שם תצוגה</Label>
                <Input
                  id="displayName"
                  placeholder="המותג שלי"
                  value={manualAccountData.display_name}
                  onChange={e =>
                    setManualAccountData(prev => ({ ...prev, display_name: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowManualDialog(false)}>
                ביטול
              </Button>
              <Button onClick={handleManualSubmit} className="bg-pink-600 text-white">
                חבר חשבון
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Disconnect Confirmation Dialog */}
        <Dialog
          open={!!accountToDisconnect}
          onOpenChange={() => setAccountToDisconnect(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>האם אתה בטוח?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-gray-600">
              פעולה זו תנתק את החשבון &quot;
              {accountToDisconnect?.handle}
              &quot; מהמערכת.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAccountToDisconnect(null)}>
                ביטול
              </Button>
              <Button onClick={handleDisconnect} className="bg-red-600 text-white hover:bg-red-700">
                כן, נתק את החשבון
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
