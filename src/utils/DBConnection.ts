import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { Env } from '@/libs/Env';
import * as schema from '@/models/Schema';

/**
 * Creates a database connection pool for Drizzle ORM
 * Supabase connections require SSL - automatically configured
 */
export const createDbConnection = () => {
  const connectionString = Env.DATABASE_URL;

  // Supabase requires SSL connections - detect by supabase.co domain
  const isSupabase = connectionString.includes('supabase.co');

  const pool = new Pool({
    connectionString,
    max: 1,
    // Enable SSL for Supabase connections
    ssl: isSupabase ? { rejectUnauthorized: false } : undefined,
  });

  return drizzle({
    client: pool,
    schema,
  });
};
