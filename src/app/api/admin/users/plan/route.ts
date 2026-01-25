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

  // Check if user email is the admin email
  if (user.email !== ADMIN_EMAIL) {
    throw new Error('Admin access required');
  }

  return user.id;
}

const updatePlanSchema = z.object({
  planType: z.enum(['free', 'basic', 'pro', 'business', 'trial']),
  billingCycle: z.enum(['monthly', 'annual']).optional().default('monthly'),
  endDate: z.string().optional(), // Optional end date for free/trial plans
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

    // Get plan details to get price
    let price = 0;
    if (data.planType !== 'free' && data.planType !== 'trial') {
      const plan = await getSubscriptionPlan(data.planType as 'basic' | 'pro' | 'business');
      if (!plan) {
        return NextResponse.json({ error: `Plan ${data.planType} not found` }, { status: 404 });
      }
      price = data.billingCycle === 'annual' && plan.priceAnnual
        ? plan.priceAnnual / 12 // Store monthly equivalent for annual plans
        : plan.priceMonthly;
    }

    // Determine status based on plan type
    let status: 'trialing' | 'active' | 'cancelled' | 'expired' | 'suspended' | 'free' = 'active';
    if (data.planType === 'free') {
      status = 'free';
    } else if (data.planType === 'trial') {
      status = 'trialing';
    }

    // Check if user has existing subscription
    const existingSubscriptions = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);

    const updateData: any = {
      planType: data.planType,
      billingCycle: data.billingCycle || 'monthly',
      status,
      price,
      currency: 'USD',
      updatedAt: new Date(),
    };

    // Set end date if provided or for free/trial plans
    if (data.endDate) {
      updateData.endDate = new Date(data.endDate);
      if (data.planType === 'trial') {
        updateData.trialEndDate = new Date(data.endDate);
      }
    } else if (data.planType === 'free' || data.planType === 'trial') {
      // Set default end date for free/trial plans (30 days from now)
      const defaultEndDate = new Date();
      defaultEndDate.setDate(defaultEndDate.getDate() + 30);
      updateData.endDate = defaultEndDate;
      if (data.planType === 'trial') {
        updateData.trialEndDate = defaultEndDate;
      }
    }

    // Clear PayPal-related fields when manually changing plan
    updateData.paypalSubscriptionId = null;
    updateData.paypalPlanId = null;
    updateData.isFreeAccess = data.planType === 'free';
    updateData.grantedByAdminId = adminId;

    if (existingSubscriptions.length > 0) {
      // Update existing subscription
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
          endDate: updated.endDate?.toISOString() || null,
          trialEndDate: updated.trialEndDate?.toISOString() || null,
        },
      });
    } else {
      // Create new subscription
      const [created] = await db
        .insert(subscriptions)
        .values({
          userId,
          planType: data.planType,
          billingCycle: data.billingCycle || 'monthly',
          status,
          startDate: new Date(),
          endDate: updateData.endDate || null,
          trialEndDate: updateData.trialEndDate || null,
          price,
          currency: 'USD',
          isFreeAccess: data.planType === 'free',
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
          endDate: created.endDate?.toISOString() || null,
          trialEndDate: created.trialEndDate?.toISOString() || null,
        },
      });
    }
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
