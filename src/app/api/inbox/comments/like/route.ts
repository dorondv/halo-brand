import type { NextRequest } from 'next/server';
import type { MetaPlatform } from '@/libs/meta-inbox';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/libs/DB';
import { createMetaInboxClient } from '@/libs/meta-inbox';
import { createSupabaseServerClient } from '@/libs/Supabase';
import { socialAccounts } from '@/models/Schema';

/**
 * POST /api/inbox/comments/like
 * Like or unlike a comment using Meta Graph API
 *
 * Body:
 * - commentId: The comment ID from Meta API
 * - accountId: The social account ID (from our database)
 * - platform: 'facebook' | 'instagram' | 'threads'
 * - conversationId: The conversation/thread ID (optional, for logging)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { commentId, accountId, platform } = body;

    if (!commentId || !accountId || !platform) {
      return NextResponse.json(
        { error: 'commentId, accountId, and platform are required' },
        { status: 400 },
      );
    }

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

    // For Facebook page comments, use page access token
    let pageAccessToken: string | undefined;
    if (platform === 'facebook' || platform === 'instagram') {
      pageAccessToken = platformSpecificData?.pageAccessToken as string | undefined;
    }

    // Create Meta client
    const tokenToUse = pageAccessToken || account.accessToken;
    const metaClient = createMetaInboxClient(
      tokenToUse,
      account.refreshToken || undefined,
      async (newToken: string) => {
        // Update token in database
        if (pageAccessToken && platformSpecificData) {
          const updatedData = {
            ...platformSpecificData,
            pageAccessToken: newToken,
          };
          await db
            .update(socialAccounts)
            .set({
              platformSpecificData: updatedData,
              updatedAt: new Date(),
            })
            .where(eq(socialAccounts.id, accountId));
        } else {
          await db
            .update(socialAccounts)
            .set({ accessToken: newToken, updatedAt: new Date() })
            .where(eq(socialAccounts.id, accountId));
        }
      },
    );

    // First, check current like status
    const currentLikes = await metaClient.getCommentLikes(
      commentId,
      platform as MetaPlatform,
      pageAccessToken,
    );

    // Toggle like status
    let result;
    if (currentLikes.liked) {
      // Unlike the comment
      result = await metaClient.unlikeComment(
        commentId,
        platform as MetaPlatform,
        pageAccessToken,
      );
      if (result.success) {
        return NextResponse.json({
          liked: false,
          count: Math.max(currentLikes.count - 1, 0),
          message: 'Comment unliked',
        });
      }
    } else {
      // Like the comment
      result = await metaClient.likeComment(
        commentId,
        platform as MetaPlatform,
        pageAccessToken,
      );
      if (result.success) {
        return NextResponse.json({
          liked: true,
          count: currentLikes.count + 1,
          message: 'Comment liked',
        });
      }
    }

    // If toggle failed, return current status
    return NextResponse.json({
      liked: currentLikes.liked,
      count: currentLikes.count,
      message: 'Failed to toggle like',
    });
  } catch (error) {
    console.error('[API] Error toggling comment like:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to toggle like';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 },
    );
  }
}

/**
 * GET /api/inbox/comments/like
 * Get like status and count for a comment using Meta Graph API
 *
 * Query params:
 * - commentId: The comment ID from Meta API
 * - accountId: The social account ID (from our database)
 * - platform: 'facebook' | 'instagram' | 'threads'
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const commentId = searchParams.get('commentId');
    const accountId = searchParams.get('accountId');
    const platform = searchParams.get('platform') as MetaPlatform | null;

    if (!commentId || !accountId || !platform) {
      return NextResponse.json(
        { error: 'commentId, accountId, and platform are required' },
        { status: 400 },
      );
    }

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

    // For Facebook page comments, use page access token
    let pageAccessToken: string | undefined;
    if (platform === 'facebook' || platform === 'instagram') {
      pageAccessToken = platformSpecificData?.pageAccessToken as string | undefined;
    }

    // Create Meta client
    const tokenToUse = pageAccessToken || account.accessToken;
    const metaClient = createMetaInboxClient(
      tokenToUse,
      account.refreshToken || undefined,
      async (newToken: string) => {
        // Update token in database
        if (pageAccessToken && platformSpecificData) {
          const updatedData = {
            ...platformSpecificData,
            pageAccessToken: newToken,
          };
          await db
            .update(socialAccounts)
            .set({
              platformSpecificData: updatedData,
              updatedAt: new Date(),
            })
            .where(eq(socialAccounts.id, accountId));
        } else {
          await db
            .update(socialAccounts)
            .set({ accessToken: newToken, updatedAt: new Date() })
            .where(eq(socialAccounts.id, accountId));
        }
      },
    );

    // Get like status from Meta API
    const likes = await metaClient.getCommentLikes(
      commentId,
      platform,
      pageAccessToken,
    );

    return NextResponse.json({
      liked: likes.liked,
      count: likes.count,
    });
  } catch (error) {
    console.error('[API] Error fetching comment likes:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch likes';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 },
    );
  }
}
