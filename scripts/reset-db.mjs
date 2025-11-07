#!/usr/bin/env node
/**
 * Database Reset Script
 *
 * This script drops all tables, functions, and triggers from the database.
 * After running this, you'll need to re-run migrations to recreate tables.
 *
 * Usage: node scripts/reset-db.mjs
 * Or: npm run db:reset
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get DATABASE_URL from environment
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('\n❌ Missing DATABASE_URL environment variable.');
  console.error('   Please set DATABASE_URL in your .env file or environment.\n');
  process.exit(1);
}

// Check if using Supabase (requires SSL)
const isSupabase = DATABASE_URL.includes('supabase.co');

// Create connection pool
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: isSupabase ? { rejectUnauthorized: false } : undefined,
  max: 1, // Single connection for script
});

async function resetDatabase() {
  console.log('🔄 Resetting database...\n');

  try {
    // Read the SQL reset script
    const sqlPath = join(__dirname, 'reset-db.sql');
    const sql = readFileSync(sqlPath, 'utf-8');

    // Execute the SQL
    const client = await pool.connect();
    try {
      await client.query(sql);
      console.log('✅ All tables, functions, and triggers have been dropped.');
      console.log('📝 Next step: Run migrations to recreate tables: npm run db:migrate\n');
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('\n❌ Database reset failed:');
    console.error(error.message);

    if (error.code === 'ENOTFOUND') {
      console.error('\n💡 DNS resolution failed. Check your DATABASE_URL.');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Connection refused. Check your DATABASE_URL and network settings.');
    }

    process.exit(1);
  } finally {
    await pool.end();
  }
}

resetDatabase().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
