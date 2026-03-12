'use client';

import { Building2, CheckCircle2, Plus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
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
import { useBrand } from '@/contexts/BrandContext';
import { cn } from '@/libs/cn';
import { createSupabaseBrowserClient } from '@/libs/SupabaseBrowser';

type Brand = {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
};

export function BrandSelector() {
  const t = useTranslations('Common');
  const tIntegrations = useTranslations('Integrations');
  const locale = useLocale();
  const isRTL = locale === 'he';
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { selectedBrandId, setSelectedBrandId } = useBrand();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isUpdatingUrlRef = useRef(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [brandName, setBrandName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [brandLogoFile, setBrandLogoFile] = useState<File | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  const fetchBrands = async () => {
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return;
      }

      // Get or create user in users table
      const { data: userRecord } = await supabase
        .from('users')
        .select('id')
        .eq('email', user.email)
        .maybeSingle();

      let userId = userRecord?.id;

      // If user doesn't exist in users table, create it
      if (!userId) {
        const { data: newUser } = await supabase
          .from('users')
          .insert([
            {
              id: user.id,
              email: user.email || '',
              name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
              plan: 'free',
              is_active: true,
            },
          ])
          .select('id')
          .single();

        userId = newUser?.id || user.id;
      }

      // Fetch brands for this user
      const { data, error } = await supabase
        .from('brands')
        .select('id,name,description,logo_url')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('Error fetching brands:', error.message || error.code || error);
      } else {
        setBrands(data || []);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error fetching brands:', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchBrands();
  }, []);

  // Sync URL params with context on mount (URL takes precedence for initial load)
  useEffect(() => {
    const brandParam = searchParams.get('brand');
    const pagesThatUseBrand = ['/dashboard', '/create-post', '/calendar', '/inbox'];
    const shouldSyncURL = pagesThatUseBrand.some(page => pathname.includes(page));

    if (brandParam && brandParam !== 'all') {
      // URL has brand param (and it's not "all") - sync to context
      if (selectedBrandId !== brandParam) {
        setSelectedBrandId(brandParam);
      }
    } else if (brandParam === 'all') {
      // URL explicitly has "all" - sync to null in context
      if (selectedBrandId !== null) {
        setSelectedBrandId(null);
      }
    } else if (shouldSyncURL && selectedBrandId !== null) {
      // No brand param in URL but we have a selected brand in context - sync to URL
      // This ensures URL always reflects the current selection
      const params = new URLSearchParams(searchParams.toString());
      params.set('brand', selectedBrandId);
      const queryString = params.toString();
      const url = queryString ? `${pathname}?${queryString}` : pathname;
      router.replace(url, { scroll: false });
    }
    // Note: If no brand param and selectedBrandId is null, that's "all brands" - don't add param to URL
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  // Only sync URL when user explicitly changes brand (not on every context change)
  // This prevents unnecessary requests to pages the user isn't on
  const handleBrandChange = (brandId: string) => {
    // Prevent duplicate URL updates
    if (isUpdatingUrlRef.current) {
      return;
    }

    const normalizedBrandId = brandId === 'all' ? null : brandId;
    setSelectedBrandId(normalizedBrandId);

    // Only update URL if we're on a page that uses brand parameter
    // Pages that use brand: dashboard, create-post, calendar, etc.
    const pagesThatUseBrand = ['/dashboard', '/create-post', '/calendar', '/inbox'];
    const shouldUpdateURL = pagesThatUseBrand.some(page => pathname.includes(page));

    if (shouldUpdateURL) {
      const params = new URLSearchParams(searchParams.toString());
      const currentBrandParam = searchParams.get('brand');

      // Only update URL if it actually changed
      // This prevents unnecessary router.replace() calls that cause duplicate requests
      // Compare: current param vs what the new param should be (null for "all", brandId otherwise)
      const currentBrandValue = currentBrandParam === 'all' ? null : currentBrandParam;
      const newBrandValue = brandId === 'all' ? null : brandId;

      if (currentBrandValue !== newBrandValue) {
        isUpdatingUrlRef.current = true;

        // Remove brand param for "all brands", set it for specific brands
        if (brandId === 'all') {
          params.delete('brand');
        } else {
          params.set('brand', brandId);
        }
        const queryString = params.toString();
        const url = queryString ? `${pathname}?${queryString}` : pathname;
        // router.replace() automatically triggers a server component refresh in Next.js 16
        // No need to call router.refresh() separately
        router.replace(url, { scroll: false });
        // Reset the flag after a short delay to allow navigation to complete
        setTimeout(() => {
          isUpdatingUrlRef.current = false;
        }, 200);
      }
    }
    // DashboardWrapper will handle URL sync for dashboard page
  };

  const handleCreateBrand = async () => {
    if (!brandName.trim()) {
      return;
    }

    // Check brand limit before creating
    try {
      const limitsResponse = await fetch('/api/subscriptions/limits');
      if (limitsResponse.ok) {
        const limitsData = await limitsResponse.json();
        if (limitsData.limits && limitsData.usage) {
          if (!limitsData.canCreateBrand) {
            // eslint-disable-next-line no-alert
            alert(
              limitsData.limits.maxBrands === 1
                ? 'You\'ve reached your brand limit. Upgrade your plan to create more brands.'
                : `You've reached your brand limit (${limitsData.limits.maxBrands}). Upgrade your plan to create more brands.`,
            );
            return;
          }
        }
      }
    } catch (error) {
      console.error('Error checking limits:', error);
      // Continue with brand creation attempt even if limit check fails
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

      // Get user ID
      const { data: userRecord } = await supabase
        .from('users')
        .select('id')
        .eq('email', session.user.email)
        .maybeSingle();

      const userId = userRecord?.id || session.user.id;

      let logoUrl: string | null = null;

      // Upload logo if provided
      if (brandLogoFile) {
        setIsUploadingLogo(true);
        try {
          // Validate file type (only images)
          if (!brandLogoFile.type.startsWith('image/')) {
            throw new Error('Please upload an image file');
          }

          // Validate file size (5MB limit)
          const maxSize = 5 * 1024 * 1024; // 5MB
          if (brandLogoFile.size > maxSize) {
            throw new Error('Image size exceeds 5MB limit');
          }

          // Generate unique file name
          const fileExt = brandLogoFile.name.split('.').pop();
          const fileName = `${userId}/brands/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

          // Upload to Supabase Storage (using post-media bucket or create a brands bucket)
          const { error: uploadError } = await supabase.storage
            .from('post-media')
            .upload(fileName, brandLogoFile, {
              cacheControl: '3600',
              upsert: false,
            });

          if (uploadError) {
            console.error('Logo upload error:', uploadError);
            throw new Error(`Failed to upload logo: ${uploadError.message}`);
          }

          // Get public URL
          const { data: { publicUrl } } = supabase.storage
            .from('post-media')
            .getPublicUrl(fileName);

          logoUrl = publicUrl;
        } catch (error) {
          console.error('Error uploading logo:', error);
          // Continue with brand creation even if logo upload fails
        } finally {
          setIsUploadingLogo(false);
        }
      }

      // Create brand via API to handle Getlate profile automatically
      const brandResponse = await fetch('/api/brands', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: brandName.trim(),
          description: null,
          logo_url: logoUrl,
        }),
      });

      if (!brandResponse.ok) {
        const error = await brandResponse.json().catch(() => ({ error: 'Failed to create brand' }));
        console.error('Error creating brand:', error);
        throw new Error(error.error || 'Failed to create brand. Please try again.');
      }

      const { brand: data } = await brandResponse.json();

      // Refresh brands list
      await fetchBrands();
      // Select the newly created brand
      const normalizedBrandId = data.id === 'all' ? null : data.id;
      setSelectedBrandId(normalizedBrandId);
      handleBrandChange(data.id);
      // Close modal and reset form
      setIsModalOpen(false);
      setBrandName('');
      setBrandLogoFile(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error creating brand:', errorMessage);
      console.error(t('brand_create_error'));
    } finally {
      setIsCreating(false);
    }
  };

  const displayBrandId = selectedBrandId || 'all';
  const selectedBrand = brands.find(b => b.id === selectedBrandId);
  const displayValue = selectedBrandId === null || selectedBrandId === 'all'
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
        <Select value={displayBrandId} onValueChange={handleBrandChange}>
          <SelectTrigger id="brand" className="w-full">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Building2 className="h-4 w-4 shrink-0 text-gray-500" />
              <span className="truncate">
                <SelectValue selectedLabel={displayValue} placeholder={t('brand_selector_placeholder')} />
              </span>
            </div>
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
          <div className="space-y-6 rounded-xl border border-pink-200/50 bg-gradient-to-br from-pink-50 to-pink-100/50 p-6">
            <div className="space-y-2">
              <Label htmlFor="brand-name">{tIntegrations('brand_name')}</Label>
              <Input
                id="brand-name"
                placeholder={tIntegrations('brand_name_placeholder')}
                value={brandName}
                onChange={e => setBrandName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && brandName.trim() && !isCreating && !isUploadingLogo) {
                    void handleCreateBrand();
                  }
                }}
                className="bg-white"
                dir={isRTL ? 'rtl' : 'ltr'}
                disabled={isCreating || isUploadingLogo}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="brand-logo">{tIntegrations('logo_optional')}</Label>
              <div className="relative">
                <input
                  type="file"
                  id="brand-logo"
                  accept="image/*"
                  onChange={e => setBrandLogoFile(e.target.files?.[0] || null)}
                  className={cn(
                    'block w-full text-sm bg-white rounded-md border border-gray-300',
                    'file:border-0 file:bg-white file:text-gray-700 file:text-sm file:font-medium',
                    'file:cursor-pointer hover:file:bg-gray-50',
                    'text-gray-500',
                    isRTL ? 'file:ml-4 file:py-2 file:px-4' : 'file:mr-4 file:py-2 file:px-4',
                  )}
                  dir={isRTL ? 'rtl' : 'ltr'}
                  disabled={isCreating || isUploadingLogo}
                />
              </div>
            </div>
            <div className={cn('flex gap-3 pt-2', isRTL ? 'justify-start' : 'justify-end')}>
              <Button
                variant="outline"
                onClick={() => {
                  setIsModalOpen(false);
                  setBrandName('');
                  setBrandLogoFile(null);
                }}
                className="border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                disabled={isCreating || isUploadingLogo}
              >
                {tIntegrations('cancel')}
              </Button>
              <Button
                onClick={() => void handleCreateBrand()}
                className="bg-pink-600 text-white hover:bg-pink-700"
                disabled={!brandName.trim() || isCreating || isUploadingLogo}
              >
                {isRTL
                  ? (
                      <>
                        {tIntegrations('create_brand')}
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                      </>
                    )
                  : (
                      <>
                        <CheckCircle2 className="ml-2 h-4 w-4" />
                        {tIntegrations('create_brand')}
                      </>
                    )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
