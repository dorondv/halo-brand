'use client';

import { useEffect } from 'react';
import { initTracking } from '@/utils/tracking';

/**
 * Initialize marketing tracking on page load
 * Should be added to marketing/landing pages
 */
export function TrackingInit() {
  useEffect(() => {
    initTracking();
  }, []);

  return null;
}
