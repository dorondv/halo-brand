import { format, subDays, subMonths } from 'date-fns';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/libs/Supabase';

const SentimentSchema = z.object({
  keywords: z.string().min(1),
  brandName: z.string().optional(),
  brandId: z.string().uuid().optional(),
  locale: z.string().optional().default('he'),
});

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = SentimentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 422 });
  }

  const { keywords, brandName, locale = 'he' } = parsed.data;
  const isHebrew = locale === 'he';

  // Posts fetching removed (AI disabled, not needed for mock data)

  // Generate search trends data (simulated)
  const searchTrendsDaily = [];
  for (let i = 29; i >= 0; i--) {
    searchTrendsDaily.push({
      date: format(subDays(new Date(), i), 'yyyy-MM-dd'),
      volume: Math.floor(Math.random() * 50) + 20, // Random volume between 20 and 70
    });
  }

  const searchTrendsMonthly = [];
  const monthNames = isHebrew
    ? ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']
    : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  for (let i = 11; i >= 0; i--) {
    const date = subMonths(new Date(), i);
    searchTrendsMonthly.push({
      month: `${monthNames[date.getMonth()]} ${date.getFullYear()}`,
      volume: Math.floor(Math.random() * 60) + 30, // Random volume between 30 and 90
    });
  }

  // Return mock sentiment data (AI disabled for now)
  const mockSentiment = isHebrew
    ? {
        overall_score: 72,
        positive_percentage: 58,
        negative_percentage: 15,
        neutral_percentage: 27,
        positive_themes: [
          'חדשנות טכנולוגית',
          'שירות לקוחות מעולה',
          'איכות מוצר גבוהה',
          'חוויית משתמש מצוינת',
        ],
        negative_themes: [
          'עלויות גבוהות',
          'זמני תגובה איטיים',
          'תמיכה טכנית מוגבלת',
        ],
        sample_mentions: [
          {
            content: `${brandName || keywords} מציגים חדשנות טכנולוגית מרשימה!`,
            source: 'twitter',
            sentiment: 'positive',
          },
          {
            content: `המוצר של ${brandName || keywords} עובד מצוין, אבל המחיר קצת גבוה`,
            source: 'facebook',
            sentiment: 'neutral',
          },
          {
            content: `אני מאוכזב מהשירות של ${brandName || keywords}, זמני תגובה איטיים מדי`,
            source: 'blog',
            sentiment: 'negative',
          },
          {
            content: `${brandName || keywords} מציעים פתרון מעולה לבעיה שלי!`,
            source: 'twitter',
            sentiment: 'positive',
          },
          {
            content: `השירות של ${brandName || keywords} בסדר, אבל יכול להיות טוב יותר`,
            source: 'news',
            sentiment: 'neutral',
          },
          {
            content: `איכות המוצר של ${brandName || keywords} מעולה, ממליץ בחום!`,
            source: 'facebook',
            sentiment: 'positive',
          },
        ],
      }
    : {
        overall_score: 72,
        positive_percentage: 58,
        negative_percentage: 15,
        neutral_percentage: 27,
        positive_themes: [
          'Technological innovation',
          'Excellent customer service',
          'High product quality',
          'Excellent user experience',
        ],
        negative_themes: [
          'High costs',
          'Slow response times',
          'Limited technical support',
        ],
        sample_mentions: [
          {
            content: `${brandName || keywords} shows impressive technological innovation!`,
            source: 'twitter',
            sentiment: 'positive',
          },
          {
            content: `The product from ${brandName || keywords} works great, but the price is a bit high`,
            source: 'facebook',
            sentiment: 'neutral',
          },
          {
            content: `I'm disappointed with the service from ${brandName || keywords}, response times are too slow`,
            source: 'blog',
            sentiment: 'negative',
          },
          {
            content: `${brandName || keywords} offers an excellent solution to my problem!`,
            source: 'twitter',
            sentiment: 'positive',
          },
          {
            content: `The service from ${brandName || keywords} is okay, but could be better`,
            source: 'news',
            sentiment: 'neutral',
          },
          {
            content: `The product quality from ${brandName || keywords} is excellent, highly recommend!`,
            source: 'facebook',
            sentiment: 'positive',
          },
        ],
      };

  return NextResponse.json({
    ...mockSentiment,
    search_trends_daily: searchTrendsDaily,
    search_trends_monthly: searchTrendsMonthly,
  });
}
