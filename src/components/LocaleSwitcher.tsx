'use client';

import { Globe } from 'lucide-react';
import { useLocale } from 'next-intl';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePathname } from '@/libs/I18nNavigation';

const locales = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'he', name: 'עברית', flag: '🇮🇱' },
];

export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();

  const currentLocale = locales.find(l => l.code === locale) ?? locales[0]!;
  const displayLabel = `${currentLocale.flag} ${currentLocale.name}`;

  const handleLocaleChange = (newLocale: string) => {
    // Navigate to the same pathname but with the new locale
    const newPath = `/${newLocale}${pathname}`;
    window.location.href = newPath;
  };

  return (
    <Select value={locale} onValueChange={handleLocaleChange}>
      <SelectTrigger className="h-9 w-auto min-w-[120px] px-3 text-sm">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-gray-600" />
          <SelectValue selectedLabel={displayLabel} />
        </div>
      </SelectTrigger>
      <SelectContent>
        {locales.map(loc => (
          <SelectItem key={loc.code} value={loc.code}>
            <div className="flex items-center gap-2">
              <span>{loc.flag}</span>
              <span>{loc.name}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
