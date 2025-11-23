import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/libs/Supabase';

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

  const { postId, locale = 'he' } = parsed.data;
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

  // Return mock sentiment data (AI disabled for now)

  // Mock sentiment data (fallback if OpenAI is not configured)
  const mockSentiment = isHebrew
    ? {
        overall_sentiment: 'positive',
        sentiment_distribution: {
          positive: 65,
          negative: 10,
          neutral: 20,
          mixed: 5,
        },
        main_themes: [
          'התלהבות מהמוצר',
          'שאלות טכניות',
          'משוב חיובי',
        ],
        common_emotions: ['שמחה', 'התרגשות', 'סקרנות'],
        recommendations: [
          'המשך לפרסם תוכן דומה',
          'ענה על שאלות טכניות במהירות',
          'שתף עוד פרטים על המוצר',
        ],
        sample_comments: [
          {
            text: 'נראה מעולה! מתי זה יהיה זמין?',
            sentiment: 'positive',
            author: 'משתמש 1',
          },
          {
            text: 'יש לי שאלה לגבי התכונות',
            sentiment: 'neutral',
            author: 'משתמש 2',
          },
          {
            text: 'מצפה לנסות את זה!',
            sentiment: 'positive',
            author: 'משתמש 3',
          },
        ],
        engagement_score: 75,
      }
    : {
        overall_sentiment: 'positive',
        sentiment_distribution: {
          positive: 65,
          negative: 10,
          neutral: 20,
          mixed: 5,
        },
        main_themes: [
          'Product excitement',
          'Technical questions',
          'Positive feedback',
        ],
        common_emotions: ['Happiness', 'Excitement', 'Curiosity'],
        recommendations: [
          'Continue posting similar content',
          'Answer technical questions quickly',
          'Share more product details',
        ],
        sample_comments: [
          {
            text: 'Looks great! When will this be available?',
            sentiment: 'positive',
            author: 'User 1',
          },
          {
            text: 'I have a question about the features',
            sentiment: 'neutral',
            author: 'User 2',
          },
          {
            text: 'Looking forward to trying this!',
            sentiment: 'positive',
            author: 'User 3',
          },
        ],
        engagement_score: 75,
      };

  return NextResponse.json(mockSentiment);
}
