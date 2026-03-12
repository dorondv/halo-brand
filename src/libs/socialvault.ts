/**
 * SocialVault API client for fetching comments from social media platforms
 * Documentation: https://docs.sociavault.com
 */

import { Env } from './Env';

const SOCIAL_VAULT_API_BASE = 'https://api.sociavault.com/v1/scrape';

export type SocialVaultComment = {
  id: string;
  text: string;
  created_at: string;
  user: {
    username: string;
    id?: string;
    profile_pic_url?: string;
    is_verified?: boolean;
  };
};

export type SocialVaultCommentsResponse = {
  success: boolean;
  data?: {
    success: boolean;
    comments?: Record<string, {
      id: string;
      text: string;
      created_at: string;
      user: {
        is_verified?: boolean;
        id: string;
        pk?: string;
        is_unpublished?: boolean | null;
        profile_pic_url?: string;
        username: string;
        fbid_v2?: string;
      };
    }>;
    cursor?: string | null;
  };
  credits_used?: number;
  endpoint?: string;
  // Legacy format (if API returns flat structure)
  num_comments_grabbed?: number;
  credit_cost?: number;
  comments?: SocialVaultComment[];
};

export type SocialVaultTikTokCommentsResponse = {
  comments: SocialVaultComment[];
  cursor?: number;
  has_more?: boolean;
  total?: number;
};

/**
 * Fetch comments from Instagram post using SocialVault API
 * Cost: 1 credit per 15 comments (default is 15 comments = 1 credit)
 * Docs: https://docs.sociavault.com/api-reference/instagram/comments
 */
export async function fetchInstagramComments(
  postUrl: string,
  amount?: number, // Optional: default is 15 (1 credit). More comments = more credits (15 comments per credit)
): Promise<SocialVaultComment[]> {
  const apiKey = Env.SOCIAL_VAULT;
  if (!apiKey) {
    throw new Error('SOCIAL_VAULT API key is not configured');
  }

  // Validate URL format - return empty array instead of throwing to prevent breaking the analysis
  if (!postUrl || typeof postUrl !== 'string' || postUrl.trim().length === 0) {
    console.warn(`[SocialVault] Invalid Instagram post URL provided: ${postUrl}`);
    return [];
  }

  const trimmedUrl = postUrl.trim();

  // Ensure URL is a valid Instagram URL
  if (!trimmedUrl.includes('instagram.com')) {
    console.warn(`[SocialVault] URL does not appear to be an Instagram URL: ${trimmedUrl}`);
    return [];
  }

  const url = new URL(`${SOCIAL_VAULT_API_BASE}/instagram/comments`);
  url.searchParams.set('url', trimmedUrl);
  // Only set amount if specified, otherwise use default (15 comments = 1 credit)
  if (amount !== undefined) {
    url.searchParams.set('amount', Math.min(amount, 300).toString()); // Cap at 300 (max allowed)
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'X-API-Key': apiKey,
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    console.error(`[SocialVault] Error response body:`, errorText);

    // Handle insufficient credits error (402) gracefully
    if (response.status === 402) {
      console.warn('[SocialVault] Insufficient credits. Please add credits to your SocialVault account.');
      return [];
    }

    throw new Error(`SocialVault API error: ${response.status} - ${errorText}`);
  }

  const responseText = await response.text();

  let data: SocialVaultCommentsResponse;
  try {
    data = JSON.parse(responseText) as SocialVaultCommentsResponse;
  } catch (parseError) {
    console.error(`[SocialVault] Failed to parse JSON response:`, parseError);
    console.error(`[SocialVault] Response text was:`, responseText);
    throw new Error(`Invalid JSON response from SocialVault: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
  }

  if (!data.success) {
    console.error(`[SocialVault] API returned unsuccessful response:`, data);
    throw new Error('SocialVault API returned unsuccessful response');
  }

  // Extract comments from the nested structure
  let comments: SocialVaultComment[] = [];

  if (data.data?.comments) {
    // Comments are in data.comments as an object with numeric keys
    // Convert object to array
    const commentsObject = data.data.comments;
    comments = Object.values(commentsObject).map(comment => ({
      id: comment.id,
      text: comment.text,
      created_at: comment.created_at,
      user: {
        username: comment.user.username,
        id: comment.user.id,
        profile_pic_url: comment.user.profile_pic_url,
        is_verified: comment.user.is_verified,
      },
    }));
  } else if (data.comments && Array.isArray(data.comments)) {
    // Legacy format: comments as array
    comments = data.comments;
  }

  if (comments.length === 0) {
    console.warn(`[SocialVault] No Instagram comments returned. Response data:`, {
      success: data.success,
      hasDataComments: !!data.data?.comments,
      commentsObjectKeys: data.data?.comments ? Object.keys(data.data.comments) : [],
      credits_used: data.credits_used,
    });
  }

  return comments;
}

/**
 * Fetch comments from TikTok video using SocialVault API
 */
export async function fetchTikTokComments(
  videoUrl: string,
  cursor?: number,
): Promise<{ comments: SocialVaultComment[]; cursor?: number; has_more?: boolean }> {
  const apiKey = Env.SOCIAL_VAULT;
  if (!apiKey) {
    throw new Error('SOCIAL_VAULT API key is not configured');
  }

  // Validate URL format - return empty array instead of throwing to prevent breaking the analysis
  if (!videoUrl || typeof videoUrl !== 'string' || videoUrl.trim().length === 0) {
    console.warn(`[SocialVault] Invalid TikTok video URL provided: ${videoUrl}`);
    return { comments: [], cursor: undefined, has_more: false };
  }

  const trimmedUrl = videoUrl.trim();

  if (!trimmedUrl.includes('tiktok.com')) {
    console.warn(`[SocialVault] URL does not appear to be a TikTok URL: ${trimmedUrl}`);
    return { comments: [], cursor: undefined, has_more: false };
  }

  const url = new URL(`${SOCIAL_VAULT_API_BASE}/tiktok/comments`);
  url.searchParams.set('url', trimmedUrl);
  if (cursor !== undefined) {
    url.searchParams.set('cursor', cursor.toString());
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'X-API-Key': apiKey,
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    console.error(`[SocialVault] Error response body:`, errorText);

    // Handle insufficient credits error (402) gracefully
    if (response.status === 402) {
      console.warn('[SocialVault] Insufficient credits. Please add credits to your SocialVault account.');
      return { comments: [], cursor: undefined, has_more: false };
    }

    throw new Error(`SocialVault API error: ${response.status} - ${errorText}`);
  }

  const responseText = await response.text();

  let data: SocialVaultTikTokCommentsResponse;
  try {
    data = JSON.parse(responseText) as SocialVaultTikTokCommentsResponse;
  } catch (parseError) {
    console.error(`[SocialVault] Failed to parse JSON response:`, parseError);
    console.error(`[SocialVault] Response text was:`, responseText);
    throw new Error(`Invalid JSON response from SocialVault: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
  }

  return {
    comments: data.comments || [],
    cursor: data.cursor,
    has_more: data.has_more,
  };
}

/**
 * Fetch comments from Facebook post using SocialVault API
 * Note: Facebook doesn't have a dedicated comments endpoint, but we can get comments via the post endpoint
 */
export async function fetchFacebookComments(
  postUrl: string,
): Promise<SocialVaultComment[]> {
  const apiKey = Env.SOCIAL_VAULT;
  if (!apiKey) {
    throw new Error('SOCIAL_VAULT API key is not configured');
  }

  // Validate URL format - return empty array instead of throwing to prevent breaking the analysis
  if (!postUrl || typeof postUrl !== 'string' || postUrl.trim().length === 0) {
    console.warn(`[SocialVault] Invalid Facebook post URL provided: ${postUrl}`);
    return [];
  }

  const trimmedUrl = postUrl.trim();

  if (!trimmedUrl.includes('facebook.com')) {
    console.warn(`[SocialVault] URL does not appear to be a Facebook URL: ${trimmedUrl}`);
    return [];
  }

  const url = new URL(`${SOCIAL_VAULT_API_BASE}/facebook/post`);
  url.searchParams.set('url', trimmedUrl);
  url.searchParams.set('get_comments', 'true');

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'X-API-Key': apiKey,
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    console.error(`[SocialVault] Error response body:`, errorText);

    // Handle insufficient credits error (402) gracefully
    if (response.status === 402) {
      console.warn('[SocialVault] Insufficient credits. Please add credits to your SocialVault account.');
      return [];
    }

    throw new Error(`SocialVault API error: ${response.status} - ${errorText}`);
  }

  const responseText = await response.text();

  let data: {
    success?: boolean;
    data?: {
      success?: boolean;
      comments?: Record<string, {
        id?: string;
        text?: string;
        author?: {
          name?: string;
          id?: string;
          username?: string;
          short_name?: string;
        };
        reaction_count?: number;
        created_at?: string;
      }>;
    };
    // Legacy format support
    comments?: Array<{
      id?: string;
      text?: string;
      created_at?: string;
      user?: {
        username?: string;
        name?: string;
        id?: string;
      };
    }>;
  };

  try {
    data = JSON.parse(responseText);
  } catch (parseError) {
    console.error(`[SocialVault] Failed to parse JSON response:`, parseError);
    console.error(`[SocialVault] Response text was:`, responseText);
    throw new Error(`Invalid JSON response from SocialVault: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
  }

  // Extract comments from the nested structure
  let comments: SocialVaultComment[] = [];

  if (data.data?.comments) {
    // Comments are in data.comments as an object with numeric keys
    // Convert object to array
    const commentsObject = data.data.comments;
    comments = Object.values(commentsObject).map(comment => ({
      id: comment.id || '',
      text: comment.text || '',
      created_at: comment.created_at || new Date().toISOString(),
      user: {
        username: comment.author?.username || comment.author?.short_name || comment.author?.name || 'Unknown',
        id: comment.author?.id,
      },
    }));
  } else if (data.comments && Array.isArray(data.comments)) {
    // Legacy format: comments as array
    comments = data.comments.map((comment, index) => ({
      id: comment.id || `fb-comment-${index}`,
      text: comment.text || '',
      created_at: comment.created_at || new Date().toISOString(),
      user: {
        username: comment.user?.username || comment.user?.name || 'Unknown',
        id: comment.user?.id,
      },
    }));
  }

  if (comments.length === 0) {
    console.warn(`[SocialVault] No Facebook comments extracted. Response data:`, {
      success: data.success,
      hasDataComments: !!data.data?.comments,
      commentsObjectKeys: data.data?.comments ? Object.keys(data.data.comments) : [],
    });
  }

  return comments;
}

/**
 * Fetch comments for a post based on platform
 * Uses default amount (15 comments = 1 credit for Instagram)
 * Docs: https://docs.sociavault.com/api-reference
 */
export async function fetchCommentsForPost(
  platform: string,
  postUrl: string,
  amount?: number, // Optional: default is 15 comments (1 credit). More comments = more credits
): Promise<SocialVaultComment[]> {
  // Validate postUrl before making API call
  if (!postUrl || typeof postUrl !== 'string' || postUrl.trim().length === 0) {
    console.warn(`[SocialVault] Invalid post URL provided for platform ${platform}: ${postUrl}`);
    return [];
  }

  const normalizedPlatform = platform.toLowerCase();

  try {
    switch (normalizedPlatform) {
      case 'instagram':
        // Instagram: default is 15 comments = 1 credit, more comments = more credits
        return await fetchInstagramComments(postUrl, amount);
      case 'tiktok': {
        // TikTok: Each request costs 1 credit (pagination available via cursor)
        const result = await fetchTikTokComments(postUrl);
        return result.comments;
      }
      case 'facebook':
        // Facebook: Each request costs 1 credit (comments via post endpoint)
        return await fetchFacebookComments(postUrl);
      default:
        // For unsupported platforms, return empty array
        console.warn(`SocialVault does not support comments for platform: ${platform}`);
        return [];
    }
  } catch (error) {
    // If it's an insufficient credits error, it's already handled in the individual functions
    // For other errors, log and return empty array to not break the analysis
    if (error instanceof Error && error.message.includes('402')) {
      // Already handled, return empty array
      return [];
    }
    console.error(`[SocialVault] Error fetching comments for ${platform}:`, error);
    return [];
  }
}
