import { defineConfig } from 'drizzle-kit';

// Use TEST_DATABASE_URL for tests, DATABASE_URL for production/development
const databaseUrl =
  process.env.NODE_ENV === 'test'
    ? process.env.TEST_DATABASE_URL
    : process.env.DATABASE_URL;

if (!databaseUrl) {
  const requiredVar =
    process.env.NODE_ENV === 'test' ? 'TEST_DATABASE_URL' : 'DATABASE_URL';
  throw new Error(
    `${requiredVar} is required. Ensure the database is provisioned.`
  );
}

export default defineConfig({
  out: './migrations',
  schema: './src/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
  migrations: {
    prefix: 'timestamp', // Options: 'timestamp', 'supabase', 'index', 'unix', 'none'
    table: '__drizzle_migrations',
    schema: 'public',
  },
});
