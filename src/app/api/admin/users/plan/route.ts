import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ADMIN_EMAIL } from '@/config/admin';
import { getSubscriptionPlan } from '@/libs/subscriptionService';
import { createSupabaseServerClient } from '@/libs/Supabase';
import { subscriptions } from '@/models/Schema';
import { createDbConnection } from '@/utils/DBConnection';

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

const updatePlanSchema = z.object({
  planType: z.enum(['basic', 'pro', 'business']),
  billingCycle: z.enum(['monthly', 'annual']).optional().default('monthly'),
});

export async function PUT(request: Request) {
  try {
    const adminId = await requireAdmin();
    const db = createDbConnection();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const body = await request.json();
    const data = updatePlanSchema.parse(body);

    const plan = await getSubscriptionPlan(data.planType);
    if (!plan) {
      return NextResponse.json({ error: `Plan ${data.planType} not found` }, { status: 404 });
    }

    const price = data.billingCycle === 'annual' && plan.priceAnnual
      ? plan.priceAnnual / 12
      : plan.priceMonthly;

    const existingSubscriptions = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);

    const updateData = {
      planType: data.planType,
      billingCycle: data.billingCycle || 'monthly',
      status: 'active' as const,
      price,
      currency: 'USD',
      endDate: null,
      trialEndDate: null,
      paypalSubscriptionId: null,
      paypalPlanId: null,
      isFreeAccess: false,
      grantedByAdminId: adminId,
      updatedAt: new Date(),
    };

    if (existingSubscriptions.length > 0) {
      const [updated] = await db
        .update(subscriptions)
        .set(updateData)
        .where(eq(subscriptions.userId, userId))
        .returning();

      if (!updated) {
        return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        subscription: {
          id: updated.id,
          planType: updated.planType,
          status: updated.status,
          billingCycle: updated.billingCycle,
          price: Number(updated.price),
          endDate: null,
          trialEndDate: null,
        },
      });
    }

    const [created] = await db
      .insert(subscriptions)
      .values({
        userId,
        planType: data.planType,
        billingCycle: data.billingCycle || 'monthly',
        status: 'active',
        startDate: new Date(),
        endDate: null,
        trialEndDate: null,
        price,
        currency: 'USD',
        isFreeAccess: false,
        grantedByAdminId: adminId,
      })
      .returning();

    if (!created) {
      return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      subscription: {
        id: created.id,
        planType: created.planType,
        status: created.status,
        billingCycle: created.billingCycle,
        price: Number(created.price),
        endDate: null,
        trialEndDate: null,
      },
    });
  } catch (error: any) {
    console.error('Error updating user plan:', error);
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to update user plan' }, { status: 500 });
  }
}
