'use client';

import { motion } from 'framer-motion';
import { Lightbulb, Settings as SettingsIcon, Sun, User as UserIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
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
import { useToast } from '@/components/ui/toast';
import { cn } from '@/libs/cn';

// Force dynamic rendering - this page requires authentication

export const dynamic = 'force-dynamic';

const getCountries = (t: (key: string) => string) => [
  { value: 'il', name: t('country_il') },
  { value: 'us', name: t('country_us') },
  { value: 'uk', name: t('country_uk') },
  { value: 'de', name: t('country_de') },
  { value: 'fr', name: t('country_fr') },
  { value: 'es', name: t('country_es') },
  { value: 'it', name: t('country_it') },
  { value: 'ca', name: t('country_ca') },
  { value: 'au', name: t('country_au') },
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

const getTimezones = (t: (key: string) => string) => [
  { value: 'Asia/Jerusalem', name: t('timezone_jerusalem') },
  { value: 'America/New_York', name: t('timezone_new_york') },
  { value: 'America/Los_Angeles', name: t('timezone_los_angeles') },
  { value: 'Europe/London', name: t('timezone_london') },
  { value: 'Europe/Paris', name: t('timezone_paris') },
  { value: 'Europe/Berlin', name: t('timezone_berlin') },
  { value: 'Asia/Tokyo', name: t('timezone_tokyo') },
  { value: 'Australia/Sydney', name: t('timezone_sydney') },
];

export default function SettingsPage() {
  const t = useTranslations('Settings');
  const locale = useLocale();
  const isRTL = locale === 'he';
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [userProfile, setUserProfile] = useState({
    first_name: '',
    last_name: '',
    id_number: '',
    country: 'il',
    language: 'he',
    timezone: 'Asia/Jerusalem',
    light_mode: true,
  });

  const countries = getCountries(t as any);
  const timezones = getTimezones(t as any);

  const loadUserSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/settings');
      if (!response.ok) {
        throw new Error('Failed to load settings');
      }
      const { data } = await response.json();
      setUserProfile({
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        id_number: data.id_number || '',
        country: data.country || 'il',
        language: data.language || 'he',
        timezone: data.timezone || 'Asia/Jerusalem',
        light_mode: data.light_mode ?? true,
      });
    } catch (error) {
      console.error('Error loading user settings:', error);
      // Set defaults on error
      setUserProfile({
        first_name: '',
        last_name: '',
        id_number: '',
        country: 'il',
        language: 'he',
        timezone: 'Asia/Jerusalem',
        light_mode: true,
      });
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
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          first_name: userProfile.first_name,
          last_name: userProfile.last_name,
          id_number: userProfile.id_number,
          country: userProfile.country,
          language: userProfile.language,
          timezone: userProfile.timezone,
          light_mode: userProfile.light_mode,
        }),
      });

      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error || 'Failed to save settings');
      }

      const { data } = await response.json();
      // Update with response data
      setUserProfile({
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        id_number: data.id_number || '',
        country: data.country || 'il',
        language: data.language || 'he',
        timezone: data.timezone || 'Asia/Jerusalem',
        light_mode: data.light_mode ?? true,
      });

      // Show success toast
      toast.showToast(t('save_success'), 'success');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.showToast(t('save_error'), 'error');
    }
    setIsSaving(false);
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setUserProfile(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-pink-500"></div>
          <p className="text-slate-500">{t('loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="mx-auto max-w-4xl space-y-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className={isRTL ? 'text-right' : 'text-left'}>
            <h1 className="bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-4xl font-bold text-transparent">
              {t('title')}
            </h1>
            <p className="mt-2 text-lg text-slate-500">{t('subtitle')}</p>
          </div>
        </motion.div>

        <div className="grid gap-8">
          {/* Personal Information */}
          <Card className="border-white/20 bg-white/70 shadow-xl backdrop-blur-sm">
            <CardHeader>
              <CardTitle className={cn('flex items-center gap-2', isRTL ? 'flex-row-reverse' : '')}>
                <UserIcon className="h-5 w-5 text-pink-500" />
                {t('personal_info_title')}
              </CardTitle>
              <CardDescription className={isRTL ? 'text-right' : 'text-left'}>
                {t('personal_info_desc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <Label htmlFor="firstName">{t('first_name')}</Label>
                  <Input
                    id="firstName"
                    placeholder={t('first_name_placeholder')}
                    value={userProfile.first_name}
                    onChange={e => handleInputChange('first_name', e.target.value)}
                    className="mt-2"
                    dir={isRTL ? 'rtl' : 'ltr'}
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">{t('last_name')}</Label>
                  <Input
                    id="lastName"
                    placeholder={t('last_name_placeholder')}
                    value={userProfile.last_name}
                    onChange={e => handleInputChange('last_name', e.target.value)}
                    className="mt-2"
                    dir={isRTL ? 'rtl' : 'ltr'}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="idNumber">{t('id_number')}</Label>
                <Input
                  id="idNumber"
                  placeholder={t('id_number_placeholder')}
                  value={userProfile.id_number}
                  onChange={e => handleInputChange('id_number', e.target.value)}
                  className="mt-2"
                  dir={isRTL ? 'rtl' : 'ltr'}
                />
              </div>
            </CardContent>
          </Card>

          {/* Appearance and Display */}
          <Card className="border-white/20 bg-white/70 shadow-xl backdrop-blur-sm">
            <CardHeader>
              <CardTitle className={cn('flex items-center gap-2', isRTL ? 'flex-row-reverse' : '')}>
                <SettingsIcon className="h-5 w-5 text-pink-500" />
                {t('appearance_title')}
              </CardTitle>
              <CardDescription className={isRTL ? 'text-right' : 'text-left'}>
                {t('appearance_desc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className={cn('flex items-center gap-3', isRTL ? 'flex-row-reverse' : '')}>
                  <Sun className="h-5 w-5 text-yellow-500" />
                  <div className={isRTL ? 'text-right' : 'text-left'}>
                    <Label htmlFor="lightMode" className="text-base font-medium text-slate-800">
                      {t('light_mode')}
                    </Label>
                    <p className="text-sm text-slate-500">{t('light_mode_desc')}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleInputChange('light_mode', !userProfile.light_mode)}
                  className={cn(
                    'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2',
                    userProfile.light_mode ? 'bg-pink-500' : 'bg-gray-300',
                  )}
                  role="switch"
                  aria-checked={userProfile.light_mode}
                  aria-label={t('light_mode')}
                >
                  <span
                    className={cn(
                      'absolute inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-all duration-200 ease-in-out',
                      userProfile.light_mode ? 'right-1' : 'left-1',
                    )}
                  />
                </button>
              </div>
              <div className={cn('flex items-start gap-3 rounded-lg bg-blue-50 p-4', isRTL ? 'flex-row-reverse' : '')}>
                <Lightbulb className="h-5 w-5 shrink-0 text-yellow-500" />
                <p className={cn('text-sm text-blue-700', isRTL ? 'text-right' : 'text-left')}>
                  {t('save_tip')}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Preferences */}
          <Card className="border-white/20 bg-white/70 shadow-xl backdrop-blur-sm">
            <CardHeader>
              <CardTitle className={cn('flex items-center gap-2', isRTL ? 'flex-row-reverse' : '')}>
                <SettingsIcon className="h-5 w-5 text-pink-500" />
                {t('preferences_title')}
              </CardTitle>
              <CardDescription className={isRTL ? 'text-right' : 'text-left'}>
                {t('preferences_desc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="country">{t('country')}</Label>
                <Select
                  value={userProfile.country}
                  onValueChange={value => handleInputChange('country', value)}
                >
                  <SelectTrigger id="country" className="mt-2" dir={isRTL ? 'rtl' : 'ltr'}>
                    <SelectValue
                      selectedLabel={countries.find(c => c.value === userProfile.country)?.name}
                      placeholder={t('country_placeholder')}
                    />
                  </SelectTrigger>
                  <SelectContent dir={isRTL ? 'rtl' : 'ltr'} className={isRTL ? 'text-right' : 'text-left'}>
                    {countries.map(country => (
                      <SelectItem key={country.value} value={country.value}>
                        {country.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="language">{t('language')}</Label>
                <Select
                  value={userProfile.language}
                  onValueChange={value => handleInputChange('language', value)}
                >
                  <SelectTrigger id="language" className="mt-2" dir={isRTL ? 'rtl' : 'ltr'}>
                    <SelectValue
                      selectedLabel={languages.find(l => l.value === userProfile.language)?.name}
                      placeholder={t('language_placeholder')}
                    />
                  </SelectTrigger>
                  <SelectContent dir={isRTL ? 'rtl' : 'ltr'} className={isRTL ? 'text-right' : 'text-left'}>
                    {languages.map(language => (
                      <SelectItem key={language.value} value={language.value}>
                        {language.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="timezone">{t('timezone')}</Label>
                <Select
                  value={userProfile.timezone}
                  onValueChange={value => handleInputChange('timezone', value)}
                >
                  <SelectTrigger id="timezone" className="mt-2" dir={isRTL ? 'rtl' : 'ltr'}>
                    <SelectValue
                      selectedLabel={timezones.find(tz => tz.value === userProfile.timezone)?.name}
                      placeholder={t('timezone_placeholder')}
                    />
                  </SelectTrigger>
                  <SelectContent dir={isRTL ? 'rtl' : 'ltr'} className={isRTL ? 'text-right' : 'text-left'}>
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
          <div className={cn('flex', isRTL ? 'justify-start' : 'justify-end')}>
            <Button
              onClick={handleSaveSettings}
              disabled={isSaving}
              className="bg-gradient-to-r from-pink-500 to-pink-600 px-8 py-3 text-white"
            >
              {isSaving
                ? (
                    <>
                      <div className={cn('h-4 w-4 animate-spin rounded-full border-b-2 border-white', isRTL ? 'ml-2' : 'mr-2')}></div>
                      {t('saving')}
                    </>
                  )
                : (
                    t('save_settings')
                  )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
