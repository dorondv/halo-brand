'use client';

import type { AccessibilitySettings } from '@/utils/accessibilitySettings';
import { Contrast, Minus, MousePointer, Plus, RotateCcw, Type } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  applyAccessibilitySettingsToDocument,
  DEFAULT_ACCESSIBILITY_SETTINGS,
  loadAccessibilityFromStorage,
  MAX_TEXT_SIZE,
  MIN_TEXT_SIZE,
  saveAccessibilityToStorage,
} from '@/utils/accessibilitySettings';

const TEXT_SIZE_STEP = 25;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AccessibilityModal({ open, onOpenChange }: Props) {
  const locale = useLocale();
  const t = useTranslations('Accessibility');
  const isRTL = locale === 'he';

  const [settings, setSettings] = useState<AccessibilitySettings>(() =>
    typeof window === 'undefined' ? DEFAULT_ACCESSIBILITY_SETTINGS : loadAccessibilityFromStorage(),
  );

  const applyAndPersist = useCallback((next: AccessibilitySettings) => {
    setSettings(next);
    saveAccessibilityToStorage(next);
    applyAccessibilitySettingsToDocument(next);
  }, []);

  const handleTextSizeIncrease = () => {
    const newSize = Math.min(settings.textSize + TEXT_SIZE_STEP, MAX_TEXT_SIZE);
    applyAndPersist({ ...settings, textSize: newSize });
  };

  const handleTextSizeDecrease = () => {
    const newSize = Math.max(settings.textSize - TEXT_SIZE_STEP, MIN_TEXT_SIZE);
    applyAndPersist({ ...settings, textSize: newSize });
  };

  const handleHighContrastToggle = () => {
    applyAndPersist({ ...settings, highContrast: !settings.highContrast });
  };

  const handleLargeCursorToggle = () => {
    applyAndPersist({ ...settings, largeCursor: !settings.largeCursor });
  };

  const handleReset = () => {
    applyAndPersist(DEFAULT_ACCESSIBILITY_SETTINGS);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogClose />
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <div className={`space-y-6 ${isRTL ? 'text-right' : 'text-left'}`}>
          <p className="text-sm text-gray-600 dark:text-slate-400">
            {t('description')}
          </p>

          <div className="space-y-3">
            <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Type className="h-5 w-5 shrink-0 text-gray-600 dark:text-slate-400" aria-hidden />
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {t('text_size')}
              </span>
            </div>
            <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <button
                type="button"
                onClick={handleTextSizeDecrease}
                disabled={settings.textSize <= MIN_TEXT_SIZE}
                className="rounded-lg border border-slate-300 p-2 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-800"
                aria-label={t('decrease_text')}
              >
                <Minus className="h-4 w-4 text-gray-600 dark:text-slate-400" aria-hidden />
              </button>
              <div className="flex-1 rounded-lg bg-slate-50 px-4 py-2 text-center dark:bg-gray-800">
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {settings.textSize}
                  %
                </span>
              </div>
              <button
                type="button"
                onClick={handleTextSizeIncrease}
                disabled={settings.textSize >= MAX_TEXT_SIZE}
                className="rounded-lg border border-slate-300 p-2 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-800"
                aria-label={t('increase_text')}
              >
                <Plus className="h-4 w-4 text-gray-600 dark:text-slate-400" aria-hidden />
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleHighContrastToggle}
            className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
              isRTL ? 'flex-row-reverse' : ''
            } ${
              settings.highContrast
                ? 'border-pink-300 bg-pink-50 dark:border-pink-700 dark:bg-pink-900/20'
                : 'border-slate-300 bg-white hover:bg-slate-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700'
            }`}
          >
            <Contrast className="h-5 w-5 shrink-0 text-gray-600 dark:text-slate-400" aria-hidden />
            <span className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">
              {t('high_contrast')}
            </span>
          </button>

          <button
            type="button"
            onClick={handleLargeCursorToggle}
            className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
              isRTL ? 'flex-row-reverse' : ''
            } ${
              settings.largeCursor
                ? 'border-pink-300 bg-pink-50 dark:border-pink-700 dark:bg-pink-900/20'
                : 'border-slate-300 bg-white hover:bg-slate-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700'
            }`}
          >
            <MousePointer className="h-5 w-5 shrink-0 text-gray-600 dark:text-slate-400" aria-hidden />
            <span className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">
              {t('large_cursor')}
            </span>
          </button>

          <Button
            type="button"
            variant="outline"
            className={`w-full ${isRTL ? 'flex-row-reverse' : ''}`}
            onClick={handleReset}
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            {t('reset')}
          </Button>
          <p className="pt-2 text-xs text-gray-500 dark:text-slate-400">
            {t('reset_hint')}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
