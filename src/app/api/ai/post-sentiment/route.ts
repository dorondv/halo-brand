import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/libs/Supabase';

export const runtime = 'edge';

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

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = PostSentimentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 422 });
  }

  const { postId, postContent, platform, engagement, locale = 'he' } = parsed.data;
  const isHebrew = locale === 'he';

  // Verify the post belongs to the user
  const { data: post } = await supabase
    .from('posts')
    .select('id,user_id')
    .eq('id', postId)
    .eq('user_id', user.id)
    .single();

  if (!post) {
    return NextResponse.json({ error: 'Post not found or access denied' }, { status: 404 });
  }

  // Use ChatGPT if API key is available
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (openaiApiKey && postContent) {
    try {
      const engagementText = engagement
        ? `${isHebrew ? 'מעורבות' : 'Engagement'}: ${engagement.likes || 0} ${isHebrew ? 'לייקים' : 'likes'}, ${engagement.comments || 0} ${isHebrew ? 'תגובות' : 'comments'}, ${engagement.shares || 0} ${isHebrew ? 'שיתופים' : 'shares'}`
        : '';

      const prompt = `${isHebrew ? 'נתח סנטימנט פוסט' : 'Analyze post sentiment'}:

${isHebrew ? 'תוכן' : 'Content'}: "${postContent.slice(0, 300)}"
${platform ? `${isHebrew ? 'פלטפורמה' : 'Platform'}: ${platform}` : ''}
${engagementText}

${isHebrew ? 'ספק JSON:' : 'Provide JSON:'}
{"overall_sentiment":"positive|negative|neutral|mixed","sentiment_distribution":{"positive":0-100,"negative":0-100,"neutral":0-100,"mixed":0-100},"main_themes":["theme1"],"common_emotions":["emotion1"],"recommendations":["rec1"],"sample_comments":[{"text":"comment","sentiment":"positive|negative|neutral","author":"name"}],"engagement_score":0-100}`;

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

      const content = JSON.parse(result.text || '{}');
      if (content.overall_sentiment !== undefined) {
        return NextResponse.json(content);
      }
    } catch (error) {
      console.error('OpenAI API error:', error);
    }
  }

  // Return error if OpenAI is not configured
  return NextResponse.json(
    { error: isHebrew ? 'OpenAI API לא מוגדר. אנא הגדר OPENAI_API_KEY.' : 'OpenAI API not configured. Please set OPENAI_API_KEY.' },
    { status: 503 },
  );
}
