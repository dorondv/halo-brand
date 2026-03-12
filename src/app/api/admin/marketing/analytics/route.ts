import type { NextRequest } from 'next/server';
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { ADMIN_EMAIL } from '@/config/admin';
import { db } from '@/libs/DB';
import { createSupabaseServerClient } from '@/libs/Supabase';
import { marketingEvents } from '@/models/Schema';

/**
 * GET /api/admin/marketing/analytics
 * Get marketing metrics with optional filters
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
    const utmSource = searchParams.get('utmSource');
    const utmCampaign = searchParams.get('utmCampaign');
    const country = searchParams.get('country');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build filters
    const conditions = [];
    if (utmSource) {
      conditions.push(eq(marketingEvents.utmSource, utmSource));
    }
    if (utmCampaign) {
      conditions.push(eq(marketingEvents.utmCampaign, utmCampaign));
    }
    if (country) {
      conditions.push(eq(marketingEvents.country, country));
    }
    if (startDate) {
      conditions.push(gte(marketingEvents.createdAt, new Date(startDate)));
    }
    if (endDate) {
      conditions.push(lte(marketingEvents.createdAt, new Date(endDate)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get metrics
    const [metrics] = await db
      .select({
        pageviews: sql<number>`COUNT(CASE WHEN ${marketingEvents.eventType} = 'pageview' THEN 1 END)`,
        signupStarts: sql<number>`COUNT(CASE WHEN ${marketingEvents.eventType} = 'signup_start' THEN 1 END)`,
        signupCompletes: sql<number>`COUNT(CASE WHEN ${marketingEvents.eventType} = 'signup_complete' THEN 1 END)`,
        leadSubmits: sql<number>`COUNT(CASE WHEN ${marketingEvents.eventType} = 'lead_submit' THEN 1 END)`,
        purchases: sql<number>`COUNT(CASE WHEN ${marketingEvents.eventType} = 'purchase_complete' THEN 1 END)`,
        totalRevenue: sql<number>`COALESCE(SUM(CASE WHEN ${marketingEvents.eventType} = 'purchase_complete' THEN ${marketingEvents.revenueTotal} ELSE 0 END), 0)`,
      })
      .from(marketingEvents)
      .where(whereClause);

    const pageviews = Number(metrics?.pageviews || 0);
    const signupStarts = Number(metrics?.signupStarts || 0);
    const signupCompletes = Number(metrics?.signupCompletes || 0);
    const leadSubmits = Number(metrics?.leadSubmits || 0);
    const purchases = Number(metrics?.purchases || 0);
    const totalRevenue = Number(metrics?.totalRevenue || 0);

    // Calculate conversion rates
    const conversionRate = pageviews > 0 ? (purchases / pageviews) * 100 : 0;
    const signupRate = signupStarts > 0 ? (signupCompletes / signupStarts) * 100 : 0;

    return NextResponse.json({
      metrics: {
        pageviews,
        signupStarts,
        signupCompletes,
        leadSubmits,
        purchases,
        conversionRate: Math.round(conversionRate * 100) / 100,
        signupRate: Math.round(signupRate * 100) / 100,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
      },
    });
  } catch (error) {
    console.error('Failed to get marketing analytics:', error);
    return NextResponse.json(
      { error: 'Failed to get analytics' },
      { status: 500 },
    );
  }
}
