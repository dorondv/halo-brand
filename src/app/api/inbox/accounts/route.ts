import type { NextRequest } from 'next/server';
import type { InboxAccount } from '@/libs/meta-inbox';
import { and, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/libs/DB';
import { createSupabaseServerClient } from '@/libs/Supabase';
import { socialAccounts } from '@/models/Schema';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get('brandId');

    const metaPlatforms = ['facebook', 'instagram', 'threads'] as const;

    const whereConditions = [
      eq(socialAccounts.userId, user.id),
      inArray(socialAccounts.platform, metaPlatforms),
      eq(socialAccounts.isActive, true),
    ];

    if (brandId) {
      whereConditions.push(eq(socialAccounts.brandId, brandId));
    }

    const accounts = await db
      .select()
      .from(socialAccounts)
      .where(and(...whereConditions));

    // Transform to InboxAccount format
    const inboxAccounts: InboxAccount[] = accounts.map((account) => {
      const platformSpecificData = account.platformSpecificData as Record<string, unknown> | null;

      // For Facebook, use selectedPageId (from Getlate) or pageId as fallback
      const pageId = platformSpecificData?.selectedPageId || platformSpecificData?.pageId;

      // Get avatar with fallback: platform-specific avatar_url > avatarUrl > profilePicture > profile_picture
      const avatarUrl
        = (platformSpecificData?.avatar_url as string | undefined)
          || (platformSpecificData?.avatarUrl as string | undefined)
          || (platformSpecificData?.profilePicture as string | undefined)
          || (platformSpecificData?.profile_picture as string | undefined)
          || undefined;

      return {
        id: account.id,
        accountId: account.accountId,
        accountName: account.accountName,
        platform: account.platform as 'facebook' | 'instagram' | 'threads',
        avatarUrl,
        unreadCount: 0,
        isActive: account.isActive,
        pageId: pageId as string | undefined,
        pageAccessToken: platformSpecificData?.pageAccessToken as string | undefined,
      };
    });

    return NextResponse.json({ accounts: inboxAccounts });
  } catch (error) {
    console.error('Error fetching inbox accounts:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch accounts' },
      { status: 500 },
    );
  }
}
