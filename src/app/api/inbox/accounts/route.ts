import type { NextRequest } from 'next/server';
import type { InboxAccount } from '@/libs/meta-inbox';
import { and, asc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/libs/DB';
import { createSupabaseServerClient } from '@/libs/Supabase';
import { normalizeDbPlatformForInbox } from '@/libs/zernio-inbox';
import { brands, socialAccounts } from '@/models/Schema';

/**
 * GET /api/inbox/accounts
 * All active social accounts for the user (every brand). Optional ?brandId= to limit to one brand.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get('brandId');

    const whereConditions = [
      eq(socialAccounts.userId, user.id),
      eq(socialAccounts.isActive, true),
    ];

    if (brandId) {
      whereConditions.push(eq(socialAccounts.brandId, brandId));
    }

    const rows = await db
      .select({
        account: socialAccounts,
        brandName: brands.name,
      })
      .from(socialAccounts)
      .leftJoin(brands, eq(socialAccounts.brandId, brands.id))
      .where(and(...whereConditions))
      .orderBy(asc(brands.name), asc(socialAccounts.accountName));

    const inboxAccounts: InboxAccount[] = rows.map(({ account, brandName }) => {
      const platformSpecificData = account.platformSpecificData as Record<string, unknown> | null;

      const pageId = platformSpecificData?.selectedPageId || platformSpecificData?.pageId;

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
        platform: normalizeDbPlatformForInbox(account.platform),
        brandName: brandName ?? null,
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
