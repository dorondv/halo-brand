import { Buffer } from 'node:buffer';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/libs/Supabase';

export const runtime = 'nodejs'; // Changed to nodejs for Buffer support

/** Sizes accepted from clients (includes legacy DALL-E 3 values mapped server-side). */
const incomingSizeSchema = z.enum([
  '1024x1024',
  '1536x1024',
  '1024x1536',
  '1792x1024',
  '1024x1792',
]);

/** GPT Image 1 supports fixed sizes only (not DALL-E 3's 1792px variants). */
function toGptImageSize(
  size: z.infer<typeof incomingSizeSchema>,
): '1024x1024' | '1536x1024' | '1024x1536' {
  switch (size) {
    case '1792x1024':
      return '1536x1024';
    case '1024x1792':
      return '1024x1536';
    default:
      return size;
  }
}

const qualitySchema = z.enum(['standard', 'hd', 'low', 'medium', 'high']);

/** GPT Image models use low | medium | high; accept legacy DALL-E labels from older clients. */
function toGptImageQuality(
  quality: z.infer<typeof qualitySchema>,
): 'low' | 'medium' | 'high' {
  if (quality === 'low' || quality === 'medium' || quality === 'high') {
    return quality;
  }
  return 'medium';
}

const generateMediaSchema = z.object({
  prompt: z.string().min(1).max(32000),
  mediaType: z.enum(['image', 'video']).default('image'),
  size: incomingSizeSchema.optional().default('1024x1024'),
  quality: qualitySchema.optional().default('medium'),
});

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validated = generateMediaSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validated.error.issues },
        { status: 400 },
      );
    }

    const { prompt, mediaType, size: requestedSize, quality } = validated.data;
    const size = toGptImageSize(requestedSize);
    const openaiQuality = toGptImageQuality(quality);

    // Image generation via OpenAI GPT Image 1 (gpt-image-1); responses are base64, not URLs.
    // Video generation would require a different service (e.g., RunwayML, Pika Labs API)
    if (mediaType === 'video') {
      return NextResponse.json(
        { error: 'Video generation is not yet supported. Please use manual upload for videos.' },
        { status: 400 },
      );
    }

    const openaiResponse = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt,
        size,
        quality: openaiQuality,
        output_format: 'png',
        n: 1,
      }),
    });

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json().catch(() => ({}));
      return NextResponse.json(
        { error: 'Failed to generate image', details: errorData },
        { status: openaiResponse.status },
      );
    }

    const openaiData = await openaiResponse.json();
    const b64 = openaiData.data?.[0]?.b64_json as string | undefined;

    if (!b64) {
      return NextResponse.json(
        { error: 'Failed to generate image', details: openaiData },
        { status: 500 },
      );
    }

    const buffer = Buffer.from(b64, 'base64');

    // Match Storage object key prefix to auth.uid() for typical RLS policies.
    const userId = user.id;
    const fileName = `${userId}/ai-generated/${Date.now()}-${Math.random().toString(36).substring(7)}.png`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('post-media')
      .upload(fileName, buffer, {
        contentType: 'image/png',
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('[AI Media] Upload error:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload generated image', details: uploadError.message },
        { status: 500 },
      );
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('post-media')
      .getPublicUrl(fileName);

    // Increment AI image generation counter
    // Use the increment_user_usage function from migration 0009
    try {
      const { error: rpcError } = await supabase.rpc('increment_user_usage', {
        p_user_id: userId,
        p_counter_type: 'ai_image',
        p_amount: 1,
      });
      if (rpcError) {
        console.warn('[AI Media] Failed to increment usage counter:', rpcError);
      }
    } catch (error) {
      // Log error but don't fail the request
      console.warn('[AI Media] Error calling increment_user_usage:', error);
    }

    return NextResponse.json({
      url: publicUrl,
      type: 'image',
      prompt,
    });
  } catch (error) {
    console.error('[AI Media] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
