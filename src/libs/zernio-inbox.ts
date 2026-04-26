/**
 * Zernio unified inbox API (DMs + comment inbox).
 * @see https://docs.zernio.com/messages/list-inbox-conversations
 * @see https://docs.zernio.com/comments/list-inbox-comments
 * @see https://docs.zernio.com/comments/get-inbox-post-comments
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Message, MetaPlatform } from '@/libs/meta-inbox';
import { Env } from '@/libs/Env';

/** Default API base when `GETLATE_API_URL` is unset (aligned with Getlate client). */
const DEFAULT_GETLATE_API_BASE = 'https://getlate.dev/api/v1';

const INBOX_PLATFORMS: readonly MetaPlatform[] = [
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
] as const;

/** Normalize raw DB / API platform string to MetaPlatform (Graph + Zernio paths). */
export function normalizeDbPlatformForInbox(raw: string): MetaPlatform {
  const p = raw.toLowerCase().trim();
  if (p === 'x' || p === 'twitter_x') {
    return 'twitter';
  }
  if (p === 'thread') {
    return 'threads';
  }
  const map: Record<string, MetaPlatform> = {
    facebook: 'facebook',
    instagram: 'instagram',
    threads: 'threads',
    twitter: 'twitter',
    bluesky: 'bluesky',
    reddit: 'reddit',
    telegram: 'telegram',
    linkedin: 'linkedin',
    youtube: 'youtube',
    tiktok: 'tiktok',
    pinterest: 'pinterest',
  };
  if (map[p]) {
    return map[p];
  }
  if ((INBOX_PLATFORMS as readonly string[]).includes(p)) {
    return p as MetaPlatform;
  }
  return 'facebook';
}

/** Unified inbox API base — uses `GETLATE_API_URL` (same as Getlate client). */
export function getZernioBaseUrl(): string {
  const fromEnv = Env.GETLATE_API_URL?.replace(/\/$/, '');
  return fromEnv || DEFAULT_GETLATE_API_BASE;
}

/** Prefer `GETLATE_SERVICE_API_KEY`; else user's `getlate_api_key` in DB. */
export async function resolveZernioApiKey(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const envKey = Env.GETLATE_SERVICE_API_KEY?.trim();
  if (envKey) {
    return envKey;
  }
  const { data } = await supabase
    .from('users')
    .select('getlate_api_key')
    .eq('id', userId)
    .single();
  const key = data?.getlate_api_key?.trim();
  return key || null;
}

export type ZernioInboxConversation = {
  id: string;
  platform: string;
  accountId: string;
  accountUsername?: string;
  participantId?: string;
  participantName?: string;
  participantPicture?: string;
  lastMessage?: string;
  updatedTime?: string;
  status?: string;
  unreadCount?: number;
  url?: string;
};

type ZernioListConversationsResponse = {
  data?: ZernioInboxConversation[];
  pagination?: { hasMore?: boolean; nextCursor?: string };
};

type ZernioInboxMessage = {
  id: string;
  conversationId?: string;
  accountId?: string;
  platform?: string;
  message?: string;
  senderId?: string;
  senderName?: string;
  direction?: 'incoming' | 'outgoing';
  createdAt?: string;
  attachments?: Array<{ type?: string; url?: string }>;
};

type ZernioListMessagesResponse = {
  messages?: ZernioInboxMessage[];
  pagination?: { hasMore?: boolean; nextCursor?: string; cursor?: string };
};

function authHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    Accept: 'application/json',
  };
}

export async function zernioListConversations(
  apiKey: string,
  params: {
    profileId: string;
    accountId: string;
    platform?: string;
    limit?: number;
    cursor?: string;
  },
): Promise<ZernioListConversationsResponse> {
  const base = getZernioBaseUrl();
  const search = new URLSearchParams();
  search.set('profileId', params.profileId);
  search.set('accountId', params.accountId);
  search.set('limit', String(params.limit ?? 50));
  if (params.platform) {
    search.set('platform', params.platform);
  }
  if (params.cursor) {
    search.set('cursor', params.cursor);
  }

  const url = `${base}/inbox/conversations?${search.toString()}`;
  const res = await fetch(url, { headers: authHeaders(apiKey) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (data as { error?: string })?.error || res.statusText;
    throw new Error(err || 'Zernio list conversations failed');
  }
  return data as ZernioListConversationsResponse;
}

export async function zernioListMessages(
  apiKey: string,
  conversationId: string,
  zernioAccountId: string,
  options?: { limit?: number; cursor?: string },
): Promise<ZernioListMessagesResponse> {
  const base = getZernioBaseUrl();
  const search = new URLSearchParams();
  search.set('accountId', zernioAccountId);
  if (options?.limit) {
    search.set('limit', String(options.limit));
  }
  if (options?.cursor) {
    search.set('cursor', options.cursor);
  }
  const url = `${base}/inbox/conversations/${encodeURIComponent(conversationId)}/messages?${search.toString()}`;
  const res = await fetch(url, { headers: authHeaders(apiKey) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (data as { error?: string })?.error || res.statusText;
    throw new Error(err || 'Zernio list messages failed');
  }
  return data as ZernioListMessagesResponse;
}

/** Post rows from GET /v1/inbox/comments (commented posts list). */
export type ZernioCommentedPost = {
  id: string;
  platform?: string;
  accountId?: string;
  accountUsername?: string;
  content?: string;
  picture?: string;
  permalink?: string;
  createdTime?: string;
  commentCount?: number;
  likeCount?: number;
};

type ZernioListCommentedPostsResponse = {
  data?: ZernioCommentedPost[];
  pagination?: { hasMore?: boolean; nextCursor?: string };
};

export type ZernioInboxCommentNode = {
  id: string;
  message?: string;
  createdTime?: string;
  from?: {
    id?: string;
    name?: string;
    username?: string;
    picture?: string;
    isOwner?: boolean;
  };
  likeCount?: number;
  replyCount?: number;
  isLiked?: boolean;
  /** Bluesky: like record URI (for unlike). */
  likeUri?: string;
  parentId?: string;
  replies?: ZernioInboxCommentNode[];
};

type ZernioGetPostCommentsResponse = {
  status?: string;
  comments?: ZernioInboxCommentNode[];
  pagination?: { hasMore?: boolean; cursor?: string };
  meta?: { postId?: string; accountId?: string };
};

/** Map Zernio nested comment nodes to inbox {@link Message} tree (sorted oldest-first per level). */
export function mapZernioCommentTreeToMessages(
  nodes: ZernioInboxCommentNode[],
  postId: string,
): Message[] {
  const mapOne = (c: ZernioInboxCommentNode): Message => {
    const nested = (c.replies || [])
      .map(mapOne)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return {
      id: c.id,
      conversationId: postId,
      senderName: c.from?.name || c.from?.username || 'Unknown',
      senderId: c.from?.id || c.from?.username,
      senderAvatar: c.from?.picture,
      content: c.message || '',
      timestamp: c.createdTime || new Date().toISOString(),
      isOutgoing: !!c.from?.isOwner,
      parentId: c.parentId,
      likeCount: c.likeCount,
      isLiked: c.isLiked,
      likeUri: c.likeUri,
      replies: nested.length ? nested : undefined,
    };
  };
  return nodes
    .map(mapOne)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

export async function zernioListCommentedPosts(
  apiKey: string,
  params: {
    profileId: string;
    accountId: string;
    platform?: string;
    minComments?: number;
    limit?: number;
    cursor?: string;
  },
): Promise<ZernioListCommentedPostsResponse> {
  const base = getZernioBaseUrl();
  const search = new URLSearchParams();
  search.set('profileId', params.profileId);
  search.set('accountId', params.accountId);
  search.set('limit', String(params.limit ?? 50));
  if (params.platform) {
    search.set('platform', params.platform);
  }
  if (params.minComments !== undefined) {
    search.set('minComments', String(params.minComments));
  }
  if (params.cursor) {
    search.set('cursor', params.cursor);
  }

  const url = `${base}/inbox/comments?${search.toString()}`;
  const res = await fetch(url, { headers: authHeaders(apiKey) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (data as { error?: string })?.error || res.statusText;
    throw new Error(err || 'Zernio list commented posts failed');
  }
  return data as ZernioListCommentedPostsResponse;
}

export async function zernioGetPostComments(
  apiKey: string,
  postId: string,
  zernioAccountId: string,
  options?: { limit?: number; cursor?: string; subreddit?: string },
): Promise<ZernioGetPostCommentsResponse> {
  const base = getZernioBaseUrl();
  const search = new URLSearchParams();
  search.set('accountId', zernioAccountId);
  search.set('limit', String(options?.limit ?? 100));
  if (options?.cursor) {
    search.set('cursor', options.cursor);
  }
  if (options?.subreddit) {
    search.set('subreddit', options.subreddit);
  }

  const url = `${base}/inbox/comments/${encodeURIComponent(postId)}?${search.toString()}`;
  const res = await fetch(url, { headers: authHeaders(apiKey) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (data as { error?: string })?.error || res.statusText;
    throw new Error(err || 'Zernio get post comments failed');
  }
  return data as ZernioGetPostCommentsResponse;
}

type ZernioLikeCommentResponse = {
  liked?: boolean;
  commentId?: string;
  likeCount?: number;
  likeUri?: string;
  status?: string;
  platform?: string;
};

/** Like a comment via Zernio/Getlate inbox API. */
export async function zernioLikeComment(
  apiKey: string,
  postId: string,
  commentId: string,
  zernioAccountId: string,
  options?: { cid?: string },
): Promise<ZernioLikeCommentResponse> {
  const base = getZernioBaseUrl();
  const url = `${base}/inbox/comments/${encodeURIComponent(postId)}/${encodeURIComponent(commentId)}/like`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...authHeaders(apiKey),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      accountId: zernioAccountId,
      ...(options?.cid ? { cid: options.cid } : {}),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (data as { error?: string })?.error || res.statusText;
    throw new Error(err || 'Zernio like comment failed');
  }
  return data as ZernioLikeCommentResponse;
}

/** Unlike a comment via Zernio/Getlate inbox API (Bluesky may require likeUri). */
export async function zernioUnlikeComment(
  apiKey: string,
  postId: string,
  commentId: string,
  zernioAccountId: string,
  options?: { likeUri?: string },
): Promise<ZernioLikeCommentResponse> {
  const base = getZernioBaseUrl();
  const search = new URLSearchParams();
  search.set('accountId', zernioAccountId);
  if (options?.likeUri) {
    search.set('likeUri', options.likeUri);
  }
  const url = `${base}/inbox/comments/${encodeURIComponent(postId)}/${encodeURIComponent(commentId)}/like?${search.toString()}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: authHeaders(apiKey),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (data as { error?: string })?.error || res.statusText;
    throw new Error(err || 'Zernio unlike comment failed');
  }
  return data as ZernioLikeCommentResponse;
}

/** Fetch all comment pages for a post (cursor loop, deduped by comment id). */
export async function zernioGetAllPostCommentsPages(
  apiKey: string,
  postId: string,
  zernioAccountId: string,
  options?: { subreddit?: string; maxPages?: number },
): Promise<ZernioInboxCommentNode[]> {
  const merged: ZernioInboxCommentNode[] = [];
  const seen = new Set<string>();
  let cursor: string | undefined;
  const maxPages = options?.maxPages ?? 40;
  for (let page = 0; page < maxPages; page++) {
    const res = await zernioGetPostComments(apiKey, postId, zernioAccountId, {
      limit: 100,
      cursor,
      ...(options?.subreddit ? { subreddit: options.subreddit } : {}),
    });
    const batch = res.comments || [];
    for (const c of batch) {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        merged.push(c);
      }
    }
    const next = res.pagination?.cursor;
    const more = res.pagination?.hasMore;
    if (!more || !next) {
      break;
    }
    cursor = next;
  }
  return merged;
}

/** Fetch all DM messages for a conversation (cursor loop). */
export async function zernioGetAllConversationMessages(
  apiKey: string,
  conversationId: string,
  zernioAccountId: string,
  options?: { maxPages?: number; pageSize?: number },
): Promise<ZernioInboxMessage[]> {
  const merged: ZernioInboxMessage[] = [];
  const seen = new Set<string>();
  let cursor: string | undefined;
  const maxPages = options?.maxPages ?? 40;
  const pageSize = options?.pageSize ?? 100;
  for (let page = 0; page < maxPages; page++) {
    const res = await zernioListMessages(apiKey, conversationId, zernioAccountId, {
      limit: pageSize,
      cursor,
    });
    const batch = res.messages || [];
    for (const m of batch) {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        merged.push(m);
      }
    }
    const next = res.pagination?.nextCursor ?? res.pagination?.cursor;
    const more = res.pagination?.hasMore;
    if (!more || !next) {
      break;
    }
    cursor = next;
  }
  return merged;
}

/**
 * Reply on a post thread. POST /v1/inbox/comments/{postId}
 * Omit targetCommentId for a new top-level comment (when the platform allows it).
 */
export async function zernioReplyToComment(
  apiKey: string,
  postId: string,
  zernioAccountId: string,
  message: string,
  targetCommentId?: string,
): Promise<{ success: boolean; commentId?: string }> {
  const base = getZernioBaseUrl();
  const url = `${base}/inbox/comments/${encodeURIComponent(postId)}`;
  const body: Record<string, string> = {
    accountId: zernioAccountId,
    message,
  };
  if (targetCommentId) {
    body.commentId = targetCommentId;
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...authHeaders(apiKey),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { success: false };
  }
  const commentId = (data as { data?: { commentId?: string; id?: string } })?.data?.commentId
    ?? (data as { data?: { commentId?: string; id?: string } })?.data?.id
    ?? (data as { commentId?: string })?.commentId;
  return { success: true, commentId };
}

export async function zernioSendMessage(
  apiKey: string,
  conversationId: string,
  zernioAccountId: string,
  message: string,
): Promise<{ success: boolean; messageId?: string }> {
  const base = getZernioBaseUrl();
  const url = `${base}/inbox/conversations/${encodeURIComponent(conversationId)}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...authHeaders(apiKey),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      accountId: zernioAccountId,
      message,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { success: false };
  }
  const msgId = (data as { data?: { messageId?: string } })?.data?.messageId;
  return { success: true, messageId: msgId };
}

export function mapZernioPlatformToMeta(platform: string): MetaPlatform {
  const p = platform.toLowerCase();
  if (p === 'x') {
    return 'twitter';
  }
  if (p === 'threads') {
    return 'threads';
  }
  if (p === 'instagram') {
    return 'instagram';
  }
  if (p === 'twitter') {
    return 'twitter';
  }
  if (p === 'bluesky') {
    return 'bluesky';
  }
  if (p === 'reddit') {
    return 'reddit';
  }
  if (p === 'telegram') {
    return 'telegram';
  }
  if (p === 'facebook') {
    return 'facebook';
  }
  if (p === 'linkedin') {
    return 'linkedin';
  }
  if (p === 'youtube') {
    return 'youtube';
  }
  if (p === 'tiktok') {
    return 'tiktok';
  }
  if (p === 'pinterest') {
    return 'pinterest';
  }
  return 'facebook';
}

/** Map our DB platform to Zernio inbox platform query value (omit for unknown). */
export function zernioPlatformFilter(platform: string): string | undefined {
  const p = platform.toLowerCase();
  if (
    p === 'facebook'
    || p === 'instagram'
    || p === 'twitter'
    || p === 'bluesky'
    || p === 'reddit'
    || p === 'telegram'
    || p === 'linkedin'
    || p === 'youtube'
    || p === 'tiktok'
    || p === 'pinterest'
  ) {
    return p;
  }
  if (p === 'threads') {
    return 'instagram';
  }
  if (p === 'x') {
    return 'twitter';
  }
  return undefined;
}

/**
 * Same as {@link zernioPlatformFilter} but Threads maps to `threads` (comment inbox API lists Threads separately).
 */
export function zernioCommentInboxPlatformFilter(platform: string): string | undefined {
  const p = platform.toLowerCase();
  if (p === 'threads') {
    return 'threads';
  }
  return zernioPlatformFilter(platform);
}
