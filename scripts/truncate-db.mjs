#!/usr/bin/env node
/**
 * Database Truncate Script
 *
 * This script removes all data from tables but keeps the table structure.
 * Safer than dropping tables - preserves schema, indexes, constraints, etc.
 *
 * Usage: node scripts/truncate-db.mjs
 * Or: npm run db:truncate
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

async function truncateDatabase() {
  console.log('🔄 Truncating database tables...\n');

  try {
    // Read the SQL truncate script
    const sqlPath = join(__dirname, 'truncate-db.sql');
    const sql = readFileSync(sqlPath, 'utf-8');

    // Execute the SQL
    const client = await pool.connect();
    try {
      await client.query(sql);
      console.log('✅ All table data has been removed. Table structures preserved.\n');
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('\n❌ Database truncate failed:');
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

truncateDatabase().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
