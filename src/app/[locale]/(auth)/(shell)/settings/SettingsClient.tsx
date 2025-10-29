'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export default function SettingsClient(): React.ReactElement {
  const [name, setName] = useState('Ariel');
  const [email, setEmail] = useState('user@example.com');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    await new Promise(r => setTimeout(r, 700));
    setSaving(false);
    setMessage('Saved');
  };

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="text-3xl font-bold">Settings</h1>

        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label htmlFor="fullName" className="mb-1 block text-sm font-medium">Full name</label>
              <Input id="fullName" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium">Email</label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
            {message && <span className="ml-2 text-sm text-gray-600">{message}</span>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-gray-600">
            <p>Email notifications: enabled</p>
            <p>Weekly summary: enabled</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
