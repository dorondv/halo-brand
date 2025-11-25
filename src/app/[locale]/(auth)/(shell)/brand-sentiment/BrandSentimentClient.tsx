'use client';

import { format } from 'date-fns';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  Briefcase,
  Facebook,
  Instagram,
  Linkedin,
  Loader2,
  Mail,
  MessageCircle,
  Search,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Twitter,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import React, { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useBrand } from '@/contexts/BrandContext';
import { createSupabaseBrowserClient } from '@/libs/SupabaseBrowser';

const COLORS = { positive: '#22c55e', neutral: '#64748b', negative: '#ef4444' };
const SOURCE_ICONS: Record<string, React.ReactElement> = {
  twitter: <Twitter className="h-4 w-4 text-sky-500" />,
  x: <Twitter className="h-4 w-4 text-sky-500" />,
  facebook: <Facebook className="h-4 w-4 text-blue-600" />,
  instagram: <Instagram className="h-4 w-4 text-pink-500" />,
  linkedin: <Linkedin className="h-4 w-4 text-sky-700" />,
  blog: <MessageCircle className="h-4 w-4 text-orange-500" />,
  news: <MessageCircle className="h-4 w-4 text-gray-700" />,
};
const DEFAULT_ICON = <Mail className="h-4 w-4 text-gray-500" />;

type AnalysisResult = {
  overall_score: number;
  positive_percentage: number;
  negative_percentage: number;
  neutral_percentage: number;
  positive_themes: string[];
  negative_themes: string[];
  sample_mentions: Array<{
    content: string;
    source: 'twitter' | 'facebook' | 'instagram' | 'linkedin' | 'blog' | 'news' | 'x';
    sentiment: 'positive' | 'negative' | 'neutral';
  }>;
  search_trends_daily?: Array<{ date: string; volume: number }>;
  search_trends_monthly?: Array<{ month: string; volume: number }>;
};

type BrandSentimentClientProps = {
  initialBrandName: string;
};

export function BrandSentimentClient({ initialBrandName }: BrandSentimentClientProps) {
  const t = useTranslations('BrandSentiment');
  const locale = useLocale();
  const isRTL = locale === 'he';
  const { selectedBrandId } = useBrand();
  const [keywords, setKeywords] = useState(() => initialBrandName || '');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [connectedPlatforms, setConnectedPlatforms] = useState<Set<string>>(() => new Set());

  // Sync keywords with initialBrandName when it changes
  const prevInitialBrandNameRef = React.useRef(initialBrandName);
  useEffect(() => {
    if (prevInitialBrandNameRef.current !== initialBrandName) {
      prevInitialBrandNameRef.current = initialBrandName;

      if (initialBrandName) {
        // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
        setKeywords(initialBrandName);
      } else {
        // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
        setAnalysisResult(null);
      }
    }
  }, [initialBrandName]);

  // Fetch connected platforms for the current brand
  useEffect(() => {
    const loadConnectedPlatforms = async () => {
      if (!selectedBrandId) {
        setConnectedPlatforms(new Set());
        return;
      }

      try {
        const supabase = createSupabaseBrowserClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setConnectedPlatforms(new Set());
          return;
        }

        const { data: userRecord } = await supabase
          .from('users')
          .select('id')
          .eq('email', session.user.email)
          .maybeSingle();

        const userId = userRecord?.id || session.user.id;

        const { data: accountsData } = await supabase
          .from('social_accounts')
          .select('platform')
          .eq('user_id', userId)
          .eq('brand_id', selectedBrandId)
          .eq('is_active', true);

        if (accountsData && accountsData.length > 0) {
          // Map platform names to mention source format
          const platformSet = new Set<string>();
          accountsData.forEach((acc) => {
            const platform = (acc.platform || '').toLowerCase();
            // Map database platform names to mention source format
            if (platform === 'twitter' || platform === 'x') {
              platformSet.add('twitter');
            } else if (platform === 'facebook') {
              platformSet.add('facebook');
            } else if (platform === 'instagram') {
              platformSet.add('instagram');
            } else if (platform === 'linkedin') {
              platformSet.add('linkedin');
            } else {
              // For other platforms, try to use as-is
              platformSet.add(platform);
            }
          });
          setConnectedPlatforms(platformSet);
        } else {
          setConnectedPlatforms(new Set());
        }
      } catch (error) {
        console.error('Error loading connected platforms:', error);
        setConnectedPlatforms(new Set());
      }
    };

    loadConnectedPlatforms();
  }, [selectedBrandId]);

  const handleAnalyze = async () => {
    if (!keywords.trim() || !selectedBrandId) {
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/ai/sentiment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          keywords,
          brandName: initialBrandName,
          brandId: selectedBrandId,
          locale,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || (isRTL ? 'שגיאה בניתוח הסנטימנט. אנא נסה שוב.' : 'Error analyzing sentiment. Please try again.'));
      }

      const result = await response.json();
      setAnalysisResult(result);
    } catch (e) {
      console.error('Analysis failed:', e);
      setError(e instanceof Error ? e.message : (isRTL ? 'שגיאה בניתוח הסנטימנט. אנא נסה שוב.' : 'Error analyzing sentiment. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  const pieData = analysisResult
    ? [
        { name: t('positive'), value: analysisResult.positive_percentage },
        { name: t('neutral'), value: analysisResult.neutral_percentage },
        { name: t('negative'), value: analysisResult.negative_percentage },
      ]
    : [];

  // Calculate overall score from sentiment distribution
  // Formula: positive% counts fully (100%), neutral% counts half (50%), negative% counts zero (0%)
  const calculatedOverallScore = useMemo(() => {
    if (!analysisResult) {
      return 0;
    }
    const positive = analysisResult.positive_percentage || 0;
    const neutral = analysisResult.neutral_percentage || 0;
    // Calculate: positive + (neutral * 0.5)
    return Math.round(positive + (neutral * 0.5));
  }, [analysisResult]);

  // Use calculated score from distribution, fallback to API score if available
  const overallScore = calculatedOverallScore || analysisResult?.overall_score || 0;

  // Filter sample mentions to only show those from connected platforms
  const filteredMentions = useMemo(() => {
    if (!analysisResult?.sample_mentions) {
      return [];
    }
    if (connectedPlatforms.size === 0) {
      return analysisResult.sample_mentions;
    } // Show all if no platforms connected

    return analysisResult.sample_mentions.filter((mention) => {
      if (!mention.source) {
        return false;
      }
      const mentionSource = mention.source.toLowerCase();
      // Check if the mention source matches any connected platform
      return connectedPlatforms.has(mentionSource);
    });
  }, [analysisResult?.sample_mentions, connectedPlatforms]);

  if (!selectedBrandId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-white p-6">
        <div className="text-center">
          <Briefcase className="mx-auto mb-4 h-16 w-16 text-gray-400" />
          <h2 className="mb-2 text-xl font-semibold text-gray-600">
            {isRTL ? 'בחר מותג' : 'Select a Brand'}
          </h2>
          <p className="text-gray-500">
            {isRTL
              ? 'אנא בחר מותג כדי להתחיל בניתוח סנטימנט.'
              : 'Please select a brand to start sentiment analysis.'}
          </p>
        </div>
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

        <Card className="rounded-lg border border-gray-200 bg-white shadow-xl">
          <CardHeader>
            <CardTitle>{t('settings_title')}</CardTitle>
            <CardDescription>
              {t('settings_description', { brand: initialBrandName || t('brand_placeholder') })}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-start gap-4 md:flex-row md:items-end">
            <Textarea
              placeholder={t('keywords_placeholder')}
              value={keywords}
              onChange={e => setKeywords(e.target.value)}
              className="min-h-[80px] flex-grow"
            />
            <Button
              onClick={handleAnalyze}
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-pink-500 to-pink-600 text-white hover:from-pink-600 hover:to-pink-700 md:w-auto"
            >
              {isLoading
                ? (
                    <>
                      <Loader2 className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'} animate-spin`} />
                      {t('analyzing')}
                    </>
                  )
                : (
                    <>
                      <Search className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                      {t('analyze_button')}
                    </>
                  )}
            </Button>
          </CardContent>
        </Card>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-100 p-4 text-red-700">
            <AlertCircle className="h-5 w-5" />
            <p>{error}</p>
          </div>
        )}

        {analysisResult && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
            {/* Search Trends Charts */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* 30 Days Chart */}
              {analysisResult.search_trends_daily && (
                <Card className="rounded-lg border border-gray-200 bg-white shadow-xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="text-blue-500" />
                      {isRTL ? 'מגמת חיפושים - 30 יום אחרונים' : 'Search Trends - Last 30 Days'}
                    </CardTitle>
                    <CardDescription>
                      {isRTL ? 'נתוני חיפוש יומיים בגוגל' : 'Daily Google search data'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={analysisResult.search_trends_daily.map(item => ({
                          ...item,
                          date: format(new Date(item.date), 'd/M'),
                        }))}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
                        <YAxis
                          domain={[0, 100]}
                          stroke="#6b7280"
                          fontSize={12}
                          label={{
                            value: isRTL ? 'עניין בחיפוש' : 'Search Interest',
                            angle: -90,
                            position: 'insideLeft',
                          }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                          }}
                          formatter={value => [`${value}`, isRTL ? 'עוצמת חיפוש' : 'Search Volume']}
                        />
                        <Line
                          type="monotone"
                          dataKey="volume"
                          stroke="#3b82f6"
                          strokeWidth={3}
                          dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                          activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2, fill: '#ffffff' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* 12 Months Chart */}
              {analysisResult.search_trends_monthly && (
                <Card className="rounded-lg border border-gray-200 bg-white shadow-xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="text-green-500" />
                      {isRTL ? 'מגמת חיפושים - 12 חודשים אחרונים' : 'Search Trends - Last 12 Months'}
                    </CardTitle>
                    <CardDescription>
                      {isRTL ? 'נתוני חיפוש חודשיים בגוגל' : 'Monthly Google search data'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={analysisResult.search_trends_monthly}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis
                          dataKey="month"
                          stroke="#6b7280"
                          fontSize={12}
                          angle={-45}
                          textAnchor="end"
                          height={80}
                        />
                        <YAxis
                          domain={[0, 100]}
                          stroke="#6b7280"
                          fontSize={12}
                          label={{
                            value: isRTL ? 'עניין בחיפוש' : 'Search Interest',
                            angle: -90,
                            position: 'insideLeft',
                          }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                          }}
                          formatter={value => [`${value}`, isRTL ? 'עוצמת חיפוש' : 'Search Volume']}
                        />
                        <Line
                          type="monotone"
                          dataKey="volume"
                          stroke="#22c55e"
                          strokeWidth={3}
                          dot={{ fill: '#22c55e', strokeWidth: 2, r: 5 }}
                          activeDot={{ r: 7, stroke: '#22c55e', strokeWidth: 2, fill: '#ffffff' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Overall Score and Distribution */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <Card className="rounded-lg border border-gray-200 bg-white shadow-xl lg:col-span-1">
                <CardHeader>
                  <CardTitle>{isRTL ? 'ציון סנטימנט כללי' : 'Overall Sentiment Score'}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center gap-4">
                  <div className="relative h-40 w-40">
                    <svg className="h-full w-full" viewBox="0 0 36 36">
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="#e5e7eb"
                        strokeWidth="3"
                      />
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke={
                          overallScore > 70
                            ? COLORS.positive
                            : overallScore > 40
                              ? COLORS.neutral
                              : COLORS.negative
                        }
                        strokeWidth="3"
                        strokeDasharray={`${overallScore}, 100`}
                        strokeLinecap="round"
                        transform="rotate(90 18 18)"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-4xl font-bold text-slate-800">{overallScore}</span>
                      <span className="text-sm text-slate-500">/ 100</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-lg border border-gray-200 bg-white shadow-xl lg:col-span-2">
                <CardHeader>
                  <CardTitle>{isRTL ? 'התפלגות הסנטימנט' : 'Sentiment Distribution'}</CardTitle>
                </CardHeader>
                <CardContent className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        nameKey="name"
                        label={(props: any) => {
                          const { name, percent } = props;
                          return `${name} ${((percent as number) * 100).toFixed(0)}%`;
                        }}
                      >
                        {pieData.map(entry => (
                          <Cell
                            key={entry.name}
                            fill={
                              COLORS[
                                entry.name === t('positive')
                                  ? 'positive'
                                  : entry.name === t('neutral')
                                    ? 'neutral'
                                    : 'negative'
                              ]
                            }
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card className="rounded-lg border border-gray-200 bg-white shadow-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ThumbsUp className="text-green-500" />
                    {t('positive_topics_title')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {analysisResult.positive_themes && analysisResult.positive_themes.length > 0
                    ? (
                        <ul className="list-disc space-y-2 pl-5 text-slate-700">
                          {analysisResult.positive_themes.map(theme => (
                            <li key={`positive-theme-${theme}`}>{theme}</li>
                          ))}
                        </ul>
                      )
                    : (
                        <p className="text-sm text-gray-500 italic">
                          {isRTL ? 'אין נושאים חיוביים זמינים' : 'No positive topics available'}
                        </p>
                      )}
                </CardContent>
              </Card>
              <Card className="rounded-lg border border-gray-200 bg-white shadow-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ThumbsDown className="text-red-500" />
                    {t('negative_topics_title')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {analysisResult.negative_themes && analysisResult.negative_themes.length > 0
                    ? (
                        <ul className="list-disc space-y-2 pl-5 text-slate-700">
                          {analysisResult.negative_themes.map(theme => (
                            <li key={`negative-theme-${theme}`}>{theme}</li>
                          ))}
                        </ul>
                      )
                    : (
                        <p className="text-sm text-gray-500 italic">
                          {isRTL ? 'אין נושאים שליליים זמינים' : 'No negative topics available'}
                        </p>
                      )}
                </CardContent>
              </Card>
            </div>

            <Card className="glass-effect border-white/20 shadow-xl">
              <CardHeader>
                <CardTitle>{t('example_mentions_title')}</CardTitle>
                <CardDescription>
                  {isRTL
                    ? `סה"כ ${filteredMentions?.length || 0} אזכורים: ${filteredMentions?.filter(m => m.sentiment === 'positive').length || 0} חיוביים, ${filteredMentions?.filter(m => m.sentiment === 'negative').length || 0} שליליים, ${filteredMentions?.filter(m => m.sentiment === 'neutral').length || 0} ניטרליים`
                    : `Total ${filteredMentions?.length || 0} mentions: ${filteredMentions?.filter(m => m.sentiment === 'positive').length || 0} positive, ${filteredMentions?.filter(m => m.sentiment === 'negative').length || 0} negative, ${filteredMentions?.filter(m => m.sentiment === 'neutral').length || 0} neutral`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {filteredMentions && filteredMentions.length > 0
                  ? (
                      filteredMentions.map((mention) => {
                        const SourceIconElement = SOURCE_ICONS[mention.source] || DEFAULT_ICON;
                        const mentionKey = `${mention.source}-${mention.content.slice(0, 30)}-${mention.sentiment}`;
                        return (
                          <div key={mentionKey} className="relative rounded-lg border bg-white/50 p-4">
                            <div className={`absolute top-2 ${isRTL ? 'right-2' : 'left-2'} flex items-center gap-2`}>
                              <div className="h-4 w-4">
                                {SourceIconElement}
                              </div>
                              <Badge
                                variant="outline"
                                className={`border-2 ${
                                  mention.sentiment === 'positive'
                                    ? 'border-green-200 bg-green-50 text-green-700'
                                    : mention.sentiment === 'negative'
                                      ? 'border-red-200 bg-red-50 text-red-700'
                                      : 'border-slate-200 bg-slate-50 text-slate-700'
                                }`}
                              >
                                {mention.sentiment === 'positive'
                                  ? t('positive')
                                  : mention.sentiment === 'negative'
                                    ? t('negative')
                                    : t('neutral')}
                              </Badge>
                            </div>
                            <p className={`text-slate-800 ${isRTL ? 'pr-24' : 'pl-24'}`}>
                              "
                              {mention.content}
                              "
                            </p>
                          </div>
                        );
                      })
                    )
                  : (
                      <p className="py-4 text-center text-gray-500">
                        {isRTL ? 'אין אזכורים זמינים' : 'No mentions available'}
                      </p>
                    )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}
