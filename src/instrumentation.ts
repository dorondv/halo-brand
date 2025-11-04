import * as Sentry from '@sentry/nextjs';

const sentryOptions: Sentry.NodeOptions | Sentry.EdgeOptions = {
  // Sentry DSN
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Enable Spotlight in development
  spotlight: process.env.NODE_ENV === 'development',

  integrations: [
    Sentry.consoleLoggingIntegration(),
  ],

  // Adds request headers and IP for users, for more info visit
  sendDefaultPii: true,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 1,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,
};

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Only run DB migrations in development or if explicitly enabled
    // In production (Vercel), migrations should be run manually or during build
    const shouldRunMigrations
      = process.env.NODE_ENV === 'development'
        || process.env.RUN_MIGRATIONS === 'true';

    if (shouldRunMigrations) {
      try {
        const { runMigrations } = await import('./utils/DBMigration');
        await runMigrations();
      } catch (error) {
        // Log migration errors but don't crash the app
        // In production, this is expected - migrations should be run separately
        if (process.env.NODE_ENV === 'development') {
          console.error('Migration error:', error);
        }
      }
    }
  }

  if (!process.env.NEXT_PUBLIC_SENTRY_DISABLED) {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
      // Node.js Sentry configuration
      Sentry.init(sentryOptions);
    }

    if (process.env.NEXT_RUNTIME === 'edge') {
      // Edge Sentry configuration
      Sentry.init(sentryOptions);
    }
  }
}

export const onRequestError = Sentry.captureRequestError;
