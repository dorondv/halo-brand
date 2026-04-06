import React from 'react';
import { DashboardShell } from '@/components/layouts/DashboardShell';

export default function DashboardLayout(props: { children: React.ReactNode }) {
  const showGetlateTestNav = process.env.VERCEL_ENV !== 'production';
  return (
    <DashboardShell showGetlateTestNav={showGetlateTestNav}>{props.children}</DashboardShell>
  );
}
