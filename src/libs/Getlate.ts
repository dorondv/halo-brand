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
  accessToken?: string;
  tempToken?: string;
};

export type GetlateFacebookPage = {
  id?: string;
  name: string;
  pageId?: string;
  pageName?: string;
  pictureUrl?: string;
  accessToken?: string;
  metadata?: Record<string, unknown>;
};

export type GetlateLinkedInOrganization = {
  id?: string;
  name: string;
  urn?: string;
  logoUrl?: string;
  vanityName?: string;
  metadata?: Record<string, unknown>;
  sourceUrl?: string;
};

export type GetlatePost = {
  id: string;
  profileId: string;
  content: string;
  mediaUrls?: string[]; // Legacy support
  mediaItems?: Array<{
    type: 'image' | 'video';
    url: string;
  }>;
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

export type GetlateAnalyticsPost = {
  _id: string;
  content: string;
  publishedAt: string;
  scheduledFor: string;
  status: string;
  analytics: {
    impressions: number;
    reach: number;
    likes: number;
    comments: number;
    shares: number;
    clicks: number;
    views: number;
    lastUpdated: string;
  };
  platforms: Array<{
    platform: string;
    status: string;
    analytics: {
      impressions: number;
      reach: number;
      likes: number;
      comments: number;
      shares: number;
      clicks: number;
      views: number;
      engagementRate: number;
      lastUpdated: string;
    };
  }>;
  platform: string;
  platformPostUrl?: string;
  isExternal?: boolean;
  profileId: string;
  thumbnailUrl?: string;
  mediaType?: string;
  mediaItems?: unknown[];
};

export type GetlateAnalyticsResponse = {
  overview: {
    totalPosts: number;
    publishedPosts: number;
    scheduledPosts: number;
    lastSync: string;
  };
  posts: GetlateAnalyticsPost[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
};

// Legacy type for backward compatibility
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
   * Get raw account data from Getlate API (includes availablePages, etc.)
   * Used internally to access fields not mapped by getAccounts()
   */
  async getRawAccounts(profileId?: string): Promise<any[]> {
    const endpoint = profileId
      ? `/accounts?profileId=${profileId}`
      : '/accounts';
    const response = await this.request<any>(endpoint);

    // Handle different response formats
    if (Array.isArray(response)) {
      return response;
    } else if (response && typeof response === 'object') {
      return response.accounts || response.data || response.results || [];
    }

    return [];
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
      // Preserve accessToken and tempToken if present in the account object
      accessToken: account.accessToken || account.access_token,
      tempToken: account.tempToken || account.temp_token,
      metadata: {
        ...(account.metadata || {}),
        // Also include accessToken/tempToken in metadata if they exist
        ...(account.accessToken ? { accessToken: account.accessToken } : {}),
        ...(account.tempToken ? { tempToken: account.tempToken } : {}),
        ...(account.access_token ? { accessToken: account.access_token } : {}),
        ...(account.temp_token ? { tempToken: account.temp_token } : {}),
      },
    })) as GetlateAccount[];
  }

  /**
   * Initiate OAuth connection flow for a social account
   * Uses GET /v1/connect/[platform] endpoint with redirect_url parameter
   * Returns a URL to redirect the user to for OAuth authorization
   *
   * According to Getlate API docs:
   * GET /v1/connect/[platform]?profileId=PROFILE_ID&redirect_url=YOUR_URL
   *
   * Note: Getlate API returns JSON with authUrl instead of redirecting directly
   * Success redirect: redirect_url?connected=platform&profileId=PROFILE_ID&username=USERNAME
   * Error redirect: redirect_url?error=ERROR_TYPE&platform=PLATFORM
   */
  async connectAccount(
    platform: GetlatePlatform,
    profileId: string,
    redirectUrl?: string,
  ): Promise<{ authUrl: string; state?: string }> {
    // Normalize platform name (x -> twitter for Getlate API)
    const normalizedPlatform = platform === 'x' ? 'twitter' : platform;

    // Build the endpoint URL with query parameters
    let endpoint = `/connect/${normalizedPlatform}?profileId=${encodeURIComponent(profileId)}`;

    // Add redirect_url if provided
    if (redirectUrl) {
      endpoint += `&redirect_url=${encodeURIComponent(redirectUrl)}`;
    }

    // Getlate API returns JSON with authUrl, not a redirect
    // We need to fetch the endpoint and extract the authUrl from the response
    const response = await this.request<{ authUrl: string; state?: string }>(endpoint, {
      method: 'GET',
    });

    // Extract authUrl from response (could be nested or direct)
    const authUrl = response.authUrl || (response as any).url || (response as any).redirectUrl;

    if (!authUrl) {
      throw new Error('Failed to get OAuth URL from Getlate API');
    }

    return {
      authUrl,
      state: response.state,
    };
  }

  /**
   * Create a new post
   * Note: Getlate API may return post in nested structure like { message: string, post: GetlatePost }
   * According to Getlate API docs, use mediaItems (not mediaUrls) for proper media handling
   */
  async createPost(data: {
    profileId: string;
    content: string;
    mediaUrls?: string[]; // Legacy - will be converted to mediaItems
    mediaItems?: Array<{
      type: 'image' | 'video';
      url: string;
    }>;
    scheduledFor?: string;
    timezone?: string;
    platforms: Array<{
      platform: GetlatePlatform;
      accountId: string;
      platformSpecificData?: Record<string, unknown>;
    }>;
    queuedFromProfile?: string; // Profile ID if post is added to queue
  }): Promise<GetlatePost> {
    // Convert mediaUrls to mediaItems format if needed
    const requestData: any = { ...data };

    // If mediaUrls is provided but mediaItems is not, convert it
    if (requestData.mediaUrls && !requestData.mediaItems && Array.isArray(requestData.mediaUrls)) {
      requestData.mediaItems = requestData.mediaUrls.map((url: string) => {
        // Determine type from URL
        const urlLower = url.toLowerCase();
        const isVideo = urlLower.includes('.mp4') || urlLower.includes('.mov')
          || urlLower.includes('.avi') || urlLower.includes('.webm')
          || urlLower.includes('.m4v') || urlLower.includes('video');

        return {
          type: isVideo ? 'video' as const : 'image' as const,
          url,
        };
      });
      // Remove mediaUrls as we're using mediaItems
      delete requestData.mediaUrls;
    }

    const response = await this.request<any>('/posts', {
      method: 'POST',
      body: JSON.stringify(requestData),
    });

    // Handle nested response format: { message: string, post: GetlatePost }
    if (response && response.post) {
      return response.post as GetlatePost;
    }

    // Fallback: if response is already a post object
    return response as GetlatePost;
  }

  /**
   * Upload media files to Getlate
   * Supports both small files (multipart) and large files (client-upload flow)
   * For large files (>4MB), use the client-upload flow with @vercel/blob
   *
   * @param files - Array of file URLs or File objects to upload
   * @returns Array of uploaded media with URLs from Getlate
   */
  async uploadMedia(files: Array<File | string>): Promise<Array<{
    type: 'image' | 'video';
    url: string;
    filename: string;
    size: number;
    mimeType: string;
  }>> {
    // For now, we'll handle URLs (from Supabase Storage) by downloading and uploading
    // In the future, we could optimize by uploading directly to Getlate from the frontend

    const uploadedFiles: Array<{
      type: 'image' | 'video';
      url: string;
      filename: string;
      size: number;
      mimeType: string;
    }> = [];

    for (const file of files) {
      if (typeof file === 'string') {
        // It's a URL - we need to download it first, then upload to Getlate
        // For now, we'll pass the URL directly and let Getlate handle it
        // If Getlate doesn't accept external URLs, we'd need to download and re-upload
        // But based on the docs, it seems Getlate expects files to be uploaded to their endpoint

        // Try to determine file type from URL
        const urlLower = file.toLowerCase();
        const isVideo = urlLower.includes('.mp4') || urlLower.includes('.mov') || urlLower.includes('.avi')
          || urlLower.includes('.webm') || urlLower.includes('.m4v');
        const type = isVideo ? 'video' : 'image';

        // Extract filename from URL
        const urlParts = file.split('/');
        const filename = urlParts[urlParts.length - 1] || 'media.jpg';

        // For URLs, we'll need to download and upload
        // But for now, let's try passing the URL directly in mediaUrls
        // If that doesn't work, we'll need to implement download + upload
        uploadedFiles.push({
          type,
          url: file, // Use original URL - Getlate may accept external URLs
          filename,
          size: 0, // Unknown size from URL
          mimeType: type === 'video' ? 'video/mp4' : 'image/jpeg',
        });
      } else {
        // It's a File object - upload directly via multipart
        const formData = new FormData();
        formData.append('files', file);

        const url = `${this.baseUrl}/media`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            // Don't set Content-Type - let browser set it with boundary for multipart
          },
          body: formData,
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

        const responseData = await response.json() as { files: Array<{
          type: 'image' | 'video';
          url: string;
          filename: string;
          size: number;
          mimeType: string;
        }>; };

        if (responseData.files && Array.isArray(responseData.files)) {
          uploadedFiles.push(...responseData.files);
        }
      }
    }

    return uploadedFiles;
  }

  /**
   * Upload media from URLs (downloads and re-uploads to Getlate)
   * This is needed when media is stored in Supabase Storage and needs to be uploaded to Getlate
   * Works in both browser and Node.js environments
   */
  async uploadMediaFromUrls(urls: string[]): Promise<string[]> {
    // Download files from URLs and upload to Getlate
    const uploadedMedia: string[] = [];

    for (const url of urls) {
      try {
        // Download the file
        const response = await fetch(url);
        if (!response.ok) {
          console.warn(`[Getlate] Failed to download media from ${url}: ${response.status} ${response.statusText}`);
          // Fallback to original URL if download fails
          uploadedMedia.push(url);
          continue;
        }

        const arrayBuffer = await response.arrayBuffer();
        const filename = url.split('/').pop()?.split('?')[0] || 'media.jpg';

        // Determine content type from URL or response headers
        const contentType = response.headers.get('content-type')
          || (url.toLowerCase().includes('.mp4')
            ? 'video/mp4'
            : url.toLowerCase().includes('.mov')
              ? 'video/quicktime'
              : url.toLowerCase().includes('.webm')
                ? 'video/webm'
                : url.toLowerCase().includes('.png')
                  ? 'image/png'
                  : url.toLowerCase().includes('.gif')
                    ? 'image/gif'
                    : url.toLowerCase().includes('.webp')
                      ? 'image/webp'
                      : 'image/jpeg');

        // Upload to Getlate using multipart/form-data
        // FormData and Blob are available in Node.js 18+ (which Next.js 16 uses)
        const formData = new FormData();
        // Create Blob from ArrayBuffer (works in both browser and Node.js 18+)
        const blob = new Blob([arrayBuffer], { type: contentType });
        // Create a File-like object for FormData
        // In Node.js 18+, FormData accepts Blob with filename as third parameter
        formData.append('files', blob, filename);

        const mediaUrl = `${this.baseUrl}/media`;
        const uploadResponse = await fetch(mediaUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            // Don't set Content-Type - let fetch set it with boundary for multipart
          },
          body: formData,
        });

        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text();
          let errorData: GetlateError;
          try {
            errorData = JSON.parse(errorText) as GetlateError;
          } catch {
            errorData = {
              error: 'Unknown error',
              message: `HTTP ${uploadResponse.status}: ${uploadResponse.statusText}`,
            };
          }

          console.error(`[Getlate] Failed to upload media to Getlate from ${url}:`, errorData.message || errorData.error, `Response: ${errorText}`);
          // Fallback to original URL if upload fails
          uploadedMedia.push(url);
          continue;
        }

        const uploadData = await uploadResponse.json() as { files: Array<{
          type: 'image' | 'video';
          url: string;
          filename: string;
          size: number;
          mimeType: string;
        }>; };

        if (uploadData.files && Array.isArray(uploadData.files) && uploadData.files.length > 0 && uploadData.files[0]) {
          uploadedMedia.push(uploadData.files[0].url);
        } else {
          console.warn(`[Getlate] No files in upload response, using original URL`);
          // Fallback to original URL if no files returned
          uploadedMedia.push(url);
        }
      } catch (error) {
        console.error(`[Getlate] Error uploading media from ${url}:`, error);
        // Fallback to original URL on error
        uploadedMedia.push(url);
      }
    }

    return uploadedMedia;
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
   * Returns structured response with overview, posts, and pagination
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
  }): Promise<GetlateAnalyticsResponse> {
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
    return this.request<GetlateAnalyticsResponse>(endpoint);
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
   * or may return the profile directly
   */
  async createProfile(name: string): Promise<GetlateProfile> {
    const response = await this.request<any>('/profiles', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });

    // Handle nested response format: { message: string, profile: GetlateProfile }
    if (response && response.profile) {
      const profile = response.profile;
      // Ensure profile has an ID field (check both _id and id)
      if (!profile._id && !profile.id) {
        console.warn('[Getlate] Profile response missing ID:', JSON.stringify(profile, null, 2));
      }
      return profile;
    }

    // Handle response with data property: { data: GetlateProfile }
    if (response && response.data) {
      const profile = response.data;
      if (!profile._id && !profile.id) {
        console.warn('[Getlate] Profile data missing ID:', JSON.stringify(profile, null, 2));
      }
      return profile;
    }

    // Fallback: if response is already a profile object
    const profile = response as GetlateProfile;
    if (!profile._id && !profile.id) {
      console.warn('[Getlate] Profile response missing ID (direct format):', JSON.stringify(response, null, 2));
    }
    return profile;
  }

  /**
   * Delete a profile by ID
   */
  /**
   * Disconnect/delete an account from Getlate
   * DELETE /v1/accounts/:accountId
   */
  async disconnectAccount(accountId: string): Promise<void> {
    const url = `${this.baseUrl}/accounts/${accountId}`;
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

  /**
   * Get Facebook pages for selection during OAuth flow
   * Used when connecting Facebook account to select which page to use
   */
  async getFacebookSelectPage(profileId: string, tempToken: string): Promise<GetlateFacebookPage[]> {
    if (!profileId || !tempToken) {
      return [];
    }

    const endpoint = `/connect/facebook/select-page?profileId=${encodeURIComponent(profileId)}&tempToken=${encodeURIComponent(tempToken)}`;
    const response = await this.request<any>(endpoint, {
      method: 'GET',
    });

    const rawPages = Array.isArray(response?.pages)
      ? response.pages
      : Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response?.results)
          ? response.results
          : [];

    if (!Array.isArray(rawPages)) {
      return [];
    }

    return rawPages
      .map((page: any) => ({
        id: page._id || page.id || page.pageId || page.facebookPageId,
        name: page.name || page.pageName || page.title || 'Page',
        pageId: page.pageId || page.facebookPageId || page.id,
        pageName: page.pageName || page.name || page.title,
        pictureUrl: page.picture?.data?.url || page.pictureUrl || page.logoUrl,
        accessToken: page.pageAccessToken || page.accessToken,
        metadata: page.metadata || {},
      }))
      .filter(page => !!page.id && !!page.name);
  }

  /**
   * Get Facebook pages for an already-connected account
   * Uses account's stored token internally (no tempToken required)
   * Similar to getLinkedInOrganizations but for Facebook pages
   */
  async getFacebookPages(accountId: string): Promise<GetlateFacebookPage[]> {
    if (!accountId) {
      return [];
    }

    const endpoint = `/accounts/${encodeURIComponent(accountId)}/facebook-pages`;
    try {
      const response = await this.request<any>(endpoint, {
        method: 'GET',
      });

      const rawPages = Array.isArray(response?.pages)
        ? response.pages
        : Array.isArray(response?.data)
          ? response.data
          : Array.isArray(response?.results)
            ? response.results
            : [];

      if (!Array.isArray(rawPages)) {
        return [];
      }

      return rawPages
        .map((page: any) => ({
          id: page._id || page.id || page.pageId || page.facebookPageId,
          name: page.name || page.pageName || page.title || 'Page',
          pageId: page.pageId || page.facebookPageId || page.id,
          pageName: page.pageName || page.name || page.title,
          pictureUrl: page.picture?.data?.url || page.pictureUrl || page.logoUrl,
          accessToken: page.pageAccessToken || page.accessToken,
          metadata: page.metadata || {},
        }))
        .filter(page => !!page.id && !!page.name);
    } catch (error) {
      // If endpoint doesn't exist or returns 404, return empty array
      if (error instanceof Error && error.message.includes('HTTP 404')) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Select a Facebook page for an account
   */
  async selectFacebookPage(
    accountId: string,
    payload: {
      pageId: string;
      pageName?: string;
      pageAccessToken?: string;
    },
  ): Promise<void> {
    if (!accountId || !payload.pageId) {
      throw new Error('Missing accountId or pageId');
    }

    await this.request(`/accounts/${encodeURIComponent(accountId)}/facebook-page`, {
      method: 'PUT',
      body: JSON.stringify({
        pageId: payload.pageId,
        page_id: payload.pageId,
        facebookPageId: payload.pageId,
        facebook_page_id: payload.pageId,
        selectedPageId: payload.pageId,
        pageName: payload.pageName,
        pageAccessToken: payload.pageAccessToken,
        page_access_token: payload.pageAccessToken,
      }),
    });
  }

  /**
   * Get LinkedIn organizations for an account
   * @param accountId - The Getlate account ID
   * @param tempToken - Optional access token to use as tempToken for the request
   */
  async getLinkedInOrganizations(accountId: string, tempToken?: string): Promise<GetlateLinkedInOrganization[]> {
    if (!accountId) {
      return [];
    }

    let endpoint = `/accounts/${encodeURIComponent(accountId)}/linkedin-organizations`;
    if (tempToken) {
      endpoint += `?tempToken=${encodeURIComponent(tempToken)}`;
    }

    const response = await this.request<any>(endpoint, {
      method: 'GET',
    });

    const rawOrgs = Array.isArray(response?.organizations)
      ? response.organizations
      : Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response?.results)
          ? response.results
          : [];

    if (!Array.isArray(rawOrgs)) {
      return [];
    }

    return rawOrgs
      .map((org: any) => ({
        id: org._id || org.id || org.organizationId,
        name: org.name || org.organizationName || org.title || 'Organization',
        urn: org.urn || org.organizationUrn,
        logoUrl: org.logoUrl || org.pictureUrl,
        vanityName: org.vanityName,
        sourceUrl: org.sourceUrl || org.url || org.profileUrl,
        metadata: org.metadata || {},
      }))
      .filter(org => !!org.id && !!org.name);
  }

  /**
   * Select a LinkedIn organization for an account
   */
  async selectLinkedInOrganization(
    accountId: string,
    payload: {
      organizationId: string;
      organizationName?: string;
      organizationUrn?: string;
      manual?: boolean;
      sourceUrl?: string;
    },
  ): Promise<any> {
    if (!accountId || !payload.organizationId) {
      throw new Error('Missing accountId or organizationId');
    }

    const response = await this.request(`/accounts/${encodeURIComponent(accountId)}/linkedin-organization`, {
      method: 'PUT',
      body: JSON.stringify({
        accountType: 'organization',
        selectedOrganization: {
          id: payload.organizationId,
          urn: payload.organizationUrn,
          name: payload.organizationName,
          manual: payload.manual ?? true,
          sourceUrl: payload.sourceUrl,
        },
      }),
    });

    return response;
  }
}

/**
 * Create a Getlate client instance with user's API key
 */
export function createGetlateClient(apiKey: string): GetlateClient {
  return new GetlateClient(apiKey);
}
