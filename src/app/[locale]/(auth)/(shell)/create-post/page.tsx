'use client';

import { motion } from 'framer-motion';
import { Calendar, Hash, Send, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import React, { useCallback, useEffect, useState } from 'react';
import MediaUpload from '@/components/create/MediaUpload';
import PlatformSelector from '@/components/create/PlatformSelector';
import ScheduleSelector from '@/components/create/ScheduleSelector';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/libs/cn';
import { createSupabaseBrowserClient } from '@/libs/SupabaseBrowser';

// Force dynamic rendering - this page requires authentication

export const dynamic = 'force-dynamic';

type Platform = 'instagram' | 'x' | 'twitter' | 'facebook' | 'linkedin' | 'youtube' | 'tiktok' | 'threads';

type Account = {
  id: string;
  brand_id: string;
  platform: Platform;
  account_name: string;
  getlate_account_id?: string | null;
};

export default function CreatePostPage() {
  const router = useRouter();
  const t = useTranslations('CreatePost');
  const locale = useLocale();
  const isRTL = locale === 'he';
  const [formData, setFormData] = useState({
    content: '',
    platforms: [] as Platform[],
    media_urls: [] as string[],
    hashtags: [] as string[],
    scheduled_time: '',
  });
  const [hashtagInput, setHashtagInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scheduleMode, setScheduleMode] = useState<'now' | 'later'>('now');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [brands, setBrands] = useState<Array<{ id: string; name: string; getlate_profile_id?: string | null }>>([]);
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load social accounts from database, syncing from Getlate first
  const loadAccounts = useCallback(async () => {
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

      // First, sync accounts from Getlate for all brands that have Getlate profiles
      try {
        const { data: brands } = await supabase
          .from('brands')
          .select('id, getlate_profile_id')
          .eq('user_id', userId)
          .eq('is_active', true)
          .not('getlate_profile_id', 'is', null);

        if (brands && brands.length > 0) {
          // Sync accounts for each brand with Getlate profile
          const syncPromises = brands.map(brand =>
            fetch(`/api/getlate/accounts?brandId=${brand.id}`).catch((err) => {
              console.warn(`⚠️  Could not sync accounts for brand ${brand.id}:`, err);
              return null;
            }),
          );

          await Promise.all(syncPromises);
        }
      } catch (syncError) {
        console.warn('⚠️  Error syncing accounts from Getlate, using cached data:', syncError);
      }

      // Load brands for brand selection
      const { data: brandsData, error: brandsError } = await supabase
        .from('brands')
        .select('id, name, getlate_profile_id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('name');

      if (!brandsError && brandsData && brandsData.length > 0) {
        setBrands(brandsData);
        // Auto-select first brand if none selected
        if (!selectedBrandId && brandsData.length > 0 && brandsData[0]) {
          setSelectedBrandId(brandsData[0].id);
        }
      }

      // Then fetch all active social accounts for this user (with brand_id and getlate_account_id)
      const { data, error: fetchError } = await supabase
        .from('social_accounts')
        .select('id, brand_id, platform, account_name, getlate_account_id')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (fetchError) {
        console.error('Error fetching accounts:', fetchError);
        setAccounts([]);
      } else {
        const accountsData: Account[] = (data || []).map(acc => ({
          id: acc.id,
          brand_id: acc.brand_id,
          platform: (acc.platform === 'twitter' ? 'x' : acc.platform) as Platform,
          account_name: acc.account_name || '',
          getlate_account_id: acc.getlate_account_id || null,
        }));
        setAccounts(accountsData);
      }
    } catch (err) {
      console.error('Error loading accounts:', err);
      setAccounts([]);
    }
  }, [selectedBrandId]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts, selectedBrandId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.content.trim() || formData.platforms.length === 0) {
      setError('Please provide content and select at least one platform');
      return;
    }

    if (!selectedBrandId) {
      setError('Please select a brand');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Get selected brand to check if it has Getlate profile
      const selectedBrand = brands.find(b => b.id === selectedBrandId);
      const useGetlate = !!selectedBrand?.getlate_profile_id;

      // Get accounts for selected platforms and brand
      const accountsForPlatforms = accounts.filter(acc =>
        formData.platforms.includes(acc.platform)
        && acc.brand_id === selectedBrandId
        && (useGetlate ? acc.getlate_account_id : true), // If using Getlate, require getlate_account_id
      );

      if (accountsForPlatforms.length === 0) {
        throw new Error('No connected accounts found for selected platforms. Please connect accounts first.');
      }

      // Determine media type
      const firstMediaUrl = formData.media_urls[0];
      const mediaType = formData.media_urls.length > 0 && firstMediaUrl ? (firstMediaUrl.includes('video') ? 'video' : 'image') : 'text';

      // Map platforms for Getlate (if using Getlate) or local
      // Always send local account ID, API will map to getlate_account_id if needed
      const platformsArray = accountsForPlatforms.map(acc => ({
        platform: acc.platform,
        account_id: acc.id, // Always send local account ID, API will look up getlate_account_id
        config: {},
      }));

      // Determine timezone (use user's timezone or default)
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      // Create post in database with Getlate integration
      const postResponse = await fetch('/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: formData.content,
          image_url: formData.media_urls.length > 0 ? formData.media_urls[0] : null,
          hashtags: formData.hashtags,
          media_type: mediaType,
          brand_id: selectedBrandId,
          scheduled_for: scheduleMode === 'later' && formData.scheduled_time ? formData.scheduled_time : undefined,
          timezone,
          platforms: platformsArray,
          use_getlate: useGetlate,
          metadata: {
            media_urls: formData.media_urls,
            platforms: formData.platforms,
          },
        }),
      });

      if (!postResponse.ok) {
        const errorData = await postResponse.json();
        throw new Error(errorData.error || 'Failed to create post');
      }

      const { data: postData } = await postResponse.json();
      const postId = postData[0]?.id;

      if (!postId) {
        throw new Error('Failed to get post ID');
      }

      // If using Getlate, the scheduling is handled by Getlate API
      // If not using Getlate and scheduling, create scheduled posts for each account
      if (!useGetlate && scheduleMode === 'later' && formData.scheduled_time) {
        // Create scheduled posts for each account
        const schedulePromises = accountsForPlatforms.map(account =>
          fetch('/api/schedule', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              postId,
              socialAccountId: account.id,
              scheduledFor: formData.scheduled_time,
              timezone,
            }),
          }),
        );

        const scheduleResults = await Promise.all(schedulePromises);
        const failedSchedules = scheduleResults.filter(r => !r.ok);

        if (failedSchedules.length > 0) {
          console.error('Some schedules failed:', failedSchedules);
          // Continue anyway - at least the post was created
        }
      }

      // Navigate to dashboard after successful submission
      router.push('/dashboard');
    } catch (err) {
      console.error('Error creating post:', err);
      setError(err instanceof Error ? err.message : 'Failed to create post');
    } finally {
      setIsSubmitting(false);
    }
  };

  const addHashtag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && hashtagInput.trim()) {
      e.preventDefault();
      const tag = hashtagInput.trim().replace(/^#/, '');
      if (!formData.hashtags.includes(tag)) {
        setFormData(prev => ({
          ...prev,
          hashtags: [...prev.hashtags, tag],
        }));
      }
      setHashtagInput('');
    }
  };

  const removeHashtag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      hashtags: prev.hashtags.filter(tag => tag !== tagToRemove),
    }));
  };

  return (
    <div className="min-h-screen p-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="mx-auto max-w-4xl space-y-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-4xl font-bold text-transparent">
            {t('title')}
          </h1>
          <p className="mt-2 text-lg text-slate-500">{t('subtitle')}</p>
        </motion.div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <Card className="border-gray-200 shadow-xl">
                <CardHeader>
                  <CardTitle className={cn('flex items-center gap-2', isRTL ? 'flex-row-reverse' : '')}>
                    <Send className="h-5 w-5 text-blue-500" />
                    {t('post_content_title')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    placeholder={t('content_placeholder')}
                    value={formData.content}
                    onChange={e => setFormData(prev => ({ ...prev, content: e.target.value }))}
                    className="min-h-[120px] resize-none border-gray-200 transition-all duration-300 focus:border-blue-300"
                  />

                  <div className={cn('flex text-sm text-slate-500', isRTL ? 'flex-row-reverse justify-between' : 'justify-between')}>
                    <span>
                      {formData.content.length}
                      {' '}
                      {t('characters')}
                    </span>
                    <span>{t('tip')}</span>
                  </div>
                </CardContent>
              </Card>

              <MediaUpload
                mediaUrls={formData.media_urls}
                onMediaUpdate={urls => setFormData(prev => ({ ...prev, media_urls: urls }))}
              />

              <Card className="border-gray-200 shadow-xl">
                <CardHeader>
                  <CardTitle className={cn('flex items-center gap-2', isRTL ? 'flex-row-reverse' : '')}>
                    <Hash className="h-5 w-5 text-emerald-500" />
                    {t('hashtags_title')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input
                    placeholder={t('hashtags_placeholder')}
                    value={hashtagInput}
                    onChange={e => setHashtagInput(e.target.value)}
                    onKeyPress={addHashtag}
                    className="border-gray-200 focus:border-emerald-300"
                  />

                  <div className="flex flex-wrap gap-2">
                    {formData.hashtags.map(tag => (
                      <span
                        key={tag}
                        className="flex items-center gap-2 rounded-full border border-gray-200 bg-gradient-to-r from-emerald-100 to-blue-100 px-3 py-1 text-sm text-slate-700"
                      >
                        #
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeHashtag(tag)}
                          className="transition-colors hover:text-red-500"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              {error && (
                <Card className="border-red-200 bg-red-50">
                  <CardContent className="pt-6">
                    <p className="text-sm text-red-600">{error}</p>
                  </CardContent>
                </Card>
              )}

              {/* Brand Selector */}
              {brands.length > 0 && (
                <Card className="border-gray-200 shadow-xl">
                  <CardHeader>
                    <CardTitle className={cn('flex items-center gap-2', isRTL ? 'flex-row-reverse' : '')}>
                      {t('brand')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Select
                      value={selectedBrandId || ''}
                      onValueChange={setSelectedBrandId}
                    >
                      <SelectTrigger dir={isRTL ? 'rtl' : 'ltr'}>
                        <SelectValue
                          placeholder={t('select_brand')}
                          options={brands.map(brand => ({ value: brand.id, name: brand.name }))}
                        />
                      </SelectTrigger>
                      <SelectContent dir={isRTL ? 'rtl' : 'ltr'}>
                        {brands.map(brand => (
                          <SelectItem key={brand.id} value={brand.id} dir={isRTL ? 'rtl' : 'ltr'}>
                            {brand.name}
                            {brand.getlate_profile_id && (
                              <span className="ml-2 text-xs text-green-600">✓</span>
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>
              )}

              <PlatformSelector
                accounts={accounts.filter(acc => !selectedBrandId || acc.brand_id === selectedBrandId)}
                selectedPlatforms={formData.platforms}
                onPlatformsChange={platforms => setFormData(prev => ({ ...prev, platforms }))}
              />

              <ScheduleSelector
                scheduleMode={scheduleMode}
                onScheduleModeChange={setScheduleMode}
                scheduledTime={formData.scheduled_time}
                onScheduledTimeChange={time => setFormData(prev => ({ ...prev, scheduled_time: time }))}
              />

              <Button
                type="submit"
                disabled={!formData.content.trim() || formData.platforms.length === 0 || isSubmitting}
                className="w-full rounded-xl bg-gradient-to-r from-blue-500 to-emerald-500 py-4 text-lg font-medium text-white shadow-lg transition-all duration-300 hover:from-blue-600 hover:to-emerald-600 hover:shadow-xl"
              >
                {isSubmitting
                  ? (
                      <div className={cn('flex items-center gap-2', isRTL ? 'flex-row-reverse' : '')}>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        {scheduleMode === 'now' ? t('publishing') : t('scheduling')}
                      </div>
                    )
                  : (
                      <div className={cn('flex items-center gap-2', isRTL ? 'flex-row-reverse' : '')}>
                        {scheduleMode === 'now' ? <Send className="h-5 w-5" /> : <Calendar className="h-5 w-5" />}
                        {scheduleMode === 'now' ? t('publish_now') : t('schedule_post')}
                      </div>
                    )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
