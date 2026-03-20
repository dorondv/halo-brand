import { desc, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { ADMIN_EMAIL } from '@/config/admin';
import { getUserStatus } from '@/libs/subscriptionService';
import { createSupabaseServerClient } from '@/libs/Supabase';
import { billingHistory, subscriptions, users } from '@/models/Schema';
import { createDbConnection } from '@/utils/DBConnection';

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error('Unauthorized');
  }

  // Check if user email is the admin email
  if (user.email !== ADMIN_EMAIL) {
    throw new Error('Admin access required');
  }

  return user.id;
}

type AuthUserRow = {
  id: string;
  email: string | null;
  createdAt: Date | string | null;
  rawUserMetaData: {
    full_name?: string;
    name?: string;
  } | null;
  appMetaData: {
    provider?: string;
    providers?: string[];
  } | null;
};

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asDateLike(value: unknown): Date | string | null {
  if (value instanceof Date || typeof value === 'string') {
    return value;
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function normalizeAuthUserRow(row: unknown): AuthUserRow | null {
  const parsed = asRecord(row);
  if (!parsed) {
    return null;
  }

  const id = asString(parsed.id);
  if (!id) {
    return null;
  }

  const rawMeta = asRecord(parsed.rawUserMetaData);
  const appMeta = asRecord(parsed.appMetaData);
  const providersRaw = appMeta?.providers;
  const providers = Array.isArray(providersRaw)
    ? providersRaw.filter((provider): provider is string => typeof provider === 'string')
    : undefined;

  return {
    id,
    email: asString(parsed.email),
    createdAt: asDateLike(parsed.createdAt),
    rawUserMetaData: rawMeta
      ? {
          full_name: asString(rawMeta.full_name) || undefined,
          name: asString(rawMeta.name) || undefined,
        }
      : null,
    appMetaData: appMeta
      ? {
          provider: asString(appMeta.provider) || undefined,
          providers,
        }
      : null,
  };
}

function getFallbackEmail(id: string) {
  return `${id}@placeholder.local`;
}

function getFallbackName(id: string, email: string | null, rawUserMetaData: AuthUserRow['rawUserMetaData']) {
  const metadataName = rawUserMetaData?.full_name || rawUserMetaData?.name;
  if (metadataName && metadataName.trim()) {
    return metadataName.trim();
  }

  if (email && email.includes('@')) {
    return email.split('@')[0] || 'User';
  }

  return `User-${id.slice(0, 8)}`;
}

async function backfillUsersFromAuth(db: ReturnType<typeof createDbConnection>) {
  const authUsersResult = await db.execute(sql<AuthUserRow>`
    SELECT
      id::text AS "id",
      email,
      created_at AS "createdAt",
      raw_user_meta_data AS "rawUserMetaData",
      raw_app_meta_data AS "appMetaData"
    FROM auth.users
    ORDER BY created_at DESC
  `);

  const authUsers = authUsersResult.rows
    .map(row => normalizeAuthUserRow(row))
    .filter((row): row is AuthUserRow => row !== null);
  if (authUsers.length === 0) {
    return;
  }

  const existingUsers = await db.select({ id: users.id }).from(users);
  const existingIds = new Set(existingUsers.map(row => row.id));

  const missingUsers = authUsers
    .filter(authUser => !existingIds.has(authUser.id))
    .map((authUser) => {
      const email = authUser.email?.trim() || getFallbackEmail(authUser.id);
      const provider = authUser.appMetaData?.provider || authUser.appMetaData?.providers?.[0] || 'email';

      return {
        id: authUser.id,
        email,
        plan: 'free' as const,
        name: getFallbackName(authUser.id, authUser.email, authUser.rawUserMetaData),
        provider,
        isActive: true,
        createdAt: authUser.createdAt ? new Date(authUser.createdAt) : new Date(),
      };
    });

  if (missingUsers.length === 0) {
    return;
  }

  await db.insert(users).values(missingUsers).onConflictDoNothing();
}

export async function GET() {
  try {
    await requireAdmin();
    const db = createDbConnection();

    // Ensure admin page reflects current auth.users accounts even if trigger sync is missing.
    try {
      await backfillUsersFromAuth(db);
    } catch (syncError) {
      console.warn('Could not backfill users from auth.users:', syncError);
    }

    // Get all users with their subscriptions and payment info
    const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));

    const usersWithDetails = await Promise.all(
      allUsers.map(async (user) => {
        const userSubscriptions = await db
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.userId, user.id))
          .limit(1);

        const subscription = userSubscriptions[0] || null;

        // Get total paid amount
        const payments = await db
          .select({
            totalPaid: sql<number>`coalesce(sum(${billingHistory.amount}) filter (where ${billingHistory.status} = 'paid'), 0)`,
          })
          .from(billingHistory)
          .innerJoin(subscriptions, eq(billingHistory.subscriptionId, subscriptions.id))
          .where(eq(subscriptions.userId, user.id));

        const totalPaid = Number(payments[0]?.totalPaid || 0);

        // Check if coupon was used
        const couponUsed = !!subscription?.couponCode;

        // Get user status
        const userStatus = subscription ? getUserStatus(subscription) : 'Churned';

        return {
          id: user.id,
          name: user.name || user.email?.split('@')[0] || 'User',
          email: user.email,
          role: 'contributor', // TODO: Add role field
          registrationDate: user.createdAt.toISOString(),
          paymentDate: subscription?.startDate?.toISOString() || null,
          userStatus,
          planType: subscription?.planType || null,
          totalPaid,
          couponUsed,
          discountAmount: 0, // TODO: Calculate from coupon
          trialEndDate: subscription?.trialEndDate?.toISOString() || null,
          expirationDate: subscription?.endDate?.toISOString() || null,
          isFreeAccess: subscription?.isFreeAccess || false,
          isPayPalTrial: false, // TODO: Check PayPal trial status
          paypalTrialEndDate: null,
          isTrialCoupon: subscription?.isTrialCoupon || false,
          subscription,
        };
      }),
    );

    return NextResponse.json(usersWithDetails);
  } catch (error: any) {
    console.error('Error fetching users:', error);
    if (error.message === 'Unauthorized' || error.message === 'Admin access required') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const adminId = await requireAdmin();
    const db = createDbConnection();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    if (userId === adminId) {
      return NextResponse.json({ error: 'You cannot delete your own admin account' }, { status: 400 });
    }

    const deleted = await db
      .delete(users)
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
      });

    if (deleted.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting user:', error);
    if (error.message === 'Unauthorized' || error.message === 'Admin access required') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
