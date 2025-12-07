import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/libs/Supabase';

export const runtime = 'edge';

const CACHE_TTL_MS = 1000 * 60 * 60;

// Web Crypto API hash function for Edge Runtime
async function sha256Hash(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

const suggestionSchema = z.object({
  type: z.enum(['caption', 'title', 'body', 'hashtags', 'optimization', 'all']),
  brief: z.string().max(1200).optional(),
  baseContent: z.string().max(5000).optional(),
  postTitle: z.string().max(500).optional(),
  tone: z.string().max(80).optional(),
  style: z.string().max(80).optional(),
  language: z.enum(['en', 'he']).default('en'),
  platform: z.string().optional(),
  format: z.string().optional(),
  mediaCount: z.number().int().min(0).optional(),
  hasVideo: z.boolean().optional(),
  characterLimit: z.number().int().min(1).max(10000).optional(),
});

const typeInstructions: Record<z.infer<typeof suggestionSchema>['type'], string> = {
  caption: 'produce one concise caption that matches the supplied length guidance.',
  title: 'deliver an attention-grabbing title or headline for this post.',
  body: 'expand into a longer body/content section while remaining friendly.',
  hashtags: 'suggest a list of trending hashtags for this topic.',
  optimization: 'describe actionable suggestions for improving the content.',
  all: 'generate all content types (title, caption, hashtags) in a single response.',
};

const safeJson = (text: string) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const extractHashtags = (text: string): string[] => {
  const matches = Array.from(text.matchAll(/#\w+/g));
  if (matches.length) {
    return matches.map(match => match[0]);
  }
  return text
    .split(/[\s,]+/)
    .filter(token => token.length > 2)
    .slice(0, 6)
    .map(token => (token.startsWith('#') ? token : `#${token}`));
};

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = suggestionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 422 });
  }

  const payload = parsed.data;
  const promptKeySource = JSON.stringify({
    userId: user.id,
    type: payload.type,
    language: payload.language,
    tone: payload.tone,
    style: payload.style,
    brief: payload.brief,
    baseContent: payload.baseContent,
    postTitle: payload.postTitle,
    platform: payload.platform,
    format: payload.format,
  });

  const promptKey = await sha256Hash(promptKeySource);

  const { data: cached } = await supabase
    .from('ai_suggestions')
    .select('response, updated_at')
    .eq('user_id', user.id)
    .eq('prompt_key', promptKey)
    .maybeSingle();

  if (cached) {
    const elapsed = Date.now() - new Date(cached.updated_at).getTime();
    if (elapsed < CACHE_TTL_MS && cached.response) {
      return NextResponse.json(cached.response);
    }
  }

  const languageLabel = payload.language === 'he' ? 'Hebrew' : 'English';

  // Build media context
  const mediaContext = [];
  if (payload.mediaCount !== undefined && payload.mediaCount > 0) {
    if (payload.hasVideo) {
      mediaContext.push(`Media: ${payload.mediaCount} video${payload.mediaCount > 1 ? 's' : ''}`);
    } else {
      mediaContext.push(`Media: ${payload.mediaCount} image${payload.mediaCount > 1 ? 's' : ''}`);
      if (payload.mediaCount > 1) {
        mediaContext.push(`Content type: Carousel (${payload.mediaCount} images)`);
      }
    }
  } else {
    mediaContext.push('Media: Text-only post (no media)');
  }

  const userPromptParts = [
    `Audience: ${payload.platform || 'Cross-platform'}`,
    `Format: ${payload.format || 'General'}`,
    `Tone: ${payload.tone || 'Friendly'}`,
    ...mediaContext,
    payload.brief ? `Brief: ${payload.brief}` : null,
    payload.baseContent ? `Base content: ${payload.baseContent}` : null,
    payload.postTitle ? `Post title: ${payload.postTitle}` : null,
  ].filter(Boolean).join('\n');

  const characterLimitInstruction = payload.characterLimit
    ? ` IMPORTANT: The caption must be ${payload.characterLimit} characters or less. This is a hard limit for ${payload.platform || 'this platform'}.`
    : '';

  const systemMessage = payload.type === 'all'
    ? `You are a social media expert crafting posts in ${languageLabel}. Generate a complete social media post with title, caption, and hashtags.${characterLimitInstruction} Respond ONLY with a valid JSON object containing these fields: "title" (string), "caption" (string, must be ${payload.characterLimit || 'concise'} characters or less), and "hashtags" (array of strings). Example format: {"title": "✨ Unlock Your Best Self: Join the Journey to Wellness! 🌟", "caption": "Your engaging caption here...", "hashtags": ["wellness", "selfcare", "motivation"]}`
    : `You are a social media expert crafting posts in ${languageLabel}. ${typeInstructions[payload.type]}${characterLimitInstruction} Respond with a JSON object.`;

  const userMessage = payload.type === 'all'
    ? `Generate a complete social media post. ${userPromptParts}`
    : `Task: ${payload.type}. ${userPromptParts}`;

  const messages = [
    {
      role: 'system' as const,
      content: systemMessage,
    },
    {
      role: 'user' as const,
      content: userMessage,
    },
  ];

  const openAiKey = process.env.OPENAI_API_KEY;
  if (!openAiKey) {
    if (payload.type === 'all') {
      const fallback = {
        title: payload.postTitle || 'AI is not configured yet. Please add OPENAI_API_KEY.',
        caption: payload.baseContent || 'AI is not configured yet. Please add OPENAI_API_KEY.',
        hashtags: [],
        type: 'all',
      };
      return NextResponse.json(fallback);
    }
    const fallback = {
      text: payload.baseContent
        ? `${payload.baseContent.slice(0, 120)}...`
        : 'AI is not configured yet. Please add OPENAI_API_KEY.',
      hashtags: [],
      type: payload.type,
    };
    return NextResponse.json(fallback);
  }

  try {
    const result = await generateText({
      model: openai('gpt-4o-mini'),
      messages,
      temperature: 0.7,
    });

    const rawText = (result.text || '').trim();
    const jsonPayload = safeJson(rawText);

    // Handle 'all' type - return complete JSON with title, caption, hashtags
    if (payload.type === 'all') {
      let caption = jsonPayload?.caption?.trim() || jsonPayload?.text?.trim() || '';

      // Enforce character limit if specified
      if (payload.characterLimit && caption.length > payload.characterLimit) {
        // Try to truncate at a word boundary
        const truncated = caption.substring(0, payload.characterLimit);
        const lastSpace = truncated.lastIndexOf(' ');
        caption = lastSpace > payload.characterLimit * 0.8
          ? `${truncated.substring(0, lastSpace)}...`
          : `${truncated}...`;
      }

      const responsePayload = {
        title: jsonPayload?.title?.trim() || '',
        caption,
        hashtags: Array.isArray(jsonPayload?.hashtags)
          ? jsonPayload.hashtags.filter((tag: unknown) => typeof tag === 'string').map((tag: string) => tag.replace(/^#/, ''))
          : [],
        type: 'all',
      };

      await supabase.from('ai_suggestions').upsert(
        {
          user_id: user.id,
          prompt_key: promptKey,
          type: payload.type,
          language: payload.language,
          tone: payload.tone || null,
          style: payload.style || null,
          prompt: userPromptParts,
          response: responsePayload,
          hashtags: responsePayload.hashtags,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,prompt_key' },
      );

      return NextResponse.json(responsePayload);
    }

    // Handle individual types (existing logic)
    const finalText = jsonPayload?.text?.trim() || rawText || payload.brief || '';
    const hashtags = jsonPayload?.hashtags
      ? jsonPayload.hashtags.filter((tag: unknown) => typeof tag === 'string')
      : (payload.type === 'hashtags' ? extractHashtags(rawText) : []);

    const responsePayload = {
      text: finalText,
      hashtags,
      type: payload.type,
      meta: jsonPayload?.meta ?? null,
    };

    await supabase.from('ai_suggestions').upsert(
      {
        user_id: user.id,
        prompt_key: promptKey,
        type: payload.type,
        language: payload.language,
        tone: payload.tone || null,
        style: payload.style || null,
        prompt: userPromptParts,
        response: responsePayload,
        hashtags,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,prompt_key' },
    );

    return NextResponse.json(responsePayload);
  } catch (err) {
    console.error('[AI] suggestion error', err);
    return NextResponse.json({ error: 'Failed to generate AI suggestion' }, { status: 500 });
  }
}
