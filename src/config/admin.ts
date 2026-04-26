import { Env } from '@/libs/Env';

/**
 * Admin Configuration
 * Admin email is configured via ADMIN_EMAIL environment variable.
 * Returns undefined if not set — no one gets admin access by default.
 */
export const ADMIN_EMAIL: string | undefined = Env.ADMIN_EMAIL;
