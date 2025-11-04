'use client';

import { motion } from 'framer-motion';
import { Settings as SettingsIcon, User as UserIcon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Force dynamic rendering - this page requires authentication

export const dynamic = 'force-dynamic';

const countries = [
  { value: 'il', name: 'ישראל' },
  { value: 'us', name: 'ארצות הברית' },
  { value: 'uk', name: 'בריטניה' },
  { value: 'de', name: 'גרמניה' },
  { value: 'fr', name: 'צרפת' },
  { value: 'es', name: 'ספרד' },
  { value: 'it', name: 'איטליה' },
  { value: 'ca', name: 'קנדה' },
  { value: 'au', name: 'אוסטרליה' },
];

const languages = [
  { value: 'he', name: 'עברית' },
  { value: 'en', name: 'English' },
  { value: 'es', name: 'Español' },
  { value: 'fr', name: 'Français' },
  { value: 'pt', name: 'Português' },
  { value: 'ar', name: 'العربية' },
  { value: 'de', name: 'Deutsch' },
  { value: 'it', name: 'Italiano' },
];

const timezones = [
  { value: 'Asia/Jerusalem', name: 'ישראל (UTC+2/+3)' },
  { value: 'America/New_York', name: 'ניו יורק (EST)' },
  { value: 'America/Los_Angeles', name: 'לוס אנג\'לס (PST)' },
  { value: 'Europe/London', name: 'לונדון (GMT)' },
  { value: 'Europe/Paris', name: 'פריז (CET)' },
  { value: 'Europe/Berlin', name: 'ברלין (CET)' },
  { value: 'Asia/Tokyo', name: 'טוקיו (JST)' },
  { value: 'Australia/Sydney', name: 'סידני (AEDT)' },
];

export default function SettingsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [userProfile, setUserProfile] = useState({
    first_name: '',
    last_name: '',
    id_number: '',
    country: 'il',
    language: 'he',
    timezone: 'Asia/Jerusalem',
  });

  const loadUserSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      // Mock user data - in production, load from API
      await new Promise<void>((resolve) => {
        const timeoutId = setTimeout(resolve, 500);
        return () => clearTimeout(timeoutId);
      });

      // Mock data
      setUserProfile({
        first_name: 'דורון',
        last_name: 'דביר',
        id_number: '',
        country: 'il',
        language: 'he',
        timezone: 'Asia/Jerusalem',
      });
    } catch (error) {
      console.error('Error loading user settings:', error);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    // Load settings on mount - using setTimeout to avoid cascading renders warning
    const timeoutId = setTimeout(() => {
      void loadUserSettings();
    }, 0);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [loadUserSettings]);

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      // Mock save - in production, save to API
      await new Promise<void>((resolve) => {
        const timeoutId = setTimeout(resolve, 1000);
        return () => clearTimeout(timeoutId);
      });

      // Settings saved successfully - UI will reflect the changes
      // In production, add toast notification here
    } catch (error) {
      console.error('Error saving settings:', error);
      // Error will be handled by not updating state
    }
    setIsSaving(false);
  };

  const handleInputChange = (field: string, value: string) => {
    setUserProfile(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-pink-500"></div>
          <p className="text-slate-500">טוען הגדרות...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto max-w-4xl space-y-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div>
            <h1 className="bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-4xl font-bold text-transparent">
              הגדרות
            </h1>
            <p className="mt-2 text-lg text-slate-500">נהל את פרטיך האישיים והעדפות המערכת</p>
          </div>
        </motion.div>

        <div className="grid gap-8">
          {/* Personal Information */}
          <Card className="border-white/20 bg-white/70 shadow-xl backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserIcon className="h-5 w-5 text-pink-500" />
                פרטים אישיים
              </CardTitle>
              <CardDescription>עדכן את הפרטים האישיים שלך</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <Label htmlFor="firstName">שם פרטי</Label>
                  <Input
                    id="firstName"
                    placeholder="הכנס שם פרטי"
                    value={userProfile.first_name}
                    onChange={e => handleInputChange('first_name', e.target.value)}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">שם משפחה</Label>
                  <Input
                    id="lastName"
                    placeholder="הכנס שם משפחה"
                    value={userProfile.last_name}
                    onChange={e => handleInputChange('last_name', e.target.value)}
                    className="mt-2"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="idNumber">מספר ת.ז. (אופציונלי)</Label>
                <Input
                  id="idNumber"
                  placeholder="הכנס מספר ת.ז."
                  value={userProfile.id_number}
                  onChange={e => handleInputChange('id_number', e.target.value)}
                  className="mt-2"
                />
              </div>
            </CardContent>
          </Card>

          {/* Preferences */}
          <Card className="border-white/20 bg-white/70 shadow-xl backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SettingsIcon className="h-5 w-5 text-pink-500" />
                העדפות
              </CardTitle>
              <CardDescription>הגדר את העדפות המערכת שלך</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="country">מדינה</Label>
                <Select
                  value={userProfile.country}
                  onValueChange={value => handleInputChange('country', value)}
                >
                  <SelectTrigger id="country" className="mt-2">
                    <SelectValue
                      selectedLabel={countries.find(c => c.value === userProfile.country)?.name}
                      placeholder="בחר מדינה"
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {countries.map(country => (
                      <SelectItem key={country.value} value={country.value}>
                        {country.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="language">שפה</Label>
                <Select
                  value={userProfile.language}
                  onValueChange={value => handleInputChange('language', value)}
                >
                  <SelectTrigger id="language" className="mt-2">
                    <SelectValue
                      selectedLabel={languages.find(l => l.value === userProfile.language)?.name}
                      placeholder="בחר שפה"
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {languages.map(language => (
                      <SelectItem key={language.value} value={language.value}>
                        {language.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="timezone">אזור זמן</Label>
                <Select
                  value={userProfile.timezone}
                  onValueChange={value => handleInputChange('timezone', value)}
                >
                  <SelectTrigger id="timezone" className="mt-2">
                    <SelectValue
                      selectedLabel={timezones.find(t => t.value === userProfile.timezone)?.name}
                      placeholder="בחר אזור זמן"
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {timezones.map(timezone => (
                      <SelectItem key={timezone.value} value={timezone.value}>
                        {timezone.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button
              onClick={handleSaveSettings}
              disabled={isSaving}
              className="bg-gradient-to-r from-pink-500 to-pink-600 px-8 py-3 text-white"
            >
              {isSaving
                ? (
                    <>
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
                      שומר...
                    </>
                  )
                : (
                    'שמור הגדרות'
                  )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
