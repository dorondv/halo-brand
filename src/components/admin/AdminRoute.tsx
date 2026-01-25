'use client';

import React, { useEffect, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { usePathname } from '@/libs/I18nNavigation';

type AdminRouteProps = {
  children: React.ReactNode;
};

export function AdminRoute({ children }: AdminRouteProps) {
  const toast = useToast();
  const pathname = usePathname();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAdminAccess = async () => {
      try {
        // Check admin status via API (server-side check, doesn't expose email)
        const response = await fetch('/api/admin/check');

        if (!response.ok) {
          window.location.href = '/dashboard';
          toast.error('Authentication required');
          setIsAuthorized(false);
          return;
        }

        const data = await response.json();

        if (!data.isAdmin) {
          window.location.href = '/dashboard';
          toast.error('Admin access required');
          setIsAuthorized(false);
          return;
        }

        setIsAuthorized(true);
      } catch (error) {
        console.error('Error checking admin access:', error);
        window.location.href = '/dashboard';
        setIsAuthorized(false);
      }
    };

    checkAdminAccess();
  }, [pathname, toast]);

  if (isAuthorized === null) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-pink-500"></div>
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return <>{children}</>;
}
