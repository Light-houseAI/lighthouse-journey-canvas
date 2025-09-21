#!/usr/bin/env tsx
/**
 * Database Seeding Script
 * Usage: npm run db:seed or npx tsx server/scripts/seed-database.ts
 */

import { createDatabaseConnection } from '../config/database.connection.js';
import { DatabaseSeeder } from '../config/database-seeder.js';
import type { Logger } from '../core/logger.js';

const logger: Logger = {
  debug: console.log,
  info: console.log,
  warn: console.warn,
  error: console.error,
};

async function main() {
  try {
    logger.info('🌱 Starting database seeding script...');

    // Get database connection
    const database = await createDatabaseConnection();

    // Create seeder instance
    const seeder = new DatabaseSeeder(database);

    // Parse command line arguments
    const args = process.argv.slice(2);
    const command = args[0] || 'seed';

    switch (command) {
      case 'seed':
        await seeder.seedDatabase({
          includeTestUsers: true,
          includeTestOrganizations: true,
          includeTestTimelines: true,
          userCount: parseInt(args[1]) || 3,
        });
        break;

      case 'minimal':
        await seeder.seedMinimalData();
        break;

      case 'clear':
        await seeder.clearTestData();
        break;

      case 'users':
        await seeder.seedDatabase({
          includeTestUsers: true,
          includeTestOrganizations: false,
          includeTestTimelines: false,
          userCount: parseInt(args[1]) || 5,
        });
        break;

      default:
        logger.error(`Unknown command: ${command}`);
        logger.info('Available commands:');
        logger.info('  seed [count]  - Seed full test data (default: 3 users)');
        logger.info('  minimal       - Seed minimal test user only');
        logger.info('  users [count] - Seed only test users (default: 5)');
        logger.info('  clear         - Clear all test data');
        process.exit(1);
    }

    logger.info('🎉 Database seeding completed successfully');

    // Close database connection
    const pool = (database as any).__pool;
    if (pool) await pool.end();

    process.exit(0);
  } catch (error) {
    logger.error('❌ Database seeding failed:', error);
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

main();
