'use client';

import { endOfMonth, format, startOfMonth, subMonths } from 'date-fns';
import { motion } from 'framer-motion';
import {
  CalendarIcon,
  Clock,
  ExternalLink,
  Heart,
  Lightbulb,
  MessageSquare,
  Share2,
  Star,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useBrand } from '@/contexts/BrandContext';
import { createSupabaseBrowserClient } from '@/libs/SupabaseBrowser';

type Post = {
  id: string;
  content: string;
  created_at: string;
  metadata?: any;
  platforms?: string[];
  platformPostUrl?: string | null;
  engagement?: {
    likes: number;
    comments: number;
    shares: number;
  };
};

type InsightsData = {
  timing: string[];
  content: string[];
  keywords: string[];
  strategy: string[];
};

export function InsightsClient() {
  const t = useTranslations('Insights');
  const locale = useLocale();
  const isRTL = locale === 'he';
  const { selectedBrandId } = useBrand();
  const [activeTab, setActiveTab] = useState('insights');
  const [posts, setPosts] = useState<Post[]>([]);
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);

  // Date range state - default to last month
  const getLastMonthRange = () => {
    const today = new Date();
    const lastMonth = subMonths(today, 1);
    return {
      startDate: startOfMonth(lastMonth),
      endDate: endOfMonth(lastMonth),
    };
  };

  const [dateRange, setDateRange] = useState(getLastMonthRange);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsLoading(false);
        return;
      }

      // Get user ID
      const { data: userRecord } = await supabase
        .from('users')
        .select('id')
        .eq('email', session.user.email)
        .maybeSingle();

      const userId = userRecord?.id || session.user.id;

      // Fetch posts with date range filter (default to last month)
      const startDateStr = format(dateRange.startDate, 'yyyy-MM-dd');
      const endDateStr = format(dateRange.endDate, 'yyyy-MM-dd');

      let postsQuery = supabase
        .from('posts')
        .select('id,content,created_at,metadata')
        .eq('user_id', userId)
        .in('status', ['published', 'scheduled', 'draft'])
        .gte('created_at', startDateStr)
        .lte('created_at', `${endDateStr}T23:59:59`)
        .order('created_at', { ascending: false });

      if (selectedBrandId) {
        postsQuery = postsQuery.eq('brand_id', selectedBrandId);
      }

      const { data: postsData } = await postsQuery;

      // Fetch analytics for posts to calculate engagement
      const postIds = postsData?.map(p => p.id) || [];
      let analyticsData: any[] = [];
      if (postIds.length > 0) {
        const { data: analytics } = await supabase
          .from('post_analytics')
          .select('post_id,likes,comments,shares,platform,date')
          .in('post_id', postIds)
          .order('date', { ascending: false });

        analyticsData = analytics || [];
      }

      // Combine posts with analytics and extract platform info
      // Get the maximum values per post per platform, then sum across platforms
      // This ensures we get the latest/cumulative engagement values
      const postsWithEngagement = (postsData || []).map((post) => {
        const postAnalytics = analyticsData.filter(a => a.post_id === post.id);

        // Extract platforms and platformPostUrl from post metadata
        let platforms: string[] = [];
        let platformPostUrl: string | null = null;

        // Extract from metadata.platforms array (Priority 1)
        if (post.metadata) {
          const metadata = post.metadata as any;

          // Check metadata.platformPostUrl directly
          if (metadata.platformPostUrl) {
            platformPostUrl = metadata.platformPostUrl;
          }

          // Check metadata.platforms array
          if (metadata.platforms && Array.isArray(metadata.platforms)) {
            const platformWithUrl = metadata.platforms.find((p: any) => p.platformPostUrl);
            if (platformWithUrl?.platformPostUrl) {
              platformPostUrl = platformWithUrl.platformPostUrl;
            }

            // Extract platform names
            platforms = metadata.platforms.map((p: any) => {
              if (typeof p === 'string') {
                return p.toLowerCase() === 'twitter' ? 'x' : p.toLowerCase();
              } else if (p && typeof p === 'object' && p.platform) {
                const platformName = p.platform.toLowerCase();
                return platformName === 'twitter' ? 'x' : platformName;
              }
              return null;
            }).filter((p: string | null): p is string => p !== null);
          }
        }

        // Extract from post_analytics if platforms not found
        if (platforms.length === 0 && postAnalytics.length > 0) {
          const uniquePlatforms = new Set<string>();
          postAnalytics.forEach((a) => {
            if (a.platform) {
              const platformName = a.platform.toLowerCase();
              uniquePlatforms.add(platformName === 'twitter' ? 'x' : platformName);
            }
          });
          platforms = Array.from(uniquePlatforms);
        }

        if (postAnalytics.length === 0) {
          return {
            ...post,
            platforms: platforms.length > 0 ? platforms : [],
            platformPostUrl,
            engagement: {
              likes: 0,
              comments: 0,
              shares: 0,
            },
          };
        }

        // Group by platform and get the maximum values per platform (latest/cumulative)
        const platformMap = new Map<string, { likes: number; comments: number; shares: number }>();

        for (const analytics of postAnalytics) {
          const platform = analytics.platform || 'unknown';
          const current = platformMap.get(platform) || { likes: 0, comments: 0, shares: 0 };

          // Take maximum values per platform (represents latest/cumulative totals)
          platformMap.set(platform, {
            likes: Math.max(current.likes, Number(analytics.likes) || 0),
            comments: Math.max(current.comments, Number(analytics.comments) || 0),
            shares: Math.max(current.shares, Number(analytics.shares) || 0),
          });
        }

        // Sum across all platforms to get total engagement for the post
        let totalLikes = 0;
        let totalComments = 0;
        let totalShares = 0;

        for (const values of platformMap.values()) {
          totalLikes += values.likes;
          totalComments += values.comments;
          totalShares += values.shares;
        }

        return {
          ...post,
          platforms: platforms.length > 0 ? platforms : [],
          platformPostUrl,
          engagement: {
            likes: totalLikes,
            comments: totalComments,
            shares: totalShares,
          },
        };
      });

      setPosts(postsWithEngagement);

      // Fetch social accounts
      let accountsQuery = supabase
        .from('social_accounts')
        .select('id,platform,account_name')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (selectedBrandId) {
        accountsQuery = accountsQuery.eq('brand_id', selectedBrandId);
      }

      // Accounts data fetched but not currently used in UI
      await accountsQuery;
    } catch (error) {
      console.error('Error loading data:', error);
    }
    setIsLoading(false);
  }, [selectedBrandId, dateRange.startDate, dateRange.endDate]);

  useEffect(() => {
    if (selectedBrandId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadData();
    }
  }, [selectedBrandId, loadData]);

  const generateInsights = async () => {
    setIsGeneratingInsights(true);
    try {
      const response = await fetch('/api/ai/insights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          brandId: selectedBrandId || undefined,
          locale,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setInsights(data);
      } else {
        console.error('Error generating insights');
      }
    } catch (error) {
      console.error('Error generating insights:', error);
    }
    setIsGeneratingInsights(false);
  };

  const currentInsights = insights;

  // Calculate best performing posts
  const bestPerformingPosts = posts
    .filter(post => post.engagement)
    .sort((a, b) => {
      const aScore = (a.engagement?.likes || 0) + (a.engagement?.comments || 0) * 2 + (a.engagement?.shares || 0) * 3;
      const bScore = (b.engagement?.likes || 0) + (b.engagement?.comments || 0) * 2 + (b.engagement?.shares || 0) * 3;
      return bScore - aScore;
    })
    .slice(0, 3);

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-pink-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className={`min-h-screen p-6 ${isRTL ? 'rtl' : 'ltr'}`}>
      <div className="mx-auto max-w-7xl space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center"
        >
          <div>
            <h1 className="bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-4xl font-bold text-transparent">
              {t('title')}
            </h1>
            <p className="mt-2 text-lg text-slate-500">{t('subtitle')}</p>
          </div>

          <Button
            onClick={generateInsights}
            disabled={isGeneratingInsights}
            className="bg-gradient-to-r from-pink-500 to-pink-600 text-white hover:from-pink-600 hover:to-pink-700"
          >
            {isGeneratingInsights
              ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    {t('generating_insights')}
                  </div>
                )
              : (
                  <>
                    <Zap className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                    {t('create_button')}
                  </>
                )}
          </Button>
        </motion.div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
          <TabsList className={`inline-flex h-auto items-center justify-start rounded-lg border-b border-gray-200 bg-transparent p-0 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <TabsTrigger
              value="insights"
              className={`rounded-none px-3 py-1.5 text-sm font-medium transition-all ${
                activeTab === 'insights'
                  ? 'border-b-2 border-pink-600 bg-white text-black'
                  : 'bg-transparent text-zinc-500 hover:text-zinc-700'
              }`}
            >
              {t('tab_insights')}
            </TabsTrigger>
            <TabsTrigger
              value="performance"
              className={`rounded-none px-3 py-1.5 text-sm font-medium transition-all ${
                activeTab === 'performance'
                  ? 'border-b-2 border-pink-600 bg-white text-black'
                  : 'bg-transparent text-zinc-500 hover:text-zinc-700'
              }`}
            >
              {t('tab_performance')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="insights" className="mt-6 space-y-6">
            {currentInsights
              ? (
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    {/* Timing Insights */}
                    <Card className="rounded-lg border border-gray-200 bg-white shadow-xl">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Clock className="h-5 w-5 text-blue-500" />
                          {t('publishing_timing_title')}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {currentInsights.timing?.map(tip => (
                          <div key={tip} className="flex items-start gap-3 rounded-lg bg-blue-50 p-3">
                            <Lightbulb className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-500" />
                            <p className="text-sm text-slate-700">{tip}</p>
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    {/* Content Insights */}
                    <Card className="rounded-lg border border-gray-200 bg-white shadow-xl">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <MessageSquare className="h-5 w-5 text-green-500" />
                          {t('content_types_title')}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {currentInsights.content?.map(tip => (
                          <div key={tip} className="flex items-start gap-3 rounded-lg bg-green-50 p-3">
                            <Target className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500" />
                            <p className="text-sm text-slate-700">{tip}</p>
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    {/* Keywords Insights */}
                    <Card className="rounded-lg border border-gray-200 bg-white shadow-xl">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Star className="h-5 w-5 text-yellow-500" />
                          {t('keywords_title')}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {currentInsights.keywords?.map(tip => (
                          <div key={tip} className="flex items-start gap-3 rounded-lg bg-yellow-50 p-3">
                            <Star className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-500" />
                            <p className="text-sm text-slate-700">{tip}</p>
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    {/* Strategy Insights */}
                    <Card className="rounded-lg border border-gray-200 bg-white shadow-xl">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <TrendingUp className="h-5 w-5 text-purple-500" />
                          {t('strategy_title')}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {currentInsights.strategy?.map(tip => (
                          <div key={tip} className="flex items-start gap-3 rounded-lg bg-purple-50 p-3">
                            <TrendingUp className="mt-0.5 h-5 w-5 flex-shrink-0 text-purple-500" />
                            <p className="text-sm text-slate-700">{tip}</p>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </div>
                )
              : (
                  <Card className="rounded-lg border border-gray-200 bg-white shadow-xl">
                    <CardContent className="py-12 text-center">
                      <Lightbulb className="mx-auto mb-4 h-16 w-16 text-gray-400" />
                      <p className="mb-4 text-lg font-medium text-slate-700">
                        {isRTL ? 'אין תובנות זמינות' : 'No insights available'}
                      </p>
                      <p className="mb-6 text-slate-500">
                        {isRTL
                          ? 'לחץ על הכפתור למעלה כדי ליצור תובנות מותאמות אישית'
                          : 'Click the button above to generate personalized insights'}
                      </p>
                      <Button
                        onClick={generateInsights}
                        disabled={isGeneratingInsights}
                        className="bg-gradient-to-r from-pink-500 to-pink-600 text-white hover:from-pink-600 hover:to-pink-700"
                      >
                        {isGeneratingInsights
                          ? (
                              <div className="flex items-center gap-2">
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                {t('generating_insights')}
                              </div>
                            )
                          : (
                              <>
                                <Zap className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                                {t('create_button')}
                              </>
                            )}
                      </Button>
                    </CardContent>
                  </Card>
                )}
          </TabsContent>

          <TabsContent value="performance" className="mt-6 space-y-6">
            <Card className="rounded-lg border border-gray-200 bg-white shadow-xl">
              <CardHeader>
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle>{t('best_posts_title')}</CardTitle>
                    <CardDescription>
                      {t('best_posts_description')}
                    </CardDescription>
                  </div>
                  <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={`w-full justify-start text-left font-normal md:w-auto ${isRTL ? 'flex-row-reverse' : ''}`}
                      >
                        <CalendarIcon className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                        {format(dateRange.startDate, 'MMM dd, yyyy')}
                        {' - '}
                        {format(dateRange.endDate, 'MMM dd, yyyy')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align={isRTL ? 'end' : 'start'}>
                      <div className="space-y-4 p-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">
                            {isRTL ? 'תאריך התחלה' : 'Start Date'}
                          </label>
                          <input
                            type="date"
                            value={format(dateRange.startDate, 'yyyy-MM-dd')}
                            onChange={(e) => {
                              const newDate = e.target.value ? new Date(e.target.value) : dateRange.startDate;
                              setDateRange(prev => ({ ...prev, startDate: newDate }));
                            }}
                            className="w-full rounded-md border px-3 py-2"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">
                            {isRTL ? 'תאריך סיום' : 'End Date'}
                          </label>
                          <input
                            type="date"
                            value={format(dateRange.endDate, 'yyyy-MM-dd')}
                            onChange={(e) => {
                              const newDate = e.target.value ? new Date(e.target.value) : dateRange.endDate;
                              setDateRange(prev => ({ ...prev, endDate: newDate }));
                            }}
                            className="w-full rounded-md border px-3 py-2"
                          />
                        </div>
                        <Button
                          onClick={() => setShowDatePicker(false)}
                          className="w-full"
                        >
                          {isRTL ? 'סגור' : 'Close'}
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {bestPerformingPosts.length > 0
                    ? (
                        bestPerformingPosts.map((post, index) => {
                          const primaryPlatform = post.platforms && post.platforms.length > 0
                            ? post.platforms[0]
                            : null;
                          const platformDisplayName = primaryPlatform
                            ? primaryPlatform.charAt(0).toUpperCase() + primaryPlatform.slice(1)
                            : null;

                          return (
                            <div key={post.id} className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white/50 p-4">
                              <Badge className="bg-pink-100 text-pink-700">
                                #
                                {index + 1}
                              </Badge>
                              <div className="flex-1">
                                <p className="line-clamp-2 font-medium text-slate-900">{post.content}</p>
                                <div className={`mt-2 flex items-center gap-4 text-sm text-slate-500 ${isRTL ? 'flex-row-reverse' : ''}`}>
                                  {platformDisplayName && (
                                    <div className="flex items-center gap-1">
                                      {post.platformPostUrl
                                        ? (
                                            <a
                                              href={post.platformPostUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="flex items-center gap-1 text-pink-600 hover:text-pink-700 hover:underline"
                                            >
                                              <span>{platformDisplayName}</span>
                                              <ExternalLink className="h-3 w-3" />
                                            </a>
                                          )
                                        : (
                                            <span>{platformDisplayName}</span>
                                          )}
                                    </div>
                                  )}
                                  <div className="flex items-center gap-1">
                                    <Heart className="h-4 w-4" />
                                    <span>{post.engagement?.likes || 0}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <MessageSquare className="h-4 w-4" />
                                    <span>{post.engagement?.comments || 0}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Share2 className="h-4 w-4" />
                                    <span>{post.engagement?.shares || 0}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )
                    : (
                        <div className="py-8 text-center text-slate-500">
                          <MessageSquare className="mx-auto mb-4 h-12 w-12 opacity-50" />
                          <p>{t('no_performance_data')}</p>
                        </div>
                      )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
