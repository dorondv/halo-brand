import type { NextRequest } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { ADMIN_EMAIL } from '@/config/admin';
import { db } from '@/libs/DB';
import { createSupabaseServerClient } from '@/libs/Supabase';
import { billingHistory, subscriptions, users } from '@/models/Schema';

/**
 * GET /api/admin/marketing/export
 * Export users with marketing data (CSV)
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
        paypalSubscriptionId: subscriptions.paypalSubscriptionId,
        couponCode: subscriptions.couponCode,
        totalPaid: sql<number>`COALESCE(SUM(${billingHistory.amount}), 0)`,
        purchaseAmount: sql<number>`COALESCE(MAX(${billingHistory.amount}), 0)`,
        paymentDate: sql<Date>`MAX(${billingHistory.paymentDate})`,
      })
      .from(users)
      .leftJoin(subscriptions, eq(users.id, subscriptions.userId))
      .leftJoin(billingHistory, eq(subscriptions.id, billingHistory.subscriptionId))
      .groupBy(
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
        subscriptions.paypalSubscriptionId,
        subscriptions.couponCode,
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

      // Determine status
      let status = 'Active';
      if (cancelDate) {
        status = 'Cancelled';
      } else if (user.subscriptionStatus === 'active' || user.subscriptionStatus === 'trialing') {
        status = 'Active';
      } else if (user.subscriptionStatus === 'free') {
        status = 'Free';
      }

      return {
        'User Email': user.email || '',
        'Registration Date': registrationDate?.toISOString().split('T')[0] || '',
        'Cancel Date': cancelDate?.toISOString().split('T')[0] || '',
        'Tenure (Months)': tenureMonths,
        'Payment Date': user.paymentDate ? new Date(user.paymentDate).toISOString().split('T')[0] : '',
        'Status': status,
        'Plan Type': user.subscriptionPlanType || 'free',
        'Total Paid': Number(user.totalPaid || 0).toFixed(2),
        'Purchase Amount': Number(user.purchaseAmount || 0).toFixed(2),
        'Revenue Total (LTV)': Number(user.totalPaid || 0).toFixed(2),
        'Coupon Used': user.couponCode || '',
        'PayPal Subscription ID': user.paypalSubscriptionId || '',
        'UTM Source': user.utmSource || '',
        'UTM Medium': user.utmMedium || '',
        'UTM Campaign': user.utmCampaign || '',
        'UTM Term': user.utmTerm || '',
        'UTM Content': user.utmContent || '',
        'Country': user.geoCountry || '',
        'Timezone': user.geoTz || '',
        'Language': user.geoLang || '',
        'First Landing URL': user.firstLandingUrl || '',
        'First Referrer': user.firstReferrer || '',
      };
    });

    // Convert to CSV
    if (formattedUsers.length === 0) {
      return NextResponse.json({ error: 'No data to export' }, { status: 404 });
    }

    const firstUser = formattedUsers[0];
    if (!firstUser) {
      return NextResponse.json({ error: 'No data to export' }, { status: 404 });
    }

    const headers = Object.keys(firstUser);
    const csvRows = [
      headers.join(','),
      ...formattedUsers.map(row =>
        headers
          .map((header) => {
            const value = row[header as keyof typeof row];
            // Escape commas and quotes in CSV
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          })
          .join(','),
      ),
    ];

    const csv = csvRows.join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="marketing-users-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error('Failed to export marketing users:', error);
    return NextResponse.json(
      { error: 'Failed to export users' },
      { status: 500 },
    );
  }
}
