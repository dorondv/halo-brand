import { format, subDays, subMonths } from 'date-fns';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/libs/Supabase';

// Explicitly use Node.js runtime (not Edge) for OpenAI API calls
export const runtime = 'nodejs';

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

  const { keywords, brandName, brandId, locale = 'he' } = parsed.data;
  const isHebrew = locale === 'he';

  // Get user ID
  const { data: userRecord } = await supabase
    .from('users')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  const userId = userRecord?.id || user.id;

  // Fetch connected platforms for the brand
  let connectedPlatforms: string[] = [];
  if (brandId) {
    const { data: accountsData } = await supabase
      .from('social_accounts')
      .select('platform')
      .eq('user_id', userId)
      .eq('brand_id', brandId)
      .eq('is_active', true);

    if (accountsData && accountsData.length > 0) {
      // Map platform names to mention source format
      const platformSet = new Set<string>();
      accountsData.forEach((acc) => {
        const platform = (acc.platform || '').toLowerCase();
        if (platform === 'twitter' || platform === 'x') {
          platformSet.add('twitter');
        } else if (platform === 'facebook') {
          platformSet.add('facebook');
        } else if (platform === 'instagram') {
          platformSet.add('instagram');
        } else if (platform === 'linkedin') {
          platformSet.add('linkedin');
        }
      });
      connectedPlatforms = Array.from(platformSet);
    }
  }

  // Fetch posts from database
  let posts: any[] = [];
  if (brandId) {
    const { data: postsData } = await supabase
      .from('posts')
      .select('id,content,created_at,platforms')
      .eq('user_id', userId)
      .eq('brand_id', brandId)
      .in('status', ['published', 'scheduled', 'draft'])
      .order('created_at', { ascending: false })
      .limit(30);

    posts = postsData || [];
  }

  // Generate realistic search trends based on posts activity
  const baseVolume = posts.length > 0 ? Math.min(50 + posts.length * 2, 100) : 30;
  const searchTrendsDaily = [];
  for (let i = 29; i >= 0; i--) {
    const dayDate = subDays(new Date(), i);
    const dayOfWeek = dayDate.getDay();
    // Higher volume on weekdays, lower on weekends
    const dayMultiplier = dayOfWeek >= 1 && dayOfWeek <= 5 ? 1.2 : 0.8;
    const variation = (Math.sin(i / 5) * 0.3 + 1) * 0.5; // Smooth variation
    searchTrendsDaily.push({
      date: format(dayDate, 'yyyy-MM-dd'),
      volume: Math.floor(baseVolume * dayMultiplier * variation + Math.random() * 10),
    });
  }

  const searchTrendsMonthly = [];
  const monthNames = isHebrew
    ? ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']
    : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  for (let i = 11; i >= 0; i--) {
    const date = subMonths(new Date(), i);
    const monthMultiplier = 0.8 + (Math.sin(i / 3) * 0.2 + 1) * 0.1; // Gradual trend
    searchTrendsMonthly.push({
      month: `${monthNames[date.getMonth()]} ${date.getFullYear()}`,
      volume: Math.floor(baseVolume * 1.5 * monthMultiplier + Math.random() * 15),
    });
  }

  // Prepare posts content for AI
  const postsContent = posts.slice(0, 15).map(p => p.content).filter(Boolean).join('\n');

  // Use ChatGPT if API key is available
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (openaiApiKey) {
    try {
      const platformsText = connectedPlatforms.length > 0
        ? `${isHebrew ? 'פלטפורמות מחוברות' : 'Connected platforms'}: ${connectedPlatforms.join(', ')}\n`
        : '';

      const prompt = `${isHebrew ? 'נתח סנטימנט מותג' : 'Analyze brand sentiment'} for "${brandName || keywords}"

${platformsText}${posts.length > 0 ? `${isHebrew ? 'פוסטים מהמותג' : 'Brand posts'}:\n${postsContent.slice(0, 500)}\n` : ''}

${isHebrew ? 'ספק ניתוח JSON מפורט:' : 'Provide detailed JSON analysis:'}
{
  "overall_score": 0-100,
  "positive_percentage": 0-100,
  "negative_percentage": 0-100,
  "neutral_percentage": 0-100,
  "positive_themes": ["theme1", "theme2", "theme3"],
  "negative_themes": ["theme1", "theme2", "theme3"],
  "sample_mentions": [
    {"content": "realistic mention text", "source": "${connectedPlatforms.length > 0 ? connectedPlatforms[0] : 'twitter'}|${connectedPlatforms.length > 1 ? connectedPlatforms[1] : 'facebook'}|${connectedPlatforms.length > 2 ? connectedPlatforms[2] : 'instagram'}|linkedin|blog|news", "sentiment": "positive|negative|neutral"}
  ]
}

${isHebrew
  ? `חשוב מאוד:
- ספק לפחות 3-4 נושאים חיוביים ו-3-4 נושאים שליליים (אפילו אם הם קטנים)
- ספק 6-8 sample_mentions עם תערובת מאוזנת של סנטימנטים (לפחות 2 חיוביים, 2 שליליים, 2 ניטרליים)
- ה-sample_mentions צריכים להיות קשורים ישירות לנושאים שזיהית ב-positive_themes ו-negative_themes
- ${connectedPlatforms.length > 0 ? `העדף mentions מהפלטפורמות המחוברות: ${connectedPlatforms.join(', ')}` : 'השתמש בפלטפורמות שונות'}
- כל mention צריך להיות ריאליסטי ומתאים למותג "${brandName || keywords}"
- ה-overall_score צריך להתאים לחישוב: positive_percentage + (neutral_percentage * 0.5)`
  : `CRITICAL REQUIREMENTS:
- Provide at least 3-4 positive_themes and 3-4 negative_themes (even if minor)
- Provide 6-8 sample_mentions with balanced mix of sentiments (at least 2 positive, 2 negative, 2 neutral)
- sample_mentions must directly relate to the themes identified in positive_themes and negative_themes
- ${connectedPlatforms.length > 0 ? `Prioritize mentions from connected platforms: ${connectedPlatforms.join(', ')}` : 'Use diverse platforms'}
- Each mention should be realistic and relevant to brand "${brandName || keywords}"
- overall_score should match calculation: positive_percentage + (neutral_percentage * 0.5)`}`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are a professional brand sentiment analysis expert specializing in social media analytics. 
Return JSON only. Language: ${isHebrew ? 'Hebrew' : 'English'}. 
Requirements:
- Always provide 3-4 positive_themes and 3-4 negative_themes (even if minor concerns)
- Include 6-8 sample_mentions with balanced distribution: at least 2 positive, 2 negative, 2 neutral
- sample_mentions must directly connect to the themes you identify
- ${connectedPlatforms.length > 0 ? `Prioritize mentions from these platforms: ${connectedPlatforms.join(', ')}` : 'Use diverse social media platforms'}
- Make mentions realistic and brand-specific
- Ensure overall_score aligns with sentiment percentages (positive% + neutral%*0.5)
- All percentages must sum to 100`,
            },
            { role: 'user', content: prompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.7,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = JSON.parse(data.choices[0]?.message?.content || '{}');
        if (content.overall_score !== undefined || (content.positive_percentage !== undefined && content.negative_percentage !== undefined)) {
          // Calculate overall_score dynamically based on sentiment percentages if not provided or to ensure it's accurate
          const positive = content.positive_percentage || 0;
          const neutral = content.neutral_percentage || 0;

          // Calculate score: positive counts fully, neutral counts half, negative counts zero
          // Formula: positive% + (neutral% * 0.5)
          const calculatedScore = Math.round(positive + (neutral * 0.5));

          // Use calculated score if OpenAI didn't provide one, or if the provided score seems inconsistent
          // (more than 10 points difference suggests inconsistency)
          const providedScore = content.overall_score || 0;
          const scoreDifference = Math.abs(calculatedScore - providedScore);
          const finalScore = scoreDifference > 10 ? calculatedScore : (providedScore || calculatedScore);

          return NextResponse.json({
            ...content,
            overall_score: finalScore,
            search_trends_daily: searchTrendsDaily,
            search_trends_monthly: searchTrendsMonthly,
          });
        }
      } else {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error('OpenAI API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        });
      }
    } catch (error) {
      console.error('OpenAI API error:', error);
      // Don't throw - fall through to error response
    }
  }

  // Return error if OpenAI is not configured
  return NextResponse.json(
    { error: isHebrew ? 'OpenAI API לא מוגדר. אנא הגדר OPENAI_API_KEY.' : 'OpenAI API not configured. Please set OPENAI_API_KEY.' },
    { status: 503 },
  );
}
