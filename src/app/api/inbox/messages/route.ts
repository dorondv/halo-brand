import type { NextRequest } from 'next/server';
import type { MetaPlatform } from '@/libs/meta-inbox';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/libs/DB';
import { createMetaInboxClient } from '@/libs/meta-inbox';
import { createSupabaseServerClient } from '@/libs/Supabase';
import { socialAccounts } from '@/models/Schema';

/**
 * GET /api/inbox/messages
 * Fetch messages for a conversation
 *
 * Query params:
 * - conversationId: The conversation ID from Meta API
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
    const conversationId = searchParams.get('conversationId');
    const accountId = searchParams.get('accountId');
    const platform = searchParams.get('platform') as MetaPlatform | null;
    const conversationType = searchParams.get('type') as 'chat' | 'comment' | null;

    if (!conversationId || !accountId || !platform) {
      return NextResponse.json(
        { error: 'conversationId, accountId, and platform are required' },
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

    // For Facebook page comments and Instagram comments, use page access token
    // Both require page access token since Instagram Business Accounts are linked to Facebook Pages
    let pageAccessToken: string | undefined;
    if (conversationType === 'comment' && (platform === 'facebook' || platform === 'instagram')) {
      pageAccessToken = platformSpecificData?.pageAccessToken as string | undefined;
    }

    // Create Meta client - use page access token if available for Facebook comments, otherwise use user token
    const tokenToUse = pageAccessToken || account.accessToken;
    const metaClient = createMetaInboxClient(
      tokenToUse,
      account.refreshToken || undefined,
      async (newToken: string) => {
        // Update token in database
        // If we used page token, update pageAccessToken in platformSpecificData
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

    // Fetch messages
    const messages = await metaClient.getMessages(conversationId, platform, conversationType || undefined, pageAccessToken);

    return NextResponse.json({ messages });
  } catch (error) {
    console.error('[API] Error fetching messages:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch messages';
    return NextResponse.json(
      { error: errorMessage, messages: [] },
      { status: 500 },
    );
  }
}
