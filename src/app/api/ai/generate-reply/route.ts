import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/libs/Supabase';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { conversationId, platform, context, existingMessage, mode = 'suggest', conversationType = 'chat' } = body;

    if (!conversationId || !platform || !context) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 },
      );
    }

    // Check if OpenAI API key is configured
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return NextResponse.json(
        { error: 'AI service not configured' },
        { status: 503 },
      );
    }

    // Determine the task based on mode
    const isImproving = mode === 'improve' && existingMessage;
    const isComment = conversationType === 'comment';

    const systemPrompt = isImproving
      ? `You are a helpful assistant that improves and enhances social media replies/comments for ${platform}. Make the message more professional, friendly, engaging, and appropriate while keeping the original intent and meaning. Keep it concise (1-3 sentences max) and natural.`
      : `You are a helpful assistant that generates professional, friendly, and appropriate ${isComment ? 'comment replies' : 'messages'} for ${platform} conversations. Keep responses concise, natural, and suitable for social media. Be helpful, empathetic, and maintain a professional tone.`;

    const userPrompt = isImproving
      ? `Improve and enhance this ${isComment ? 'comment reply' : 'message'} to make it more professional and engaging while keeping the same meaning:\n\n"${existingMessage}"\n\nConversation context:\n${context}\n\nReturn only the improved version, nothing else.`
      : `Based on this ${isComment ? 'comment thread' : 'conversation'} context, generate an appropriate ${isComment ? 'reply to the comment' : 'response'}:\n\n${context}\n\nGenerate a short, natural ${isComment ? 'comment reply' : 'response'} (1-2 sentences max) that is helpful and appropriate.`;

    // Generate AI response using OpenAI
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        max_tokens: 200,
        temperature: 0.7,
      }),
    });

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json().catch(() => ({}));
      console.error('OpenAI API error:', errorData);
      return NextResponse.json(
        { error: 'Failed to generate AI response' },
        { status: 500 },
      );
    }

    const data = await openaiResponse.json();
    const reply = data.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      return NextResponse.json(
        { error: 'No response generated' },
        { status: 500 },
      );
    }

    return NextResponse.json({ reply });
  } catch (error) {
    console.error('Error generating AI reply:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
