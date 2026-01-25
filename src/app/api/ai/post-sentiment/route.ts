import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { fetchCommentsForPost } from '@/libs/socialvault';
import { getUserSubscription } from '@/libs/subscriptionService';
import { createSupabaseServerClient } from '@/libs/Supabase';

// Note: Using Node.js runtime instead of Edge because createSupabaseServerClient
// requires cookies() from next/headers which is not available in Edge runtime

const PostSentimentSchema = z.object({
  postId: z.string().uuid(),
  postContent: z.string().min(1),
  platform: z.string().optional(),
  engagement: z.object({
    likes: z.number().optional(),
    comments: z.number().optional(),
    shares: z.number().optional(),
  }).optional(),
  locale: z.string().optional().default('he'),
});

// Types
type PlatformData = {
  platformPostUrl: string | null;
  accountPlatform: string;
};

type Comment = {
  text: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  author: string;
};

type SentimentAnalysisResult = {
  overall_sentiment: string;
  sentiment_distribution: {
    positive: number;
    negative: number;
    neutral: number;
    mixed: number;
  };
  main_themes: string[];
  common_emotions: string[];
  recommendations: string[];
  sample_comments: Comment[];
  engagement_score: number;
};

// Constants
const MAX_COMMENT_TEXT_MATCH_LENGTH = 50;
const MAX_COMMENTS_TO_RETURN = 10;
const POST_CONTENT_PREVIEW_LENGTH = 500;

const SENTIMENT_ORDER = { positive: 0, neutral: 1, negative: 2 } as const;

// Helper Functions

/**
 * Normalize platform name (twitter -> x, etc.)
 */
function normalizePlatform(platform: string): string {
  const normalized = platform.toLowerCase();
  return normalized === 'twitter' ? 'x' : normalized;
}

/**
 * Detect platform from URL
 */
function detectPlatformFromUrl(url: string): string {
  const normalizedUrl = url.toLowerCase();
  if (normalizedUrl.includes('instagram.com')) {
    return 'instagram';
  }
  if (normalizedUrl.includes('facebook.com')) {
    return 'facebook';
  }
  if (normalizedUrl.includes('tiktok.com')) {
    return 'tiktok';
  }
  if (normalizedUrl.includes('twitter.com') || normalizedUrl.includes('x.com')) {
    return 'x';
  }
  if (normalizedUrl.includes('youtube.com') || normalizedUrl.includes('youtu.be')) {
    return 'youtube';
  }
  if (normalizedUrl.includes('linkedin.com')) {
    return 'linkedin';
  }
  return 'instagram'; // default
}

/**
 * Extract platform post URL from analytics metadata
 */
function extractUrlFromAnalytics(analyticsData: Array<{ metadata?: unknown }>): PlatformData | null {
  for (const analytics of analyticsData) {
    if (!analytics.metadata) {
      continue;
    }

    const metadata = analytics.metadata as Record<string, unknown>;

    // Check direct platformPostUrl
    if (metadata.platformPostUrl) {
      const url = String(metadata.platformPostUrl);
      return {
        platformPostUrl: url,
        accountPlatform: detectPlatformFromUrl(url),
      };
    }

    // Check nested platforms array
    if (Array.isArray(metadata.platforms)) {
      const platformWithUrl = metadata.platforms.find((p: unknown) => {
        if (typeof p === 'object' && p !== null) {
          return !!(p as Record<string, unknown>).platformPostUrl;
        }
        return false;
      }) as Record<string, unknown> | undefined;

      if (platformWithUrl?.platformPostUrl) {
        const url = String(platformWithUrl.platformPostUrl);
        return {
          platformPostUrl: url,
          accountPlatform: platformWithUrl.platform
            ? normalizePlatform(String(platformWithUrl.platform))
            : detectPlatformFromUrl(url),
        };
      }
    }
  }

  return null;
}

/**
 * Parse platforms data (handles both JSON string and array)
 */
function parsePlatformsData(platforms: unknown): unknown[] {
  if (Array.isArray(platforms)) {
    return platforms;
  }

  if (typeof platforms === 'string') {
    try {
      return JSON.parse(platforms) as unknown[];
    } catch {
      return [];
    }
  }

  return [];
}

/**
 * Extract URL from platforms array
 */
function extractUrlFromPlatformsArray(platformsArray: unknown[]): PlatformData | null {
  for (const platformData of platformsArray) {
    if (typeof platformData !== 'object' || platformData === null) {
      continue;
    }

    const platformObj = platformData as Record<string, unknown>;
    if (platformObj.platformPostUrl) {
      const url = String(platformObj.platformPostUrl);
      return {
        platformPostUrl: url,
        accountPlatform: platformObj.platform
          ? normalizePlatform(String(platformObj.platform))
          : detectPlatformFromUrl(url),
      };
    }
  }

  return null;
}

/**
 * Extract platform post URL from multiple possible sources
 */
async function extractPlatformPostUrl(
  postId: string,
  post: { metadata?: unknown; platforms?: unknown },
  defaultPlatform: string | undefined,
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
): Promise<PlatformData> {
  const metadata = (post.metadata as Record<string, unknown>) || {};
  let platformPostUrl: string | null = null;
  const accountPlatform = normalizePlatform(defaultPlatform || 'instagram');

  // Priority 1: Check post_analytics metadata (most reliable source)
  const { data: analyticsData } = await supabase
    .from('post_analytics')
    .select('metadata')
    .eq('post_id', postId)
    .limit(10);

  if (analyticsData && analyticsData.length > 0) {
    const result = extractUrlFromAnalytics(analyticsData);
    if (result) {
      return result;
    }
  }

  // Priority 2: Check post.platforms directly
  if (post.platforms) {
    const platformsArray = parsePlatformsData(post.platforms);
    const result = extractUrlFromPlatformsArray(platformsArray);
    if (result) {
      return result;
    }
  }

  // Priority 3: Check post.metadata.platformPostUrl directly
  if (metadata.platformPostUrl) {
    platformPostUrl = String(metadata.platformPostUrl);
    // Detect platform from URL if we have a URL
    const detectedPlatform = detectPlatformFromUrl(platformPostUrl);
    return { platformPostUrl, accountPlatform: detectedPlatform };
  }

  // Priority 4: Check post.metadata.platforms array
  if (!platformPostUrl && Array.isArray(metadata.platforms)) {
    const result = extractUrlFromPlatformsArray(metadata.platforms);
    if (result) {
      return result;
    }
  }

  return { platformPostUrl, accountPlatform };
}

/**
 * Format comments for AI analysis
 */
function formatCommentsForAI(comments: Array<{ text: string; author: string }>, isHebrew: boolean): string {
  if (comments.length === 0) {
    return '';
  }

  const header = isHebrew
    ? '\nתגובות אמיתיות מהפלטפורמה (ניתוח כל תגובה בנפרד):\n'
    : '\nReal comments from platform (analyze each comment separately):\n';

  const formattedComments = comments
    .map((c, idx) => `${idx + 1}. "${c.text}" ${isHebrew ? 'מאת' : 'by'} @${c.author}`)
    .join('\n');

  return header + formattedComments;
}

/**
 * Build AI prompt for sentiment analysis
 */
function buildSentimentPrompt(
  postContent: string,
  platform: string | undefined,
  engagement: { likes?: number; comments?: number; shares?: number } | undefined,
  commentsText: string,
  isHebrew: boolean,
): string {
  const engagementText = engagement
    ? `${isHebrew ? 'מעורבות' : 'Engagement'}: ${engagement.likes || 0} ${isHebrew ? 'לייקים' : 'likes'}, ${engagement.comments || 0} ${isHebrew ? 'תגובות' : 'comments'}, ${engagement.shares || 0} ${isHebrew ? 'שיתופים' : 'shares'}`
    : '';

  const platformText = platform ? `${isHebrew ? 'פלטפורמה' : 'Platform'}: ${platform}` : '';

  return `${isHebrew ? 'נתח סנטימנט פוסט ותגובות' : 'Analyze post sentiment and comments'}:

${isHebrew ? 'תוכן הפוסט' : 'Post Content'}: "${postContent.slice(0, POST_CONTENT_PREVIEW_LENGTH)}"
${platformText}
${engagementText}${commentsText}

${isHebrew ? 'משימות:' : 'Tasks:'}
1. ${isHebrew ? 'נתח את הסנטימנט הכללי של הפוסט והתגובות' : 'Analyze the overall sentiment of the post and comments'}
2. ${isHebrew ? 'חשב התפלגות סנטימנט על בסיס התגובות האמיתיות (אם יש תגובות)' : 'Calculate sentiment distribution based on real comments (if comments exist)'}
3. ${isHebrew ? 'זהה נושאים מרכזיים מהתגובות' : 'Identify main themes from the comments'}
4. ${isHebrew ? 'זהה רגשות נפוצים' : 'Identify common emotions'}
5. ${isHebrew ? 'ספק המלצות מעשיות לשיפור על בסיס התגובות האמיתיות' : 'Provide actionable recommendations for improvement based on real comments'}
6. ${isHebrew ? 'נתח כל תגובה בנפרד וקבע סנטימנט (positive/negative/neutral)' : 'Analyze each comment separately and determine sentiment (positive/negative/neutral)'}
7. ${isHebrew ? 'הצג את התגובות המובילות (עם שם משתמש וסנטימנט)' : 'Show top comments (with username and sentiment)'}

${isHebrew ? 'ספק JSON:' : 'Provide JSON:'}
{
  "overall_sentiment": "positive|negative|neutral|mixed",
  "sentiment_distribution": {
    "positive": 0-100,
    "negative": 0-100,
    "neutral": 0-100,
    "mixed": 0-100
  },
  "main_themes": ["theme1", "theme2"],
  "common_emotions": ["emotion1", "emotion2"],
  "recommendations": ["specific actionable recommendation based on real comments", "another recommendation"],
  "sample_comments": [
    {"text": "actual comment text from above", "sentiment": "positive|negative|neutral", "author": "actual username"}
  ],
  "engagement_score": 0-100
}

${isHebrew ? 'חשוב:' : 'Important:'}
- ${isHebrew ? 'אם יש תגובות אמיתיות, השתמש בהן ב-sample_comments עם הסנטימנט המנותח שלך' : 'If real comments exist, use them in sample_comments with your analyzed sentiment'}
- ${isHebrew ? 'המלצות צריכות להיות ספציפיות ומבוססות על התגובות האמיתיות' : 'Recommendations should be specific and based on real comments'}
- ${isHebrew ? 'התפלגות הסנטימנט צריכה לשקף את התגובות האמיתיות' : 'Sentiment distribution should reflect the real comments'}`;
}

/**
 * Extract JSON from AI response (handles markdown code blocks)
 */
function extractJSONFromResponse(text: string): string {
  let jsonText = text.trim();

  // Remove markdown code blocks
  jsonText = jsonText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  // Find JSON object boundaries
  const jsonStart = jsonText.indexOf('{');
  const jsonEnd = jsonText.lastIndexOf('}');

  if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
    return jsonText.substring(jsonStart, jsonEnd + 1);
  }

  return jsonText;
}

/**
 * Check if two comment texts match (fuzzy matching)
 */
function commentsMatch(text1: string, text2: string): boolean {
  const t1 = text1.toLowerCase().slice(0, MAX_COMMENT_TEXT_MATCH_LENGTH);
  const t2 = text2.toLowerCase().slice(0, MAX_COMMENT_TEXT_MATCH_LENGTH);
  return t1.includes(t2) || t2.includes(t1);
}

/**
 * Match AI-analyzed comments with real comments
 */
function matchCommentsWithSentiment(
  realComments: Comment[],
  aiComments: Array<{ text?: string; sentiment?: string; author?: string }>,
): Comment[] {
  return realComments.map((realComment) => {
    const matchingAiComment = aiComments.find(aiC =>
      aiC.text && realComment.text && commentsMatch(aiC.text, realComment.text),
    );

    return {
      text: realComment.text,
      sentiment: (matchingAiComment?.sentiment as Comment['sentiment']) || realComment.sentiment || 'neutral',
      author: realComment.author,
    };
  });
}

/**
 * Sort comments by sentiment (positive first, then neutral, then negative)
 */
function sortCommentsBySentiment(comments: Comment[]): Comment[] {
  return comments.sort((a, b) => {
    const aOrder = SENTIMENT_ORDER[a.sentiment] ?? 1;
    const bOrder = SENTIMENT_ORDER[b.sentiment] ?? 1;
    return aOrder - bOrder;
  });
}

/**
 * Calculate sentiment distribution from comments
 */
function calculateSentimentDistribution(comments: Comment[]): {
  positive: number;
  negative: number;
  neutral: number;
  mixed: number;
} {
  const total = comments.length;
  if (total === 0) {
    return { positive: 0, negative: 0, neutral: 0, mixed: 0 };
  }

  const positiveCount = comments.filter(c => c.sentiment === 'positive').length;
  const negativeCount = comments.filter(c => c.sentiment === 'negative').length;
  const neutralCount = comments.filter(c => c.sentiment === 'neutral').length;

  return {
    positive: Math.round((positiveCount / total) * 100),
    negative: Math.round((negativeCount / total) * 100),
    neutral: Math.round((neutralCount / total) * 100),
    mixed: 0,
  };
}

/**
 * Process AI response and merge with real comments
 */
function processAIResponse(
  aiResponse: SentimentAnalysisResult,
  realComments: Comment[],
): SentimentAnalysisResult {
  const result = { ...aiResponse };

  // If we have real comments, merge AI sentiment analysis with them
  if (realComments.length > 0) {
    const aiComments = Array.isArray(result.sample_comments) ? result.sample_comments : [];
    const commentsWithSentiment = matchCommentsWithSentiment(realComments, aiComments);

    // Add unmatched AI comments (shouldn't happen, but handle gracefully)
    const unmatchedAiComments = aiComments.filter(aiC =>
      !realComments.some(sc => sc.text && aiC.text && commentsMatch(sc.text, aiC.text)),
    ).map(c => ({
      text: c.text || '',
      sentiment: (c.sentiment as Comment['sentiment']) || 'neutral',
      author: c.author || 'Unknown',
    }));

    // Sort and limit comments
    result.sample_comments = sortCommentsBySentiment([...commentsWithSentiment, ...unmatchedAiComments])
      .slice(0, MAX_COMMENTS_TO_RETURN);

    // Recalculate sentiment distribution based on analyzed comments
    result.sentiment_distribution = calculateSentimentDistribution(result.sample_comments);
  }

  return result;
}

// Main Route Handler

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  const subscription = await getUserSubscription(user.id);

  if (!subscription) {
    return NextResponse.json(
      { error: 'Semantic analysis is only available for Pro and Business plans. Please upgrade to access this feature.' },
      { status: 403 },
    );
  }

  const now = new Date();
  const isSubscriptionActive = subscription.status === 'active' || subscription.status === 'trialing';
  const isNotExpired = !subscription.endDate || new Date(subscription.endDate) > now;

  if (!isSubscriptionActive || !isNotExpired) {
    return NextResponse.json(
      { error: 'Your subscription is not active. Please renew your subscription to access this feature.' },
      { status: 403 },
    );
  }

  const planType = subscription.planType || 'free';

  if (planType !== 'pro' && planType !== 'business') {
    return NextResponse.json(
      { error: 'Semantic analysis is only available for Pro and Business plans. Please upgrade to access this feature.' },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = PostSentimentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 422 });
  }

  const { postId, postContent, platform, engagement, locale = 'he' } = parsed.data;
  const isHebrew = locale === 'he';

  const { data: post, error: postError } = await supabase
    .from('posts')
    .select('id,user_id,metadata,platforms')
    .eq('id', postId)
    .eq('user_id', user.id)
    .single();

  if (postError || !post) {
    return NextResponse.json(
      { error: isHebrew ? 'פוסט לא נמצא או שאין לך הרשאה לגשת אליו' : 'Post not found or you do not have permission to access it' },
      { status: 404 },
    );
  }

  if (!post) {
    return NextResponse.json({ error: 'Post not found or access denied' }, { status: 404 });
  }

  // Fetch comments from SocialVault API
  let sampleComments: Comment[] = [];
  let accountPlatform: string = normalizePlatform(platform || 'instagram');
  let platformPostUrl: string | null = null;

  try {
    const platformData = await extractPlatformPostUrl(
      postId,
      post,
      platform,
      await supabase,
    );
    platformPostUrl = platformData.platformPostUrl;
    accountPlatform = platformData.accountPlatform;

    // Fetch comments using SocialVault API
    // Using default amount (15 comments = 1 credit) to keep cost at 1 credit per request
    // Docs: https://docs.sociavault.com/api-reference/instagram/comments
    // Validate platformPostUrl is a non-empty string before making API call
    if (platformPostUrl && typeof platformPostUrl === 'string' && platformPostUrl.trim().length > 0) {
      // Double-check URL is valid before making API call
      const trimmedUrl = platformPostUrl.trim();
      if (trimmedUrl && trimmedUrl.length > 0 && trimmedUrl !== 'undefined' && trimmedUrl !== 'null') {
        try {
          const socialVaultComments = await fetchCommentsForPost(accountPlatform, trimmedUrl);

          // Format comments for sample_comments (sentiment will be analyzed by AI)
          if (socialVaultComments.length > 0) {
            sampleComments = socialVaultComments.map(comment => ({
              text: comment.text,
              sentiment: 'neutral' as const, // Will be analyzed by AI
              author: comment.user.username || 'Unknown',
            }));
          }
        } catch (commentError) {
          // Log error but don't throw - continue with analysis without comments
          console.error(
            `[Post Sentiment] Error fetching comments from SocialVault for ${accountPlatform} post (${trimmedUrl}):`,
            commentError,
          );
          // sampleComments remains empty, analysis will continue without comments
        }
      } else {
        console.warn(
          `[Post Sentiment] Invalid platformPostUrl detected for post ${postId}: "${platformPostUrl}" (type: ${typeof platformPostUrl})`,
        );
      }
    } else {
      console.warn(
        `[Post Sentiment] No platformPostUrl found for post ${postId}. `
        + `Checked: post.platforms, post.metadata, post_analytics.metadata`,
      );
    }
  } catch (error) {
    console.error('[Post Sentiment] Error in comment fetching:', error);
  }

  // Use ChatGPT if API key is available
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey || !postContent) {
    return NextResponse.json(
      {
        error: isHebrew
          ? 'OpenAI API לא מוגדר. אנא הגדר OPENAI_API_KEY.'
          : 'OpenAI API not configured. Please set OPENAI_API_KEY.',
      },
      { status: 503 },
    );
  }

  try {
    const commentsText = formatCommentsForAI(sampleComments, isHebrew);
    const prompt = buildSentimentPrompt(postContent, platform, engagement, commentsText, isHebrew);

    const result = await generateText({
      model: openai('gpt-4o-mini'),
      messages: [
        {
          role: 'system',
          content: `You are a post sentiment analysis expert. Return JSON only. Language: ${isHebrew ? 'Hebrew' : 'English'}.`,
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
    });

    // Extract and parse JSON from response
    const jsonText = extractJSONFromResponse(result.text || '{}');
    let content: SentimentAnalysisResult;

    try {
      content = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('JSON parsing error:', parseError);
      console.error('Response text:', result.text);
      console.error('Cleaned text:', jsonText);
      throw new Error(
        `Invalid JSON response from AI: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
      );
    }

    if (content.overall_sentiment === undefined) {
      throw new Error('AI response missing required field: overall_sentiment');
    }

    // Process and merge with real comments
    const processedContent = processAIResponse(content, sampleComments);

    // Save sentiment analysis results to database
    try {
      // Get or create post_analytics record for this post
      const { data: existingAnalytics } = await supabase
        .from('post_analytics')
        .select('id, metadata')
        .eq('post_id', postId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const existingMetadata = (existingAnalytics?.metadata as Record<string, unknown>) || {};

      // Prepare sentiment analysis data to save
      const sentimentData = {
        ...existingMetadata,
        sentimentAnalysis: {
          overall_sentiment: processedContent.overall_sentiment,
          sentiment_distribution: processedContent.sentiment_distribution,
          main_themes: processedContent.main_themes || [],
          common_emotions: processedContent.common_emotions || [],
          recommendations: processedContent.recommendations || [],
          engagement_score: processedContent.engagement_score || 0,
          analyzed_at: new Date().toISOString(),
          platform: accountPlatform || platform || 'unknown',
          comments_analyzed: sampleComments.length,
        },
        // Store comments with sentiment analysis
        comments: processedContent.sample_comments?.map(comment => ({
          text: comment.text,
          sentiment: comment.sentiment,
          author: comment.author,
        })) || [],
      };

      if (existingAnalytics?.id) {
        // Update existing analytics record
        const { error: updateError } = await supabase
          .from('post_analytics')
          .update({
            metadata: sentimentData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingAnalytics.id);

        if (updateError) {
          console.error('[Post Sentiment] Error updating analytics:', updateError);
        }
      } else {
        // Create new analytics record
        const { error: insertError } = await supabase
          .from('post_analytics')
          .insert({
            post_id: postId,
            date: new Date().toISOString(),
            metadata: sentimentData,
            // Use engagement data from the request if available
            likes: engagement?.likes || 0,
            comments: engagement?.comments || sampleComments.length,
            shares: engagement?.shares || 0,
          });

        if (insertError) {
          console.error('[Post Sentiment] Error creating analytics:', insertError);
        }
      }
    } catch (dbError) {
      // Log error but don't fail the request - sentiment analysis was successful
      console.error('[Post Sentiment] Error saving to database:', dbError);
    }

    return NextResponse.json(processedContent);
  } catch (error) {
    console.error('OpenAI API error:', error);
    return NextResponse.json(
      {
        error: isHebrew
          ? 'שגיאה בניתוח הסנטימנט. אנא נסה שוב.'
          : 'Error analyzing sentiment. Please try again.',
      },
      { status: 500 },
    );
  }
}
