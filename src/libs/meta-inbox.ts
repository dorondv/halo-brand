/**
 * Meta Graph API Client for Unified Inbox
 *
 * Handles fetching conversations, messages, and sending replies
 * for Facebook, Instagram, and Threads platforms.
 */

const META_GRAPH_API_BASE = 'https://graph.facebook.com/v21.0';

export type MetaPlatform = 'facebook' | 'instagram' | 'threads';

export type ConversationType = 'chat' | 'comment';

export type InboxAccount = {
  id: string;
  accountId: string; // Platform account ID
  accountName: string;
  platform: MetaPlatform;
  avatarUrl?: string;
  unreadCount: number;
  isActive: boolean;
  pageId?: string; // For Facebook Pages
  pageAccessToken?: string; // For Facebook Pages
};

export type Conversation = {
  id: string;
  accountId: string;
  platform: MetaPlatform;
  type: ConversationType;
  contactName: string;
  contactAvatar?: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  status: 'unread' | 'read' | 'assigned';
  // For comments
  postId?: string;
  postContent?: string;
  postImageUrl?: string;
  commentId?: string; // For comment conversations
};

export type Message = {
  id: string;
  conversationId: string;
  senderName: string;
  senderId?: string; // User ID for mentions (Facebook user ID or Instagram username)
  senderAvatar?: string;
  content: string;
  timestamp: string;
  isOutgoing: boolean;
  attachments?: Array<{
    type: 'image' | 'video' | 'file';
    url: string;
  }>;
  likeCount?: number;
  isLiked?: boolean;
  parentId?: string; // ID of parent comment if this is a reply
  replies?: Message[]; // Nested replies
};

export type MetaApiError = {
  error: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
  };
};

export class MetaInboxClient {
  private accessToken: string;
  private refreshToken?: string;
  private onTokenRefresh?: (newToken: string) => Promise<void>;

  constructor(
    accessToken: string,
    refreshToken?: string,
    onTokenRefresh?: (newToken: string) => Promise<void>,
  ) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.onTokenRefresh = onTokenRefresh;
  }

  /**
   * Make a request to Meta Graph API with error handling and token refresh
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const [path, existingParams] = endpoint.split('?');
    const params = new URLSearchParams();

    // Add access token to query params (Meta Graph API standard)
    params.append('access_token', this.accessToken);

    // Add any existing query params from endpoint
    if (existingParams) {
      existingParams.split('&').forEach((param) => {
        const [key, value] = param.split('=');
        if (key && key !== 'access_token') {
          params.append(key, decodeURIComponent(value || ''));
        }
      });
    }

    const fullUrl = `${META_GRAPH_API_BASE}${path}?${params.toString()}`;

    // Prepare request options
    const requestOptions: RequestInit = {
      method: options.method || 'GET',
      headers: {
        ...options.headers,
      } as HeadersInit,
    };

    // For POST/PUT requests, add body
    if (options.body && (options.method === 'POST' || options.method === 'PUT')) {
      requestOptions.body = options.body;
      const headers = requestOptions.headers as Record<string, string>;
      if (!headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      }
    }

    let response = await fetch(fullUrl, requestOptions);
    let data = await response.json().catch(() => ({}));

    // Handle token expiry - attempt refresh if refresh token available
    if (!response.ok && data.error?.code === 190 && this.refreshToken && this.onTokenRefresh) {
      // Token expired, try to refresh
      try {
        const newToken = await this.refreshAccessToken();
        if (newToken) {
          // Retry request with new token
          params.set('access_token', newToken);
          const retryUrl = `${META_GRAPH_API_BASE}${path}?${params.toString()}`;
          response = await fetch(retryUrl, requestOptions);
          data = await response.json().catch(() => ({}));
        }
      } catch (refreshError) {
        console.error('Failed to refresh token:', refreshError);
      }
    }

    if (!response.ok) {
      const error = data as MetaApiError;
      const errorCode = error.error?.code;
      const errorMessage = error.error?.message || `Meta API error: ${response.status} ${response.statusText}`;

      // Don't log permission errors (code 100) - these are expected for some posts/comments
      // Only log unexpected errors
      if (errorCode !== 100) {
        console.error(`Meta API Error [${endpoint}]:`, errorMessage, data);
      }

      throw new Error(errorMessage);
    }

    return data as T;
  }

  /**
   * Refresh access token using refresh token
   */
  private async refreshAccessToken(): Promise<string | null> {
    if (!this.refreshToken) {
      return null;
    }

    try {
      const params = new URLSearchParams({
        grant_type: 'fb_exchange_token',
        client_id: process.env.META_APP_ID || '',
        client_secret: process.env.META_APP_SECRET || '',
        fb_exchange_token: this.refreshToken,
      });

      const response = await fetch(
        `${META_GRAPH_API_BASE}/oauth/access_token?${params.toString()}`,
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const newAccessToken = data.access_token;

      if (newAccessToken && this.onTokenRefresh) {
        await this.onTokenRefresh(newAccessToken);
        this.accessToken = newAccessToken;
      }

      return newAccessToken || null;
    } catch (error) {
      console.error('Token refresh error:', error);
      return null;
    }
  }

  /**
   * Get Facebook Messenger conversations
   */
  async getFacebookConversations(pageId: string, pageAccessToken: string): Promise<Conversation[]> {
    try {
      // Use page access token for page conversations
      const client = new MetaInboxClient(pageAccessToken);
      const data = await client.request<{
        data: Array<{
          id: string;
          participants: {
            data: Array<{
              name: string;
              id: string;
            }>;
          };
          updated_time: string;
          unread_count?: number;
          snippet?: string;
        }>;
        paging?: {
          next?: string;
        };
      }>(`/${pageId}/conversations?fields=id,participants,updated_time,unread_count,snippet&limit=50`);

      const conversations = (data.data || []).map((conv) => {
        const participant = conv.participants?.data?.[0];
        return {
          id: conv.id,
          accountId: pageId,
          platform: 'facebook' as MetaPlatform,
          type: 'chat' as ConversationType,
          contactName: participant?.name || 'Unknown',
          lastMessage: conv.snippet || '',
          lastMessageTime: conv.updated_time,
          unreadCount: conv.unread_count || 0,
          status: (conv.unread_count || 0) > 0 ? 'unread' : 'read',
        } as Conversation;
      });
      return conversations;
    } catch (error) {
      console.error('[Meta API] Error fetching Facebook conversations:', error);
      return [];
    }
  }

  /**
   * Get Instagram Direct Message conversations
   * Note: Requires Instagram Business Account ID and pages_messaging permission
   */
  async getInstagramConversations(igUserId: string): Promise<Conversation[]> {
    try {
      // Instagram conversations endpoint requires the Instagram Business Account ID
      // The endpoint is: /{ig-user-id}/conversations
      const data = await this.request<{
        data: Array<{
          id: string;
          participants: {
            data: Array<{
              username?: string;
              name?: string;
              id: string;
            }>;
          };
          updated_time: string;
          unread_count?: number;
          snippet?: string;
          can_reply?: boolean;
        }>;
        paging?: {
          next?: string;
        };
      }>(`/${igUserId}/conversations?fields=id,participants,updated_time,unread_count,snippet,can_reply&limit=50`);

      const conversations = (data.data || []).map((conv) => {
        // Get the first participant (excluding the page itself)
        const participant = conv.participants?.data?.find(p => p.id !== igUserId) || conv.participants?.data?.[0];
        return {
          id: conv.id,
          accountId: igUserId,
          platform: 'instagram' as MetaPlatform,
          type: 'chat' as ConversationType,
          contactName: participant?.username || participant?.name || 'Unknown',
          lastMessage: conv.snippet || '',
          lastMessageTime: conv.updated_time,
          unreadCount: conv.unread_count || 0,
          status: (conv.unread_count || 0) > 0 ? 'unread' : 'read',
        } as Conversation;
      });
      return conversations;
    } catch (error) {
      console.error('[Meta API] Error fetching Instagram conversations:', error);
      // Return empty array instead of throwing to allow UI to render
      return [];
    }
  }

  /**
   * Get Facebook Page comments
   */
  async getFacebookComments(pageId: string, pageAccessToken: string): Promise<Conversation[]> {
    try {
      const client = new MetaInboxClient(pageAccessToken);

      // First, get recent posts with comments
      const postsData = await client.request<{
        data: Array<{
          id: string;
          message?: string;
          created_time: string;
          permalink_url?: string;
          attachments?: {
            data: Array<{
              media?: {
                image?: {
                  src: string;
                };
              };
            }>;
          };
        }>;
        paging?: {
          next?: string;
        };
      }>(`/${pageId}/posts?fields=id,message,created_time,permalink_url,attachments{media}&limit=25&order=reverse_chronological`);

      const conversations: Conversation[] = [];

      // Get comments for each post
      for (const post of postsData.data || []) {
        try {
          const commentsData = await client.request<{
            data: Array<{
              id: string;
              message?: string;
              from?: {
                name?: string;
                id?: string;
                picture?: {
                  data?: {
                    url?: string;
                  };
                };
              };
              created_time?: string;
              can_reply?: boolean;
              parent?: {
                id: string;
              };
            }>;
            paging?: {
              next?: string;
            };
          }>(`/${post.id}/comments?fields=id,message,from{id,name,picture},created_time,can_reply,parent&limit=50&order=reverse_chronological`);

          (commentsData.data || []).forEach((comment) => {
            // Get post image if available
            const postImageUrl = post.attachments?.data?.[0]?.media?.image?.src;

            // Handle cases where 'from' might be missing or have different structure
            const contactName = comment.from?.name || 'Unknown';
            const contactAvatar = comment.from?.picture?.data?.url;

            conversations.push({
              id: comment.id,
              accountId: pageId,
              platform: 'facebook' as MetaPlatform,
              type: 'comment' as ConversationType,
              contactName,
              contactAvatar,
              lastMessage: comment.message || '',
              lastMessageTime: comment.created_time,
              unreadCount: 1,
              status: 'unread' as const,
              commentId: comment.id,
              postId: post.id,
              postContent: post.message || '',
              postImageUrl,
            } as Conversation);
          });
        } catch (commentError) {
          // Skip posts that fail to load comments (permission errors, missing posts, etc.)
          // These are expected for some posts and don't need to be logged
          const errorMessage = commentError instanceof Error ? commentError.message : String(commentError);
          // Only log if it's not a permission/object not found error (code 100)
          if (!errorMessage.includes('(#100)') && !errorMessage.includes('code 100')) {
            // This is an unexpected error, but we'll still skip the post
            // The error was already logged in the request method if it wasn't code 100
          }
        }
      }

      // Sort by last message time (most recent first)
      const sorted = conversations.sort((a, b) =>
        new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime(),
      );
      return sorted;
    } catch (error) {
      console.error('[Meta API] Error fetching Facebook comments:', error);
      return [];
    }
  }

  /**
   * Get Instagram comments
   */
  async getInstagramComments(igUserId: string, pageAccessToken?: string, mediaId?: string): Promise<Conversation[]> {
    try {
      const conversations: Conversation[] = [];

      // Instagram Business Accounts require a page access token
      // If no valid page token is provided, return empty array
      if (!pageAccessToken || pageAccessToken.length < 50) {
        return [];
      }

      // For Instagram Business Account, use page access token
      // Instagram Business Accounts are linked to Facebook Pages, so we need the page token
      const clientToUse = new MetaInboxClient(pageAccessToken, undefined, undefined);

      if (mediaId) {
        // Single media comments
        const data = await clientToUse.request<{
          data: Array<{
            id: string;
            text: string;
            from: {
              username: string;
              id: string;
            };
            timestamp: string;
          }>;
        }>(`/${mediaId}/comments?fields=id,text,from,timestamp&limit=50`);

        (data.data || []).forEach((comment) => {
          conversations.push({
            id: comment.id,
            accountId: igUserId,
            platform: 'instagram' as MetaPlatform,
            type: 'comment' as ConversationType,
            contactName: comment.from?.username || 'Unknown',
            lastMessage: comment.text || '',
            lastMessageTime: comment.timestamp,
            unreadCount: 1,
            status: 'unread' as const,
            commentId: comment.id,
            postId: mediaId,
          } as Conversation);
        });
      } else {
        // Get recent media and their comments
        const mediaData = await clientToUse.request<{
          data: Array<{
            id: string;
            caption?: string;
            media_type?: string;
            media_url?: string;
            permalink?: string;
            timestamp?: string;
          }>;
        }>(`/${igUserId}/media?fields=id,caption,media_type,media_url,permalink,timestamp&limit=25`);

        // Fetch comments for each media item
        for (const media of mediaData.data || []) {
          try {
            const commentsData = await clientToUse.request<{
              data: Array<{
                id: string;
                text: string;
                from: {
                  username: string;
                  id: string;
                  profile_picture_url?: string;
                };
                timestamp: string;
              }>;
            }>(`/${media.id}/comments?fields=id,text,from{username,id,profile_picture_url},timestamp&limit=50`);

            (commentsData.data || []).forEach((comment) => {
              conversations.push({
                id: comment.id,
                accountId: igUserId,
                platform: 'instagram' as MetaPlatform,
                type: 'comment' as ConversationType,
                contactName: comment.from?.username || 'Unknown',
                contactAvatar: comment.from?.profile_picture_url,
                lastMessage: comment.text || '',
                lastMessageTime: comment.timestamp,
                unreadCount: 1,
                status: 'unread' as const,
                commentId: comment.id,
                postId: media.id,
                postContent: media.caption || '',
                postImageUrl: media.media_type === 'IMAGE' ? media.media_url : undefined,
              } as Conversation);
            });
          } catch {
            // Skip media that fail to load comments
          }
        }
      }

      // Sort by last message time (most recent first)
      return conversations.sort((a, b) =>
        new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime(),
      );
    } catch (error) {
      console.error('Error fetching Instagram comments:', error);
      return [];
    }
  }

  /**
   * Get messages for a conversation
   * For chats: fetches messages from /{conversation-id}/messages
   * For comments: fetches the comment and its replies
   */
  async getMessages(conversationId: string, platform: MetaPlatform, conversationType?: ConversationType, pageAccessToken?: string): Promise<Message[]> {
    try {
      // Use conversationType parameter if provided, otherwise try to detect from ID format
      // Facebook comment IDs are typically: {page-id}_{comment-id} (contains underscore)
      // Facebook conversation IDs are typically: t_{thread-id} (starts with 't_')
      const isComment = conversationType === 'comment'
        || (conversationType !== 'chat' && conversationId.includes('_') && !conversationId.startsWith('t_'));

      if (isComment) {
        return this.getCommentMessages(conversationId, platform, pageAccessToken);
      }

      // Regular chat conversation
      const data = await this.request<{
        data: Array<{
          id: string;
          message?: string;
          from: {
            name?: string;
            username?: string;
            id: string;
            picture?: {
              data: {
                url: string;
              };
            };
          };
          created_time?: string;
          timestamp?: string;
          attachments?: {
            data: Array<{
              type: string;
              image_data?: {
                url: string;
              };
              video_data?: {
                url: string;
              };
              file_url?: string;
            }>;
          };
        }>;
        paging?: {
          next?: string;
        };
      }>(`/${conversationId}/messages?fields=id,message,from,created_time,timestamp,attachments&limit=50`);

      return (data.data || []).map(msg => ({
        id: msg.id,
        conversationId,
        senderName: msg.from.name || msg.from.username || 'Unknown',
        senderId: msg.from.id,
        senderAvatar: msg.from.picture?.data?.url,
        content: msg.message || '',
        timestamp: msg.created_time || msg.timestamp || new Date().toISOString(),
        isOutgoing: false, // TODO: Determine if message is outgoing based on sender ID
        attachments: msg.attachments?.data?.map(att => ({
          type: (att.type === 'image' ? 'image' : att.type === 'video' ? 'video' : 'file') as 'image' | 'video' | 'file',
          url: att.image_data?.url || att.video_data?.url || att.file_url || '',
        })),
      } as Message));
    } catch (error) {
      console.error('Error fetching messages:', error);
      return [];
    }
  }

  /**
   * Get all comments on a post (for comment conversations)
   * When viewing a comment conversation, show all comments on the post, not just one thread
   */
  async getPostComments(postId: string, platform: MetaPlatform, pageAccessToken?: string): Promise<Message[]> {
    try {
      const messages: Message[] = [];

      if (platform === 'facebook') {
        const clientToUse = pageAccessToken
          ? new MetaInboxClient(pageAccessToken, undefined, undefined)
          : this;

        // Get all comments on the post - include picture field for avatars and filter to get all comments including replies
        // Use filter=stream to get all comments including replies
        const commentsData = await clientToUse.request<{
          data?: Array<{
            id: string;
            message?: string;
            from?: {
              name?: string;
              id?: string;
              picture?: {
                data?: {
                  url?: string;
                };
              };
            };
            created_time?: string;
            parent?: {
              id: string;
            };
          }>;
          paging?: {
            next?: string;
            cursors?: {
              before?: string;
              after?: string;
            };
          };
        }>(`/${postId}/comments?fields=id,message,from{id,name,picture},created_time,parent&filter=stream&limit=100&order=reverse_chronological`);

        // Fetch all pages of comments (including replies)
        const allCommentsData: Array<{
          id: string;
          message?: string;
          from?: {
            name?: string;
            id?: string;
            picture?: {
              data?: {
                url?: string;
              };
            };
          };
          created_time?: string;
          parent?: {
            id: string;
          };
        }> = [];

        // Collect first page
        if (commentsData.data) {
          allCommentsData.push(...commentsData.data);
        }

        // Fetch additional pages if available
        let nextPageUrl = commentsData.paging?.next;
        let pageCount = 0;
        const maxPages = 10; // Limit to prevent infinite loops

        while (nextPageUrl && pageCount < maxPages) {
          try {
            pageCount++;
            // Facebook Graph API returns absolute URLs for pagination
            // We need to fetch directly from the absolute URL
            const url = new URL(nextPageUrl);

            // Extract pathname (remove leading /vXX.X/ if present)
            let path = url.pathname;
            const versionMatch = path.match(/^\/v\d+\.\d+\/(.+)$/);
            if (versionMatch) {
              path = `/${versionMatch[1]}`;
            }

            // Extract query parameters (excluding access_token as it will be added by request method)
            const queryParams = new URLSearchParams();
            url.searchParams.forEach((value, key) => {
              if (key !== 'access_token') {
                queryParams.append(key, value);
              }
            });

            // Make request to next page
            const requestPath = queryParams.toString() ? `${path}?${queryParams.toString()}` : path;
            const nextPageData = await clientToUse.request<{
              data?: Array<{
                id: string;
                message?: string;
                from?: {
                  name?: string;
                  id?: string;
                  picture?: {
                    data?: {
                      url?: string;
                    };
                  };
                };
                created_time?: string;
                parent?: {
                  id: string;
                };
              }>;
              paging?: {
                next?: string;
              };
            }>(requestPath);

            if (nextPageData.data && nextPageData.data.length > 0) {
              allCommentsData.push(...nextPageData.data);
            }
            nextPageUrl = nextPageData.paging?.next;
          } catch (error) {
            console.error('Error fetching next page of comments:', error);
            break;
          }
        }

        // First, collect all comments with parent information
        const allComments: Message[] = [];
        allCommentsData.forEach((comment) => {
          allComments.push({
            id: comment.id,
            conversationId: postId,
            senderName: comment.from?.name || 'Unknown',
            senderId: comment.from?.id,
            senderAvatar: comment.from?.picture?.data?.url,
            content: comment.message || '',
            timestamp: comment.created_time || new Date().toISOString(),
            isOutgoing: false,
            parentId: comment.parent?.id,
            replies: [],
          } as Message);
        });

        // Organize comments into a tree structure (parent comments with nested replies)
        const commentMap = new Map<string, Message>();
        const topLevelComments: Message[] = [];

        // First pass: create map of all comments
        allComments.forEach((comment) => {
          commentMap.set(comment.id, comment);
        });

        // Second pass: build tree structure
        // Note: parentId can be either a comment ID (for replies) or the post ID (for top-level comments)
        // We need to check if parentId matches the postId to determine if it's top-level
        allComments.forEach((comment) => {
          if (comment.parentId && comment.parentId !== postId) {
            // This is a reply to another comment (parentId is a comment ID, not the post ID)
            const parent = commentMap.get(comment.parentId);
            if (parent) {
              if (!parent.replies) {
                parent.replies = [];
              }
              parent.replies.push(comment);
            } else {
              // Parent comment not found in current batch - might be in a different page
              // For now, treat as top-level (this can happen with pagination)
              // In a production app, you might want to fetch the parent comment
              topLevelComments.push(comment);
            }
          } else {
            // This is a top-level comment (no parentId or parentId is the postId)
            topLevelComments.push(comment);
          }
        });

        // Sort top-level comments and their replies by timestamp (oldest first)
        const sortComments = (comments: Message[]): Message[] => {
          return comments
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
            .map(comment => ({
              ...comment,
              replies: comment.replies ? sortComments(comment.replies) : [],
            }));
        };

        messages.push(...sortComments(topLevelComments));
      } else if (platform === 'instagram') {
        const clientToUse = pageAccessToken
          ? new MetaInboxClient(pageAccessToken, undefined, undefined)
          : this;

        try {
          // Get all comments on the Instagram post - include profile picture if available
          const commentsData = await clientToUse.request<{
            data?: Array<{
              id: string;
              text?: string;
              from?: {
                username?: string;
                id?: string;
                profile_picture_url?: string;
              };
              timestamp?: string;
            }>;
          }>(`/${postId}/comments?fields=id,text,from{username,id,profile_picture_url},timestamp&limit=100`);

          (commentsData.data || []).forEach((comment) => {
            messages.push({
              id: comment.id,
              conversationId: postId,
              senderName: comment.from?.username || 'Unknown',
              senderId: comment.from?.username, // Instagram uses username as ID
              senderAvatar: comment.from?.profile_picture_url, // Instagram profile picture
              content: comment.text || '',
              timestamp: comment.timestamp || new Date().toISOString(),
              isOutgoing: false,
            } as Message);
          });

          // Sort by timestamp (oldest first)
          messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        } catch {
          // Fallback if comments endpoint fails
        }
      }

      return messages;
    } catch (error) {
      console.error('Error fetching post comments:', error);
      return [];
    }
  }

  /**
   * Get comment and its replies (for comment conversations)
   * @deprecated Use getPostComments instead to show all comments on the post
   */
  async getCommentMessages(commentId: string, platform: MetaPlatform, pageAccessToken?: string): Promise<Message[]> {
    try {
      const messages: Message[] = [];

      if (platform === 'facebook') {
        // For Facebook page comments, use page access token if provided
        // Create a separate client with page token if available
        const clientToUse = pageAccessToken
          ? new MetaInboxClient(pageAccessToken, undefined, undefined)
          : this;

        // Get the comment itself
        const commentData = await clientToUse.request<{
          id: string;
          message?: string;
          from?: {
            name?: string;
            id?: string;
            picture?: {
              data?: {
                url?: string;
              };
            };
          };
          created_time?: string;
        }>(`/${commentId}?fields=id,message,from,created_time`);

        // Add the original comment as a message
        messages.push({
          id: commentData.id,
          conversationId: commentId,
          senderName: commentData.from?.name || 'Unknown',
          senderId: commentData.from?.id,
          senderAvatar: commentData.from?.picture?.data?.url,
          content: commentData.message || '',
          timestamp: commentData.created_time,
          isOutgoing: false,
        } as Message);

        // Get replies to the comment
        const repliesData = await clientToUse.request<{
          data?: Array<{
            id: string;
            message?: string;
            from?: {
              name?: string;
              id?: string;
              picture?: {
                data?: {
                  url?: string;
                };
              };
            };
            created_time?: string;
          }>;
        }>(`/${commentId}/comments?fields=id,message,from,created_time&limit=50`);

        // Add replies as messages
        (repliesData.data || []).forEach((reply) => {
          // Handle cases where 'from' might be missing or have different structure
          const senderName = reply.from?.name || 'Unknown';
          const senderAvatar = reply.from?.picture?.data?.url;

          messages.push({
            id: reply.id,
            conversationId: commentId,
            senderName,
            senderId: reply.from?.id,
            senderAvatar,
            content: reply.message || '',
            timestamp: reply.created_time,
            isOutgoing: false, // TODO: Determine if reply is from page
          } as Message);
        });
      } else if (platform === 'instagram') {
        // For Instagram comments, use page access token if provided
        // Instagram Business Accounts are linked to Facebook Pages
        const clientToUse = pageAccessToken
          ? new MetaInboxClient(pageAccessToken, undefined, undefined)
          : this;

        try {
          // Get the comment itself
          const commentData = await clientToUse.request<{
            id: string;
            text?: string;
            from?: {
              username?: string;
              id?: string;
            };
            timestamp?: string;
          }>(`/${commentId}?fields=id,text,from,timestamp`);

          // Add the original comment as a message
          messages.push({
            id: commentData.id,
            conversationId: commentId,
            senderName: commentData.from?.username || 'Unknown',
            senderId: commentData.from?.username, // Instagram uses username as ID for mentions
            content: commentData.text || '',
            timestamp: commentData.timestamp || new Date().toISOString(),
            isOutgoing: false,
          } as Message);

          // Get replies to the comment (if supported by Instagram API)
          try {
            const repliesData = await clientToUse.request<{
              data?: Array<{
                id: string;
                text?: string;
                from?: {
                  username?: string;
                  id?: string;
                };
                timestamp?: string;
              }>;
            }>(`/${commentId}/replies?fields=id,text,from,timestamp&limit=50`);

            // Add replies as messages
            (repliesData.data || []).forEach((reply) => {
              messages.push({
                id: reply.id,
                conversationId: commentId,
                senderName: reply.from?.username || 'Unknown',
                senderId: reply.from?.username, // Instagram uses username as ID for mentions
                content: reply.text || '',
                timestamp: reply.timestamp || new Date().toISOString(),
                isOutgoing: false,
              } as Message);
            });
          } catch {
            // Instagram may not support replies endpoint, or comment may not have replies
          }
        } catch {
          // Fallback: add a basic message entry
          messages.push({
            id: commentId,
            conversationId: commentId,
            senderName: 'Unknown',
            content: 'Comment',
            timestamp: new Date().toISOString(),
            isOutgoing: false,
          } as Message);
        }
      }

      return messages;
    } catch (error) {
      console.error('Error fetching comment messages:', error);
      return [];
    }
  }

  /**
   * Send a reply to a conversation
   */
  async sendReply(
    conversationId: string,
    message: string,
    _platform: MetaPlatform,
    pageAccessToken?: string,
  ): Promise<{ success: boolean; messageId?: string }> {
    try {
      // Use page access token if provided (for Facebook Pages)
      const token = pageAccessToken || this.accessToken;
      const client = new MetaInboxClient(token);

      const data = await client.request<{
        id: string;
      }>(`/${conversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          message,
        }),
      });

      return {
        success: true,
        messageId: data.id,
      };
    } catch (error) {
      console.error('Error sending reply:', error);
      return {
        success: false,
      };
    }
  }

  /**
   * Reply to a comment or create a new comment on a post
   * @param commentId - The comment ID to reply to, or post ID to create a new top-level comment
   * @param message - The reply message
   * @param platform - The platform (facebook, instagram, threads)
   * @param pageAccessToken - Optional page access token for Facebook Pages
   * @param mentionUserId - Optional user ID to mention (Facebook user ID or Instagram username)
   * @param mentionName - Optional name/username to mention
   */
  async replyToComment(
    commentId: string,
    message: string,
    platform: MetaPlatform,
    pageAccessToken?: string,
    mentionUserId?: string,
    mentionName?: string,
  ): Promise<{ success: boolean; commentId?: string }> {
    try {
      const token = pageAccessToken || this.accessToken;
      const client = new MetaInboxClient(token);

      // Format message with mention if provided
      let formattedMessage = message;
      if (mentionUserId && mentionName) {
        if (platform === 'facebook') {
          // Facebook uses @[user-id:name] format for mentions
          formattedMessage = `@[${mentionUserId}:${mentionName}] ${message}`;
        } else if (platform === 'instagram') {
          // Instagram uses @username format
          formattedMessage = `@${mentionName} ${message}`;
        }
      }

      if (platform === 'facebook') {
        // Meta API uses the same endpoint for both:
        // - POST /{post-id}/comments creates a new top-level comment
        // - POST /{comment-id}/comments creates a reply to that comment
        const data = await client.request<{
          id: string;
        }>(`/${commentId}/comments`, {
          method: 'POST',
          body: JSON.stringify({
            message: formattedMessage,
          }),
        });

        return {
          success: true,
          commentId: data.id,
        };
      } else if (platform === 'instagram') {
        // Reply to Instagram comment (requires media ID)
        // This is a simplified version - actual implementation may need media ID
        throw new Error('Instagram comment replies require media ID');
      }

      return {
        success: false,
      };
    } catch (error) {
      console.error('Error replying to comment:', error);
      return {
        success: false,
      };
    }
  }

  /**
   * Like a comment using Meta Graph API
   */
  async likeComment(
    commentId: string,
    platform: MetaPlatform,
    pageAccessToken?: string,
  ): Promise<{ success: boolean }> {
    try {
      const token = pageAccessToken || this.accessToken;
      const client = new MetaInboxClient(token);

      if (platform === 'facebook') {
        // Like Facebook comment
        await client.request<{
          success: boolean;
        }>(`/${commentId}/likes`, {
          method: 'POST',
        });

        return {
          success: true,
        };
      } else if (platform === 'instagram') {
        // Instagram doesn't have a direct like endpoint for comments via Graph API
        // Instagram comments can't be liked via API - only posts can be liked
        return {
          success: false,
        };
      }

      return {
        success: false,
      };
    } catch (error) {
      console.error('Error liking comment:', error);
      return {
        success: false,
      };
    }
  }

  /**
   * Unlike a comment using Meta Graph API
   */
  async unlikeComment(
    commentId: string,
    platform: MetaPlatform,
    pageAccessToken?: string,
  ): Promise<{ success: boolean }> {
    try {
      const token = pageAccessToken || this.accessToken;
      const client = new MetaInboxClient(token);

      if (platform === 'facebook') {
        // Unlike Facebook comment
        await client.request<{
          success: boolean;
        }>(`/${commentId}/likes`, {
          method: 'DELETE',
        });

        return {
          success: true,
        };
      } else if (platform === 'instagram') {
        // Instagram doesn't support unliking comments via API
        return {
          success: false,
        };
      }

      return {
        success: false,
      };
    } catch (error) {
      console.error('Error unliking comment:', error);
      return {
        success: false,
      };
    }
  }

  /**
   * Get like status and count for a comment
   */
  async getCommentLikes(
    commentId: string,
    platform: MetaPlatform,
    pageAccessToken?: string,
  ): Promise<{ liked: boolean; count: number }> {
    try {
      const token = pageAccessToken || this.accessToken;
      const client = new MetaInboxClient(token);

      if (platform === 'facebook') {
        // Get likes for Facebook comment
        // First, get the summary to check if current user liked it
        const summaryData = await client.request<{
          summary: {
            total_count: number;
            can_like: boolean;
            has_liked: boolean;
          };
        }>(`/${commentId}/likes?summary=true&limit=0`);

        return {
          liked: summaryData.summary?.has_liked || false,
          count: summaryData.summary?.total_count || 0,
        };
      } else if (platform === 'instagram') {
        // Instagram doesn't support getting comment likes via Graph API
        return {
          liked: false,
          count: 0,
        };
      }

      return {
        liked: false,
        count: 0,
      };
    } catch (error) {
      console.error('Error fetching comment likes:', error);
      return {
        liked: false,
        count: 0,
      };
    }
  }
}

/**
 * Create a Meta Inbox client instance
 */
export function createMetaInboxClient(
  accessToken: string,
  refreshToken?: string,
  onTokenRefresh?: (newToken: string) => Promise<void>,
): MetaInboxClient {
  return new MetaInboxClient(accessToken, refreshToken, onTokenRefresh);
}
