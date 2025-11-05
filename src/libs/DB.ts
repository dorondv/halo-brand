import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '@/models/Schema';
import { createDbConnection } from '@/utils/DBConnection';

// Stores the db connection in the global scope to prevent multiple instances
// This works safely in both development and production (including serverless)
const globalForDb = globalThis as unknown as {
  drizzle: NodePgDatabase<typeof schema> | undefined;
};

// Reuse existing connection if available, otherwise create new one
// This prevents connection pool exhaustion in serverless environments
const db = globalForDb.drizzle || createDbConnection();

// Always store in global to reuse connections across serverless function invocations
// This is safe because each serverless function instance has its own global scope
globalForDb.drizzle = db;

export { db };
