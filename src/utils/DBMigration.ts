import path from 'node:path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Env } from '@/libs/Env';
import { createDbConnection } from './DBConnection';

// Create a new and dedicated database connection for running migrations
const db = createDbConnection();

try {
  await migrate(db, {
    migrationsFolder: path.join(process.cwd(), 'migrations'),
  });
} catch (error) {
  console.error('❌ Database migration failed');

  if (error instanceof Error) {
    const dbUrl = Env.DATABASE_URL;

    if ('code' in error) {
      if (error.code === 'ENOTFOUND') {
        console.error(
          '\n💡 DNS resolution failed. Possible solutions:\n',
          '1. Verify the Supabase project still exists and the connection string is correct\n',
          '2. Try using the Transaction Pooler connection string (port 6543) instead:\n',
          '   Format: postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres\n',
          '3. Or use the IPv4 direct connection string from Supabase dashboard\n',
          '4. Check your network/firewall settings\n',
          `Current hostname: ${dbUrl?.match(/@([^:/]+)/)?.[1] || 'unknown'}\n`,
        );
      } else if (error.code === 'ECONNREFUSED') {
        console.error(
          '\n💡 Connection refused. Check:\n',
          '1. Database is running and accessible\n',
          '2. Connection string is correct\n',
          '3. SSL configuration is correct (Supabase requires SSL)\n',
        );
      }
    }

    console.error('Error details:', error.message);
    if (error.cause) {
      console.error('Caused by:', error.cause);
    }
  }

  throw error;
} finally {
  await db.$client.end();
}
