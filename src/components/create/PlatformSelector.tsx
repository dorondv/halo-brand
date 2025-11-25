'use client';

import { Check, Facebook, Hash, Instagram, Linkedin, MessageSquare, Play, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const XIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const platformIcons = {
  instagram: { icon: Instagram, color: 'text-white', bg: 'bg-gradient-to-br from-pink-500 to-pink-600', name: 'Instagram' },
  x: { icon: XIcon, color: 'text-white', bg: 'bg-gradient-to-br from-pink-500 to-pink-600', name: 'X' },
  twitter: { icon: XIcon, color: 'text-white', bg: 'bg-gradient-to-br from-pink-500 to-pink-600', name: 'X' }, // Alias for backwards compatibility
  facebook: { icon: Facebook, color: 'text-white', bg: 'bg-gradient-to-br from-pink-500 to-pink-600', name: 'Facebook' },
  linkedin: { icon: Linkedin, color: 'text-white', bg: 'bg-gradient-to-br from-pink-500 to-pink-600', name: 'LinkedIn' },
  youtube: { icon: Play, color: 'text-white', bg: 'bg-gradient-to-br from-pink-500 to-pink-600', name: 'YouTube' },
  tiktok: { icon: Hash, color: 'text-white', bg: 'bg-gradient-to-br from-pink-500 to-pink-600', name: 'TikTok' },
  threads: { icon: MessageSquare, color: 'text-white', bg: 'bg-gradient-to-br from-pink-500 to-pink-600', name: 'Threads' },
} as const;

type Platform = keyof typeof platformIcons;

// All available platforms (matching dashboard)
const ALL_PLATFORMS: Platform[] = ['instagram', 'x', 'facebook', 'linkedin', 'youtube', 'tiktok', 'threads'];

type Account = {
  id: string;
  platform: Platform;
  account_name: string;
};

type PlatformSelectorProps = {
  accounts: Account[];
  selectedPlatforms: Platform[];
  onPlatformsChange: (platforms: Platform[]) => void;
};

export default function PlatformSelector({ accounts, selectedPlatforms, onPlatformsChange }: PlatformSelectorProps) {
  const t = useTranslations('CreatePost');

  // Show all platforms (matching dashboard), not just ones with accounts
  const availablePlatforms = React.useMemo(() => {
    // Return all platforms, showing connected accounts count
    return ALL_PLATFORMS;
  }, []);

  // Normalize selected platforms
  const normalizedSelectedPlatforms = React.useMemo(
    () => selectedPlatforms.map(p => (p === 'twitter' ? 'x' : p)) as Platform[],
    [selectedPlatforms],
  );

  const togglePlatform = (platform: Platform) => {
    // Always use 'x' instead of 'twitter' for consistency
    const normalizedPlatform = platform === 'twitter' ? 'x' : platform;

    // Normalize all selected platforms for comparison
    const currentNormalized = selectedPlatforms.map(p => (p === 'twitter' ? 'x' : p)) as Platform[];

    if (currentNormalized.includes(normalizedPlatform)) {
      // Remove the platform (remove both 'x' and 'twitter' if present)
      onPlatformsChange(
        selectedPlatforms.filter((p) => {
          const normalized = p === 'twitter' ? 'x' : p;
          return normalized !== normalizedPlatform;
        }),
      );
    } else {
      // Add the platform (always use 'x' instead of 'twitter')
      const platformToAdd = normalizedPlatform === 'x' ? 'x' : platform;
      onPlatformsChange([...selectedPlatforms, platformToAdd]);
    }
  };

  return (
    <Card className="border-gray-200 shadow-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-pink-500" />
          {t('platforms_title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {availablePlatforms.map((platform) => {
          const config = platformIcons[platform];
          if (!config) {
            return null;
          }

          const Icon = config.icon;
          // Normalize platform for comparison (support both 'x' and 'twitter')
          const normalizedPlatform = platform === 'twitter' ? 'x' : platform;
          const isSelected
            = normalizedSelectedPlatforms.includes(normalizedPlatform)
              || normalizedSelectedPlatforms.includes(platform as Platform)
              || selectedPlatforms.includes(platform);

          // Count accounts for this platform (support both 'x' and 'twitter')
          const accountsForPlatform = accounts.filter(
            acc => acc.platform === platform || (platform === 'x' && acc.platform === 'twitter') || (platform === 'twitter' && acc.platform === 'x'),
          );

          return (
            <div
              key={platform}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3 transition-all duration-300 ${
                isSelected ? 'border-pink-300 bg-pink-50' : 'hover:bg-pink-25 border-gray-200 hover:border-pink-200'
              }`}
              onClick={() => togglePlatform(platform)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  togglePlatform(platform);
                }
              }}
              role="button"
              tabIndex={0}
            >
              <div
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border-2 transition-colors ${
                  isSelected
                    ? 'border-pink-500 bg-pink-500 text-white'
                    : 'border-gray-300 bg-white'
                }`}
              >
                {isSelected && <Check className="h-3 w-3" />}
              </div>
              <div className={`h-10 w-10 ${config.bg} flex items-center justify-center rounded-xl shadow-lg`}>
                <Icon className={`h-5 w-5 ${config.color}`} />
              </div>
              <div className="flex-1">
                <p className="font-medium text-slate-900">{config.name}</p>
                <p className="text-xs text-slate-500">
                  {accountsForPlatform.length > 0
                    ? `${accountsForPlatform.length} ${accountsForPlatform.length !== 1 ? t('platform_accounts') : t('platform_account')}`
                    : t('platform_not_connected')}
                </p>
              </div>
              {isSelected && (
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-pink-500 text-white">
                  <Check className="h-4 w-4" />
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
