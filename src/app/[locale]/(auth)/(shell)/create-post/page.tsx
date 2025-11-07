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
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/libs/cn';
import { createSupabaseBrowserClient } from '@/libs/SupabaseBrowser';

// Force dynamic rendering - this page requires authentication

export const dynamic = 'force-dynamic';

type Platform = 'instagram' | 'x' | 'twitter' | 'facebook' | 'linkedin' | 'youtube' | 'tiktok' | 'threads';

type Account = {
  id: string;
  platform: Platform;
  account_name: string;
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
  const [error, setError] = useState<string | null>(null);

  // Load social accounts from database
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

      // Fetch all active social accounts for this user
      const { data, error: fetchError } = await supabase
        .from('social_accounts')
        .select('id,platform,account_name')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (fetchError) {
        console.error('Error fetching accounts:', fetchError);
        setAccounts([]);
      } else {
        const accountsData: Account[] = (data || []).map(acc => ({
          id: acc.id,
          platform: (acc.platform === 'twitter' ? 'x' : acc.platform) as Platform,
          account_name: acc.account_name || '',
        }));
        setAccounts(accountsData);
      }
    } catch (err) {
      console.error('Error loading accounts:', err);
      setAccounts([]);
    }
  }, []);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.content.trim() || formData.platforms.length === 0) {
      setError('Please provide content and select at least one platform');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Determine media type
      const firstMediaUrl = formData.media_urls[0];
      const mediaType = formData.media_urls.length > 0 && firstMediaUrl ? (firstMediaUrl.includes('video') ? 'video' : 'image') : 'text';

      // Create post in database
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

      // If scheduling, create scheduled posts for each selected platform
      if (scheduleMode === 'later' && formData.scheduled_time) {
        // Get accounts for selected platforms
        const accountsForPlatforms = accounts.filter(acc =>
          formData.platforms.includes(acc.platform),
        );

        if (accountsForPlatforms.length === 0) {
          throw new Error('No connected accounts found for selected platforms');
        }

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
              <PlatformSelector
                accounts={accounts}
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
