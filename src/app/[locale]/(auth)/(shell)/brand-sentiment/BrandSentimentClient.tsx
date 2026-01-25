'use client';

import { format } from 'date-fns';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  Briefcase,
  ExternalLink,
  Loader2,
  Search,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
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
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useBrand } from '@/contexts/BrandContext';
import { createSupabaseBrowserClient } from '@/libs/SupabaseBrowser';

const COLORS = { positive: '#22c55e', neutral: '#64748b', negative: '#ef4444' };

type AnalysisResult = {
  overall_score: number;
  positive_percentage: number;
  negative_percentage: number;
  neutral_percentage: number;
  positive_themes: string[];
  negative_themes: string[];
  sample_mentions?: Array<{
    content: string;
    source: 'twitter' | 'facebook' | 'instagram' | 'linkedin' | 'blog' | 'news' | 'x';
    sentiment: 'positive' | 'negative' | 'neutral';
  }>;
  report?: {
    overall_sentiment_section?: string;
    positive_feedback?: {
      title?: string;
      items?: Array<{
        title?: string;
        description?: string;
        url?: string;
      }>;
    };
    critical_feedback?: {
      title?: string;
      items?: Array<{
        title?: string;
        description?: string;
        url?: string;
      }>;
    };
    summary?: {
      positive?: string;
      negative?: string;
    };
    positioning?: string;
    sentiment_snapshot?: Array<{
      source?: string;
      sentiment_summary?: string;
      url?: string;
    }>;
    key_takeaways?: string[];
  };
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
  const [_connectedPlatforms, setConnectedPlatforms] = useState<Set<string>>(() => new Set());

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

            {/* Brand Sentiment Report */}
            {analysisResult.report && (
              <Card className="glass-effect border-white/20 shadow-xl">
                <CardHeader>
                  <CardTitle>{isRTL ? 'דוח סנטימנט מותג' : 'Brand Sentiment Report'}</CardTitle>
                  <CardDescription>
                    {isRTL
                      ? 'סקירה מפורטת של התפיסה והסנטימנט של המותג באינטרנט'
                      : 'Comprehensive overview of brand perception and sentiment online'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Overall Sentiment Section */}
                  {analysisResult.report.overall_sentiment_section && (
                    <div className="rounded-lg border border-gray-200 bg-white/80 p-6">
                      <h3 className="mb-4 text-xl font-semibold text-slate-800">
                        {isRTL ? '📊 סנטימנט כללי באינטרנט וביקורות' : '📊 Overall Web Sentiment & Reviews'}
                      </h3>
                      <div className="prose prose-sm max-w-none whitespace-pre-wrap text-slate-700">
                        {analysisResult.report.overall_sentiment_section}
                      </div>
                    </div>
                  )}

                  {/* Positive Feedback */}
                  {analysisResult.report.positive_feedback && (
                    <div className="rounded-lg border border-green-200 bg-green-50/50 p-6">
                      <h3 className="mb-4 text-xl font-semibold text-green-800">
                        {analysisResult.report.positive_feedback.title || (isRTL ? '👍 משוב חיובי' : '👍 Positive Feedback')}
                      </h3>
                      {analysisResult.report.positive_feedback.items && analysisResult.report.positive_feedback.items.length > 0 && (
                        <div className="space-y-4">
                          {analysisResult.report.positive_feedback.items.map((item, index) => (
                            <div key={`positive-${index}`} className="rounded-lg border border-green-200 bg-white p-4">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1">
                                  {item.title && (
                                    <h4 className="mb-2 font-semibold text-green-800">{item.title}</h4>
                                  )}
                                  {item.description && (
                                    <p className="text-sm whitespace-pre-wrap text-slate-700">{item.description}</p>
                                  )}
                                </div>
                                {item.url && (
                                  <a
                                    href={item.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-shrink-0 text-green-600 transition-colors hover:text-green-800"
                                    title={isRTL ? 'פתח בקישור' : 'Open link'}
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                  </a>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Critical Feedback */}
                  {analysisResult.report.critical_feedback && (
                    <div className="rounded-lg border border-orange-200 bg-orange-50/50 p-6">
                      <h3 className="mb-4 text-xl font-semibold text-orange-800">
                        {analysisResult.report.critical_feedback.title || (isRTL ? '👎 משוב ביקורתי או ניטרלי' : '👎 Critical or Neutral Feedback')}
                      </h3>
                      {analysisResult.report.critical_feedback.items && analysisResult.report.critical_feedback.items.length > 0 && (
                        <div className="space-y-4">
                          {analysisResult.report.critical_feedback.items.map((item, index) => (
                            <div key={`critical-${index}`} className="rounded-lg border border-orange-200 bg-white p-4">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1">
                                  {item.title && (
                                    <h4 className="mb-2 font-semibold text-orange-800">{item.title}</h4>
                                  )}
                                  {item.description && (
                                    <p className="text-sm whitespace-pre-wrap text-slate-700">{item.description}</p>
                                  )}
                                </div>
                                {item.url && (
                                  <a
                                    href={item.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-shrink-0 text-orange-600 transition-colors hover:text-orange-800"
                                    title={isRTL ? 'פתח בקישור' : 'Open link'}
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                  </a>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Summary */}
                  {analysisResult.report.summary && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-6">
                      <h3 className="mb-4 text-xl font-semibold text-blue-800">
                        {isRTL ? '⭐ סיכום סנטימנט המותג' : '⭐ Summary of Brand Sentiment'}
                      </h3>
                      <div className="space-y-3">
                        {analysisResult.report.summary.positive && (
                          <div className="rounded-lg border border-green-200 bg-white p-4">
                            <h4 className="mb-2 font-semibold text-green-800">{isRTL ? 'חיובי' : 'Positive'}</h4>
                            <p className="text-sm whitespace-pre-wrap text-slate-700">{analysisResult.report.summary.positive}</p>
                          </div>
                        )}
                        {analysisResult.report.summary.negative && (
                          <div className="rounded-lg border border-red-200 bg-white p-4">
                            <h4 className="mb-2 font-semibold text-red-800">{isRTL ? 'שלילי / מעורב' : 'Negative / Mixed'}</h4>
                            <p className="text-sm whitespace-pre-wrap text-slate-700">{analysisResult.report.summary.negative}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Positioning */}
                  {analysisResult.report.positioning && (
                    <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-6">
                      <h3 className="mb-4 text-xl font-semibold text-purple-800">
                        {isRTL ? '📌 מיצוב כללי בתעשייה' : '📌 General Positioning in Industry'}
                      </h3>
                      <p className="text-sm whitespace-pre-wrap text-slate-700">{analysisResult.report.positioning}</p>
                    </div>
                  )}

                  {/* Sentiment Snapshot */}
                  {analysisResult.report.sentiment_snapshot && analysisResult.report.sentiment_snapshot.length > 0 && (
                    <div className="rounded-lg border border-gray-200 bg-white/80 p-6">
                      <h3 className="mb-4 text-xl font-semibold text-slate-800">
                        {isRTL ? '📊 תמונת סנטימנט ברמה גבוהה' : '📊 High-Level Sentiment Snapshot'}
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="border-b border-gray-300">
                              <th className={`p-3 text-left font-semibold text-slate-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                                {isRTL ? 'מקור' : 'Source'}
                              </th>
                              <th className={`p-3 text-left font-semibold text-slate-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                                {isRTL ? 'סיכום סנטימנט' : 'Sentiment Summary'}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {analysisResult.report.sentiment_snapshot.map((snapshot, index) => (
                              <tr key={`snapshot-${index}`} className="border-b border-gray-200">
                                <td className={`p-3 font-medium text-slate-800 ${isRTL ? 'text-right' : 'text-left'}`}>
                                  {snapshot.url
                                    ? (
                                        <a
                                          href={snapshot.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex items-center gap-2 text-blue-600 transition-colors hover:text-blue-800 hover:underline"
                                        >
                                          <span>{snapshot.source || '-'}</span>
                                          <ExternalLink className="h-3 w-3" />
                                        </a>
                                      )
                                    : (
                                        snapshot.source || '-'
                                      )}
                                </td>
                                <td className={`p-3 text-sm text-slate-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                                  {snapshot.sentiment_summary || '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Key Takeaways */}
                  {analysisResult.report.key_takeaways && analysisResult.report.key_takeaways.length > 0 && (
                    <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-6">
                      <h3 className="mb-4 text-xl font-semibold text-indigo-800">
                        {isRTL ? '📌 נקודות מפתח' : '📌 Key Takeaways'}
                      </h3>
                      <ul className="space-y-2">
                        {analysisResult.report.key_takeaways.map((takeaway, index) => {
                          // Extract emoji/icon from the beginning of the string (handle multiple emojis)
                          const emojiMatch = takeaway.match(/^(\S+\s*)+/);
                          let emoji = '•';
                          let textWithoutEmoji = takeaway;

                          if (emojiMatch) {
                            // Extract all emojis/special chars at the start
                            const emojiPart = emojiMatch[0].trim();
                            // Check if it's actually an emoji/special char (not regular text)
                            const isEmoji = /^[\p{Emoji}\p{Symbol}]+$/u.test(emojiPart) || emojiPart.length <= 2;

                            if (isEmoji) {
                              emoji = emojiPart;
                              textWithoutEmoji = takeaway.substring(emojiMatch[0].length).trim();
                            } else {
                              // If it's not an emoji, use default bullet
                              emoji = '•';
                              textWithoutEmoji = takeaway.trim();
                            }
                          }

                          // Clean up any remaining formatting or duplicate emojis in the text
                          textWithoutEmoji = textWithoutEmoji.replace(/^[\p{Emoji}\p{Symbol}]+\s*/u, '').trim();

                          return (
                            <li key={`takeaway-${index}`} className="flex items-start gap-2">
                              <span className="mt-0.5 flex-shrink-0 text-lg leading-none">{emoji}</span>
                              <span className="flex-1 text-sm leading-relaxed font-normal text-slate-700 normal-case">{textWithoutEmoji}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
