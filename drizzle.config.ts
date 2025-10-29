import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './migrations',
  schema: './src/models/Schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
    // Supabase requires SSL - enable if connection string contains supabase.co
    ssl: process.env.DATABASE_URL?.includes('supabase.co') ? 'require' : undefined,
  },
  verbose: true,
  strict: true,
});
