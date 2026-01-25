import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ADMIN_EMAIL } from '@/config/admin';
import { createSupabaseServerClient } from '@/libs/Supabase';

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

const updateRoleSchema = z.object({
  role: z.enum(['contributor', 'manager', 'admin']),
});

export async function PUT(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const body = await request.json();
    updateRoleSchema.parse(body);

    // TODO: Update user role when role field is added to users table
    // For now, return success but don't actually update
    // const db = createDbConnection();
    // await db.update(users).set({ role: data.role }).where(eq(users.id, userId));

    return NextResponse.json({ success: true, message: 'Role update will be available when role field is added' });
  } catch (error: any) {
    console.error('Error updating role:', error);
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to update role' }, { status: 500 });
  }
}
