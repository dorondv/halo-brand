import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ADMIN_EMAIL } from '@/config/admin';
import { createSupabaseServerClient } from '@/libs/Supabase';
import { coupons } from '@/models/Schema';
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

const createCouponSchema = z.object({
  code: z.string().min(1),
  trialDays: z.number().int().positive(),
  description: z.string().optional(),
  validUntil: z.string().optional(),
  maxUses: z.number().int().positive().optional(),
  isActive: z.boolean().default(true),
});

const updateCouponSchema = z.object({
  trialDays: z.number().int().positive().optional(),
  description: z.string().optional(),
  validUntil: z.string().optional(),
  maxUses: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
});

export async function GET() {
  try {
    await requireAdmin();
    const db = createDbConnection();

    const allCoupons = await db
      .select()
      .from(coupons)
      .orderBy(desc(coupons.createdAt));

    const couponsData = allCoupons.map(coupon => ({
      id: coupon.id,
      code: coupon.code,
      trialDays: coupon.trialDays,
      description: coupon.description,
      validFrom: coupon.validFrom.toISOString(),
      validUntil: coupon.validUntil?.toISOString() || null,
      maxUses: coupon.maxUses,
      currentUses: coupon.currentUses,
      isActive: coupon.isActive,
      createdAt: coupon.createdAt.toISOString(),
    }));

    return NextResponse.json(couponsData);
  } catch (error: any) {
    console.error('Error fetching coupons:', error);
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to fetch coupons' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const db = createDbConnection();
    const body = await request.json();
    const data = createCouponSchema.parse(body);

    const couponData: any = {
      code: data.code.toUpperCase(),
      trialDays: data.trialDays,
      description: data.description || null,
      isActive: data.isActive,
    };

    if (data.validUntil) {
      couponData.validUntil = new Date(data.validUntil);
    }

    if (data.maxUses) {
      couponData.maxUses = data.maxUses;
    }

    const [newCoupon] = await db.insert(coupons).values(couponData).returning();

    if (!newCoupon) {
      return NextResponse.json({ error: 'Failed to create coupon' }, { status: 500 });
    }

    return NextResponse.json({
      id: newCoupon.id,
      code: newCoupon.code,
      trialDays: newCoupon.trialDays,
      description: newCoupon.description,
      validFrom: newCoupon.validFrom.toISOString(),
      validUntil: newCoupon.validUntil?.toISOString() || null,
      maxUses: newCoupon.maxUses,
      currentUses: newCoupon.currentUses,
      isActive: newCoupon.isActive,
      createdAt: newCoupon.createdAt.toISOString(),
    });
  } catch (error: any) {
    console.error('Error creating coupon:', error);
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: error.message || 'Failed to create coupon' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    await requireAdmin();
    const db = createDbConnection();
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'Coupon ID is required' }, { status: 400 });
    }

    const data = updateCouponSchema.parse(updateData);
    const updateFields: any = {};

    if (data.trialDays !== undefined) {
      updateFields.trialDays = data.trialDays;
    }
    if (data.description !== undefined) {
      updateFields.description = data.description || null;
    }
    if (data.validUntil !== undefined) {
      updateFields.validUntil = data.validUntil ? new Date(data.validUntil) : null;
    }
    if (data.maxUses !== undefined) {
      updateFields.maxUses = data.maxUses || null;
    }
    if (data.isActive !== undefined) {
      updateFields.isActive = data.isActive;
    }

    const [updatedCoupon] = await db
      .update(coupons)
      .set(updateFields)
      .where(eq(coupons.id, id))
      .returning();

    if (!updatedCoupon) {
      return NextResponse.json({ error: 'Coupon not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: updatedCoupon.id,
      code: updatedCoupon.code,
      trialDays: updatedCoupon.trialDays,
      description: updatedCoupon.description,
      validFrom: updatedCoupon.validFrom.toISOString(),
      validUntil: updatedCoupon.validUntil?.toISOString() || null,
      maxUses: updatedCoupon.maxUses,
      currentUses: updatedCoupon.currentUses,
      isActive: updatedCoupon.isActive,
      createdAt: updatedCoupon.createdAt.toISOString(),
    });
  } catch (error: any) {
    console.error('Error updating coupon:', error);
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to update coupon' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdmin();
    const db = createDbConnection();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Coupon ID is required' }, { status: 400 });
    }

    // Deactivate instead of delete
    const [updatedCoupon] = await db
      .update(coupons)
      .set({ isActive: false })
      .where(eq(coupons.id, id))
      .returning();

    if (!updatedCoupon) {
      return NextResponse.json({ error: 'Coupon not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting coupon:', error);
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to delete coupon' }, { status: 500 });
  }
}
