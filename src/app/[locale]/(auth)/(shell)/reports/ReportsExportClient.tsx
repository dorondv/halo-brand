'use client';

import { format } from 'date-fns';
import { he as dfHe } from 'date-fns/locale';
import {
  BarChart3,
  Calendar as CalendarIcon,
  CheckCircle2,
  Download,
  Facebook,
  FileSpreadsheet,
  FileText,
  Instagram,
  LineChart,
  Linkedin,
  Loader2,
  Settings,
  TrendingUp,
  Youtube,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { useBrand } from '@/contexts/BrandContext';
import { cn } from '@/libs/cn';
import { createSupabaseBrowserClient } from '@/libs/SupabaseBrowser';

// Custom icon components
const XIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="currentColor"
    {...props}
  >
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const TikTokIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="currentColor"
    {...props}
  >
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
  </svg>
);

type ReportType = 'comprehensive' | 'engagement' | 'growth' | 'posts';
type ExportFormat = 'pdf' | 'excel' | 'csv';
type Platform = 'x' | 'facebook' | 'instagram' | 'tiktok' | 'youtube' | 'linkedin';

export function ReportsExportClient() {
  const t = useTranslations('ReportsExport');
  const locale = useLocale();
  const isRTL = locale === 'he';
  const { selectedBrandId } = useBrand();
  const { showToast } = useToast();

  // Platform configurations with translated names
  const platformConfigs: Record<Platform, { name: string; icon: React.ComponentType<React.SVGProps<SVGSVGElement>> }> = useMemo(() => ({
    x: { name: 'X', icon: XIcon },
    facebook: { name: 'Facebook', icon: Facebook },
    instagram: { name: 'Instagram', icon: Instagram },
    tiktok: { name: 'TikTok', icon: TikTokIcon },
    youtube: { name: 'YouTube', icon: Youtube },
    linkedin: { name: 'LinkedIn', icon: Linkedin },
  }), []);

  const [reportType, setReportType] = useState<ReportType>(() => 'comprehensive');
  const [exportFormat, setExportFormat] = useState<ExportFormat>(() => 'pdf');
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<Platform>>(() => new Set());
  const [reportName, setReportName] = useState(() => '');
  const [dateFrom, setDateFrom] = useState(() => format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [dateRangePreset, setDateRangePreset] = useState<string | null>(() => null);
  const [isExporting, setIsExporting] = useState(() => false);
  const [connectedPlatforms, setConnectedPlatforms] = useState<Set<string>>(() => new Set());
  const [isLoadingPlatforms, setIsLoadingPlatforms] = useState(() => true);

  // Create stable string representation of selected platforms for useEffect dependency
  const selectedPlatformsKey = useMemo(() => {
    return Array.from(selectedPlatforms).sort().join(',');
  }, [selectedPlatforms]);

  const formatDateForDisplay = (dateStr: string) => {
    const date = new Date(dateStr);
    return format(date, 'dd/MM/yyyy', { locale: isRTL ? dfHe : undefined });
  };

  const getReportTypeLabel = (type: ReportType) => {
    switch (type) {
      case 'comprehensive':
        return t('report_type_comprehensive');
      case 'engagement':
        return t('report_type_engagement');
      case 'growth':
        return t('report_type_growth');
      case 'posts':
        return t('report_type_posts');
    }
  };

  const getFormatLabel = (format: ExportFormat) => {
    switch (format) {
      case 'pdf':
        return t('format_pdf');
      case 'excel':
        return t('format_excel');
      case 'csv':
        return t('format_csv');
    }
  };

  const handleDateRangePreset = (preset: string) => {
    setDateRangePreset(preset);
    const today = new Date();
    let fromDate: Date;
    let toDate = new Date();

    switch (preset) {
      case 'last7':
        fromDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'last30':
        fromDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'previousMonth': {
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        fromDate = new Date(firstDayOfMonth.getTime() - 1);
        fromDate = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);
        toDate = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
      }
      default:
        return;
    }

    setDateFrom(format(fromDate, 'yyyy-MM-dd'));
    setDateTo(format(toDate, 'yyyy-MM-dd'));
  };

  // Fetch connected platforms
  useEffect(() => {
    const loadConnectedPlatforms = async () => {
      setIsLoadingPlatforms(true);
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          setConnectedPlatforms(new Set());
          setIsLoadingPlatforms(false);
          return;
        }

        // Get user ID from users table
        const { data: userRecord } = await supabase
          .from('users')
          .select('id')
          .eq('email', session.user.email)
          .maybeSingle();

        const userId = userRecord?.id || session.user.id;

        // Build query
        let accountsQuery = supabase
          .from('social_accounts')
          .select('platform')
          .eq('user_id', userId)
          .eq('is_active', true);

        // Filter by brand if selected
        if (selectedBrandId) {
          accountsQuery = accountsQuery.eq('brand_id', selectedBrandId);
        }

        const { data: accountsData } = await accountsQuery;

        if (accountsData && accountsData.length > 0) {
          const platformSet = new Set<string>();
          accountsData.forEach((acc) => {
            const platform = (acc.platform || '').toLowerCase();
            // Normalize platform names (twitter/x -> x, etc.)
            if (platform === 'twitter' || platform === 'x') {
              platformSet.add('x');
            } else if (platform === 'facebook') {
              platformSet.add('facebook');
            } else if (platform === 'instagram') {
              platformSet.add('instagram');
            } else if (platform === 'linkedin') {
              platformSet.add('linkedin');
            } else if (platform === 'tiktok') {
              platformSet.add('tiktok');
            } else if (platform === 'youtube') {
              platformSet.add('youtube');
            }
          });
          setConnectedPlatforms(platformSet);
        } else {
          setConnectedPlatforms(new Set());
        }
      } catch (error) {
        console.error('Error loading connected platforms:', error);
        setConnectedPlatforms(new Set());
      } finally {
        setIsLoadingPlatforms(false);
      }
    };

    loadConnectedPlatforms();
  }, [selectedBrandId]);

  const togglePlatform = (platform: Platform) => {
    // Only allow toggling if platform is connected
    if (!connectedPlatforms.has(platform)) {
      return;
    }

    const newSet = new Set(selectedPlatforms);
    if (newSet.has(platform)) {
      newSet.delete(platform);
    } else {
      newSet.add(platform);
    }
    setSelectedPlatforms(newSet);
  };

  const handleExport = async () => {
    if (selectedPlatforms.size === 0) {
      showToast(t('select_at_least_one_platform'), 'error');
      return;
    }

    setIsExporting(true);

    try {
      const response = await fetch('/api/reports/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reportType,
          exportFormat,
          selectedPlatforms: Array.from(selectedPlatforms),
          reportName: reportName || undefined,
          dateFrom,
          dateTo,
          brandId: selectedBrandId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to export report');
      }

      // Get the file blob
      const blob = await response.blob();

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      let fileName = `report-${dateFrom}-${dateTo}`;
      if (contentDisposition) {
        const fileNameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (fileNameMatch && fileNameMatch[1]) {
          fileName = decodeURIComponent(fileNameMatch[1].replace(/['"]/g, ''));
        }
      }

      // Add extension if not present
      const extension = exportFormat === 'pdf' ? '.pdf' : exportFormat === 'excel' ? '.xlsx' : '.csv';
      if (!fileName.endsWith(extension)) {
        fileName += extension;
      }

      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      showToast(t('export_success_desc', { format: getFormatLabel(exportFormat) }), 'success');
    } catch (error) {
      console.error('Export error:', error);
      showToast(
        error instanceof Error ? error.message : t('export_error_desc'),
        'error',
      );
    } finally {
      setIsExporting(false);
    }
  };

  // Auto-generate report name based on selections
  useEffect(() => {
    // Get report type label
    let reportTypeLabel = '';
    switch (reportType) {
      case 'comprehensive':
        reportTypeLabel = t('report_type_comprehensive');
        break;
      case 'engagement':
        reportTypeLabel = t('report_type_engagement');
        break;
      case 'growth':
        reportTypeLabel = t('report_type_growth');
        break;
      case 'posts':
        reportTypeLabel = t('report_type_posts');
        break;
    }

    // Format dates based on locale
    const fromDate = new Date(dateFrom);
    const toDate = new Date(dateTo);

    // Check if it's a single month
    const isSameMonth = fromDate.getMonth() === toDate.getMonth() && fromDate.getFullYear() === toDate.getFullYear();
    const isSameYear = fromDate.getFullYear() === toDate.getFullYear();

    let dateRangeStr = '';
    if (isSameMonth) {
      // Single month: "January 2024" or "ינואר 2024"
      if (isRTL) {
        dateRangeStr = format(fromDate, 'MMMM yyyy', { locale: dfHe });
      } else {
        dateRangeStr = format(fromDate, 'MMMM yyyy');
      }
    } else if (isSameYear) {
      // Same year, different months: "January - February 2024"
      if (isRTL) {
        dateRangeStr = `${format(fromDate, 'MMMM', { locale: dfHe })} - ${format(toDate, 'MMMM yyyy', { locale: dfHe })}`;
      } else {
        dateRangeStr = `${format(fromDate, 'MMMM')} - ${format(toDate, 'MMMM yyyy')}`;
      }
    } else {
      // Different years: "January 2024 - February 2025"
      if (isRTL) {
        dateRangeStr = `${format(fromDate, 'MMMM yyyy', { locale: dfHe })} - ${format(toDate, 'MMMM yyyy', { locale: dfHe })}`;
      } else {
        dateRangeStr = `${format(fromDate, 'MMMM yyyy')} - ${format(toDate, 'MMMM yyyy')}`;
      }
    }

    // Add platform names if only a few are selected
    let platformStr = '';
    if (selectedPlatforms.size > 0 && selectedPlatforms.size <= 3) {
      const platformNames = Array.from(selectedPlatforms)
        .map(p => platformConfigs[p as Platform]?.name || p)
        .join(', ');
      platformStr = ` - ${platformNames}`;
    }

    // Generate name: "Report Type - Date Range - Platforms"
    const generatedName = `${reportTypeLabel} - ${dateRangeStr}${platformStr}`;
    // Use functional update to avoid direct setState in useEffect warning
    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
    setReportName((prev) => {
      // Only update if the name actually changed to avoid unnecessary re-renders
      return prev !== generatedName ? generatedName : prev;
    });
  }, [reportType, dateFrom, dateTo, selectedPlatformsKey, isRTL, t, platformConfigs, selectedPlatforms]);

  return (
    <div className={cn('space-y-6', isRTL && 'rtl')} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className={cn('space-y-2', isRTL && 'text-right')}>
        <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
        <p className="text-lg text-gray-600">{t('subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Left Column - Main Options */}
        <div className="space-y-6 lg:col-span-3">
          {/* Report Type Selection */}
          <Card>
            <CardHeader>
              <CardTitle className={cn(isRTL && 'text-right')}>{t('report_type_title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Comprehensive Report */}
                <button
                  type="button"
                  onClick={() => setReportType('comprehensive')}
                  className={cn(
                    'group relative rounded-lg border-2 p-4 text-right transition-all hover:shadow-md',
                    reportType === 'comprehensive'
                      ? 'border-pink-500 bg-pink-50 shadow-md'
                      : 'border-gray-200 bg-white hover:border-pink-200',
                    isRTL && 'text-right',
                  )}
                >
                  <div className={cn('flex items-start gap-3', isRTL ? 'flex-row-reverse' : 'flex-row')}>
                    <div className={cn('rounded-lg bg-pink-100 p-2', reportType === 'comprehensive' && 'bg-pink-500')}>
                      <BarChart3 className={cn('h-5 w-5', reportType === 'comprehensive' ? 'text-white' : 'text-pink-600')} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{t('report_type_comprehensive')}</h3>
                      <p className="mt-1 text-sm text-gray-600">{t('report_type_comprehensive_desc')}</p>
                    </div>
                  </div>
                </button>

                {/* Engagement Report */}
                <button
                  type="button"
                  onClick={() => setReportType('engagement')}
                  className={cn(
                    'group relative rounded-lg border-2 p-4 text-right transition-all hover:shadow-md',
                    reportType === 'engagement'
                      ? 'border-pink-500 bg-pink-50 shadow-md'
                      : 'border-gray-200 bg-white hover:border-pink-200',
                    isRTL && 'text-right',
                  )}
                >
                  <div className={cn('flex items-start gap-3', isRTL ? 'flex-row-reverse' : 'flex-row')}>
                    <div className={cn('rounded-lg bg-pink-100 p-2', reportType === 'engagement' && 'bg-pink-500')}>
                      <LineChart className={cn('h-5 w-5', reportType === 'engagement' ? 'text-white' : 'text-pink-600')} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{t('report_type_engagement')}</h3>
                      <p className="mt-1 text-sm text-gray-600">{t('report_type_engagement_desc')}</p>
                    </div>
                  </div>
                </button>

                {/* Growth Report */}
                <button
                  type="button"
                  onClick={() => setReportType('growth')}
                  className={cn(
                    'group relative rounded-lg border-2 p-4 text-right transition-all hover:shadow-md',
                    reportType === 'growth'
                      ? 'border-pink-500 bg-pink-50 shadow-md'
                      : 'border-gray-200 bg-white hover:border-pink-200',
                    isRTL && 'text-right',
                  )}
                >
                  <div className={cn('flex items-start gap-3', isRTL ? 'flex-row-reverse' : 'flex-row')}>
                    <div className={cn('rounded-lg bg-pink-100 p-2', reportType === 'growth' && 'bg-pink-500')}>
                      <TrendingUp className={cn('h-5 w-5', reportType === 'growth' ? 'text-white' : 'text-pink-600')} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{t('report_type_growth')}</h3>
                      <p className="mt-1 text-sm text-gray-600">{t('report_type_growth_desc')}</p>
                    </div>
                  </div>
                </button>

                {/* Posts Report */}
                <button
                  type="button"
                  onClick={() => setReportType('posts')}
                  className={cn(
                    'group relative rounded-lg border-2 p-4 text-right transition-all hover:shadow-md',
                    reportType === 'posts'
                      ? 'border-pink-500 bg-pink-50 shadow-md'
                      : 'border-gray-200 bg-white hover:border-pink-200',
                    isRTL && 'text-right',
                  )}
                >
                  <div className={cn('flex items-start gap-3', isRTL ? 'flex-row-reverse' : 'flex-row')}>
                    <div className={cn('rounded-lg bg-pink-100 p-2', reportType === 'posts' && 'bg-pink-500')}>
                      <FileText className={cn('h-5 w-5', reportType === 'posts' ? 'text-white' : 'text-pink-600')} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{t('report_type_posts')}</h3>
                      <p className="mt-1 text-sm text-gray-600">{t('report_type_posts_desc')}</p>
                    </div>
                  </div>
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Platform Selection */}
          <Card>
            <CardHeader>
              <CardTitle className={cn(isRTL && 'text-right')}>{t('platform_selection_title')}</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingPlatforms
                ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-pink-500" />
                    </div>
                  )
                : connectedPlatforms.size === 0
                  ? (
                      <div className={cn('rounded-lg border border-gray-200 bg-gray-50 p-6 text-center', isRTL && 'text-right')}>
                        <p className="text-sm text-gray-600">{t('no_connected_platforms')}</p>
                      </div>
                    )
                  : (
                      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                        {(Object.keys(platformConfigs) as Platform[]).map((platform) => {
                          const config = platformConfigs[platform];
                          const Icon = config.icon;
                          const isConnected = connectedPlatforms.has(platform);
                          const isSelected = selectedPlatforms.has(platform);

                          if (!isConnected) {
                            return null; // Don't show unconnected platforms
                          }

                          return (
                            <button
                              key={platform}
                              type="button"
                              onClick={() => togglePlatform(platform)}
                              disabled={!isConnected}
                              className={cn(
                                'group relative rounded-lg border-2 p-4 text-center transition-all hover:shadow-md',
                                isSelected
                                  ? 'border-pink-500 bg-pink-50 shadow-md'
                                  : 'border-gray-200 bg-white hover:border-pink-200',
                                !isConnected && 'opacity-50 cursor-not-allowed',
                              )}
                            >
                              <div className="flex flex-col items-center gap-2">
                                <div className={cn('rounded-lg bg-gray-100 p-2', isSelected && 'bg-pink-500')}>
                                  <Icon className={cn('h-6 w-6', isSelected ? 'text-white' : 'text-gray-600')} />
                                </div>
                                <div>
                                  <h3 className="text-sm font-semibold text-gray-900">{config.name}</h3>
                                  <div className="mt-1 flex items-center justify-center gap-1">
                                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                                    <p className="text-xs text-green-600">{t('platform_connected')}</p>
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
            </CardContent>
          </Card>

          {/* Date Range */}
          <Card>
            <CardHeader>
              <CardTitle className={cn(isRTL && 'text-right')}>{t('date_range_title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Preset Buttons */}
              <div className={cn('flex flex-wrap gap-2', isRTL && 'flex-row-reverse')}>
                <Button
                  type="button"
                  variant={dateRangePreset === 'last7' ? 'default' : 'outline'}
                  onClick={() => handleDateRangePreset('last7')}
                  className={dateRangePreset === 'last7' ? 'bg-pink-500 text-white hover:bg-pink-600' : ''}
                >
                  {t('date_range_last_7')}
                </Button>
                <Button
                  type="button"
                  variant={dateRangePreset === 'last30' ? 'default' : 'outline'}
                  onClick={() => handleDateRangePreset('last30')}
                  className={dateRangePreset === 'last30' ? 'bg-pink-500 text-white hover:bg-pink-600' : ''}
                >
                  {t('date_range_last_30')}
                </Button>
                <Button
                  type="button"
                  variant={dateRangePreset === 'previousMonth' ? 'default' : 'outline'}
                  onClick={() => handleDateRangePreset('previousMonth')}
                  className={dateRangePreset === 'previousMonth' ? 'bg-pink-500 text-white hover:bg-pink-600' : ''}
                >
                  {t('date_range_previous_month')}
                </Button>
              </div>

              {/* Date Inputs */}
              <div className={cn('grid grid-cols-1 gap-4 md:grid-cols-2', isRTL && 'flex-row-reverse')}>
                <div className="space-y-2">
                  <label htmlFor="date-from" className={cn('block text-sm font-medium text-gray-700', isRTL && 'text-right')}>
                    {t('date_from')}
                  </label>
                  <div className="relative">
                    <CalendarIcon className={cn('absolute top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400', isRTL ? 'right-3' : 'left-3')} />
                    <Input
                      id="date-from"
                      type="date"
                      value={dateFrom}
                      onChange={(e) => {
                        setDateFrom(e.target.value);
                        setDateRangePreset(null);
                      }}
                      className={cn('w-full', isRTL ? 'pr-9' : 'pl-9', isRTL && 'text-right')}
                      dir={isRTL ? 'rtl' : 'ltr'}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label htmlFor="date-to" className={cn('block text-sm font-medium text-gray-700', isRTL && 'text-right')}>
                    {t('date_to')}
                  </label>
                  <div className="relative">
                    <CalendarIcon className={cn('absolute top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400', isRTL ? 'right-3' : 'left-3')} />
                    <Input
                      id="date-to"
                      type="date"
                      value={dateTo}
                      onChange={(e) => {
                        setDateTo(e.target.value);
                        setDateRangePreset(null);
                      }}
                      className={cn('w-full', isRTL ? 'pr-9' : 'pl-9', isRTL && 'text-right')}
                      dir={isRTL ? 'rtl' : 'ltr'}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Export Settings & Preview */}
        <div className="space-y-6 lg:col-span-2">
          {/* Export Settings */}
          <Card>
            <CardHeader>
              <CardTitle className={cn(isRTL && 'text-right')}>{t('export_settings_title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Report Name */}
              <div className="space-y-2">
                <label htmlFor="report-name" className={cn('block text-sm font-medium text-gray-700', isRTL && 'text-right')}>
                  {t('report_name_label')}
                </label>
                <Input
                  id="report-name"
                  type="text"
                  placeholder={t('report_name_placeholder')}
                  value={reportName}
                  onChange={e => setReportName(e.target.value)}
                  className={cn('w-full', isRTL && 'text-right')}
                  dir={isRTL ? 'rtl' : 'ltr'}
                />
              </div>

              {/* Export Format */}
              <div className="space-y-3">
                <h3 className={cn('text-sm font-medium text-gray-700', isRTL && 'text-right')}>{t('export_format_title')}</h3>
                <div className="grid grid-cols-1 gap-3">
                  {/* PDF */}
                  <button
                    type="button"
                    onClick={() => setExportFormat('pdf')}
                    className={cn(
                      'group relative rounded-lg border-2 p-4 text-right transition-all hover:shadow-md',
                      exportFormat === 'pdf'
                        ? 'border-pink-500 bg-pink-50 shadow-md'
                        : 'border-gray-200 bg-white hover:border-pink-200',
                      isRTL && 'text-right',
                    )}
                  >
                    <div className={cn('flex items-start gap-3', isRTL ? 'flex-row-reverse' : 'flex-row')}>
                      <div className={cn('rounded-lg bg-pink-100 p-2', exportFormat === 'pdf' && 'bg-pink-500')}>
                        <FileText className={cn('h-5 w-5', exportFormat === 'pdf' ? 'text-white' : 'text-pink-600')} />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{t('format_pdf')}</h3>
                        <p className="mt-1 text-xs text-gray-600">{t('format_pdf_desc')}</p>
                      </div>
                    </div>
                  </button>

                  {/* Excel */}
                  <button
                    type="button"
                    onClick={() => setExportFormat('excel')}
                    className={cn(
                      'group relative rounded-lg border-2 p-4 text-right transition-all hover:shadow-md',
                      exportFormat === 'excel'
                        ? 'border-pink-500 bg-pink-50 shadow-md'
                        : 'border-gray-200 bg-white hover:border-pink-200',
                      isRTL && 'text-right',
                    )}
                  >
                    <div className={cn('flex items-start gap-3', isRTL ? 'flex-row-reverse' : 'flex-row')}>
                      <div className={cn('rounded-lg bg-pink-100 p-2', exportFormat === 'excel' && 'bg-pink-500')}>
                        <FileSpreadsheet className={cn('h-5 w-5', exportFormat === 'excel' ? 'text-white' : 'text-pink-600')} />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{t('format_excel')}</h3>
                        <p className="mt-1 text-xs text-gray-600">{t('format_excel_desc')}</p>
                      </div>
                    </div>
                  </button>

                  {/* CSV */}
                  <button
                    type="button"
                    onClick={() => setExportFormat('csv')}
                    className={cn(
                      'group relative rounded-lg border-2 p-4 text-right transition-all hover:shadow-md',
                      exportFormat === 'csv'
                        ? 'border-pink-500 bg-pink-50 shadow-md'
                        : 'border-gray-200 bg-white hover:border-pink-200',
                      isRTL && 'text-right',
                    )}
                  >
                    <div className={cn('flex items-start gap-3', isRTL ? 'flex-row-reverse' : 'flex-row')}>
                      <div className={cn('rounded-lg bg-pink-100 p-2', exportFormat === 'csv' && 'bg-pink-500')}>
                        <Settings className={cn('h-5 w-5', exportFormat === 'csv' ? 'text-white' : 'text-pink-600')} />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{t('format_csv')}</h3>
                        <p className="mt-1 text-xs text-gray-600">{t('format_csv_desc')}</p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Export Button */}
              <Button
                onClick={handleExport}
                disabled={isExporting}
                className={cn('w-full bg-pink-500 text-white hover:bg-pink-600', isRTL && 'flex-row-reverse')}
                size="lg"
              >
                {isExporting
                  ? (
                      <>
                        <Loader2 className={cn('h-5 w-5 animate-spin', isRTL ? 'ml-2' : 'mr-2')} />
                        {t('exporting')}
                      </>
                    )
                  : (
                      <>
                        <Download className={cn('h-5 w-5', isRTL ? 'ml-2' : 'mr-2')} />
                        {t('export_button')}
                      </>
                    )}
              </Button>
              <p className={cn('text-xs text-gray-500', isRTL && 'text-right')}>{t('select_at_least_one_platform')}</p>
            </CardContent>
          </Card>

          {/* Preview */}
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className={cn(isRTL && 'text-right')}>{t('preview_title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className={cn('space-y-3', isRTL && 'text-right')}>
                <div>
                  <p className="text-sm font-medium text-gray-700">{t('preview_report_type')}</p>
                  <p className="mt-1 text-sm text-gray-900">{getReportTypeLabel(reportType)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">{t('preview_period')}</p>
                  <p className="mt-1 text-sm text-gray-900">
                    {isRTL
                      ? `${formatDateForDisplay(dateTo)}-${formatDateForDisplay(dateFrom)}`
                      : `${formatDateForDisplay(dateFrom)}-${formatDateForDisplay(dateTo)}`}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">{t('preview_platforms')}</p>
                  <p className="mt-1 text-sm text-gray-900">
                    {selectedPlatforms.size > 0
                      ? (
                          <span>
                            {selectedPlatforms.size}
                            {' '}
                            {selectedPlatforms.size === 1
                              ? t('platform')
                              : t('platforms')}
                          </span>
                        )
                      : t('preview_no_platforms')}
                  </p>
                  {selectedPlatforms.size > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {Array.from(selectedPlatforms).map((platform) => {
                        const config = platformConfigs[platform as Platform];
                        return (
                          <span
                            key={platform}
                            className="inline-flex items-center rounded-full bg-pink-100 px-2 py-0.5 text-xs font-medium text-pink-800"
                          >
                            {config?.name || platform}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">{t('preview_format')}</p>
                  <p className="mt-1 text-sm text-gray-900">{getFormatLabel(exportFormat)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
