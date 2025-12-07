'use client';

import { format } from 'date-fns';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  Briefcase,
  ExternalLink,
  Facebook,
  Frown,
  Instagram,
  Linkedin,
  Loader2,
  Meh,
  MessageSquare,
  MessageSquareText,
  Smile,
  TrendingUp,
  Youtube,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useBrand } from '@/contexts/BrandContext';
import { createSupabaseBrowserClient } from '@/libs/SupabaseBrowser';

const XIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const TikTokIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
  </svg>
);

const platformDetails: Record<string, { icon: React.ComponentType<{ className?: string }>; name: string; color: string }> = {
  facebook: { icon: Facebook, name: 'Facebook', color: 'text-blue-600' },
  instagram: { icon: Instagram, name: 'Instagram', color: 'text-pink-500' },
  tiktok: { icon: TikTokIcon, name: 'TikTok', color: 'text-black' },
  youtube: { icon: Youtube, name: 'YouTube', color: 'text-red-600' },
  twitter: { icon: XIcon, name: 'X', color: 'text-gray-800' },
  x: { icon: XIcon, name: 'X', color: 'text-gray-800' },
  linkedin: { icon: Linkedin, name: 'LinkedIn', color: 'text-sky-700' },
};

const COLORS = {
  positive: '#22c55e',
  neutral: '#64748b',
  negative: '#ef4444',
  mixed: '#f59e0b',
};

const SENTIMENT_ICONS = {
  positive: <Smile className="h-5 w-5 text-green-500" />,
  negative: <Frown className="h-5 w-5 text-red-500" />,
  neutral: <Meh className="h-5 w-5 text-slate-500" />,
  mixed: <MessageSquare className="h-5 w-5 text-amber-500" />,
};

type Post = {
  id: string;
  content: string;
  created_at: string;
  platforms?: string[];
  engagement?: {
    likes: number;
    comments: number;
    shares: number;
    views?: number;
  };
  platformPostUrl?: string | null;
};

type AnalysisResult = {
  overall_sentiment?: 'positive' | 'negative' | 'neutral' | 'mixed';
  sentiment_distribution?: {
    positive?: number;
    negative?: number;
    neutral?: number;
    mixed?: number;
  };
  main_themes?: string[];
  common_emotions?: string[];
  recommendations?: string[];
  sample_comments?: Array<{
    text: string;
    sentiment: 'positive' | 'negative' | 'neutral';
    author: string;
  }>;
  engagement_score?: number;
};

export function PostSentimentClient() {
  const t = useTranslations('PostSentiment');
  const locale = useLocale();
  const isRTL = locale === 'he';
  const { selectedBrandId } = useBrand();
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState('all');
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!selectedBrandId) {
      setPosts([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsLoading(false);
        return;
      }

      const { data: userRecord } = await supabase
        .from('users')
        .select('id')
        .eq('email', session.user.email)
        .maybeSingle();

      const userId = userRecord?.id || session.user.id;

      // Fetch posts
      const postsQuery = supabase
        .from('posts')
        .select('id,content,created_at,platforms,metadata')
        .eq('user_id', userId)
        .eq('brand_id', selectedBrandId)
        .in('status', ['published', 'scheduled', 'draft'])
        .order('created_at', { ascending: false })
        .limit(50);

      const { data: postsData } = await postsQuery;

      // Fetch analytics for posts to calculate engagement
      const postIds = postsData?.map(p => p.id) || [];
      let analyticsData: any[] = [];
      if (postIds.length > 0) {
        const { data: analytics } = await supabase
          .from('post_analytics')
          .select('post_id,likes,comments,shares,metadata')
          .in('post_id', postIds);

        analyticsData = analytics || [];
      }

      // Combine posts with analytics
      const postsWithEngagement = (postsData || []).map((post) => {
        const postAnalytics = analyticsData.filter(a => a.post_id === post.id);
        const totalLikes = postAnalytics.reduce((sum, a) => sum + (a.likes || 0), 0);
        const totalComments = postAnalytics.reduce((sum, a) => sum + (a.comments || 0), 0);
        const totalShares = postAnalytics.reduce((sum, a) => sum + (a.shares || 0), 0);

        // Extract platformPostUrl from analytics metadata (Priority 1)
        let platformPostUrl: string | null = null;
        for (const analytics of postAnalytics) {
          if (analytics.metadata) {
            const metadata = analytics.metadata as any;
            if (metadata.platformPostUrl) {
              platformPostUrl = metadata.platformPostUrl;
              break;
            }
            // Also check nested platform objects
            if (metadata.platforms && Array.isArray(metadata.platforms)) {
              const platformWithUrl = metadata.platforms.find((p: any) => p.platformPostUrl);
              if (platformWithUrl?.platformPostUrl) {
                platformPostUrl = platformWithUrl.platformPostUrl;
                break;
              }
            }
          }
        }

        // Parse platforms if it's a string
        let platforms = post.platforms;
        if (typeof platforms === 'string') {
          try {
            platforms = JSON.parse(platforms);
          } catch {
            platforms = [];
          }
        }
        if (!Array.isArray(platforms)) {
          platforms = [];
        }

        // Extract platformPostUrl from post's platforms array (Priority 2)
        // This is where Getlate stores platformPostUrl in the original API response
        if (!platformPostUrl && platforms.length > 0) {
          for (const platformData of platforms) {
            // Handle both object and string formats
            const platformObj = typeof platformData === 'object' ? platformData : null;
            if (platformObj?.platformPostUrl) {
              platformPostUrl = platformObj.platformPostUrl;
              break; // Found it
            }
          }
          // If still not found, try the first platform's platformPostUrl regardless of match
          if (!platformPostUrl) {
            const firstPlatform = platforms[0];
            const firstPlatformObj = typeof firstPlatform === 'object' ? firstPlatform : null;
            if (firstPlatformObj?.platformPostUrl) {
              platformPostUrl = firstPlatformObj.platformPostUrl;
            }
          }
        }

        // Extract platformPostUrl from post's metadata (Priority 3)
        if (!platformPostUrl && post.metadata) {
          const postMetadata = post.metadata as any;
          if (postMetadata.platformPostUrl) {
            platformPostUrl = postMetadata.platformPostUrl;
          } else if (postMetadata.platforms && Array.isArray(postMetadata.platforms)) {
            // Check nested platforms in metadata
            for (const platformData of postMetadata.platforms) {
              const platformObj = typeof platformData === 'object' ? platformData : null;
              if (platformObj?.platformPostUrl) {
                platformPostUrl = platformObj.platformPostUrl;
                break;
              }
            }
          }
        }

        // Normalize platforms: extract platform name if it's an object, or use string directly
        const normalizedPlatforms = platforms.map((p: string | { platform?: string } | null) => {
          if (typeof p === 'string') {
            // Normalize platform names (twitter -> x)
            return p.toLowerCase() === 'twitter' ? 'x' : p.toLowerCase();
          } else if (p && typeof p === 'object' && p.platform) {
            // Extract platform from object
            const platformName = p.platform.toLowerCase();
            return platformName === 'twitter' ? 'x' : platformName;
          }
          return null;
        }).filter((p: string | null): p is string => p !== null);

        return {
          ...post,
          platforms: normalizedPlatforms.length > 0 ? normalizedPlatforms : ['instagram'], // Default to instagram
          engagement: {
            likes: totalLikes,
            comments: totalComments,
            shares: totalShares,
          },
          platformPostUrl,
        };
      });

      setPosts(postsWithEngagement);
    } catch (error) {
      console.error('Error loading data:', error);
      setPosts([]);
    }
    setIsLoading(false);
  }, [selectedBrandId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAnalyzePost = async (post: Post) => {
    if (!post) {
      return;
    }

    setSelectedPost(post);
    setIsAnalyzing(true);
    setError('');

    try {
      const platform = Array.isArray(post.platforms) && post.platforms.length > 0
        ? post.platforms[0]
        : 'instagram';

      const response = await fetch('/api/ai/post-sentiment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          postId: post.id,
          postContent: post.content,
          platform,
          engagement: post.engagement,
          locale,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || (isRTL ? 'שגיאה בניתוח הפוסט. אנא נסה שוב.' : 'Error analyzing post. Please try again.'));
      }

      const result = await response.json();
      setAnalysis(result);
    } catch (e) {
      console.error('Analysis failed:', e);
      setError(e instanceof Error ? e.message : (isRTL ? 'שגיאה בניתוח הפוסט. אנא נסה שוב.' : 'Error analyzing post. Please try again.'));
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Get all unique platforms from posts
  const availablePlatforms = useMemo(() => {
    const platformSet = new Set<string>();
    posts.forEach((post) => {
      if (Array.isArray(post.platforms)) {
        post.platforms.forEach(p => platformSet.add(p.toLowerCase()));
      }
    });
    // Sort platforms in a consistent order
    const platformOrder = ['instagram', 'facebook', 'x', 'twitter', 'linkedin', 'youtube', 'tiktok'];
    return Array.from(platformSet).sort((a, b) => {
      const aIndex = platformOrder.indexOf(a);
      const bIndex = platformOrder.indexOf(b);
      if (aIndex === -1 && bIndex === -1) {
        return a.localeCompare(b);
      }
      if (aIndex === -1) {
        return 1;
      }
      if (bIndex === -1) {
        return -1;
      }
      return aIndex - bIndex;
    });
  }, [posts]);

  const filteredPosts
    = selectedPlatform === 'all'
      ? posts
      : posts.filter((post) => {
          const postPlatforms = Array.isArray(post.platforms)
            ? post.platforms.map(p => p.toLowerCase())
            : [];
          return postPlatforms.includes(selectedPlatform.toLowerCase());
        });

  const pieData = analysis && analysis.sentiment_distribution
    ? [
        { name: t('positive'), value: analysis.sentiment_distribution.positive || 0, color: COLORS.positive },
        { name: t('negative'), value: analysis.sentiment_distribution.negative || 0, color: COLORS.negative },
        { name: t('neutral'), value: analysis.sentiment_distribution.neutral || 0, color: COLORS.neutral },
        { name: t('mixed'), value: analysis.sentiment_distribution.mixed || 0, color: COLORS.mixed },
      ].filter(item => item.value > 0)
    : [];

  if (!selectedBrandId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-white p-6">
        <div className="text-center">
          <Briefcase className="mx-auto mb-4 h-16 w-16 text-gray-400" />
          <h2 className="mb-2 text-xl font-semibold text-gray-600">
            {isRTL ? 'בחר מותג' : 'Select a Brand'}
          </h2>
          <p className="text-gray-500">{isRTL ? 'אנא בחר מותג כדי לנתח פוסטים' : 'Please select a brand to analyze posts'}</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-pink-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto max-w-7xl space-y-8">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-4xl font-bold text-transparent">
            {t('title')}
          </h1>
          <p className="mt-2 text-lg text-slate-500">{t('subtitle')}</p>
        </motion.div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Posts List */}
          <div className="lg:col-span-1">
            <Card className="glass-effect border-white/20 shadow-xl">
              <CardHeader>
                <CardTitle>{t('posts_title')}</CardTitle>
                <CardDescription>{t('posts_description')}</CardDescription>
              </CardHeader>
              <CardContent className={`space-y-4 ${isRTL ? 'text-right' : ''}`}>
                {/* Platform Filter */}
                <Tabs value={selectedPlatform} onValueChange={setSelectedPlatform}>
                  <TabsList className={`inline-flex h-auto items-center justify-start gap-1 rounded-lg bg-gray-100/50 p-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <TabsTrigger
                      value="all"
                      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                        selectedPlatform === 'all'
                          ? 'bg-white text-pink-600 shadow-sm'
                          : 'bg-transparent text-gray-600 hover:bg-white/50 hover:text-gray-900'
                      }`}
                    >
                      {t('all_platforms')}
                    </TabsTrigger>
                    {availablePlatforms.map((platform) => {
                      const config = platformDetails[platform] || platformDetails.instagram;
                      if (!config) {
                        return null;
                      }
                      const Icon = config.icon;
                      const isActive = selectedPlatform === platform;
                      return (
                        <TabsTrigger
                          key={platform}
                          value={platform}
                          className={
                            `flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                              isActive
                                ? 'bg-white text-pink-600 shadow-sm'
                                : 'bg-transparent text-gray-600 hover:bg-white/50 hover:text-gray-900'
                            }`
                          }
                        >
                          <Icon className={`h-3.5 w-3.5 ${isActive ? config.color : 'text-gray-500'}`} />
                          <span className="hidden sm:inline">{config.name}</span>
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>
                </Tabs>

                {/* Posts */}
                <div className="max-h-96 space-y-3 overflow-y-auto">
                  {filteredPosts.length === 0
                    ? (
                        <p className="py-4 text-center text-gray-500">{t('no_posts')}</p>
                      )
                    : (
                        filteredPosts.map((post) => {
                          // Get the first platform and normalize it
                          let platform = 'instagram';
                          if (Array.isArray(post.platforms) && post.platforms.length > 0 && post.platforms[0]) {
                            platform = post.platforms[0].toLowerCase();
                            // Normalize twitter to x
                            if (platform === 'twitter') {
                              platform = 'x';
                            }
                          }
                          const config = platformDetails[platform] || platformDetails.instagram;
                          if (!config) {
                            return null;
                          }
                          const Icon = config.icon;
                          const isSelected = selectedPost?.id === post.id;

                          return (
                            <div
                              key={post.id}
                              role="button"
                              tabIndex={0}
                              onClick={() => handleAnalyzePost(post)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  handleAnalyzePost(post);
                                }
                              }}
                              className={
                                `cursor-pointer rounded-lg border p-3 transition-all duration-300 ${
                                  isSelected
                                    ? 'border-pink-500 bg-pink-50'
                                    : 'border-gray-200 hover:border-pink-300'
                                }`
                              }
                            >
                              <div className="flex items-start gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-pink-50">
                                  <Icon className={`h-4 w-4 ${config.color}`} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="mb-1 line-clamp-2 text-sm font-medium text-gray-900">
                                    {post.content}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {format(new Date(post.created_at), 'dd/MM/yyyy')}
                                    {' '}
                                    •
                                    {' '}
                                    {post.engagement?.comments || 0}
                                    {' '}
                                    {t('comments')}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Analysis Results */}
          <div className="lg:col-span-2">
            {!selectedPost
              ? (
                  <div className="flex h-96 items-center justify-center rounded-xl bg-gray-50">
                    <div className="text-center">
                      <MessageSquareText className="mx-auto mb-4 h-16 w-16 text-gray-400" />
                      <p className="text-gray-500">{t('select_post')}</p>
                    </div>
                  </div>
                )
              : isAnalyzing
                ? (
                    <div className="flex h-96 items-center justify-center rounded-xl bg-white shadow-lg">
                      <div className="text-center">
                        <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-pink-500" />
                        <p className="text-gray-600">{t('analyzing')}</p>
                      </div>
                    </div>
                  )
                : error
                  ? (
                      <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-100 p-4 text-red-700">
                        <AlertCircle className="h-5 w-5" />
                        <p>{error}</p>
                      </div>
                    )
                  : analysis
                    ? (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                          {/* Selected Post Info */}
                          {selectedPost && (
                            <Card className="glass-effect border-white/20 shadow-xl">
                              <CardHeader>
                                <div className={`flex items-start justify-between gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                                  <div className="flex-1">
                                    <CardTitle className="mb-2">{t('selected_post')}</CardTitle>
                                    <CardDescription className="line-clamp-2">{selectedPost.content}</CardDescription>
                                  </div>
                                  {selectedPost.platformPostUrl
                                    ? (
                                        <a
                                          href={selectedPost.platformPostUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className={`flex items-center gap-2 rounded-lg border border-pink-200 bg-pink-50 px-4 py-2 text-sm font-medium text-pink-700 transition-colors hover:bg-pink-100 ${isRTL ? 'flex-row-reverse' : ''}`}
                                        >
                                          <ExternalLink className="h-4 w-4" />
                                          {t('view_on_platform')}
                                        </a>
                                      )
                                    : (
                                        <Link
                                          href={`/${locale}/dashboard?postId=${selectedPost.id}`}
                                          className={`flex items-center gap-2 rounded-lg border border-pink-200 bg-pink-50 px-4 py-2 text-sm font-medium text-pink-700 transition-colors hover:bg-pink-100 ${isRTL ? 'flex-row-reverse' : ''}`}
                                        >
                                          <ExternalLink className="h-4 w-4" />
                                          {t('view_post')}
                                        </Link>
                                      )}
                                </div>
                              </CardHeader>
                            </Card>
                          )}

                          {/* Overall Sentiment */}
                          <Card className="glass-effect border-white/20 shadow-xl">
                            <CardHeader>
                              <CardTitle className="flex items-center gap-2">
                                {SENTIMENT_ICONS[analysis.overall_sentiment || 'neutral']}
                                {t('overall_sentiment')}
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className={`flex items-center justify-between gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                                <div className="flex-1">
                                  <h3 className="text-lg font-semibold capitalize">
                                    {analysis.overall_sentiment === 'positive'
                                      ? t('positive')
                                      : analysis.overall_sentiment === 'negative'
                                        ? t('negative')
                                        : analysis.overall_sentiment === 'mixed'
                                          ? t('mixed')
                                          : t('neutral')}
                                  </h3>
                                  <p className="text-gray-600">
                                    {t('engagement_score')}
                                    :
                                    {' '}
                                    {analysis.engagement_score || 0}
                                    /100
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="relative h-3 w-32 overflow-hidden rounded-full bg-gray-200">
                                    <div
                                      className="h-full bg-pink-500 transition-all"
                                      style={{ width: `${analysis.engagement_score || 0}%` }}
                                    />
                                  </div>
                                  <span className="min-w-[3rem] text-right text-sm font-medium text-gray-700">
                                    {analysis.engagement_score || 0}
                                    %
                                  </span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>

                          {/* Sentiment Distribution */}
                          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                            <Card className="glass-effect border-white/20 shadow-xl">
                              <CardHeader>
                                <CardTitle>{t('sentiment_distribution')}</CardTitle>
                              </CardHeader>
                              <CardContent className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                  <PieChart>
                                    <Pie
                                      data={pieData}
                                      cx="50%"
                                      cy="50%"
                                      outerRadius={80}
                                      fill="#8884d8"
                                      dataKey="value"
                                      label={(props: any) => {
                                        const { name, percent } = props;
                                        return `${name} ${((percent as number) * 100).toFixed(0)}%`;
                                      }}
                                    >
                                      {pieData.map(entry => (
                                        <Cell key={entry.name} fill={entry.color} />
                                      ))}
                                    </Pie>
                                    <Tooltip />
                                  </PieChart>
                                </ResponsiveContainer>
                              </CardContent>
                            </Card>

                            <Card className="glass-effect border-white/20 shadow-xl">
                              <CardHeader>
                                <CardTitle>{t('main_themes')}</CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="space-y-2">
                                  {(analysis.main_themes || []).map(theme => (
                                    <Badge key={theme} variant="outline" className="mr-2 mb-2">
                                      {theme}
                                    </Badge>
                                  ))}
                                </div>
                                <div className="mt-4">
                                  <h4 className="mb-2 font-semibold">
                                    {t('common_emotions')}
                                    :
                                  </h4>
                                  <div className="flex flex-wrap gap-2">
                                    {(analysis.common_emotions || []).map(emotion => (
                                      <Badge key={emotion} className="bg-pink-100 text-pink-700">
                                        {emotion}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          </div>

                          {/* Sample Comments */}
                          <Card className="glass-effect border-white/20 shadow-xl">
                            <CardHeader>
                              <CardTitle>{t('sample_comments')}</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-3">
                                {(analysis.sample_comments || []).map(comment => (
                                  <div key={`comment-${comment.text.slice(0, 20)}-${comment.author}`} className="rounded-lg border bg-white/50 p-3">
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1">
                                        <p className="mb-1 text-gray-800">
                                          "
                                          {comment.text}
                                          "
                                        </p>
                                        <p className="text-sm text-gray-500">
                                          -
                                          {comment.author}
                                        </p>
                                      </div>
                                      <Badge
                                        variant="outline"
                                        className={`${
                                          comment.sentiment === 'positive'
                                            ? 'border-green-200 bg-green-50 text-green-700'
                                            : comment.sentiment === 'negative'
                                              ? 'border-red-200 bg-red-50 text-red-700'
                                              : 'border-gray-200 bg-gray-50 text-gray-700'
                                        }`}
                                      >
                                        {comment.sentiment === 'positive'
                                          ? t('positive')
                                          : comment.sentiment === 'negative'
                                            ? t('negative')
                                            : t('neutral')}
                                      </Badge>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>

                          {/* Recommendations */}
                          <Card className="glass-effect border-white/20 shadow-xl">
                            <CardHeader>
                              <CardTitle className="flex items-center gap-2">
                                <TrendingUp className="text-green-500" />
                                {t('recommendations')}
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <ul className="space-y-2">
                                {(analysis.recommendations || []).map(rec => (
                                  <li key={rec} className="flex items-start gap-2">
                                    <div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-pink-500"></div>
                                    <p className="text-gray-700">{rec}</p>
                                  </li>
                                ))}
                              </ul>
                            </CardContent>
                          </Card>
                        </motion.div>
                      )
                    : null}
          </div>
        </div>
      </div>
    </div>
  );
}
