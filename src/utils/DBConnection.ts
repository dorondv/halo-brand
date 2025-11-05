import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { Env } from '@/libs/Env';
import * as schema from '@/models/Schema';

/**
 * Creates a database connection pool for Drizzle ORM
 * Optimized for serverless environments (Vercel)
 * Supabase connections require SSL - automatically configured
 */
export const createDbConnection = () => {
  const connectionString = Env.DATABASE_URL;

  // Supabase requires SSL connections - detect by supabase.co domain
  const isSupabase = connectionString.includes('supabase.co');

  // Check if using Supabase connection pooler (port 6543)
  const isPooler = connectionString.includes(':6543');

  // For serverless environments, use smaller pool but with proper timeouts
  // Pool size: 1 for direct connections, 2-5 for pooler connections
  const maxConnections = isPooler ? 2 : 1;

  const pool = new Pool({
    connectionString,
    max: maxConnections,
    // Connection timeout (10 seconds)
    connectionTimeoutMillis: 10000,
    // Idle timeout (30 seconds) - close idle connections quickly in serverless
    idleTimeoutMillis: 30000,
    // Keep connections alive for 30 seconds
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    // Enable SSL for Supabase connections
    ssl: isSupabase ? { rejectUnauthorized: false } : undefined,
    // Allow exit on idle to prevent hanging connections
    allowExitOnIdle: true,
  });

  // Handle pool errors gracefully
  pool.on('error', (err) => {
    console.error('Unexpected database pool error:', err);
  });

  return drizzle({
    client: pool,
    schema,
  });
};
