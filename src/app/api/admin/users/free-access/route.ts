import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ADMIN_EMAIL } from '@/config/admin';
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

const grantFreeAccessSchema = z.object({
  days: z.number().int().positive().optional(),
  endDate: z.string().optional(),
}).refine(data => data.days || data.endDate, {
  message: 'Either days or endDate must be provided',
});

export async function POST(request: Request) {
  try {
    const adminId = await requireAdmin();
    const db = createDbConnection();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const body = await request.json();
    const data = grantFreeAccessSchema.parse(body);

    // Calculate end date
    let endDate: Date;
    if (data.endDate) {
      endDate = new Date(data.endDate);
    } else {
      endDate = new Date();
      endDate.setDate(endDate.getDate() + (data.days || 30));
    }

    // Check if user has existing subscription
    const existingSubscription = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);

    if (existingSubscription.length > 0) {
      // Update existing subscription
      await db
        .update(subscriptions)
        .set({
          status: 'free',
          isFreeAccess: true,
          endDate,
          grantedByAdminId: adminId,
        })
        .where(eq(subscriptions.userId, userId));
    } else {
      // Create new free access subscription
      await db.insert(subscriptions).values({
        userId,
        planType: 'free',
        status: 'free',
        startDate: new Date(),
        endDate,
        price: 0,
        currency: 'USD',
        isFreeAccess: true,
        grantedByAdminId: adminId,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error granting free access:', error);
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to grant free access' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdmin();
    const db = createDbConnection();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Revoke free access by setting end date to now
    await db
      .update(subscriptions)
      .set({
        status: 'cancelled',
        endDate: new Date(),
        isFreeAccess: false,
      })
      .where(eq(subscriptions.userId, userId));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error revoking free access:', error);
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to revoke free access' }, { status: 500 });
  }
}
