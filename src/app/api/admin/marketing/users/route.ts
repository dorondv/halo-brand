import type { NextRequest } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { ADMIN_EMAIL } from '@/config/admin';
import { db } from '@/libs/DB';
import { createSupabaseServerClient } from '@/libs/Supabase';
import { billingHistory, subscriptions, users } from '@/models/Schema';

/**
 * GET /api/admin/marketing/users
 * Get users with marketing data and business metrics
 * Requires admin authentication
 */
async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error('Unauthorized');
  }

  if (user.email !== ADMIN_EMAIL) {
    throw new Error('Admin access required');
  }

  return user.id;
}

export async function GET(_request: NextRequest) {
  try {
    await requireAdmin();

    // Get all users with their subscriptions and billing history
    const usersData = await db
      .select({
        id: users.id,
        email: users.email,
        createdAt: users.createdAt,
        cancelDate: users.cancelDate,
        utmSource: users.utmSource,
        utmMedium: users.utmMedium,
        utmCampaign: users.utmCampaign,
        utmTerm: users.utmTerm,
        utmContent: users.utmContent,
        geoCountry: users.geoCountry,
        geoTz: users.geoTz,
        geoLang: users.geoLang,
        firstReferrer: users.firstReferrer,
        firstLandingUrl: users.firstLandingUrl,
        subscriptionStatus: subscriptions.status,
        subscriptionPlanType: subscriptions.planType,
        subscriptionStartDate: subscriptions.startDate,
        subscriptionEndDate: subscriptions.endDate,
        totalPaid: sql<number>`COALESCE(SUM(${billingHistory.amount}), 0)`,
        purchaseAmount: sql<number>`COALESCE(MAX(${billingHistory.amount}), 0)`,
      })
      .from(users)
      .leftJoin(subscriptions, eq(users.id, subscriptions.userId))
      .leftJoin(billingHistory, eq(subscriptions.id, billingHistory.subscriptionId))
      .groupBy(
        users.id,
        users.email,
        users.createdAt,
        users.cancelDate,
        users.utmSource,
        users.utmMedium,
        users.utmCampaign,
        users.utmTerm,
        users.utmContent,
        users.geoCountry,
        users.geoTz,
        users.geoLang,
        users.firstReferrer,
        users.firstLandingUrl,
        subscriptions.status,
        subscriptions.planType,
        subscriptions.startDate,
        subscriptions.endDate,
      );

    // Calculate tenure and format data
    const formattedUsers = usersData.map((user) => {
      const registrationDate = user.createdAt;
      const cancelDate = user.cancelDate;
      const now = new Date();

      // Calculate tenure in months
      let tenureMonths = 0;
      if (registrationDate) {
        const endDate = cancelDate || now;
        const monthsDiff = (endDate.getTime() - registrationDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
        tenureMonths = Math.max(0, Math.floor(monthsDiff));
      }

      // Determine user status
      let userStatus = 'Active User';
      if (cancelDate) {
        userStatus = 'Cancelled User';
      } else if (user.subscriptionStatus === 'active' || user.subscriptionStatus === 'trialing') {
        const totalPaid = Number(user.totalPaid || 0);
        if (totalPaid > 0) {
          userStatus = 'Active User (Paid)';
        } else {
          userStatus = 'Active User (Free)';
        }
      } else if (user.subscriptionStatus === 'free') {
        userStatus = 'Free User';
      }

      return {
        id: user.id,
        email: user.email,
        registrationDate: registrationDate?.toISOString() || null,
        cancelDate: cancelDate?.toISOString() || null,
        tenureMonths,
        hasPurchase: Number(user.totalPaid || 0) > 0,
        purchaseAmount: Number(user.purchaseAmount || 0),
        revenueTotal: Number(user.totalPaid || 0), // LTV
        utmSource: user.utmSource,
        utmMedium: user.utmMedium,
        utmCampaign: user.utmCampaign,
        utmTerm: user.utmTerm,
        utmContent: user.utmContent,
        geoCountry: user.geoCountry,
        geoTz: user.geoTz,
        geoLang: user.geoLang,
        firstReferrer: user.firstReferrer,
        firstLandingUrl: user.firstLandingUrl,
        userStatus,
        planType: user.subscriptionPlanType || 'free',
      };
    });

    return NextResponse.json(formattedUsers);
  } catch (error) {
    console.error('Failed to get marketing users:', error);
    return NextResponse.json(
      { error: 'Failed to get users' },
      { status: 500 },
    );
  }
}
