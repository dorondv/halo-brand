'use client';

import { format } from 'date-fns';
import { enUS as dfEnUS, he as dfHe } from 'date-fns/locale';
import { ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type PostRow = {
  score: number;
  engagementRate: number;
  engagement: number;
  impressions: number;
  date: string;
  postContent: string;
  platform: string;
};

type PostsTableProps = {
  posts?: PostRow[];
};

const EMPTY_POSTS: PostRow[] = [];

const PlatformIcon = ({ platform, className }: { platform: string; className?: string }) => {
  const platformLower = platform.toLowerCase();
  const iconClass = className || 'h-5 w-5';

  if (platformLower === 'instagram') {
    return (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
      </svg>
    );
  }
  if (platformLower === 'facebook') {
    return (
      <svg className={iconClass} viewBox="0 0 24 24" fill="currentColor">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    );
  }
  if (platformLower === 'x' || platformLower === 'twitter') {
    return (
      <svg className={iconClass} viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    );
  }
  if (platformLower === 'youtube') {
    return (
      <svg className={iconClass} viewBox="0 0 24 24" fill="currentColor">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    );
  }
  if (platformLower === 'linkedin') {
    return (
      <svg className={iconClass} viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    );
  }
  if (platformLower === 'tiktok') {
    return (
      <svg className={iconClass} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
      </svg>
    );
  }
  return <span className={iconClass}>📱</span>;
};

const platformColors: Record<string, string> = {
  instagram: 'text-pink-500',
  facebook: 'text-blue-600',
  x: 'text-black',
  twitter: 'text-black',
  youtube: 'text-red-600',
  linkedin: 'text-blue-700',
  tiktok: 'text-black',
};

const getScoreColor = (score: number) => {
  if (score >= 1400) {
    return 'bg-green-100 text-green-800';
  }
  if (score >= 800) {
    return 'bg-yellow-100 text-yellow-800';
  }
  return 'bg-gray-100 text-gray-800';
};

function PostsTable({ posts = EMPTY_POSTS }: PostsTableProps) {
  const t = useTranslations('DashboardPage');
  const localeCode = useLocale();
  const dfLocale = localeCode === 'he' ? dfHe : dfEnUS;
  const [sortColumn, setSortColumn] = React.useState<string | null>('date');
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('desc');

  // Default dummy data if no posts provided
  const defaultPosts: PostRow[] = [
    {
      score: 1492,
      engagementRate: 8.70,
      engagement: 1357,
      impressions: 15600,
      date: '2025-10-31T17:51:00',
      postContent: 'השבוע השקנו את הקולקציה החדשה שלנו! 🌸 מה הפריט שהכי אהבתם? ספרו לנו בתגובות! #אופנה #קיץ #חדש',
      platform: 'instagram',
    },
    {
      score: 908,
      engagementRate: 8.56,
      engagement: 839,
      impressions: 9800,
      date: '2025-10-29T17:51:00',
      postContent: 'מאחורי הקלעים של הצילומים האחרונים שלנו. היה יום מדהים עם צוות מנצח! תודה לכל מי שלקח חלק. 💪',
      platform: 'facebook',
    },
    {
      score: 842,
      engagementRate: 8.47,
      engagement: 618,
      impressions: 7300,
      date: '2025-10-26T17:51:00',
      postContent: 'טיפ קטן ליום מוצלח: התחילו את הבוקר עם חיוך וקפה טוב. ☕ מה הטיפ שלכם לבוקר אנרגטי?',
      platform: 'x',
    },
  ];

  const displayPosts = posts.length > 0 ? posts : defaultPosts;

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const sortedPosts = [...displayPosts].sort((a, b) => {
    if (!sortColumn) {
      return 0;
    }
    let aVal: any = a[sortColumn as keyof PostRow];
    let bVal: any = b[sortColumn as keyof PostRow];

    if (sortColumn === 'date') {
      aVal = new Date(aVal).getTime();
      bVal = new Date(bVal).getTime();
    }

    if (sortDirection === 'asc') {
      return aVal > bVal ? 1 : -1;
    }
    return aVal < bVal ? 1 : -1;
  });

  return (
    <Card className="rounded-lg border border-gray-200 bg-white shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-gray-800">
          <FileText className="h-5 w-5 text-pink-500" />
          {t('posts_details_title')}
        </CardTitle>
        <p className="mt-2 text-sm text-gray-600">
          {t('posts_details_description')}
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th
                  className="cursor-pointer px-4 py-3 text-right text-sm font-medium text-gray-700 hover:bg-gray-50"
                  onClick={() => handleSort('score')}
                >
                  <div className={`flex items-center gap-1 ${localeCode === 'he' ? 'justify-start' : 'justify-end'}`}>
                    {t('posts_table_score')}
                    {sortColumn === 'score' && (
                      sortDirection === 'desc' ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />
                    )}
                  </div>
                </th>
                <th
                  className="cursor-pointer px-4 py-3 text-right text-sm font-medium text-gray-700 hover:bg-gray-50"
                  onClick={() => handleSort('engagementRate')}
                >
                  <div className={`flex items-center gap-1 ${localeCode === 'he' ? 'justify-start' : 'justify-end'}`}>
                    {t('posts_table_engagement_rate')}
                    {sortColumn === 'engagementRate' && (
                      sortDirection === 'desc' ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />
                    )}
                  </div>
                </th>
                <th
                  className="cursor-pointer px-4 py-3 text-right text-sm font-medium text-gray-700 hover:bg-gray-50"
                  onClick={() => handleSort('engagement')}
                >
                  <div className={`flex items-center gap-1 ${localeCode === 'he' ? 'justify-start' : 'justify-end'}`}>
                    {t('posts_table_engagement')}
                    {sortColumn === 'engagement' && (
                      sortDirection === 'desc' ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />
                    )}
                  </div>
                </th>
                <th
                  className="cursor-pointer px-4 py-3 text-right text-sm font-medium text-gray-700 hover:bg-gray-50"
                  onClick={() => handleSort('impressions')}
                >
                  <div className={`flex items-center gap-1 ${localeCode === 'he' ? 'justify-start' : 'justify-end'}`}>
                    {t('posts_table_impressions')}
                    {sortColumn === 'impressions' && (
                      sortDirection === 'desc' ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />
                    )}
                  </div>
                </th>
                <th
                  className="cursor-pointer px-4 py-3 text-right text-sm font-medium text-gray-700 hover:bg-gray-50"
                  onClick={() => handleSort('date')}
                >
                  <div className={`flex items-center gap-1 ${localeCode === 'he' ? 'justify-start' : 'justify-end'}`}>
                    {t('posts_table_date')}
                    {sortColumn === 'date' && (
                      sortDirection === 'desc' ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">
                  {t('posts_table_post')}
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">
                  {t('posts_table_platform')}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedPosts.map((post) => {
                const postDate = new Date(post.date);
                const dayName = format(postDate, 'EEEE', { locale: dfLocale });
                const dateStr = format(postDate, 'dd/MM/yyyy');
                const timeStr = format(postDate, 'HH:mm');
                const platformLower = post.platform.toLowerCase();
                const platformColor = platformColors[platformLower] || 'text-gray-600';

                return (
                  <tr key={`post-${post.date}-${post.platform}-${post.engagement}-${post.postContent.slice(0, 20)}`} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-4 text-right">
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${getScoreColor(post.score)}`}>
                        {post.score}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right text-sm text-gray-700">
                      {post.engagementRate.toFixed(2)}
                      %
                    </td>
                    <td className="px-4 py-4 text-right text-sm text-gray-700">
                      {new Intl.NumberFormat('he-IL').format(post.engagement)}
                    </td>
                    <td className="px-4 py-4 text-right text-sm text-gray-700">
                      {new Intl.NumberFormat('he-IL').format(post.impressions)}
                    </td>
                    <td className="px-4 py-4 text-right text-sm text-gray-700">
                      <div>
                        <div>{dateStr}</div>
                        <div className="text-gray-500">{timeStr}</div>
                        <div className="text-xs text-gray-500">{dayName}</div>
                      </div>
                    </td>
                    <td className="max-w-md px-4 py-4 text-right text-sm text-gray-700">
                      <div className="truncate" title={post.postContent}>
                        {post.postContent}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className={`flex items-center gap-2 ${localeCode === 'he' ? 'justify-start' : 'justify-end'}`}>
                        <span className={platformColor}>
                          <PlatformIcon platform={post.platform} />
                        </span>
                        <span className="text-xs text-gray-500">{t('posts_table_post_media')}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export default PostsTable;
