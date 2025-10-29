'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Post } from '@/libs/base44';

export default function CreatePostClient(): React.ReactElement {
  const [content, setContent] = useState('');
  const [scheduled, setScheduled] = useState<string>('');
  const [platforms, setPlatforms] = useState<string[]>(['instagram', 'twitter']);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>('');

  const togglePlatform = (p: string) =>
    setPlatforms(prev => (prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]));

  const handleSubmit = async () => {
    setSaving(true);
    setMessage('');
    try {
      await Post.create({
        content: content.trim(),
        engagement: {},
        scheduled_time: scheduled ? new Date(scheduled).toISOString() : null,
        platforms,
      });
      setMessage('Post scheduled successfully!');
      setContent('');
      setScheduled('');
    } catch {
      setMessage('Failed to schedule post');
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="text-3xl font-bold">Create & Schedule Post</h1>

        <Card>
          <CardHeader>
            <CardTitle>Composer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label htmlFor="content" className="mb-1 block text-sm font-medium">Content</label>
              <textarea
                id="content"
                className="min-h-28 w-full rounded-md border p-3"
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Write your post..."
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="schedule" className="mb-1 block text-sm font-medium">Schedule</label>
                <Input
                  id="schedule"
                  type="datetime-local"
                  value={scheduled}
                  onChange={e => setScheduled(e.target.value)}
                />
              </div>
              <fieldset>
                <legend className="mb-2 block text-sm font-medium">Platforms</legend>
                <div className="flex flex-wrap gap-2">
                  {[
                    'instagram',
                    'twitter',
                    'facebook',
                    'linkedin',
                    'youtube',
                    'tiktok',
                  ].map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => togglePlatform(p)}
                      className={`rounded-full border px-3 py-1 text-sm ${platforms.includes(p)
                        ? 'bg-linear-to-r from-pink-500 to-pink-600 text-white'
                        : 'bg-white'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>

            <div className="flex items-center gap-3">
              <Button onClick={handleSubmit} disabled={saving || !content.trim()}>
                {saving ? 'Saving...' : 'Schedule'}
              </Button>
              {message && <span className="text-sm text-gray-600">{message}</span>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
