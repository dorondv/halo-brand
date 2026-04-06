import React from 'react';
import { DashboardShell } from '@/components/layouts/DashboardShell';

// Force dynamic rendering - all pages in this layout require authentication
export const dynamic = 'force-dynamic';

export default function ShellLayout(props: { children: React.ReactNode }) {
  const showGetlateTestNav = process.env.VERCEL_ENV !== 'production';
  return (
    <DashboardShell showGetlateTestNav={showGetlateTestNav}>{props.children}</DashboardShell>
  );
}
