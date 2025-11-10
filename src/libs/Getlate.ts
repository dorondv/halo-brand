/**
 * Getlate.dev API Client
 *
 * Unified API for social media scheduling and analytics.
 * Documentation: https://getlate.dev/docs
 */

import { Env } from './Env';

const GETLATE_API_BASE_URL = Env.GETLATE_API_URL || 'https://getlate.dev/api/v1';

export type GetlatePlatform
  = | 'twitter'
    | 'x'
    | 'facebook'
    | 'instagram'
    | 'linkedin'
    | 'tiktok'
    | 'youtube'
    | 'threads';

export type GetlateProfile = {
  id?: string;
  _id?: string; // Getlate API sometimes returns _id format
  name: string;
  created_at?: string;
  updated_at?: string;
};

export type GetlateAccount = {
  id?: string; // May be _id in API response
  _id?: string; // Getlate API uses _id format
  profileId: string;
  platform: GetlatePlatform;
  accountName?: string; // May be username in API response
  username?: string; // Getlate API uses username
  accountId?: string; // May not be present in API response
  displayName?: string;
  avatarUrl?: string; // May be profilePicture in API response
  profilePicture?: string; // Getlate API uses profilePicture
  followerCount?: number;
  isConnected?: boolean; // May be isActive in API response
  isActive?: boolean; // Getlate API uses isActive
  lastSync?: string;
  tokenExpiresAt?: string; // Getlate API includes token expiration
  permissions?: string[]; // Getlate API includes permissions array
  metadata?: Record<string, unknown>;
};

export type GetlatePost = {
  id: string;
  profileId: string;
  content: string;
  mediaUrls?: string[];
  scheduledFor?: string;
  timezone?: string;
  platforms: Array<{
    platform: GetlatePlatform;
    accountId: string;
    platformSpecificData?: Record<string, unknown>;
  }>;
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  createdAt: string;
  updatedAt: string;
};

export type GetlateAnalytics = {
  postId: string;
  platform: GetlatePlatform;
  likes?: number;
  comments?: number;
  shares?: number;
  impressions?: number;
  engagementRate?: number;
  date: string;
  metadata?: Record<string, unknown>;
};

// Queue slot interface removed - using inline type in getNextQueueSlot

export type GetlateError = {
  error: string;
  message: string;
  code?: string;
};

export class GetlateClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.baseUrl = GETLATE_API_BASE_URL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        error: 'Unknown error',
        message: `HTTP ${response.status}: ${response.statusText}`,
      })) as GetlateError;

      throw new Error(
        errorData.message || errorData.error || `HTTP ${response.status}`,
      );
    }

    return response.json() as Promise<T>;
  }

  /**
   * Get all connected accounts for a profile
   * Note: Getlate API returns accounts in format: { accounts: [...] }
   * Each account has: _id, profileId, platform, username, displayName, profilePicture, isActive, etc.
   */
  async getAccounts(profileId?: string): Promise<GetlateAccount[]> {
    const endpoint = profileId
      ? `/accounts?profileId=${profileId}`
      : '/accounts';
    const response = await this.request<any>(endpoint);

    // Handle different response formats
    let accounts: any[] = [];

    if (Array.isArray(response)) {
      accounts = response;
    } else if (response && typeof response === 'object') {
      // Getlate API returns { accounts: [...] }
      accounts = response.accounts || response.data || response.results || [];
    }

    if (!Array.isArray(accounts)) {
      return [];
    }

    // Map Getlate API response format to our interface
    // API uses: _id, username, profilePicture, isActive
    // We need: id, accountName, avatarUrl, isConnected
    return accounts.map((account: any) => ({
      id: account._id || account.id,
      _id: account._id,
      profileId: account.profileId,
      platform: account.platform,
      accountName: account.username || account.accountName, // Map username to accountName
      username: account.username,
      accountId: account.accountId || account._id, // Use _id as accountId if not provided
      displayName: account.displayName,
      avatarUrl: account.profilePicture || account.avatarUrl, // Map profilePicture to avatarUrl
      profilePicture: account.profilePicture,
      followerCount: account.followerCount,
      isConnected: account.isActive !== undefined ? account.isActive : account.isConnected, // Map isActive to isConnected
      isActive: account.isActive,
      lastSync: account.lastSync,
      tokenExpiresAt: account.tokenExpiresAt,
      permissions: account.permissions,
      metadata: account.metadata || {},
    })) as GetlateAccount[];
  }

  /**
   * Initiate OAuth connection flow for a social account
   * Returns a URL to redirect the user to for OAuth authorization
   * Note: The /connect endpoint may not be available, use createPlatformInvite instead
   */
  async connectAccount(
    platform: GetlatePlatform,
    profileId: string,
    redirectUrl?: string,
  ): Promise<{ authUrl: string; state: string }> {
    // Try using platform-invites as /connect returns 405
    const inviteResult = await this.createPlatformInvite({
      profileId,
      platform,
      redirectUrl,
    });

    return {
      authUrl: inviteResult.inviteUrl,
      state: inviteResult.token,
    };
  }

  /**
   * Create a new post
   * Note: Getlate API may return post in nested structure like { message: string, post: GetlatePost }
   */
  async createPost(data: {
    profileId: string;
    content: string;
    mediaUrls?: string[];
    scheduledFor?: string;
    timezone?: string;
    platforms: Array<{
      platform: GetlatePlatform;
      accountId: string;
      platformSpecificData?: Record<string, unknown>;
    }>;
    queuedFromProfile?: string; // Profile ID if post is added to queue
  }): Promise<GetlatePost> {
    const response = await this.request<any>('/posts', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    // Handle nested response format: { message: string, post: GetlatePost }
    if (response && response.post) {
      return response.post as GetlatePost;
    }

    // Fallback: if response is already a post object
    return response as GetlatePost;
  }

  /**
   * Bulk upload posts
   */
  async bulkUploadPosts(
    profileId: string,
    posts: Array<{
      content: string;
      mediaUrls?: string[];
      scheduledFor?: string;
      timezone?: string;
      platforms: Array<{
        platform: GetlatePlatform;
        accountId: string;
        platformSpecificData?: Record<string, unknown>;
      }>;
    }>,
  ): Promise<{ posts: GetlatePost[]; errors?: Array<{ index: number; error: string }> }> {
    return this.request<{ posts: GetlatePost[]; errors?: Array<{ index: number; error: string }> }>(
      '/posts/bulk-upload',
      {
        method: 'POST',
        body: JSON.stringify({
          profileId,
          posts,
        }),
      },
    );
  }

  /**
   * Get posts from Getlate API
   * Fetches all posts for a profile or all posts if no profileId is provided
   */
  async getPosts(params?: {
    profileId?: string;
    status?: 'draft' | 'scheduled' | 'published' | 'failed';
    limit?: number;
    page?: number;
  }): Promise<GetlatePost[]> {
    const queryParams = new URLSearchParams();
    if (params?.profileId) {
      queryParams.append('profileId', params.profileId);
    }
    if (params?.status) {
      queryParams.append('status', params.status);
    }
    if (params?.limit) {
      queryParams.append('limit', params.limit.toString());
    }
    if (params?.page) {
      queryParams.append('page', params.page.toString());
    }

    const endpoint = `/posts${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await this.request<any>(endpoint);

    // Handle different response formats
    if (Array.isArray(response)) {
      return response as GetlatePost[];
    } else if (response && typeof response === 'object') {
      // Try to extract from common response formats
      const posts = response.posts || response.data || response.results || response.items || [];
      if (Array.isArray(posts)) {
        return posts as GetlatePost[];
      }
    }

    return [];
  }

  /**
   * Get analytics for posts
   * ⚠️ Requires Analytics add-on. Returns HTTP 402 if not enabled.
   * Rate limit: 30 requests per hour per user
   * Note: Getlate API may return analytics in different formats (array or nested object)
   */
  async getAnalytics(params: {
    profileId?: string;
    postId?: string;
    platform?: GetlatePlatform | 'all';
    fromDate?: string; // ISO date format
    toDate?: string; // ISO date format
    limit?: number; // Default: 50
    page?: number; // Default: 1
    sortBy?: 'date' | 'engagement'; // Default: 'date'
    order?: 'asc' | 'desc'; // Default: 'desc'
  }): Promise<GetlateAnalytics[]> {
    const queryParams = new URLSearchParams();
    if (params.profileId) {
      queryParams.append('profileId', params.profileId);
    }
    if (params.postId) {
      queryParams.append('postId', params.postId);
    }
    if (params.platform) {
      queryParams.append('platform', params.platform);
    }
    if (params.fromDate) {
      queryParams.append('fromDate', params.fromDate);
    }
    if (params.toDate) {
      queryParams.append('toDate', params.toDate);
    }
    if (params.limit) {
      queryParams.append('limit', params.limit.toString());
    }
    if (params.page) {
      queryParams.append('page', params.page.toString());
    }
    if (params.sortBy) {
      queryParams.append('sortBy', params.sortBy);
    }
    if (params.order) {
      queryParams.append('order', params.order);
    }

    const endpoint = `/analytics${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await this.request<any>(endpoint);

    // Handle different response formats (array or nested object)
    if (Array.isArray(response)) {
      return response as GetlateAnalytics[];
    } else if (response && typeof response === 'object') {
      // Try to extract from common response formats
      const analytics = response.analytics || response.data || response.results || [];
      if (Array.isArray(analytics)) {
        return analytics as GetlateAnalytics[];
      }
    }

    // If we can't parse it, return empty array
    return [];
  }

  /**
   * Get next available queue slot
   * Returns the next available slot taking into account already scheduled posts
   */
  async getNextQueueSlot(
    profileId: string,
  ): Promise<{ profileId: string; nextSlot: string; timezone: string }> {
    const queryParams = new URLSearchParams();
    queryParams.append('profileId', profileId);

    return this.request<{ profileId: string; nextSlot: string; timezone: string }>(
      `/queue/next-slot?${queryParams.toString()}`,
    );
  }

  /**
   * Get all profiles for the authenticated user
   */
  async getProfiles(): Promise<GetlateProfile[]> {
    return this.request<GetlateProfile[]>('/profiles');
  }

  /**
   * Create a new profile
   * Note: Getlate API returns { message: string, profile: GetlateProfile }
   */
  async createProfile(name: string): Promise<GetlateProfile> {
    const response = await this.request<any>('/profiles', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });

    // Handle nested response format: { message: string, profile: GetlateProfile }
    if (response && response.profile) {
      return response.profile;
    }

    // Fallback: if response is already a profile object
    return response as GetlateProfile;
  }

  /**
   * Delete a profile by ID
   */
  async deleteProfile(profileId: string): Promise<void> {
    const url = `${this.baseUrl}/profiles/${profileId}`;
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };

    const response = await fetch(url, {
      method: 'DELETE',
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        error: 'Unknown error',
        message: `HTTP ${response.status}: ${response.statusText}`,
      })) as GetlateError;

      throw new Error(
        errorData.message || errorData.error || `HTTP ${response.status}`,
      );
    }

    // DELETE requests may return 204 No Content (empty body)
    // Try to parse JSON only if there's content
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      await response.json().catch(() => {
        // Ignore JSON parse errors for empty responses
      });
    }
  }

  /**
   * Get queue schedule for a profile (preview upcoming slots)
   */
  async getQueuePreview(
    profileId: string,
    count: number = 20,
  ): Promise<{ profileId: string; count: number; slots: string[] }> {
    const queryParams = new URLSearchParams();
    queryParams.append('profileId', profileId);
    queryParams.append('count', count.toString());

    return this.request<{ profileId: string; count: number; slots: string[] }>(
      `/queue/preview?${queryParams.toString()}`,
    );
  }

  /**
   * Create a team member invite token
   * This allows creating Getlate accounts for users automatically
   */
  async createTeamInvite(params: {
    scope: 'all' | 'profiles';
    profileIds?: string[];
  }): Promise<{
    token: string;
    scope: string;
    invitedProfileIds?: string[];
    expiresAt: string;
    inviteUrl: string;
  }> {
    return this.request<{
      token: string;
      scope: string;
      invitedProfileIds?: string[];
      expiresAt: string;
      inviteUrl: string;
    }>('/invite/tokens', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  /**
   * Create a platform connection invite
   * Allows users to connect social accounts without exposing Getlate
   */
  async createPlatformInvite(params: {
    profileId: string;
    platform: GetlatePlatform;
    redirectUrl?: string;
  }): Promise<{
    token: string;
    inviteUrl: string;
    expiresAt: string;
  }> {
    // Getlate API might expect redirect_url (snake_case) instead of redirectUrl (camelCase)
    // Try both formats to ensure compatibility
    const requestBody: any = {
      profileId: params.profileId,
      platform: params.platform,
    };

    if (params.redirectUrl) {
      // Include both formats to ensure Getlate recognizes it
      requestBody.redirectUrl = params.redirectUrl;
      requestBody.redirect_url = params.redirectUrl;
    }

    const response = await this.request<any>('/platform-invites', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    // Handle different response formats (camelCase, snake_case, or nested)
    // The response is nested in an "invite" object based on the API response
    const inviteUrl = response.invite?.inviteUrl // Nested in invite object
      || response.inviteUrl
      || response.invite_url
      || response.url
      || response.authUrl
      || response.invite?.url
      || response.data?.inviteUrl
      || response.data?.invite_url;

    const token = response.invite?.token // Nested in invite object
      || response.token
      || response.inviteToken
      || response.data?.token;

    const expiresAt = response.invite?.expiresAt // Nested in invite object
      || response.expiresAt
      || response.expires_at
      || response.data?.expiresAt;

    if (!inviteUrl) {
      throw new Error(`Platform invite response missing inviteUrl. Response keys: ${Object.keys(response || {}).join(', ')}`);
    }

    if (!token) {
      throw new Error(`Platform invite response missing token. Response keys: ${Object.keys(response || {}).join(', ')}`);
    }

    return {
      token,
      inviteUrl,
      expiresAt: expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Default 7 days
    };
  }

  /**
   * List API keys for the authenticated account
   */
  async getApiKeys(): Promise<Array<{
    id: string;
    name: string;
    permissions: string[];
    createdAt: string;
    expiresAt?: string;
  }>> {
    return this.request<Array<{
      id: string;
      name: string;
      permissions: string[];
      createdAt: string;
      expiresAt?: string;
    }>>('/api-keys');
  }

  /**
   * Create a new API key
   */
  async createApiKey(params: {
    name: string;
    permissions?: string[];
    expiresIn?: number; // days
  }): Promise<{
    id: string;
    key: string; // Only returned on creation
    name: string;
    permissions: string[];
    createdAt: string;
    expiresAt?: string;
  }> {
    return this.request<{
      id: string;
      key: string;
      name: string;
      permissions: string[];
      createdAt: string;
      expiresAt?: string;
    }>('/api-keys', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  /**
   * Delete an API key
   */
  async deleteApiKey(keyId: string): Promise<void> {
    await this.request(`/api-keys/${keyId}`, {
      method: 'DELETE',
    });
  }
}

/**
 * Create a Getlate client instance with user's API key
 */
export function createGetlateClient(apiKey: string): GetlateClient {
  return new GetlateClient(apiKey);
}
