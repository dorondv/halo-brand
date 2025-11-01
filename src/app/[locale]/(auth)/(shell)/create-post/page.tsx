'use client';

import { motion } from 'framer-motion';
import { Calendar, Hash, Send, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';
import MediaUpload from '@/components/create/MediaUpload';
import PlatformSelector from '@/components/create/PlatformSelector';
import ScheduleSelector from '@/components/create/ScheduleSelector';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

type Platform = 'instagram' | 'x' | 'twitter' | 'facebook' | 'linkedin' | 'youtube' | 'tiktok' | 'threads';

type Account = {
  id: string;
  platform: Platform;
  account_name: string;
};

// Mock accounts data - showing all platforms with some connected
const mockAccounts: Account[] = [
  { id: '1', platform: 'instagram', account_name: '@mybrand' },
  { id: '2', platform: 'x', account_name: '@mybrand' },
  { id: '3', platform: 'facebook', account_name: 'My Brand Page' },
  { id: '4', platform: 'linkedin', account_name: 'My Brand' },
  // YouTube, TikTok, and Threads are not connected (will show "Not connected")
];

export default function CreatePostPage() {
  const router = useRouter();
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.content.trim() || formData.platforms.length === 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      // Mock submission - in production, this would call an API
      // Post data prepared - uncomment when ready to use:
      // const postData = {
      //   ...formData,
      //   status: scheduleMode === 'now' ? 'published' : 'scheduled',
      //   scheduled_time: scheduleMode === 'later' ? formData.scheduled_time : null,
      // };

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Navigate to dashboard after successful submission
      router.push('/dashboard');
    } catch (error) {
      console.error('Error creating post:', error);
    }
    setIsSubmitting(false);
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
    <div className="min-h-screen p-6">
      <div className="mx-auto max-w-4xl space-y-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-4xl font-bold text-transparent">
            Create New Post
          </h1>
          <p className="mt-2 text-lg text-slate-500">Create engaging and inspiring content for your audience</p>
        </motion.div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <Card className="border-gray-200 shadow-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Send className="h-5 w-5 text-blue-500" />
                    Post Content
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    placeholder="What's on your mind?"
                    value={formData.content}
                    onChange={e => setFormData(prev => ({ ...prev, content: e.target.value }))}
                    className="min-h-[120px] resize-none border-gray-200 transition-all duration-300 focus:border-blue-300"
                  />

                  <div className="flex justify-between text-sm text-slate-500">
                    <span>
                      {formData.content.length}
                      {' '}
                      characters
                    </span>
                    <span>Tip: Add a question or call to action</span>
                  </div>
                </CardContent>
              </Card>

              <MediaUpload
                mediaUrls={formData.media_urls}
                onMediaUpdate={urls => setFormData(prev => ({ ...prev, media_urls: urls }))}
              />

              <Card className="border-gray-200 shadow-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Hash className="h-5 w-5 text-emerald-500" />
                    Hashtags
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input
                    placeholder="Add hashtags (press Enter)"
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
              <PlatformSelector
                accounts={mockAccounts}
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
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        {scheduleMode === 'now' ? 'Publishing...' : 'Scheduling...'}
                      </div>
                    )
                  : (
                      <div className="flex items-center gap-2">
                        {scheduleMode === 'now' ? <Send className="h-5 w-5" /> : <Calendar className="h-5 w-5" />}
                        {scheduleMode === 'now' ? 'Publish Now' : 'Schedule Post'}
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
