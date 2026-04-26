import type { NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/libs/DB';
import { createMetaInboxClient } from '@/libs/meta-inbox';
import { createSupabaseServerClient } from '@/libs/Supabase';
import { resolveZernioApiKey, zernioReplyToComment, zernioSendMessage } from '@/libs/zernio-inbox';
import { socialAccounts } from '@/models/Schema';

const replySchema = z.object({
  conversationId: z.string(),
  message: z.string().min(1),
  accountId: z.string(),
  platform: z.enum([
    'facebook',
    'instagram',
    'threads',
    'twitter',
    'bluesky',
    'reddit',
    'telegram',
    'linkedin',
    'youtube',
    'tiktok',
    'pinterest',
  ]),
  commentId: z.string().optional(), // For comment replies (or post id for new top-level on Meta / Zernio)
  /** Zernio comment inbox: the post id (required for Zernio comment reply; Meta ignores it) */
  postId: z.string().optional(),
  mentionUserId: z.string().optional(), // User ID to mention (Facebook user ID or Instagram username)
  mentionName: z.string().optional(), // Name/username to mention
  zernioSocialAccountId: z.string().optional(),
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

    const {
      conversationId,
      message,
      accountId,
      platform,
      commentId,
      postId: postIdBody,
      mentionUserId,
      mentionName,
      zernioSocialAccountId,
    } = validation.data;

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

    if (zernioSocialAccountId && !commentId) {
      const apiKey = await resolveZernioApiKey(supabase, user.id);
      if (!apiKey) {
        return NextResponse.json({ error: 'Zernio API key not configured' }, { status: 400 });
      }
      const result = await zernioSendMessage(apiKey, conversationId, zernioSocialAccountId, message);
      if (!result.success) {
        return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
      }
      return NextResponse.json({
        success: true,
        messageId: result.messageId,
      });
    }

    if (zernioSocialAccountId && commentId && postIdBody) {
      const apiKey = await resolveZernioApiKey(supabase, user.id);
      if (apiKey) {
        const targetCommentId = commentId === postIdBody ? undefined : commentId;
        const result = await zernioReplyToComment(
          apiKey,
          postIdBody,
          zernioSocialAccountId,
          message,
          targetCommentId,
        );
        if (result.success) {
          return NextResponse.json({
            success: true,
            messageId: result.commentId,
          });
        }
      }
    }

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
      // Reply to comment with mention support
      // Meta API handles both cases:
      // - If commentId is a postId, creates a new top-level comment
      // - If commentId is a commentId, creates a reply to that comment
      result = await metaClient.replyToComment(
        commentId,
        message,
        platform,
        pageAccessToken,
        mentionUserId,
        mentionName,
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
