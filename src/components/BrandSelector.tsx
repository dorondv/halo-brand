'use client';

import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function BrandSelector() {
  const t = useTranslations('Common');
  return (
    <div className="mt-2 space-y-2">
      <Label htmlFor="brand">{t('brand_selector_label')}</Label>
      <Input id="brand" placeholder="Brand name" />
    </div>
  );
}

export default BrandSelector;
