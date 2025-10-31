'use client';

import { ChevronDown, FileText, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createSupabaseBrowserClient } from '@/libs/SupabaseBrowser';

type Brand = {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
};

export function BrandSelector() {
  const t = useTranslations('Common');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [brandName, setBrandName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const fetchBrands = async () => {
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return;
      }

      // Get user from users table
      const { data: userRecord } = await supabase
        .from('users')
        .select('id')
        .eq('email', session.user.email)
        .single();

      const userId = userRecord?.id || session.user.id;

      // Fetch brands for this user
      const { data, error } = await supabase
        .from('brands')
        .select('id,name,description,logo_url')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('Error fetching brands:', error);
      } else {
        setBrands(data || []);
      }
    } catch (error) {
      console.error('Error fetching brands:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchBrands();
  }, []);

  useEffect(() => {
    // Get selected brand from URL params
    const brandParam = searchParams.get('brand');
    const newBrandId = brandParam || 'all';
    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
    setSelectedBrandId(prev => prev !== newBrandId ? newBrandId : prev);
  }, [searchParams]);

  const handleBrandChange = (brandId: string) => {
    setSelectedBrandId(brandId);
    const params = new URLSearchParams(searchParams.toString());
    if (brandId === 'all') {
      params.delete('brand');
    } else {
      params.set('brand', brandId);
    }
    const queryString = params.toString();
    const url = queryString ? `${pathname}?${queryString}` : pathname;
    router.push(url, { scroll: false });
    router.refresh();
  };

  const handleCreateBrand = async () => {
    if (!brandName.trim()) {
      return;
    }

    setIsCreating(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('No session found');
        setIsCreating(false);
        return;
      }

      // Get user from users table
      const { data: userRecord } = await supabase
        .from('users')
        .select('id')
        .eq('email', session.user.email)
        .single();

      const userId = userRecord?.id || session.user.id;

      // Create brand
      const { data, error } = await supabase
        .from('brands')
        .insert([
          {
            user_id: userId,
            name: brandName.trim(),
            description: null,
            logo_url: null,
            is_active: true,
          },
        ])
        .select()
        .single();

      if (error) {
        console.error('Error creating brand:', error);
        // Use console.error instead of alert to avoid blocking the UI in tests and satisfy lint rules.
        console.error(t('brand_create_error'));
      } else {
        // Refresh brands list
        await fetchBrands();
        // Select the newly created brand
        handleBrandChange(data.id);
        // Close modal and reset form
        setIsModalOpen(false);
        setBrandName('');
        // Show success message (optional)
        // alert(t('brand_create_success'));
      }
    } catch (error) {
      console.error('Error creating brand:', error);
      console.error(t('brand_create_error'));
    } finally {
      setIsCreating(false);
    }
  };

  const selectedBrand = brands.find(b => b.id === selectedBrandId);
  const displayValue = selectedBrandId === 'all'
    ? t('brand_selector_all')
    : selectedBrand?.name || t('brand_selector_placeholder');

  if (isLoading) {
    return (
      <div className="mt-2 space-y-2">
        <div className="h-10 w-full animate-pulse rounded-md border border-gray-300 bg-gray-100" />
        <div className="h-10 w-full animate-pulse rounded-md border border-gray-300 bg-gray-100" />
      </div>
    );
  }

  return (
    <>
      <div className="mt-2 space-y-2">
        {/* Brand Dropdown */}
        <Select value={selectedBrandId} onValueChange={handleBrandChange}>
          <SelectTrigger id="brand" className="w-full">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <FileText className="h-4 w-4 shrink-0 text-gray-500" />
              <span className="truncate">
                <SelectValue selectedLabel={displayValue} placeholder={t('brand_selector_placeholder')} />
              </span>
            </div>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('brand_selector_all')}</SelectItem>
            {brands.map(brand => (
              <SelectItem key={brand.id} value={brand.id}>
                {brand.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Add Brand Button */}
        <Button
          variant="outline"
          className="w-full justify-start gap-2 bg-white hover:bg-gray-50"
          onClick={() => setIsModalOpen(true)}
        >
          <Plus className="h-4 w-4" />
          {t('brand_add_button')}
        </Button>
      </div>

      {/* Create Brand Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogClose />
          <DialogHeader>
            <DialogTitle>{t('brand_create_modal_title')}</DialogTitle>
            <DialogDescription>
              {t('brand_create_modal_description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="brand-name">{t('brand_create_modal_label')}</Label>
              <Input
                id="brand-name"
                placeholder={t('brand_create_modal_placeholder')}
                value={brandName}
                onChange={e => setBrandName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && brandName.trim()) {
                    void handleCreateBrand();
                  }
                }}
                disabled={isCreating}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsModalOpen(false);
                  setBrandName('');
                }}
                disabled={isCreating}
              >
                {t('brand_create_cancel')}
              </Button>
              <Button
                onClick={() => void handleCreateBrand()}
                disabled={!brandName.trim() || isCreating}
                className="bg-gray-600 text-white hover:bg-gray-700"
              >
                {isCreating ? 'Creating...' : t('brand_create_button')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
