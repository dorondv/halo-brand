import type { NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { ADMIN_EMAIL } from '@/config/admin';
import { db } from '@/libs/DB';
import { createSupabaseServerClient } from '@/libs/Supabase';
import { marketingEvents } from '@/models/Schema';

/**
 * GET /api/admin/marketing/breakdown
 * Get breakdown by UTM source/campaign or country
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

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const groupBy = searchParams.get('groupBy') || 'utmSource'; // utmSource, utmCampaign, or country

    let groupByField;
    if (groupBy === 'utmCampaign') {
      groupByField = marketingEvents.utmCampaign;
    } else if (groupBy === 'country') {
      groupByField = marketingEvents.country;
    } else {
      groupByField = marketingEvents.utmSource;
    }

    // Get breakdown data
    const breakdown = await db
      .select({
        groupValue: groupByField,
        pageviews: sql<number>`COUNT(CASE WHEN ${marketingEvents.eventType} = 'pageview' THEN 1 END)`,
        signupStarts: sql<number>`COUNT(CASE WHEN ${marketingEvents.eventType} = 'signup_start' THEN 1 END)`,
        signupCompletes: sql<number>`COUNT(CASE WHEN ${marketingEvents.eventType} = 'signup_complete' THEN 1 END)`,
        leadSubmits: sql<number>`COUNT(CASE WHEN ${marketingEvents.eventType} = 'lead_submit' THEN 1 END)`,
        purchases: sql<number>`COUNT(CASE WHEN ${marketingEvents.eventType} = 'purchase_complete' THEN 1 END)`,
        totalRevenue: sql<number>`COALESCE(SUM(CASE WHEN ${marketingEvents.eventType} = 'purchase_complete' THEN ${marketingEvents.revenueTotal} ELSE 0 END), 0)`,
      })
      .from(marketingEvents)
      .where(sql`${groupByField} IS NOT NULL`)
      .groupBy(groupByField);

    // Format and calculate conversion rates
    const formatted = breakdown.map((item) => {
      const pageviews = Number(item.pageviews || 0);
      const signupStarts = Number(item.signupStarts || 0);
      const signupCompletes = Number(item.signupCompletes || 0);
      const leadSubmits = Number(item.leadSubmits || 0);
      const purchases = Number(item.purchases || 0);
      const totalRevenue = Number(item.totalRevenue || 0);

      const conversionRate = pageviews > 0 ? (purchases / pageviews) * 100 : 0;

      return {
        [groupBy]: item.groupValue,
        pageviews,
        signupStarts,
        signupCompletes,
        leadSubmits,
        purchases,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        conversionRate: Math.round(conversionRate * 100) / 100,
      };
    });

    return NextResponse.json(formatted);
  } catch (error) {
    console.error('Failed to get marketing breakdown:', error);
    return NextResponse.json(
      { error: 'Failed to get breakdown' },
      { status: 500 },
    );
  }
}
