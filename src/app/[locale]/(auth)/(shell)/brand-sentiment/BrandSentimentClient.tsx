'use client';

import { format } from 'date-fns';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  Briefcase,
  Facebook,
  Loader2,
  MessageCircle,
  Search,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Twitter,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import React, { useEffect, useState } from 'react';
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
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { useBrand } from '@/contexts/BrandContext';

const COLORS = { positive: '#22c55e', neutral: '#64748b', negative: '#ef4444' };
const SOURCE_ICONS = {
  twitter: <Twitter className="h-4 w-4 text-sky-500" />,
  facebook: <Facebook className="h-4 w-4 text-blue-600" />,
  blog: <MessageCircle className="h-4 w-4 text-orange-500" />,
  news: <MessageCircle className="h-4 w-4 text-gray-700" />,
};

type AnalysisResult = {
  overall_score: number;
  positive_percentage: number;
  negative_percentage: number;
  neutral_percentage: number;
  positive_themes: string[];
  negative_themes: string[];
  sample_mentions: Array<{
    content: string;
    source: 'twitter' | 'facebook' | 'blog' | 'news';
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
  const [keywords, setKeywords] = useState(initialBrandName || '');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialBrandName) {
      setKeywords(initialBrandName);
    } else {
      setAnalysisResult(null);
    }
  }, [initialBrandName]);

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
        throw new Error('Failed to analyze sentiment');
      }

      const result = await response.json();
      setAnalysisResult(result);
    } catch (e) {
      console.error('Analysis failed:', e);
      setError(isRTL ? 'שגיאה בניתוח הסנטימנט. אנא נסה שוב.' : 'Error analyzing sentiment. Please try again.');
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
                      {isRTL ? 'נתוני חיפוש יומיים בגוגל (סימולציה)' : 'Daily Google search data (simulated)'}
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
                      {isRTL ? 'נתוני חיפוש חודשיים בגוגל (סימולציה)' : 'Monthly Google search data (simulated)'}
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
                          analysisResult.overall_score > 70
                            ? COLORS.positive
                            : analysisResult.overall_score > 40
                              ? COLORS.neutral
                              : COLORS.negative
                        }
                        strokeWidth="3"
                        strokeDasharray={`${analysisResult.overall_score}, 100`}
                        strokeLinecap="round"
                        transform="rotate(90 18 18)"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-4xl font-bold text-slate-800">{analysisResult.overall_score}</span>
                      <span className="text-sm text-slate-500">/ 100</span>
                    </div>
                  </div>
                  <Progress value={analysisResult.overall_score} className="h-2 w-full" />
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
                  <ul className="list-disc space-y-2 pl-5 text-slate-700">
                    {analysisResult.positive_themes.map(theme => (
                      <li key={theme}>{theme}</li>
                    ))}
                  </ul>
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
                  <ul className="list-disc space-y-2 pl-5 text-slate-700">
                    {analysisResult.negative_themes.map(theme => (
                      <li key={theme}>{theme}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>

            <Card className="glass-effect border-white/20 shadow-xl">
              <CardHeader>
                <CardTitle>{t('example_mentions_title')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {analysisResult.sample_mentions.map((mention) => {
                  const SourceIconElement = SOURCE_ICONS[mention.source];
                  return (
                    <div key={`mention-${mention.content.slice(0, 20)}-${mention.source}`} className="relative rounded-lg border bg-white/50 p-4">
                      <div className={`absolute top-2 ${isRTL ? 'right-2' : 'left-2'} flex items-center gap-2`}>
                        {SourceIconElement ? React.cloneElement(SourceIconElement, { className: 'w-4 h-4' }) : <div className="h-4 w-4" />}
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
                })}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}
