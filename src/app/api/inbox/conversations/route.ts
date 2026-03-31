import type { NextRequest } from 'next/server';
import type { Conversation } from '@/libs/meta-inbox';
import type { ZernioCommentedPost, ZernioInboxConversation } from '@/libs/zernio-inbox';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/libs/DB';
import { createGetlateClient } from '@/libs/Getlate';
import { createMetaInboxClient } from '@/libs/meta-inbox';
import { createSupabaseServerClient } from '@/libs/Supabase';
import {
  mapZernioPlatformToMeta,
  normalizeDbPlatformForInbox,
  resolveZernioApiKey,
  zernioCommentInboxPlatformFilter,
  zernioListCommentedPosts,
  zernioListConversations,
  zernioPlatformFilter,
} from '@/libs/zernio-inbox';
import { socialAccounts } from '@/models/Schema';

function resolveGetlateAccountIdFromRow(
  supabaseValue: string | null | undefined,
  psd: Record<string, unknown> | null,
): string | undefined {
  const v = supabaseValue?.trim();
  if (v) {
    return v;
  }
  if (!psd) {
    return undefined;
  }
  const direct = (psd.getlateAccountId ?? psd.getlate_account_id) as string | undefined;
  if (typeof direct === 'string' && direct.trim()) {
    return direct.trim();
  }
  const nested = psd.account as Record<string, unknown> | undefined;
  const id = (nested?._id ?? nested?.id) as string | undefined;
  return typeof id === 'string' && id.trim() ? id.trim() : undefined;
}

/**
 * Helper function to fetch Instagram Business Account ID from Meta API
 * Handles both User Access Tokens and Page Access Tokens
 */
async function fetchInstagramAccountData(
  accessToken: string,
  pageId?: string,
  pageAccessToken?: string,
): Promise<{
  igBusinessAccountId: string | null;
  pageAccessToken: string | null;
  pageId: string | null;
}> {
  try {
    // Strategy 1: If we have a pageAccessToken, use it directly with /me (Page token)
    // When using a Page Access Token, /me refers to the Page, not the User
    if (pageAccessToken && pageAccessToken.length >= 50) {
      try {
        const meResponse = await fetch(
          `https://graph.facebook.com/v21.0/me?fields=id,instagram_business_account&access_token=${pageAccessToken}`,
        );

        if (meResponse.ok) {
          const meData = await meResponse.json();

          // If this is a Page token, meData.id will be the page ID
          if (meData.instagram_business_account?.id) {
            return {
              igBusinessAccountId: meData.instagram_business_account.id,
              pageAccessToken,
              pageId: meData.id || pageId || null,
            };
          }
        }
      } catch {
        // Ignore errors
      }
    }

    // Strategy 2: If we have a pageId, try to fetch directly
    if (pageId) {
      const tokenToUse = pageAccessToken && pageAccessToken.length >= 50 ? pageAccessToken : accessToken;
      try {
        const pageResponse = await fetch(
          `https://graph.facebook.com/v21.0/${pageId}?fields=instagram_business_account&access_token=${tokenToUse}`,
        );

        if (pageResponse.ok) {
          const pageData = await pageResponse.json();
          if (pageData.instagram_business_account?.id) {
            return {
              igBusinessAccountId: pageData.instagram_business_account.id,
              pageAccessToken: tokenToUse,
              pageId,
            };
          }
        }
      } catch {
        // Ignore errors
      }
    }

    // Strategy 3: Try /me with the accessToken (might be a Page token)
    // Only try this if we haven't already tried with pageAccessToken
    if (!pageAccessToken || pageAccessToken !== accessToken) {
      try {
        const meResponse = await fetch(
          `https://graph.facebook.com/v21.0/me?fields=id,instagram_business_account&access_token=${accessToken}`,
        );

        if (meResponse.ok) {
          const meData = await meResponse.json();

          // If this is a Page token, meData.id will be the page ID
          if (meData.instagram_business_account?.id) {
            return {
              igBusinessAccountId: meData.instagram_business_account.id,
              pageAccessToken: accessToken,
              pageId: meData.id || null,
            };
          }
        }
      } catch {
        // Ignore errors
      }
    }

    // Strategy 4: If token is a User Access Token, get user's pages
    // Only try this if the token is NOT a Page token (we can check by trying /me first)
    // Skip this if we already know it's a Page token (pageAccessToken was provided)
    if (!pageAccessToken || pageAccessToken !== accessToken) {
      const pagesResponse = await fetch(
        `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${accessToken}`,
      );

      if (!pagesResponse.ok) {
        const errorData = await pagesResponse.json().catch(() => ({}));
        // If error is about Page node, this is a Page token, skip
        if (errorData.error?.code === 100 && errorData.error?.message?.includes('Page')) {
          return { igBusinessAccountId: null, pageAccessToken: null, pageId: null };
        }
        return { igBusinessAccountId: null, pageAccessToken: null, pageId: null };
      }

      const pagesData = await pagesResponse.json();
      const pages = pagesData.data || [];

      // Find a page with an Instagram Business Account
      for (const page of pages) {
        if (page.instagram_business_account?.id && page.access_token) {
          return {
            igBusinessAccountId: page.instagram_business_account.id,
            pageAccessToken: page.access_token,
            pageId: page.id,
          };
        }
      }
    }

    // If no page with Instagram account found, return null
    return { igBusinessAccountId: null, pageAccessToken: null, pageId: null };
  } catch (error) {
    console.error('[API] Error fetching Instagram account data:', error);
    return { igBusinessAccountId: null, pageAccessToken: null, pageId: null };
  }
}

/**
 * Helper function to get real access token from Publishing integration API
 * For accounts managed by Publishing integration, we need to fetch the actual token from Publishing integration API
 */
const getGetlateAccessToken = async (
  getlateAccountId: string,
  brandId: string,
  userGetlateApiKey: string,
): Promise<string | null> => {
  try {
    const getlateClient = createGetlateClient(userGetlateApiKey);

    // Get brand to fetch profile ID
    const { data: brandRecord } = await createSupabaseServerClient()
      .then(supabase => supabase
        .from('brands')
        .select('getlate_profile_id')
        .eq('id', brandId)
        .single(),
      );

    if (!brandRecord?.getlate_profile_id) {
      return null;
    }

    // Fetch raw account data from Publishing integration
    const rawAccounts = await getlateClient.getRawAccounts(brandRecord.getlate_profile_id);
    const instagramAccount = rawAccounts.find(
      (acc: any) => (acc._id || acc.id) === getlateAccountId && acc.platform === 'instagram',
    );

    if (!instagramAccount) {
      return null;
    }

    // Extract access token from multiple possible locations
    const accessToken = instagramAccount.accessToken
      || instagramAccount.access_token
      || instagramAccount.tempToken
      || instagramAccount.temp_token
      || (instagramAccount.metadata as Record<string, unknown> | undefined)?.accessToken as string | undefined
      || (instagramAccount.metadata as Record<string, unknown> | undefined)?.access_token as string | undefined
      || (instagramAccount.metadata as Record<string, unknown> | undefined)?.tempToken as string | undefined
      || (instagramAccount.metadata as Record<string, unknown> | undefined)?.temp_token as string | undefined
      || null;

    if (!accessToken || accessToken === 'getlate-managed') {
      return null;
    }

    return accessToken;
  } catch (error) {
    console.error('[API] Error fetching access token from Getlate:', error);
    return null;
  }
};

/**
 * GET /api/inbox/conversations
 * Fetch conversations (chats or comments) for a selected account
 *
 * Query params:
 * - accountId: The social account ID (from our database)
 * - type: 'chat' | 'comment' (default: 'chat')
 * - filter: 'all' | 'unread' | 'read' (default: 'all')
 * - cursor: optional — Zernio next page (from previous response `nextCursor`)
 * - limit: optional page size (default 50, max 100; Zernio only)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    const type = (searchParams.get('type') || 'chat') as 'chat' | 'comment';
    const filter = (searchParams.get('filter') || 'all') as 'all' | 'unread' | 'read';
    const cursorParam = searchParams.get('cursor') ?? undefined;
    const limitRaw = Number.parseInt(searchParams.get('limit') || '50', 10);
    const pageLimit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 50, 1), 100);

    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }

    // Fetch account details (including provider account id column when present)
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

    // Also read provider account id from Supabase (may be absent from Drizzle types)
    const { data: accountWithGetlate } = await supabase
      .from('social_accounts')
      .select('getlate_account_id, brand_id')
      .eq('id', accountId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const brandId = accountWithGetlate?.brand_id || account.brandId;
    const platformSpecificData = account.platformSpecificData as Record<string, unknown> | null;
    const getlateAccountId = resolveGetlateAccountIdFromRow(
      accountWithGetlate?.getlate_account_id,
      platformSpecificData,
    );
    const platform = normalizeDbPlatformForInbox(account.platform);

    // Check if we need to get access token from Publishing integration (for Publishing integration-managed accounts)
    let actualAccessToken = account.accessToken;
    const isGetlateManaged = account.accessToken === 'getlate-managed' || (account.accessToken?.length || 0) < 50;

    if (isGetlateManaged && getlateAccountId) {
      // Get user's Publishing integration API key
      const { data: userRecord } = await supabase
        .from('users')
        .select('getlate_api_key')
        .eq('id', user.id)
        .single();

      if (userRecord?.getlate_api_key && brandId) {
        const getlateToken = await getGetlateAccessToken(
          getlateAccountId,
          brandId,
          userRecord.getlate_api_key,
        );

        if (getlateToken) {
          actualAccessToken = getlateToken;
        }
      }
    }

    // Create Meta client with actual access token (from Publishing integration if needed)
    const metaClient = createMetaInboxClient(
      actualAccessToken,
      account.refreshToken || undefined,
      async (newToken: string) => {
        // Update token in database
        await db
          .update(socialAccounts)
          .set({ accessToken: newToken, updatedAt: new Date() })
          .where(eq(socialAccounts.id, accountId));
      },
    );

    let conversations: Conversation[] = [];
    let nextCursorOut: string | null = null;
    let hasMoreOut = false;

    try {
      if (type === 'chat') {
        let usedZernioInbox = false;
        const zernioKey = await resolveZernioApiKey(supabase, user.id);
        const { data: brandForZernio } = brandId
          ? await supabase
              .from('brands')
              .select('getlate_profile_id')
              .eq('id', brandId)
              .maybeSingle()
          : { data: null };
        const zernioProfileId = brandForZernio?.getlate_profile_id;

        if (zernioKey && zernioProfileId && getlateAccountId) {
          const mapZernioRows = (rows: ZernioInboxConversation[]): Conversation[] =>
            rows.map((r) => {
              const unread = r.unreadCount ?? 0;
              const zSid = r.accountId?.trim() || getlateAccountId;
              return {
                id: r.id,
                accountId: account.accountId,
                platform: mapZernioPlatformToMeta(r.platform),
                type: 'chat' as const,
                contactName: r.participantName || r.accountUsername || 'Unknown',
                contactAvatar: r.participantPicture,
                lastMessage: r.lastMessage || '',
                lastMessageTime: r.updatedTime || new Date().toISOString(),
                unreadCount: unread,
                status: unread > 0 ? 'unread' : 'read',
                zernioSocialAccountId: zSid,
                inboxAccountId: accountId,
              };
            });

          const setChatPagination = (zData: { pagination?: { hasMore?: boolean; nextCursor?: string } }) => {
            nextCursorOut = zData.pagination?.nextCursor ?? null;
            hasMoreOut = !!zData.pagination?.hasMore;
          };

          if (cursorParam) {
            try {
              const zf = zernioPlatformFilter(platform);
              const zData = await zernioListConversations(zernioKey, {
                profileId: zernioProfileId,
                accountId: getlateAccountId,
                ...(zf ? { platform: zf } : {}),
                limit: pageLimit,
                cursor: cursorParam,
              });
              conversations = mapZernioRows(zData.data || []);
              setChatPagination(zData);
              usedZernioInbox = true;
            } catch (zErr) {
              console.error('[API] Zernio inbox conversations page failed:', zErr);
            }
          } else {
            try {
              const zf = zernioPlatformFilter(platform);
              let zData = await zernioListConversations(zernioKey, {
                profileId: zernioProfileId,
                accountId: getlateAccountId,
                ...(zf ? { platform: zf } : {}),
                limit: pageLimit,
              });
              let rows = zData.data || [];
              if (rows.length === 0 && zf) {
                zData = await zernioListConversations(zernioKey, {
                  profileId: zernioProfileId,
                  accountId: getlateAccountId,
                  limit: pageLimit,
                });
                rows = zData.data || [];
              }
              conversations = mapZernioRows(rows);
              setChatPagination(zData);
              usedZernioInbox = true;
            } catch (zErr) {
              console.error('[API] Zernio inbox conversations failed, retrying without platform filter:', zErr);
              try {
                const zData = await zernioListConversations(zernioKey, {
                  profileId: zernioProfileId,
                  accountId: getlateAccountId,
                  limit: pageLimit,
                });
                const rows = zData.data || [];
                conversations = mapZernioRows(rows);
                setChatPagination(zData);
                usedZernioInbox = true;
              } catch (zErr2) {
                console.error('[API] Zernio inbox conversations failed, using Meta Graph:', zErr2);
              }
            }
          }
        }

        if (!usedZernioInbox) {
        // Fetch chat conversations (Meta Graph API)
          if (platform === 'facebook') {
          // Try selectedPageId first (from Publishing integration), then pageId as fallback
            const pageId = (platformSpecificData?.selectedPageId || platformSpecificData?.pageId) as string | undefined;
            const pageAccessToken = platformSpecificData?.pageAccessToken as string | undefined;

            if (pageId && pageAccessToken) {
              conversations = await metaClient.getFacebookConversations(pageId, pageAccessToken);
            }
          } else if (platform === 'instagram') {
          // For Instagram DMs, accountId should be the Instagram Business Account ID
            let igBusinessAccountId = platformSpecificData?.igBusinessAccountId as string | undefined || account.accountId;
            const pageAccessToken = platformSpecificData?.pageAccessToken as string | undefined;
            const pageId = platformSpecificData?.pageId as string | undefined;

            // If we don't have a valid Instagram Business Account ID, try to fetch it
            if (!igBusinessAccountId || igBusinessAccountId === account.accountId) {
            // Use pageAccessToken if available (it's a Meta token), otherwise try actualAccessToken
            // The Publishing integration token might not be a valid Meta token, so prefer pageAccessToken
              const tokenToUse = pageAccessToken && pageAccessToken.length >= 50
                ? pageAccessToken
                : actualAccessToken;

              // Pass pageId and pageAccessToken if available to help with fetching
              const instagramData = await fetchInstagramAccountData(
                tokenToUse,
                pageId || undefined,
                pageAccessToken && pageAccessToken.length >= 50 ? pageAccessToken : undefined,
              );

              if (instagramData.igBusinessAccountId) {
                igBusinessAccountId = instagramData.igBusinessAccountId;

                // Update platformSpecificData with fetched value for future use
                const updatedPlatformData = {
                  ...platformSpecificData,
                  igBusinessAccountId: instagramData.igBusinessAccountId,
                  ...(instagramData.pageAccessToken ? { pageAccessToken: instagramData.pageAccessToken } : {}),
                  ...(instagramData.pageId ? { pageId: instagramData.pageId } : {}),
                };

                await db
                  .update(socialAccounts)
                  .set({
                    platformSpecificData: updatedPlatformData,
                    updatedAt: new Date(),
                  })
                  .where(eq(socialAccounts.id, accountId));
              }
            }

            conversations = await metaClient.getInstagramConversations(igBusinessAccountId);
          } else if (platform === 'threads') {
          // Threads uses similar API to Instagram
            const igBusinessAccountId = platformSpecificData?.igBusinessAccountId as string | undefined || account.accountId;
            conversations = await metaClient.getInstagramConversations(igBusinessAccountId);
          }
        }
      } else if (type === 'comment') {
        let usedZernioComments = false;
        const zernioKeyComments = await resolveZernioApiKey(supabase, user.id);
        const { data: brandForZernioComments } = brandId
          ? await supabase
              .from('brands')
              .select('getlate_profile_id')
              .eq('id', brandId)
              .maybeSingle()
          : { data: null };
        const zernioProfileIdComments = brandForZernioComments?.getlate_profile_id;

        if (zernioKeyComments && zernioProfileIdComments && getlateAccountId) {
          const mapZernioCommentPosts = (rows: ZernioCommentedPost[]): Conversation[] =>
            rows.map((p) => {
              const zSid = p.accountId?.trim() || getlateAccountId;
              const cc = p.commentCount ?? 0;
              const metaPlat = mapZernioPlatformToMeta(p.platform || platform);
              return {
                id: p.id,
                accountId: account.accountId,
                platform: metaPlat,
                type: 'comment' as const,
                contactName: p.accountUsername || 'Post',
                commentCount: cc,
                lastMessage:
                  cc > 0
                    ? `${cc} comment${cc === 1 ? '' : 's'}`
                    : (p.content || '').slice(0, 140),
                lastMessageTime: p.createdTime || new Date().toISOString(),
                unreadCount: 0,
                status: 'read' as const,
                postId: p.id,
                postContent: p.content || '',
                postImageUrl: p.picture,
                zernioSocialAccountId: zSid,
                inboxAccountId: accountId,
              };
            });

          const setCommentPagination = (z: { pagination?: { hasMore?: boolean; nextCursor?: string } }) => {
            nextCursorOut = z.pagination?.nextCursor ?? null;
            hasMoreOut = !!z.pagination?.hasMore;
          };

          if (cursorParam) {
            try {
              const zcf = zernioCommentInboxPlatformFilter(platform);
              const zCommentData = await zernioListCommentedPosts(zernioKeyComments, {
                profileId: zernioProfileIdComments,
                accountId: getlateAccountId,
                minComments: 1,
                ...(zcf ? { platform: zcf } : {}),
                limit: pageLimit,
                cursor: cursorParam,
              });
              const rows = zCommentData.data || [];
              conversations = mapZernioCommentPosts(rows).sort(
                (a, b) =>
                  new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime(),
              );
              setCommentPagination(zCommentData);
              usedZernioComments = true;
            } catch (zCommentErr) {
              console.error('[API] Zernio inbox comments page failed:', zCommentErr);
            }
          } else {
            try {
              const zcf = zernioCommentInboxPlatformFilter(platform);
              let zCommentData = await zernioListCommentedPosts(zernioKeyComments, {
                profileId: zernioProfileIdComments,
                accountId: getlateAccountId,
                minComments: 1,
                ...(zcf ? { platform: zcf } : {}),
                limit: pageLimit,
              });
              let rows = zCommentData.data || [];
              if (rows.length === 0 && zcf) {
                zCommentData = await zernioListCommentedPosts(zernioKeyComments, {
                  profileId: zernioProfileIdComments,
                  accountId: getlateAccountId,
                  minComments: 1,
                  limit: pageLimit,
                });
                rows = zCommentData.data || [];
              }
              conversations = mapZernioCommentPosts(rows).sort(
                (a, b) =>
                  new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime(),
              );
              setCommentPagination(zCommentData);
              usedZernioComments = true;
            } catch (zCommentErr) {
              console.error('[API] Zernio inbox comments failed, retrying without platform filter:', zCommentErr);
              try {
                const zFallback = await zernioListCommentedPosts(zernioKeyComments, {
                  profileId: zernioProfileIdComments,
                  accountId: getlateAccountId,
                  minComments: 1,
                  limit: pageLimit,
                });
                const rowsFb = zFallback.data || [];
                conversations = mapZernioCommentPosts(rowsFb).sort(
                  (a, b) =>
                    new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime(),
                );
                setCommentPagination(zFallback);
                usedZernioComments = true;
              } catch (zCommentErr2) {
                console.error('[API] Zernio inbox comments failed, falling back to Meta Graph:', zCommentErr2);
              }
            }
          }
        }

        if (!usedZernioComments) {
        // Fetch comment conversations (Meta Graph — Facebook / Instagram only)
          if (platform === 'facebook') {
          // Try selectedPageId first (from Publishing integration), then pageId as fallback
            const pageId = (platformSpecificData?.selectedPageId || platformSpecificData?.pageId) as string | undefined;
            const pageAccessToken = platformSpecificData?.pageAccessToken as string | undefined;

            if (pageId && pageAccessToken) {
              conversations = await metaClient.getFacebookComments(pageId, pageAccessToken);
            }
          } else if (platform === 'instagram') {
          // For Instagram comments, accountId should be the Instagram Business Account ID
          // Instagram Business Accounts are linked to Facebook Pages, so we need the page access token
            let igBusinessAccountId = platformSpecificData?.igBusinessAccountId as string | undefined || account.accountId;
            let pageAccessToken = platformSpecificData?.pageAccessToken as string | undefined;
            let pageId = platformSpecificData?.pageId as string | undefined;

            // Check if igBusinessAccountId is actually a Publishing integration account ID (MongoDB ObjectId format)
            // MongoDB ObjectIds are 24 hex characters
            const isLikelyGetlateId = igBusinessAccountId && /^[0-9a-f]{24}$/i.test(igBusinessAccountId);

            // We need to fetch igBusinessAccountId if:
            // 1. It's missing
            // 2. It's the same as account.accountId (fallback value)
            // 3. It looks like a Publishing integration account ID (MongoDB ObjectId)
            // We only need to fetch pageAccessToken if it's missing or invalid
            const needsIgBusinessAccountId = !igBusinessAccountId || igBusinessAccountId === account.accountId || isLikelyGetlateId;
            const needsPageAccessToken = !pageAccessToken || pageAccessToken.length < 50;

            if (needsIgBusinessAccountId || needsPageAccessToken) {
            // Use pageAccessToken if available, otherwise try actualAccessToken
            // pageAccessToken is more likely to work since it's a page token
              const tokenToUse = pageAccessToken && pageAccessToken.length >= 50
                ? pageAccessToken
                : actualAccessToken;

              // Pass pageId and pageAccessToken if available to help with fetching
              const instagramData = await fetchInstagramAccountData(
                tokenToUse,
                pageId || undefined,
                pageAccessToken && pageAccessToken.length >= 50 ? pageAccessToken : undefined,
              );

              if (instagramData.igBusinessAccountId) {
                igBusinessAccountId = instagramData.igBusinessAccountId;
              }

              // Only update pageAccessToken if we don't have a valid one or if we fetched a new one
              if (needsPageAccessToken && instagramData.pageAccessToken) {
                pageAccessToken = instagramData.pageAccessToken;
              } else if (instagramData.pageAccessToken && instagramData.pageAccessToken !== pageAccessToken) {
              // Update if we got a different (possibly newer) token
                pageAccessToken = instagramData.pageAccessToken;
              }

              if (instagramData.pageId) {
                pageId = instagramData.pageId;
              }

              // Update platformSpecificData with fetched values for future use
              if (instagramData.igBusinessAccountId || (needsPageAccessToken && instagramData.pageAccessToken)) {
                const updatedPlatformData = {
                  ...platformSpecificData,
                  ...(instagramData.igBusinessAccountId ? { igBusinessAccountId: instagramData.igBusinessAccountId } : {}),
                  ...(needsPageAccessToken && instagramData.pageAccessToken ? { pageAccessToken: instagramData.pageAccessToken } : {}),
                  ...(instagramData.pageId ? { pageId: instagramData.pageId } : {}),
                };

                await db
                  .update(socialAccounts)
                  .set({
                    platformSpecificData: updatedPlatformData,
                    updatedAt: new Date(),
                  })
                  .where(eq(socialAccounts.id, accountId));
              }
            }

            if (!pageAccessToken || pageAccessToken.length < 50) {
              conversations = []; // Return empty array instead of trying with invalid token
            } else if (!igBusinessAccountId || igBusinessAccountId === account.accountId || /^[0-9a-f]{24}$/i.test(igBusinessAccountId)) {
              conversations = [];
            } else {
              conversations = await metaClient.getInstagramComments(igBusinessAccountId, pageAccessToken);
            }
          }
        }
      }
    } catch (fetchError) {
      console.error(`[API] Error fetching ${type} conversations for ${platform}:`, fetchError);
      // Return empty array to allow UI to render
      conversations = [];
    }

    // Apply filter
    let filteredConversations = conversations;
    if (filter === 'unread') {
      filteredConversations = conversations.filter(c => c.status === 'unread');
    } else if (filter === 'read') {
      filteredConversations = conversations.filter(c => c.status === 'read');
    }

    // Get account avatar with fallback for each conversation
    // Avatar priority: platform-specific avatar_url > avatarUrl > profilePicture > profile_picture
    const accountAvatar
      = (platformSpecificData?.avatar_url as string | undefined)
        || (platformSpecificData?.avatarUrl as string | undefined)
        || (platformSpecificData?.profilePicture as string | undefined)
        || (platformSpecificData?.profile_picture as string | undefined)
        || undefined;

    // Add account avatar to conversations if not already present in contactAvatar
    // For comment conversations, always use the commenter's avatar (contactAvatar)
    // For chat conversations, use contactAvatar if available, otherwise fallback to account avatar
    const conversationsWithAvatar = filteredConversations.map(conv => ({
      ...conv,
      inboxAccountId: accountId,
      // For comment conversations, prioritize contactAvatar (commenter's avatar)
      // For chat conversations, use contactAvatar if available, otherwise account avatar
      contactAvatar: conv.type === 'comment'
        ? (conv.contactAvatar || undefined) // Don't fallback to account avatar for comments
        : (conv.contactAvatar || accountAvatar), // Fallback for chat conversations
    }));

    return NextResponse.json({
      conversations: conversationsWithAvatar,
      accountAvatar, // Also return account avatar separately for UI use
      nextCursor: nextCursorOut,
      hasMore: hasMoreOut,
    });
  } catch (error) {
    console.error('[API] Error fetching conversations:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch conversations';
    return NextResponse.json(
      { error: errorMessage, conversations: [] },
      { status: 500 },
    );
  }
}
