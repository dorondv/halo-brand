'use client';

import type { AccessibilitySettings } from '@/utils/accessibilitySettings';
import { useEffect } from 'react';
import {
  applyAccessibilitySettingsToDocument,
  loadAccessibilityFromStorage,
  resetAccessibilityToDefault,
  validateAccessibilitySettings,
} from '@/utils/accessibilitySettings';

/**
 * Applies saved accessibility settings on mount and registers Ctrl+Shift+0 (Cmd+Shift+0) reset.
 */
export function AccessibilityBootstrap() {
  useEffect(() => {
    const saved = loadAccessibilityFromStorage();
    applyAccessibilitySettingsToDocument(saved);

    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === '0') {
        e.preventDefault();
        resetAccessibilityToDefault();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    const onStorage = (ev: StorageEvent) => {
      if (ev.key !== 'accessibilitySettings' || ev.newValue == null) {
        return;
      }
      try {
        const parsed = JSON.parse(ev.newValue) as unknown;
        const next = validateAccessibilitySettings(parsed as Partial<AccessibilitySettings>);
        applyAccessibilitySettingsToDocument(next);
      } catch {
        // ignore
      }
    };
    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return null;
}
