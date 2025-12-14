import { Buffer } from 'node:buffer';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/libs/Supabase';

export const runtime = 'nodejs'; // Changed to nodejs for Buffer support

const generateMediaSchema = z.object({
  prompt: z.string().min(1).max(1000),
  mediaType: z.enum(['image', 'video']).default('image'),
  size: z.enum(['1024x1024', '1024x1792', '1792x1024']).optional().default('1024x1024'),
  quality: z.enum(['standard', 'hd']).optional().default('standard'),
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

    const { prompt, mediaType, size, quality } = validated.data;

    // For now, only support image generation (OpenAI DALL-E)
    // Video generation would require a different service (e.g., RunwayML, Pika Labs API)
    if (mediaType === 'video') {
      return NextResponse.json(
        { error: 'Video generation is not yet supported. Please use manual upload for videos.' },
        { status: 400 },
      );
    }

    // Generate image using OpenAI DALL-E API directly
    const openaiResponse = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt,
        size,
        quality,
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
    const imageUrl = openaiData.data?.[0]?.url;

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'Failed to generate image' },
        { status: 500 },
      );
    }

    // Download the generated image and upload to Supabase Storage
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to download generated image' },
        { status: 500 },
      );
    }

    const imageBlob = await imageResponse.blob();
    const arrayBuffer = await imageBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Get user ID
    const { data: userRecord } = await supabase
      .from('users')
      .select('id')
      .eq('email', user.email)
      .maybeSingle();

    const userId = userRecord?.id || user.id;
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
