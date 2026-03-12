import { Env } from '@/libs/Env';

/**
 * Admin Configuration
 * Admin email is configured via ADMIN_EMAIL environment variable
 * Falls back to 'demo@hello.brand' if not set
 */
export const ADMIN_EMAIL = Env.ADMIN_EMAIL || 'demo@hello.brand';
