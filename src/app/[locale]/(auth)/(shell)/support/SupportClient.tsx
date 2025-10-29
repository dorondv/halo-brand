'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export default function SupportClient(): React.ReactElement {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="text-3xl font-bold">Support</h1>
        <Card>
          <CardHeader>
            <CardTitle>Contact support</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label htmlFor="subject" className="mb-1 block text-sm font-medium">Subject</label>
              <Input id="subject" value={subject} onChange={e => setSubject(e.target.value)} />
            </div>
            <div>
              <label htmlFor="message" className="mb-1 block text-sm font-medium">Message</label>
              <textarea
                id="message"
                className="min-h-28 w-full rounded-md border p-3"
                value={message}
                onChange={e => setMessage(e.target.value)}
              />
            </div>
            <Button onClick={() => setSent(true)} disabled={sent || !subject.trim() || !message.trim()}>
              {sent ? 'Sent' : 'Send'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
