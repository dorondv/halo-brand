import React from 'react';
import { DashboardShell } from '@/components/layouts/DashboardShell';

export default function ShellLayout(props: { children: React.ReactNode }) {
    return <DashboardShell>{props.children}</DashboardShell>;
}


