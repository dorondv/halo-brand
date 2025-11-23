import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Load migration journal to map IDs to names
function loadMigrationJournal() {
  const migrationMap = {};

  // First, try to load from journal
  try {
    const journalPath = join(process.cwd(), 'migrations', 'meta', '_journal.json');
    const journalContent = readFileSync(journalPath, 'utf-8');
    const journal = JSON.parse(journalContent);

    if (journal.entries) {
      journal.entries.forEach((entry) => {
        migrationMap[entry.idx] = entry.tag;
      });
    }
  } catch {
    // Journal not found, will use filesystem fallback
  }

  // Fallback: read migration files from filesystem
  try {
    const migrationsDir = join(process.cwd(), 'migrations');
    const files = readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    files.forEach((file, index) => {
      // Extract migration name from filename (remove .sql extension)
      const migrationName = file.replace('.sql', '');
      // Only add if not already in map (journal takes precedence)
      if (!migrationMap[index]) {
        migrationMap[index] = migrationName;
      }
    });
  } catch {
    // Migrations directory not found
  }

  return migrationMap;
}

// Load environment variables from .env file if it exists
let DATABASE_URL = process.env.DATABASE_URL;

// Try to load from .env file
try {
  const envPath = join(process.cwd(), '.env');
  const envContent = readFileSync(envPath, 'utf-8');
  const envLines = envContent.split('\n');

  for (const line of envLines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');

      if (key === 'DATABASE_URL' && !DATABASE_URL) {
        DATABASE_URL = value;
      }
    }
  }
} catch {
  // .env file doesn't exist or can't be read, that's okay
}

if (!DATABASE_URL) {
  console.error('\n❌ Error: DATABASE_URL not found');
  console.error('Please set DATABASE_URL in your .env file or as an environment variable\n');
  process.exit(1);
}

// Load migration journal
const migrationMap = loadMigrationJournal();

// Use direct PostgreSQL connection
try {
  const { Pool } = await import('pg');
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('supabase.co') ? { rejectUnauthorized: false } : undefined,
  });

  const result = await pool.query(
    'SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id;',
  );

  if (result.rows.length === 0) {
    console.log('\n📋 No migrations have been applied yet.\n');
    console.log('💡 Run migrations: npm run db:migrate\n');
    await pool.end();
    process.exit(0);
  }

  console.log('\n📋 Applied Migrations\n');
  console.log('═'.repeat(100));

  // Header
  const header = [
    '#'.padEnd(4),
    'Migration Name'.padEnd(45),
    'Hash (short)'.padEnd(15),
    'Applied At'.padEnd(20),
  ].join(' │ ');

  console.log(header);
  console.log('═'.repeat(100));

  // Format date properly - handle various PostgreSQL date formats
  function formatDate(dateValue) {
    if (!dateValue) {
      return 'N/A';
    }

    let date;

    // Handle different types
    if (dateValue instanceof Date) {
      date = dateValue;
    } else if (typeof dateValue === 'string') {
      // PostgreSQL returns dates as strings, try parsing directly
      date = new Date(dateValue);

      // If that fails, it might be a timestamp string
      if (Number.isNaN(date.getTime())) {
        const timestamp = Number.parseInt(dateValue, 10);
        if (!Number.isNaN(timestamp)) {
          // Check if it's seconds or milliseconds
          date = new Date(timestamp < 10000000000 ? timestamp * 1000 : timestamp);
        }
      }
    } else if (typeof dateValue === 'number') {
      // Check if it's seconds or milliseconds
      date = new Date(dateValue < 10000000000 ? dateValue * 1000 : dateValue);
    } else {
      return 'N/A';
    }

    // Validate the date
    if (Number.isNaN(date.getTime())) {
      return 'N/A';
    }

    // Format nicely
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }

  // Display migrations
  result.rows.forEach((row, index) => {
    const migrationId = Number.parseInt(row.id, 10);
    const migrationName = migrationMap[migrationId - 1] || `Migration #${row.id}`;
    const hashShort = row.hash ? `${row.hash.substring(0, 12)}...` : 'N/A';
    const appliedAt = formatDate(row.created_at);

    const line = [
      `${(index + 1).toString()}.`.padEnd(4),
      migrationName.padEnd(45),
      hashShort.padEnd(15),
      appliedAt.padEnd(20),
    ].join(' │ ');

    console.log(line);
  });

  console.log('═'.repeat(100));

  // Check for pending migrations
  const allMigrations = Object.keys(migrationMap).length;
  const appliedMigrations = result.rows.length;
  const pendingMigrations = allMigrations - appliedMigrations;

  console.log(`\n✅ Applied: ${appliedMigrations} migration(s)`);

  if (pendingMigrations > 0) {
    console.log(`⚠️  Pending: ${pendingMigrations} migration(s) not yet applied`);
    console.log('💡 Run: npm run db:migrate\n');
  } else {
    console.log('✨ All migrations are up to date!\n');
  }

  await pool.end();
} catch (error) {
  if (error.message.includes('does not exist')) {
    console.log('\n📋 No migrations have been applied yet.\n');
    console.log('💡 The migrations table does not exist.');
    console.log('   Run migrations first: npm run db:migrate\n');
  } else {
    console.error('❌ Error:', error.message);
    if (error.code === 'ENOTFOUND') {
      console.error('\n💡 DNS resolution failed. Check your DATABASE_URL connection string.');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Connection refused. Check if the database is accessible.');
    }
  }
  process.exit(1);
}
