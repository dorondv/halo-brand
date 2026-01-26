import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/libs/Supabase';

// Note: Using Node.js runtime instead of Edge because createSupabaseServerClient
// requires cookies() from next/headers which is not available in Edge runtime

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const Schema = z.object({ content: z.string().min(1) });
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 422 });
  }

  // Use ChatGPT if API key is available
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (openaiApiKey) {
    try {
      const result = await generateText({
        model: openai('gpt-4o-mini'),
        messages: [
          {
            role: 'system',
            content: 'You are a social media expert. Generate engaging captions for posts.',
          },
          {
            role: 'user',
            content: `Generate a social media caption for: ${parsed.data.content}`,
          },
        ],
        temperature: 0.7,
      });

      // Increment AI content generation counter
      // Use the increment_user_usage function from migration 0009
      try {
        const { error: rpcError } = await supabase.rpc('increment_user_usage', {
          p_user_id: user.id,
          p_counter_type: 'ai_content',
          p_amount: 1,
        });
        if (rpcError) {
          console.warn('[AI Caption] Failed to increment usage counter:', rpcError);
        }
      } catch (error) {
        // Log error but don't fail the request
        console.warn('[AI Caption] Error calling increment_user_usage:', error);
      }

      return NextResponse.json({ aiCaption: result.text });
    } catch (error) {
      console.error('OpenAI API error:', error);
    }
  }

  // Fallback if OpenAI is not configured
  const aiCaption = `${String(parsed.data.content).slice(0, 80)}... (AI suggested caption)`;
  return NextResponse.json({ aiCaption });
}
