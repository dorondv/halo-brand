'use client';

import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useTranslations } from 'next-intl';

export function BrandSelector() {
  const t = useTranslations('Common');
  return (
    <div className="space-y-2 mt-2">
      <Label htmlFor="brand">{t('brand_selector_label')}</Label>
      <Input id="brand" placeholder="Brand name" />
    </div>
  );
}

export default BrandSelector;
