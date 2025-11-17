'use client';

/**
 * Client wrapper component for dashboard
 * The server component reads brand from cookie, so no URL syncing needed here
 * This prevents duplicate requests - let BrandSelector handle URL updates when user explicitly changes brand
 */
export function DashboardWrapper({ children }: { children: React.ReactNode }) {
  // No URL syncing here - server component reads from cookie
  // BrandSelector will update URL when user explicitly changes brand
  // This prevents duplicate requests
  return <>{children}</>;
}
