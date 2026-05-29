import { NextResponse } from 'next/server';

/**
 * Free access grants were removed. Use trial coupons (/admin/coupons) instead.
 */
export async function POST() {
  return NextResponse.json(
    { error: 'Free access is no longer available. Use trial coupons instead.' },
    { status: 410 },
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Free access is no longer available.' },
    { status: 410 },
  );
}
