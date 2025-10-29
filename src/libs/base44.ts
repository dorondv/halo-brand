// Lightweight mock of the Base44 SDK used by the legacy app.
// Replace with real data access (Supabase/Drizzle) when ready.

export type AnalyticsItem = {
  id: string;
  date: string;
};

export type Engagement = {
  likes?: number;
  comments?: number;
  shares?: number;
};

export type PostItem = {
  id: string;
  content: string;
  engagement?: Engagement;
  scheduled_time?: string | null;
  platforms?: string[];
};

export type SocialAccountItem = {
  id: string;
  platform: string;
  account_name: string;
  follower_count?: number;
};

export type ConversationItem = {
  id: string;
  platform: string;
  type: string;
  contact_name: string;
  contact_avatar: string;
  last_message_timestamp: string;
  last_message_snippet: string;
  status: 'unresolved' | 'unread' | 'all' | string;
};

export type MessageItem = {
  id: string;
  conversation_id: string;
  sender_name: string;
  sender_avatar: string;
  content: string;
  timestamp: string;
  is_outgoing: boolean;
};

let demoPosts: PostItem[] = [
  {
    id: 'p1',
    content: 'Launching our new feature today!',
    engagement: { likes: 120, comments: 14, shares: 8 },
    scheduled_time: new Date().toISOString(),
    platforms: ['instagram', 'twitter'],
  },
  {
    id: 'p2',
    content: 'Weekly tips: How to grow your audience',
    engagement: { likes: 80, comments: 10, shares: 4 },
    scheduled_time: null,
    platforms: ['facebook'],
  },
  {
    id: 'p3',
    content: 'Happy holidays!',
    engagement: { likes: 300, comments: 45, shares: 20 },
    scheduled_time: new Date(Date.now() + 86400000).toISOString(),
    platforms: ['linkedin', 'instagram'],
  },
];

const demoAccounts: SocialAccountItem[] = [
  { id: 'a1', platform: 'instagram', account_name: 'brand_ig', follower_count: 12000 },
  { id: 'a2', platform: 'twitter', account_name: 'brand_x', follower_count: 4300 },
  { id: 'a3', platform: 'facebook', account_name: 'brand_fb', follower_count: 9800 },
];

const demoConversations: ConversationItem[] = [
  {
    id: 'c1',
    platform: 'instagram',
    type: 'direct_message',
    contact_name: 'Dana',
    contact_avatar: 'https://i.pravatar.cc/150?u=dana',
    last_message_timestamp: new Date().toISOString(),
    last_message_snippet: 'Thanks!',
    status: 'unread',
  },
  {
    id: 'c2',
    platform: 'twitter',
    type: 'mention',
    contact_name: 'Alex',
    contact_avatar: 'https://i.pravatar.cc/150?u=alex',
    last_message_timestamp: new Date(Date.now() - 86400000).toISOString(),
    last_message_snippet: 'Can you help?',
    status: 'unresolved',
  },
];

let demoMessages: MessageItem[] = [
  {
    id: 'm1',
    conversation_id: 'c1',
    sender_name: 'Dana',
    sender_avatar: 'https://i.pravatar.cc/150?u=dana',
    content: 'Hi! Is the feature available?',
    timestamp: new Date(Date.now() - 3600_000).toISOString(),
    is_outgoing: false,
  },
  {
    id: 'm2',
    conversation_id: 'c1',
    sender_name: 'You',
    sender_avatar: 'https://i.pravatar.cc/150?u=user',
    content: 'Yes, rolling out today!',
    timestamp: new Date(Date.now() - 1800_000).toISOString(),
    is_outgoing: true,
  },
];

export const AnalyticsEntity = {
  async list(_sort?: string, _limit?: number): Promise<AnalyticsItem[]> {
    return [
      { id: 'an1', date: new Date().toISOString() },
      { id: 'an2', date: new Date(Date.now() - 86400000).toISOString() },
    ];
  },
};

export const Post = {
  async list(): Promise<PostItem[]> {
    return demoPosts;
  },
  async create(values: Omit<PostItem, 'id'>): Promise<PostItem> {
    const created: PostItem = { ...values, id: `p${demoPosts.length + 1}` } as PostItem;
    demoPosts = [created, ...demoPosts];
    return created;
  },
};

export const SocialAccount = {
  async list(): Promise<SocialAccountItem[]> {
    return demoAccounts;
  },
};

export const Conversation = {
  async list(_sort?: string): Promise<ConversationItem[]> {
    return demoConversations;
  },
  async update(id: string, updates: Partial<ConversationItem>): Promise<void> {
    const idx = demoConversations.findIndex(c => c.id === id);
    if (idx >= 0) {
      demoConversations[idx] = { ...demoConversations[idx], ...updates } as ConversationItem;
    }
  },
};

export const Message = {
  async filter(where: Partial<MessageItem>, _sort?: string): Promise<MessageItem[]> {
    return demoMessages.filter(m =>
      Object.entries(where).every(([k, v]) => {
        const key = k as keyof MessageItem;
        return m[key] === (v as MessageItem[keyof MessageItem]);
      }),
    );
  },
  async create(message: Omit<MessageItem, 'id'>): Promise<MessageItem> {
    const created: MessageItem = { ...message, id: `m${demoMessages.length + 1}` } as MessageItem;
    demoMessages = [...demoMessages, created];
    return created;
  },
};
