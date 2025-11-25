import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/libs/Supabase';

export const runtime = 'edge';

const InsightsSchema = z.object({
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
  const parsed = InsightsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 422 });
  }

  const { brandId, locale = 'he' } = parsed.data;
  const isHebrew = locale === 'he';

  // Get user ID
  const { data: userRecord } = await supabase
    .from('users')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  const userId = userRecord?.id || user.id;

  // Fetch recent posts
  let postsQuery = supabase
    .from('posts')
    .select('id,content,created_at,platforms')
    .eq('user_id', userId)
    .in('status', ['published', 'scheduled', 'draft'])
    .order('created_at', { ascending: false })
    .limit(30);

  if (brandId) {
    postsQuery = postsQuery.eq('brand_id', brandId);
  }

  const { data: postsData } = await postsQuery;

  // Fetch scheduled posts to analyze posting times
  const postIds = postsData?.map(p => p.id) || [];
  let scheduledPostsData: any[] = [];
  if (postIds.length > 0) {
    const { data: scheduled } = await supabase
      .from('scheduled_posts')
      .select('post_id,scheduled_for,published_at')
      .in('post_id', postIds);

    scheduledPostsData = scheduled || [];
  }

  // Fetch analytics for engagement data
  let analyticsData: any[] = [];
  if (postIds.length > 0) {
    const { data: analytics } = await supabase
      .from('post_analytics')
      .select('post_id,likes,comments,shares,platform,date')
      .in('post_id', postIds)
      .order('date', { ascending: false });

    analyticsData = analytics || [];
  }

  // Analyze posting times and engagement
  const timeEngagementMap = new Map<string, { engagement: number; count: number }>();
  const dayOfWeekMap = new Map<number, { engagement: number; count: number }>();

  for (const scheduled of scheduledPostsData) {
    const postTime = scheduled.published_at || scheduled.scheduled_for;
    if (!postTime) {
      continue;
    }

    const date = new Date(postTime);
    const hour = date.getHours();
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const timeKey = `${hour}:00`;

    // Get engagement for this post
    const postAnalytics = analyticsData.filter(a => a.post_id === scheduled.post_id);
    const engagement = postAnalytics.reduce((sum, a) =>
      sum + (a.likes || 0) + (a.comments || 0) + (a.shares || 0), 0);

    // Track by hour
    const hourData = timeEngagementMap.get(timeKey) || { engagement: 0, count: 0 };
    timeEngagementMap.set(timeKey, {
      engagement: hourData.engagement + engagement,
      count: hourData.count + 1,
    });

    // Track by day of week
    const dayData = dayOfWeekMap.get(dayOfWeek) || { engagement: 0, count: 0 };
    dayOfWeekMap.set(dayOfWeek, {
      engagement: dayData.engagement + engagement,
      count: dayData.count + 1,
    });
  }

  // Find best performing times
  const bestTimes: Array<{ time: string; avgEngagement: number }> = [];
  for (const [time, data] of timeEngagementMap.entries()) {
    if (data.count > 0) {
      bestTimes.push({
        time,
        avgEngagement: data.engagement / data.count,
      });
    }
  }
  bestTimes.sort((a, b) => b.avgEngagement - a.avgEngagement);

  // Find best performing days
  const dayNames = isHebrew
    ? ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
    : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const bestDays: Array<{ day: string; avgEngagement: number }> = [];
  for (const [dayNum, data] of dayOfWeekMap.entries()) {
    if (data.count > 0 && dayNum >= 0 && dayNum < dayNames.length) {
      bestDays.push({
        day: dayNames[dayNum]!,
        avgEngagement: data.engagement / data.count,
      });
    }
  }
  bestDays.sort((a, b) => b.avgEngagement - a.avgEngagement);

  // Format timing analysis for prompt
  const timingAnalysis = bestTimes.length > 0
    ? `${isHebrew ? 'זמני פרסום מומלצים' : 'Best posting times'}: ${bestTimes.slice(0, 3).map(t => `${t.time} (${Math.round(t.avgEngagement)} avg engagement)`).join(', ')}`
    : '';

  const dayAnalysis = bestDays.length > 0
    ? `${isHebrew ? 'ימי שבוע מומלצים' : 'Best days'}: ${bestDays.slice(0, 3).map(d => `${d.day} (${Math.round(d.avgEngagement)} avg engagement)`).join(', ')}`
    : '';

  // Fetch social accounts
  let accountsQuery = supabase
    .from('social_accounts')
    .select('platform,account_name')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (brandId) {
    accountsQuery = accountsQuery.eq('brand_id', brandId);
  }

  const { data: accountsData } = await accountsQuery;

  // Prepare concise data summary for AI
  const postsContent = (postsData || []).slice(0, 15).map(p => p.content).filter(Boolean).join('\n');
  const platforms = [...new Set((accountsData || []).map(a => a.platform))];
  const totalPosts = postsData?.length || 0;
  const totalAccounts = accountsData?.length || 0;

  // Calculate engagement stats
  const totalEngagement = analyticsData.reduce((sum, a) => sum + (a.likes || 0) + (a.comments || 0) + (a.shares || 0), 0);
  const avgEngagement = totalPosts > 0 ? Math.round(totalEngagement / totalPosts) : 0;

  // Generate trends data from analytics
  const trendsData: { date: string; engagement: number; likes: number; comments: number; shares: number }[] = [];
  const dateMap = new Map<string, { likes: number; comments: number; shares: number }>();

  // Group analytics by date
  for (const analytics of analyticsData) {
    if (!analytics.date) {
      continue;
    }
    const date = new Date(analytics.date).toISOString().split('T')[0];
    if (!date) {
      continue;
    }
    const current = dateMap.get(date) || { likes: 0, comments: 0, shares: 0 };
    dateMap.set(date, {
      likes: current.likes + (analytics.likes || 0),
      comments: current.comments + (analytics.comments || 0),
      shares: current.shares + (analytics.shares || 0),
    });
  }

  // Convert to array and sort by date
  for (const [date, values] of dateMap.entries()) {
    trendsData.push({
      date,
      engagement: values.likes + values.comments + values.shares,
      likes: values.likes,
      comments: values.comments,
      shares: values.shares,
    });
  }

  trendsData.sort((a, b) => a.date.localeCompare(b.date));

  // Use ChatGPT if API key is available
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (openaiApiKey && postsContent) {
    try {
      const trendsSummary = trendsData.length > 0
        ? trendsData.slice(-7).map(t => `${t.date}: ${t.engagement}`).join(', ')
        : 'No data';

      const prompt = `${isHebrew ? 'נתח את הנתונים הבאים וספק המלצות קצרות:' : 'Analyze the following data and provide brief recommendations:'}

${isHebrew ? 'פוסטים' : 'Posts'}: ${totalPosts}
${isHebrew ? 'חשבונות' : 'Accounts'}: ${totalAccounts}
${isHebrew ? 'פלטפורמות' : 'Platforms'}: ${platforms.join(', ')}
${isHebrew ? 'ממוצע מעורבות' : 'Avg Engagement'}: ${avgEngagement}
${isHebrew ? 'טרנדים (7 ימים אחרונים)' : 'Trends (last 7 days)'}: ${trendsSummary}
${timingAnalysis ? `${timingAnalysis}\n` : ''}${dayAnalysis ? `${dayAnalysis}\n` : ''}
${isHebrew ? 'דוגמאות תוכן' : 'Sample Content'}:
${postsContent.slice(0, 500)}

${isHebrew
  ? 'ספק 4 קטגוריות, 3 המלצות קצרות כל אחת (JSON). חשוב: עבור קטגוריית timing, ספק זמנים מדויקים (יום + שעה) כמו "פרסם בימי שלישי בין 9:00-10:00" או "הזמן הטוב ביותר הוא יום רביעי בשעה 14:00". אל תספק הודעות כלליות כמו "פרסם בשעות השיא".'
  : 'Provide 4 categories, 3 short recommendations each (JSON). IMPORTANT: For the timing category, provide EXACT times (day + hour) like "Publish on Tuesdays between 9:00-10:00" or "Best time is Wednesday at 14:00". Do NOT provide generic messages like "post during peak hours".'}
{"timing":[],"content":[],"keywords":[],"strategy":[]}`;

      const result = await generateText({
        model: openai('gpt-4o-mini'),
        messages: [
          {
            role: 'system',
            content: `You are a social media expert. Return JSON only. Language: ${isHebrew ? 'Hebrew' : 'English'}. ${isHebrew
              ? 'עבור קטגוריית timing, תמיד ספק זמנים מדויקים (יום בשבוע + שעות) ולא הודעות כלליות.'
              : 'For the timing category, always provide EXACT times (day of week + hours) and never generic messages like "post during peak hours".'}`,
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
      });

      const content = JSON.parse(result.text || '{}');
      if (content.timing && content.content && content.keywords && content.strategy) {
        return NextResponse.json({
          ...content,
          trends: trendsData,
        });
      }
    } catch (error) {
      console.error('OpenAI API error:', error);
    }
  }

  // Generate fallback timing recommendations based on analyzed data
  let fallbackTiming: string[] = [];
  if (bestTimes.length > 0 && bestDays.length > 0) {
    // Use analyzed data to create specific recommendations
    const topTime = bestTimes[0];
    const topDay = bestDays[0];
    const secondDay = bestDays[1];

    if (topTime && topDay) {
      if (isHebrew) {
        fallbackTiming = [
          `פרסם ביום ${topDay.day} בשעה ${topTime.time} לקבלת מעורבות מקסימלית (${Math.round(topTime.avgEngagement)} מעורבות ממוצעת)`,
          secondDay ? `יום ${secondDay.day} גם מתאים לפרסום בשעות ${bestTimes.slice(0, 2).map(t => t.time).join(' או ')}` : `פרסם ביום ${topDay.day} בשעות ${bestTimes.slice(0, 2).map(t => t.time).join(' או ')}`,
          `הימנע מפרסום בשעות 13:00-15:00 - שעות עם מעורבות נמוכה`,
        ];
      } else {
        fallbackTiming = [
          `Publish on ${topDay.day} at ${topTime.time} for maximum engagement (${Math.round(topTime.avgEngagement)} avg engagement)`,
          secondDay ? `${secondDay.day} is also good for posting at ${bestTimes.slice(0, 2).map(t => t.time).join(' or ')}` : `Post on ${topDay.day} at ${bestTimes.slice(0, 2).map(t => t.time).join(' or ')}`,
          `Avoid posting between 13:00-15:00 - hours with low engagement`,
        ];
      }
    }
  } else {
    // Default fallback with exact times
    fallbackTiming = isHebrew
      ? [
          'פרסם בימי שלישי ורביעי בין 9:00-11:00 לקבלת מעורבות מקסימלית',
          'סוף השבוע (שבת-ראשון) בשעות 10:00-12:00 מתאים לתוכן אישי ומעורר השראה',
          'הימנע מפרסום בין 13:00-15:00 - שעות עמוסות עם מעורבות נמוכה',
        ]
      : [
          'Publish on Tuesdays and Wednesdays between 9:00-11:00 for maximum engagement',
          'Weekends (Saturday-Sunday) at 10:00-12:00 suit personal and inspiring content',
          'Avoid posting between 13:00-15:00 - busy hours with low engagement',
        ];
  }

  // Fallback to mock data
  const insights = isHebrew
    ? {
        timing: fallbackTiming,
        content: [
          'צור תוכן ויזואלי עם סיפורים אישיים - מגדיל מעורבות',
          'הוסף סרטוני הדרכה קצרים (30-60 שניות)',
          'שתף תוכן מאחורי הקלעים לחיבור אותנטי',
        ],
        keywords: [
          '#טיפיםמקצועיים #השראה #יזמות - האשטגים הפופולריים',
          'השתמש בטרנדים עכשוויים בצורה רלוונטית',
          'צור האשטגים ייחודיים למותג שלך',
        ],
        strategy: [
          'פתח אסטרטגיית תוכן חודשית: 70% מקורי, 30% משותף',
          'בנה שיתופי פעולה עם אינפלואנסרים',
          'התמקד בבניית קהילה פעילה',
        ],
        trends: trendsData.length > 0 ? trendsData : [],
      }
    : {
        timing: fallbackTiming,
        content: [
          'Create visual content with personal stories',
          'Add short tutorial videos (30-60 seconds)',
          'Share behind-the-scenes for authentic connection',
        ],
        keywords: [
          '#ProfessionalTips #Inspiration - popular hashtags',
          'Use current trends in brand-relevant way',
          'Create unique brand hashtags for community',
        ],
        strategy: [
          'Monthly strategy: 70% original, 30% shared content',
          'Build influencer collaborations',
          'Focus on active community building',
        ],
        trends: trendsData.length > 0 ? trendsData : [],
      };

  return NextResponse.json(insights);
}
