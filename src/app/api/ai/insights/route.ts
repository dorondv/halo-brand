import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/libs/Supabase';

const InsightsSchema = z.object({
  prompt: z.string().min(1),
  postsCount: z.number().optional(),
  accountsCount: z.number().optional(),
  platforms: z.array(z.string()).optional(),
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

  // For now, return mock insights based on the data
  // In production, this would call OpenAI or another LLM service
  const { postsCount = 0, locale = 'he' } = parsed.data;
  const isHebrew = locale === 'he';

  // Generate insights based on the data and locale
  const insights = isHebrew
    ? {
        timing: [
          postsCount > 10
            ? 'פרסם בימי שלישי ורביעי בין 9:00-11:00 לקבלת מעורבות מקסימלית'
            : 'פרסם בימי שלישי ורביעי בין 9:00-11:00 לקבלת מעורבות מקסימלית',
          'סוף השבוע (שבת-ראשון) מתאים לתוכן אישי ומעורר השראה',
          'הימנע מפרסום בין 13:00-15:00 - שעות עמוסות עם מעורבות נמוכה',
        ],
        content: [
          'צור תוכן ויזואלי עם סיפורים אישיים - מגדיל מעורבות ב-45%',
          'הוסף סרטוני הדרכה קצרים (30-60 שניות) - פורמט פופולרי',
          'שתף תוכן מאחורי הקלעים לחיבור אותנטי עם הקהל',
        ],
        keywords: [
          '#טיפיםמקצועיים #השראה #יזמות - האשטגים הפופולריים ביותר בתחום',
          'השתמש בטרנדים עכשוויים אבל בצורה רלוונטית למותג',
          'צור האשטגים ייחודיים למותג שלך לבניית קהילה',
        ],
        strategy: [
          'פתח אסטרטגיית תוכן חודשית עם 70% תוכן מקורי, 30% תוכן משותף',
          'בנה שיתופי פעולה עם אינפלואנסרים בתחום שלך',
          'התמקד בבניית קהילה פעילה במקום רק גידול במספר עוקבים',
        ],
      }
    : {
        timing: [
          'Publish on Tuesdays and Wednesdays between 9:00-11:00 for maximum engagement',
          'Weekends (Saturday-Sunday) are suitable for personal and inspiring content',
          'Avoid publishing between 13:00-15:00 - busy hours with low engagement',
        ],
        content: [
          'Create visual content with personal stories - increases engagement by 45%',
          'Add short tutorial videos (30-60 seconds) - popular format',
          'Share behind-the-scenes content for authentic connection with audience',
        ],
        keywords: [
          '#ProfessionalTips #Inspiration #Entrepreneurship - the most popular hashtags in the field',
          'Use current trends but in a way relevant to your brand',
          'Create unique hashtags for your brand to build a community',
        ],
        strategy: [
          'Develop a monthly content strategy with 70% original content, 30% shared content',
          'Build collaborations with influencers in your field',
          'Focus on building an active community rather than just growing follower count',
        ],
      };

  // Return mock insights (AI disabled for now)
  return NextResponse.json(insights);
}
