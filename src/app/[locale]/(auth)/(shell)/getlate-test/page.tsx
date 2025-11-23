import { format } from 'date-fns';
import { notFound, redirect } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createGetlateClient } from '@/libs/Getlate';
import { createSupabaseServerClient } from '@/libs/Supabase';

export const dynamic = 'force-dynamic';

export default async function GetlateTestPage() {
  // Block this route in production (only allow in development/preview)
  if (process.env.VERCEL_ENV === 'production') {
    notFound();
  }

  const supabase = await createSupabaseServerClient();

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    redirect('/sign-in');
  }

  // Get user's Getlate API key
  const { data: userRecord } = await supabase
    .from('users')
    .select('getlate_api_key')
    .eq('id', user.id)
    .single();

  if (!userRecord?.getlate_api_key) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-800">Getlate API Key Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-700">
              Please configure your Getlate API key in settings to use this test page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getlateClient = createGetlateClient(userRecord.getlate_api_key);

  // Fetch all Getlate data
  let profiles: any[] = [];
  let profilesError: string | null = null;
  const accounts: Record<string, any[]> = {};
  let accountsError: string | null = null;
  let apiKeys: any[] = [];
  let apiKeysError: string | null = null;
  const analytics: Record<string, any[]> = {};
  const analyticsRawResponses: Record<string, any> = {}; // Store raw API responses
  let analyticsError: string | null = null;
  const queueData: Record<string, any> = {};
  let queueError: string | null = null;
  let posts: any[] = [];
  let scheduledPosts: any[] = [];
  let postsError: string | null = null;

  // Fetch posts from database
  try {
    const { data: postsData, error: postsErr } = await supabase
      .from('posts')
      .select(`
        id,
        content,
        image_url,
        status,
        platforms,
        getlate_post_id,
        created_at,
        brand_id,
        brands (
          id,
          name
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100); // Limit to 100 most recent posts

    if (postsErr) {
      postsError = postsErr.message || 'Failed to fetch posts';
    } else {
      posts = postsData || [];
    }
  } catch (error: any) {
    postsError = error.message || 'Failed to fetch posts';
  }

  // Fetch scheduled posts from database
  try {
    if (posts.length > 0) {
      const { data: scheduledPostsData, error: scheduledErr } = await supabase
        .from('scheduled_posts')
        .select(`
          id,
          post_id,
          scheduled_for,
          published_at,
          status,
          timezone,
          posts (
            id,
            content,
            status,
            getlate_post_id
          )
        `)
        .in('post_id', posts.map(p => p.id))
        .order('scheduled_for', { ascending: false });

      if (scheduledErr) {
        // Don't fail completely if scheduled posts fail
        console.error('Error fetching scheduled posts:', scheduledErr);
      } else {
        scheduledPosts = scheduledPostsData || [];
      }
    }
  } catch (error: any) {
    // Don't fail completely if scheduled posts fail
    console.error('Error fetching scheduled posts:', error);
  }

  try {
    const profilesResponse = await getlateClient.getProfiles();
    // Handle different response formats
    if (Array.isArray(profilesResponse)) {
      profiles = profilesResponse;
    } else if (profilesResponse && typeof profilesResponse === 'object') {
      // Check for nested array in response
      profiles = (profilesResponse as any)?.profiles
        || (profilesResponse as any)?.data
        || (profilesResponse as any)?.results
        || (profilesResponse as any)?.items
        || [];
      // If still not an array, wrap it
      if (!Array.isArray(profiles)) {
        profiles = [profilesResponse];
      }
    } else {
      profiles = [];
    }
  } catch (error: any) {
    profilesError = error.message || 'Failed to fetch profiles';
    profiles = []; // Ensure it's always an array
  }

  // Fetch accounts for each profile
  if (profiles.length > 0) {
    for (const profile of profiles) {
      const profileId = profile.id || profile._id;
      if (!profileId) {
        continue;
      } // Skip if no profile ID
      try {
        const profileAccountsResponse = await getlateClient.getAccounts(profileId);
        // Ensure it's an array
        const profileAccounts = Array.isArray(profileAccountsResponse)
          ? profileAccountsResponse
          : [];
        accounts[profileId] = profileAccounts;
      } catch (error: any) {
        accountsError = error.message || `Failed to fetch accounts for profile ${profileId}`;
        accounts[profileId] = []; // Ensure it's always an array
      }
    }
  }

  // Fetch API keys
  try {
    const apiKeysResponse = await getlateClient.getApiKeys();
    // Ensure it's an array
    apiKeys = Array.isArray(apiKeysResponse) ? apiKeysResponse : [];
  } catch (error: any) {
    apiKeysError = error.message || 'Failed to fetch API keys';
    apiKeys = []; // Ensure it's always an array
  }

  // Fetch analytics for each profile (limited to recent data)
  if (profiles.length > 0) {
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 7); // Last 7 days

    for (const profile of profiles) {
      const profileId = profile.id || profile._id;
      try {
        const profileAnalyticsResponse = await getlateClient.getAnalytics({
          profileId,
          fromDate: fromDate.toISOString().split('T')[0],
          toDate: toDate.toISOString().split('T')[0],
          limit: 10, // Limit to 10 records per profile for testing
        });
        // Store raw response for display
        analyticsRawResponses[profileId] = profileAnalyticsResponse;
        // Extract posts from the structured response
        analytics[profileId] = profileAnalyticsResponse.posts || [];
      } catch (error: any) {
        // Analytics might require add-on, so don't fail completely
        if (error.message?.includes('402') || error.message?.includes('add-on')) {
          analyticsError = 'Analytics add-on required';
        } else {
          analyticsError = error.message || `Failed to fetch analytics for profile ${profileId}`;
        }
        analytics[profileId] = []; // Ensure it's always an array
        analyticsRawResponses[profileId] = { error: error.message || 'Failed to fetch' };
      }
    }
  }

  // Fetch queue data for each profile
  if (profiles.length > 0) {
    for (const profile of profiles) {
      const profileId = profile.id || profile._id;
      try {
        const nextSlot = await getlateClient.getNextQueueSlot(profileId);
        queueData[profileId] = { nextSlot };
      } catch (error: any) {
        queueError = error.message || `Failed to fetch queue data for profile ${profileId}`;
      }
    }
  }

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div>
        <h1 className="mb-2 text-3xl font-bold text-gray-900">Getlate API Test Page</h1>
        <p className="text-gray-600">
          This page displays all data that can be retrieved from the Getlate API.
        </p>
      </div>

      {/* Profiles Section */}
      <Card>
        <CardHeader>
          <CardTitle>
            Profiles (
            {profiles.length}
            )
          </CardTitle>
          {profilesError && (
            <Badge variant="destructive" className="mt-2">
              Error:
              {' '}
              {profilesError}
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          {!Array.isArray(profiles) || profiles.length === 0
            ? (
                <p className="text-gray-500">
                  {profilesError ? `Error: ${profilesError}` : 'No profiles found'}
                </p>
              )
            : (
                <div className="space-y-4">
                  {profiles.map((profile) => {
                    const profileId = profile.id || profile._id;
                    return (
                      <div key={profileId} className="rounded-lg border p-4">
                        <div className="mb-2 flex items-center justify-between">
                          <h3 className="text-lg font-semibold">{profile.name}</h3>
                          <Badge variant="outline">
                            ID:
                            {profileId}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                          {profile.created_at && (
                            <div>
                              <span className="font-medium">Created:</span>
                              {' '}
                              {format(new Date(profile.created_at), 'PPpp')}
                            </div>
                          )}
                          {profile.updated_at && (
                            <div>
                              <span className="font-medium">Updated:</span>
                              {' '}
                              {format(new Date(profile.updated_at), 'PPpp')}
                            </div>
                          )}
                        </div>
                        <pre className="mt-2 overflow-auto rounded bg-gray-100 p-2 text-xs">
                          {JSON.stringify(profile, null, 2)}
                        </pre>
                      </div>
                    );
                  })}
                </div>
              )}
        </CardContent>
      </Card>

      {/* Accounts Section */}
      <Card>
        <CardHeader>
          <CardTitle>
            Accounts (
            {Object.values(accounts).flat().length}
            {' '}
            total)
          </CardTitle>
          {accountsError && (
            <Badge variant="destructive" className="mt-2">
              Error:
              {' '}
              {accountsError}
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          {!Array.isArray(profiles) || Object.keys(accounts).length === 0
            ? (
                <p className="text-gray-500">No accounts found</p>
              )
            : (
                <div className="space-y-4">
                  {profiles.map((profile) => {
                    const profileId = profile.id || profile._id;
                    const profileAccounts = accounts[profileId] || [];
                    if (profileAccounts.length === 0) {
                      return null;
                    }

                    return (
                      <div key={profileId} className="rounded-lg border p-4">
                        <h3 className="mb-3 font-semibold">
                          {profile.name}
                          {' '}
                          (
                          {profileAccounts.length}
                          {' '}
                          accounts)
                        </h3>
                        <div className="space-y-3">
                          {profileAccounts.map((account: any) => (
                            <div key={account.id || account._id} className="rounded bg-gray-50 p-3">
                              <div className="mb-2 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Badge>{account.platform}</Badge>
                                  <span className="font-medium">
                                    {account.displayName || account.accountName || account.username}
                                  </span>
                                </div>
                                {account.isActive !== undefined && (
                                  <Badge variant={account.isActive ? 'default' : 'secondary'}>
                                    {account.isActive ? 'Active' : 'Inactive'}
                                  </Badge>
                                )}
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                                {account.followerCount !== undefined && (
                                  <div>
                                    <span className="font-medium">Followers:</span>
                                    {' '}
                                    {account.followerCount.toLocaleString()}
                                  </div>
                                )}
                                {account.lastSync && (
                                  <div>
                                    <span className="font-medium">Last Sync:</span>
                                    {' '}
                                    {format(new Date(account.lastSync), 'PPpp')}
                                  </div>
                                )}
                                {account.tokenExpiresAt && (
                                  <div>
                                    <span className="font-medium">Token Expires:</span>
                                    {' '}
                                    {format(new Date(account.tokenExpiresAt), 'PPpp')}
                                  </div>
                                )}
                                {account.permissions && account.permissions.length > 0 && (
                                  <div>
                                    <span className="font-medium">Permissions:</span>
                                    {' '}
                                    {account.permissions.join(', ')}
                                  </div>
                                )}
                              </div>
                              <details className="mt-2">
                                <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                                  View Raw Data
                                </summary>
                                <pre className="mt-2 overflow-auto rounded bg-gray-100 p-2 text-xs">
                                  {JSON.stringify(account, null, 2)}
                                </pre>
                              </details>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
        </CardContent>
      </Card>

      {/* Analytics Section */}
      <Card>
        <CardHeader>
          <CardTitle>
            Analytics API (/v1/analytics) - Last 7 Days
            {Object.values(analytics).flat().length > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-500">
                (
                {Object.values(analytics).flat().length}
                {' '}
                records)
              </span>
            )}
          </CardTitle>
          {analyticsError && (
            <Badge variant="destructive" className="mt-2">
              Error:
              {' '}
              {analyticsError}
            </Badge>
          )}
          <p className="mt-2 text-sm text-gray-600">
            GET /v1/analytics?profileId=...&fromDate=...&toDate=...&limit=10
          </p>
        </CardHeader>
        <CardContent>
          {!Array.isArray(profiles) || Object.keys(analytics).length === 0
            ? (
                <div className="space-y-2">
                  <p className="text-gray-500">
                    {analyticsError?.includes('add-on')
                      ? 'Analytics add-on required. Please enable it in your Getlate account.'
                      : 'No analytics data found'}
                  </p>
                  {Object.keys(analyticsRawResponses).length > 0 && (
                    <details className="mt-4">
                      <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
                        View Raw API Response (/v1/analytics)
                      </summary>
                      <pre className="mt-2 max-h-96 overflow-auto rounded bg-gray-100 p-4 text-xs">
                        {JSON.stringify(analyticsRawResponses, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              )
            : (
                <div className="space-y-4">
                  {profiles.map((profile) => {
                    const profileId = profile.id || profile._id;
                    const profileAnalytics = analytics[profileId] || [];
                    const rawResponse = analyticsRawResponses[profileId] as any;
                    const overview = rawResponse?.overview;
                    const pagination = rawResponse?.pagination;

                    return (
                      <div key={profileId} className="rounded-lg border p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <h3 className="font-semibold">
                            {profile.name}
                            {' '}
                            (
                            {profileAnalytics.length}
                            {' '}
                            posts)
                          </h3>
                          {rawResponse && (
                            <details className="text-sm">
                              <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                                View Raw API Response
                              </summary>
                              <pre className="mt-2 max-h-64 overflow-auto rounded bg-gray-100 p-3 text-xs">
                                {JSON.stringify(rawResponse, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>

                        {/* Overview Stats */}
                        {overview && (
                          <div className="mb-4 rounded-lg bg-blue-50 p-3">
                            <h4 className="mb-2 text-sm font-semibold text-blue-900">Overview</h4>
                            <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
                              <div>
                                <span className="font-medium">Total Posts:</span>
                                {' '}
                                {overview.totalPosts}
                              </div>
                              <div>
                                <span className="font-medium">Published:</span>
                                {' '}
                                {overview.publishedPosts}
                              </div>
                              <div>
                                <span className="font-medium">Scheduled:</span>
                                {' '}
                                {overview.scheduledPosts}
                              </div>
                              <div>
                                <span className="font-medium">Last Sync:</span>
                                {' '}
                                {overview.lastSync ? format(new Date(overview.lastSync), 'PPp') : 'N/A'}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Pagination Info */}
                        {pagination && (
                          <div className="mb-3 text-sm text-gray-600">
                            Page
                            {' '}
                            {pagination.page}
                            {' '}
                            of
                            {' '}
                            {pagination.pages}
                            {' '}
                            (Total:
                            {' '}
                            {pagination.total}
                            {' '}
                            posts)
                          </div>
                        )}

                        {profileAnalytics.length === 0
                          ? (
                              <p className="text-sm text-gray-500">No posts found for this profile</p>
                            )
                          : (
                              <div className="space-y-2">
                                {profileAnalytics.map((post: any) => {
                                  const postKey = post._id || post.id || `post-${post.publishedAt}`;
                                  const postAnalytics = post.analytics || {};
                                  const platformAnalytics = post.platforms?.[0]?.analytics || postAnalytics;

                                  return (
                                    <div key={postKey} className="rounded bg-gray-50 p-3">
                                      <div className="mb-2 flex items-start justify-between">
                                        <div className="flex-1">
                                          <div className="mb-1 flex items-center gap-2">
                                            <Badge>{post.platform || 'unknown'}</Badge>
                                            <Badge variant={post.status === 'published' ? 'default' : 'secondary'}>
                                              {post.status}
                                            </Badge>
                                          </div>
                                          {post.content && (
                                            <p className="mb-2 line-clamp-2 text-sm text-gray-700">
                                              {post.content}
                                            </p>
                                          )}
                                          {post.publishedAt && (
                                            <span className="text-xs text-gray-600">
                                              Published:
                                              {' '}
                                              {format(new Date(post.publishedAt), 'PPp')}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
                                        {platformAnalytics.likes !== undefined && (
                                          <div>
                                            <span className="font-medium">Likes:</span>
                                            {' '}
                                            {platformAnalytics.likes.toLocaleString()}
                                          </div>
                                        )}
                                        {platformAnalytics.comments !== undefined && (
                                          <div>
                                            <span className="font-medium">Comments:</span>
                                            {' '}
                                            {platformAnalytics.comments.toLocaleString()}
                                          </div>
                                        )}
                                        {platformAnalytics.shares !== undefined && (
                                          <div>
                                            <span className="font-medium">Shares:</span>
                                            {' '}
                                            {platformAnalytics.shares.toLocaleString()}
                                          </div>
                                        )}
                                        {platformAnalytics.impressions !== undefined && (
                                          <div>
                                            <span className="font-medium">Impressions:</span>
                                            {' '}
                                            {platformAnalytics.impressions.toLocaleString()}
                                          </div>
                                        )}
                                        {platformAnalytics.reach !== undefined && (
                                          <div>
                                            <span className="font-medium">Reach:</span>
                                            {' '}
                                            {platformAnalytics.reach.toLocaleString()}
                                          </div>
                                        )}
                                        {platformAnalytics.clicks !== undefined && (
                                          <div>
                                            <span className="font-medium">Clicks:</span>
                                            {' '}
                                            {platformAnalytics.clicks.toLocaleString()}
                                          </div>
                                        )}
                                        {platformAnalytics.views !== undefined && (
                                          <div>
                                            <span className="font-medium">Views:</span>
                                            {' '}
                                            {platformAnalytics.views.toLocaleString()}
                                          </div>
                                        )}
                                        {platformAnalytics.engagementRate !== undefined && (
                                          <div>
                                            <span className="font-medium">Engagement Rate:</span>
                                            {' '}
                                            {platformAnalytics.engagementRate.toFixed(2)}
                                            %
                                          </div>
                                        )}
                                      </div>
                                      {post.platformPostUrl && (
                                        <div className="mt-2">
                                          <a
                                            href={post.platformPostUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-blue-600 hover:underline"
                                          >
                                            View on
                                            {' '}
                                            {post.platform}
                                          </a>
                                        </div>
                                      )}
                                      {post._id && (
                                        <div className="mt-1 text-xs text-gray-500">
                                          Post ID:
                                          {' '}
                                          {post._id}
                                        </div>
                                      )}
                                      <details className="mt-2">
                                        <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                                          View Raw Post Data
                                        </summary>
                                        <pre className="mt-2 overflow-auto rounded bg-gray-100 p-2 text-xs">
                                          {JSON.stringify(post, null, 2)}
                                        </pre>
                                      </details>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                      </div>
                    );
                  })}
                </div>
              )}
        </CardContent>
      </Card>

      {/* Queue Data Section */}
      <Card>
        <CardHeader>
          <CardTitle>Queue Information</CardTitle>
          {queueError && (
            <Badge variant="destructive" className="mt-2">
              Error:
              {' '}
              {queueError}
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          {!Array.isArray(profiles) || Object.keys(queueData).length === 0
            ? (
                <p className="text-gray-500">No queue data found</p>
              )
            : (
                <div className="space-y-4">
                  {profiles.map((profile) => {
                    const profileId = profile.id || profile._id;
                    const queue = queueData[profileId];
                    if (!queue) {
                      return null;
                    }

                    return (
                      <div key={profileId} className="rounded-lg border p-4">
                        <h3 className="mb-3 font-semibold">{profile.name}</h3>
                        {queue.nextSlot && (
                          <div className="rounded bg-gray-50 p-3">
                            <div className="text-sm">
                              <span className="font-medium">Next Available Slot:</span>
                              {' '}
                              {format(new Date(queue.nextSlot.nextSlot), 'PPpp')}
                            </div>
                            {queue.nextSlot.timezone && (
                              <div className="mt-1 text-sm text-gray-600">
                                <span className="font-medium">Timezone:</span>
                                {' '}
                                {queue.nextSlot.timezone}
                              </div>
                            )}
                            <details className="mt-2">
                              <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                                View Raw Data
                              </summary>
                              <pre className="mt-2 overflow-auto rounded bg-gray-100 p-2 text-xs">
                                {JSON.stringify(queue.nextSlot, null, 2)}
                              </pre>
                            </details>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
        </CardContent>
      </Card>

      {/* Posts Section */}
      <Card>
        <CardHeader>
          <CardTitle>
            Posts & Scheduled Posts (
            {posts.length}
            {' '}
            posts,
            {' '}
            {scheduledPosts.length}
            {' '}
            scheduled)
          </CardTitle>
          {postsError && (
            <Badge variant="destructive" className="mt-2">
              Error:
              {' '}
              {postsError}
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          {postsError
            ? (
                <p className="text-gray-500">
                  Error:
                  {postsError}
                </p>
              )
            : posts.length === 0
              ? (
                  <p className="text-gray-500">No posts found</p>
                )
              : (
                  <div className="space-y-6">
                    {/* Group posts by status */}
                    {['published', 'scheduled', 'draft'].map((status) => {
                      // Create a map of post_id -> scheduled_post data first
                      const scheduledPostsMap = new Map<string, any>();
                      scheduledPosts.forEach((sp: any) => {
                        if (sp.post_id) {
                          scheduledPostsMap.set(sp.post_id, sp);
                        }
                      });

                      // Filter posts by status, but also check scheduled_posts for actual status
                      const statusPosts = posts.filter((p) => {
                        const scheduledPost = scheduledPostsMap.get(p.id);

                        // If post has published_at in scheduled_posts, it's published
                        if (scheduledPost?.published_at) {
                          return status === 'published';
                        }

                        // If post has scheduled_for but no published_at, it's scheduled
                        if (scheduledPost?.scheduled_for && !scheduledPost?.published_at) {
                          return status === 'scheduled';
                        }

                        // Otherwise, use the post's status field
                        return p.status === status;
                      });

                      if (statusPosts.length === 0) {
                        return null;
                      }

                      return (
                        <div key={status} className="rounded-lg border p-4">
                          <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-lg font-semibold capitalize">
                              {status}
                              {' '}
                              Posts (
                              {statusPosts.length}
                              )
                            </h3>
                            <Badge variant={status === 'published' ? 'default' : status === 'scheduled' ? 'secondary' : 'outline'}>
                              {status}
                            </Badge>
                          </div>
                          <div className="space-y-3">
                            {statusPosts.map((post: any) => {
                              const scheduledPost = scheduledPostsMap.get(post.id);
                              const brand = post.brands as any;

                              return (
                                <div key={post.id} className="rounded-lg bg-gray-50 p-4">
                                  <div className="mb-2 flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="mb-2 flex items-center gap-2">
                                        <Badge variant="outline" className="text-xs">
                                          ID:
                                          {' '}
                                          {post.id.substring(0, 8)}
                                          ...
                                        </Badge>
                                        {post.getlate_post_id && (
                                          <Badge variant="secondary" className="text-xs">
                                            Getlate:
                                            {' '}
                                            {post.getlate_post_id.substring(0, 8)}
                                            ...
                                          </Badge>
                                        )}
                                        {brand && (
                                          <Badge variant="outline" className="text-xs">
                                            Brand:
                                            {' '}
                                            {brand.name}
                                          </Badge>
                                        )}
                                      </div>
                                      <p className="mb-2 line-clamp-2 text-sm font-medium text-gray-900">
                                        {post.content || '(No content)'}
                                      </p>
                                      <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 md:grid-cols-4">
                                        <div>
                                          <span className="font-medium">Created:</span>
                                          {' '}
                                          {format(new Date(post.created_at), 'PPpp')}
                                        </div>
                                        {scheduledPost?.scheduled_for && (
                                          <div>
                                            <span className="font-medium">Scheduled For:</span>
                                            {' '}
                                            {format(new Date(scheduledPost.scheduled_for), 'PPpp')}
                                          </div>
                                        )}
                                        {scheduledPost?.published_at && (
                                          <div>
                                            <span className="font-medium">Published At:</span>
                                            {' '}
                                            {format(new Date(scheduledPost.published_at), 'PPpp')}
                                          </div>
                                        )}
                                        {scheduledPost?.status && (
                                          <div>
                                            <span className="font-medium">Schedule Status:</span>
                                            {' '}
                                            <Badge variant="outline" className="text-xs">
                                              {scheduledPost.status}
                                            </Badge>
                                          </div>
                                        )}
                                        {post.platforms && Array.isArray(post.platforms) && post.platforms.length > 0 && (
                                          <div className="col-span-2 md:col-span-4">
                                            <span className="font-medium">Platforms:</span>
                                            {' '}
                                            {post.platforms.map((p: any, idx: number) => {
                                              // Handle both string and object formats
                                              const platformName = typeof p === 'string' ? p : (p.platform || p.name || `Platform ${idx + 1}`);
                                              const platformKey = typeof p === 'string' ? p : (p.platform || p._id || p.id || `platform-${idx}`);
                                              return (
                                                <Badge key={platformKey} variant="outline" className="mr-1 text-xs">
                                                  {platformName}
                                                </Badge>
                                              );
                                            })}
                                          </div>
                                        )}
                                        {scheduledPost?.timezone && (
                                          <div>
                                            <span className="font-medium">Timezone:</span>
                                            {' '}
                                            {scheduledPost.timezone}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  {post.image_url && (
                                    <div className="mt-2">
                                      <span className="text-xs font-medium text-gray-600">Image URL:</span>
                                      <a
                                        href={post.image_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="ml-1 text-xs break-all text-blue-600 hover:underline"
                                      >
                                        {post.image_url}
                                      </a>
                                    </div>
                                  )}
                                  <details className="mt-3">
                                    <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700">
                                      View Raw Post Data
                                    </summary>
                                    <pre className="mt-2 max-h-64 overflow-auto rounded bg-gray-100 p-2 text-xs">
                                      {JSON.stringify(post, null, 2)}
                                    </pre>
                                  </details>
                                  {scheduledPost && (
                                    <details className="mt-2">
                                      <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700">
                                        View Raw Scheduled Post Data
                                      </summary>
                                      <pre className="mt-2 max-h-64 overflow-auto rounded bg-gray-100 p-2 text-xs">
                                        {JSON.stringify(scheduledPost, null, 2)}
                                      </pre>
                                    </details>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
        </CardContent>
      </Card>

      {/* API Keys Section */}
      <Card>
        <CardHeader>
          <CardTitle>
            API Keys (
            {apiKeys.length}
            )
          </CardTitle>
          {apiKeysError && (
            <Badge variant="destructive" className="mt-2">
              Error:
              {' '}
              {apiKeysError}
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          {apiKeys.length === 0
            ? (
                <p className="text-gray-500">No API keys found</p>
              )
            : (
                <div className="space-y-3">
                  {apiKeys.map((key: any) => (
                    <div key={key.id} className="rounded-lg border p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <h3 className="font-semibold">{key.name}</h3>
                        <Badge variant="outline">
                          ID:
                          {key.id}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                        {key.createdAt && (
                          <div>
                            <span className="font-medium">Created:</span>
                            {' '}
                            {format(new Date(key.createdAt), 'PPpp')}
                          </div>
                        )}
                        {key.expiresAt && (
                          <div>
                            <span className="font-medium">Expires:</span>
                            {' '}
                            {format(new Date(key.expiresAt), 'PPpp')}
                          </div>
                        )}
                        {key.permissions && key.permissions.length > 0 && (
                          <div className="col-span-2">
                            <span className="font-medium">Permissions:</span>
                            {' '}
                            {key.permissions.join(', ')}
                          </div>
                        )}
                      </div>
                      <details className="mt-2">
                        <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                          View Raw Data
                        </summary>
                        <pre className="mt-2 overflow-auto rounded bg-gray-100 p-2 text-xs">
                          {JSON.stringify(key, null, 2)}
                        </pre>
                      </details>
                    </div>
                  ))}
                </div>
              )}
        </CardContent>
      </Card>

      {/* Summary Card */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-blue-900">Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3 lg:grid-cols-6">
            <div>
              <div className="font-semibold text-blue-900">Profiles</div>
              <div className="text-2xl font-bold text-blue-700">
                {Array.isArray(profiles) ? profiles.length : 0}
              </div>
            </div>
            <div>
              <div className="font-semibold text-blue-900">Total Accounts</div>
              <div className="text-2xl font-bold text-blue-700">
                {Array.isArray(Object.values(accounts).flat())
                  ? Object.values(accounts).flat().length
                  : 0}
              </div>
            </div>
            <div>
              <div className="font-semibold text-blue-900">Analytics Records</div>
              <div className="text-2xl font-bold text-blue-700">
                {Array.isArray(Object.values(analytics).flat())
                  ? Object.values(analytics).flat().length
                  : 0}
              </div>
            </div>
            <div>
              <div className="font-semibold text-blue-900">API Keys</div>
              <div className="text-2xl font-bold text-blue-700">
                {Array.isArray(apiKeys) ? apiKeys.length : 0}
              </div>
            </div>
            <div>
              <div className="font-semibold text-blue-900">Posts</div>
              <div className="text-2xl font-bold text-blue-700">
                {Array.isArray(posts) ? posts.length : 0}
              </div>
            </div>
            <div>
              <div className="font-semibold text-blue-900">Scheduled</div>
              <div className="text-2xl font-bold text-blue-700">
                {Array.isArray(scheduledPosts) ? scheduledPosts.length : 0}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
