import type { NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/libs/DB';
import { createMetaInboxClient } from '@/libs/meta-inbox';
import { createSupabaseServerClient } from '@/libs/Supabase';
import { socialAccounts } from '@/models/Schema';

const replySchema = z.object({
  conversationId: z.string(),
  message: z.string().min(1),
  accountId: z.string(),
  platform: z.enum(['facebook', 'instagram', 'threads']),
  commentId: z.string().optional(), // For comment replies
});

/**
 * POST /api/inbox/reply
 * Send a reply to a conversation (chat or comment)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const body = await request.json();
    const validation = replySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validation.error.issues },
        { status: 400 },
      );
    }

    const { conversationId, message, accountId, platform, commentId } = validation.data;

    // Fetch account details
    const [account] = await db
      .select()
      .from(socialAccounts)
      .where(
        and(
          eq(socialAccounts.id, accountId),
          eq(socialAccounts.userId, user.id),
        ),
      )
      .limit(1);

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const platformSpecificData = account.platformSpecificData as Record<string, unknown> | null;
    const pageAccessToken = platformSpecificData?.pageAccessToken as string | undefined;

    // Create Meta client
    const metaClient = createMetaInboxClient(
      account.accessToken,
      account.refreshToken || undefined,
      async (newToken: string) => {
        // Update token in database
        await db
          .update(socialAccounts)
          .set({ accessToken: newToken, updatedAt: new Date() })
          .where(eq(socialAccounts.id, accountId));
      },
    );

    // Send reply
    let result;
    if (commentId) {
      // Reply to comment
      result = await metaClient.replyToComment(
        commentId,
        message,
        platform,
        pageAccessToken,
      );
    } else {
      // Reply to chat conversation
      result = await metaClient.sendReply(
        conversationId,
        message,
        platform,
        pageAccessToken,
      );
    }

    if (!result.success) {
      return NextResponse.json(
        { error: 'Failed to send reply' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      messageId: 'messageId' in result ? result.messageId : 'commentId' in result ? result.commentId : undefined,
    });
  } catch (error) {
    console.error('Error sending reply:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send reply' },
      { status: 500 },
    );
  }
}
