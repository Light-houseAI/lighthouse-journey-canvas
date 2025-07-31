/**
 * Database Factory
 * 
 * Creates database configurations based on environment settings.
 * Uses different database names on the same PostgreSQL instance for parallel testing.
 */

import {
  DatabaseConfig,
  TestingConfig,
  PostgresConfig,
  DatabaseFactoryOptions,
  DatabaseEnvironment,
} from './database-config.js';
import { TestDatabaseCreator } from './test-database-creator.js';

export class DatabaseFactory {
  /**
   * Create database configuration based on environment
   */
  static async createConfig(options: DatabaseFactoryOptions = {}): Promise<DatabaseConfig> {
    const environment = options.environment || DatabaseFactory.detectEnvironment();
    
    switch (environment) {
      case 'production':
        return DatabaseFactory.createProductionConfig(options);
      
      case 'test':
        return DatabaseFactory.createTestConfig(options);
      
      case 'development':
        // Use PostgreSQL for development by default, but allow test override
        if (process.env.USE_TEST_DB === 'true') {
          return DatabaseFactory.createTestConfig(options);
        }
        return DatabaseFactory.createProductionConfig(options);
      
      default:
        throw new Error(`Unknown database environment: ${environment}`);
    }
  }

  /**
   * Create PostgreSQL configuration for production/development
   */
  private static createProductionConfig(options: DatabaseFactoryOptions): PostgresConfig {
    const connectionString = options.connectionString || process.env.DATABASE_URL;
    
    if (!connectionString) {
      throw new Error('DATABASE_URL must be set for production environment');
    }

    return {
      type: 'postgresql',
      connectionString,
      schemaName: options.schemaName || 'mastra_ai',
      ssl: process.env.NODE_ENV === 'production',
      pgPoolOptions: {
        max: 10,
        idleTimeoutMillis: 60000,
        connectionTimeoutMillis: 10000,
      },
    };
  }

  /**
   * Create testing configuration using local Docker PostgreSQL container with database copying
   */
  private static async createTestConfig(options: DatabaseFactoryOptions): Promise<TestingConfig> {
    // Generate unique test ID for database isolation
    const testId = options.testId || `test_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    // Use local Docker PostgreSQL container for testing
    const localTestConnectionString = process.env.TEST_DATABASE_URL || 'postgresql://test_user:test_password@localhost:5433/lighthouse_test';
    
    // Parse the connection string and create a unique database name
    const url = new URL(localTestConnectionString);
    const testDatabaseName = `test_${testId}`;
    
    // Create a new database by copying from the template
    await TestDatabaseCreator.createTestDatabaseFromTemplate(testDatabaseName);
    
    // Update connection string to use the new database
    url.pathname = `/${testDatabaseName}`;
    
    return {
      type: 'testing',
      connectionString: url.toString(),
      schemaName: 'mastra_ai',
      testDatabaseName,
      testId,
      pgPoolOptions: {
        max: 5, // Allow multiple connections for testing
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 5000,
      },
    };
  }

  /**
   * Detect current environment from NODE_ENV and context
   */
  private static detectEnvironment(): DatabaseEnvironment {
    // Explicit NODE_ENV takes precedence
    if (process.env.NODE_ENV === 'production') {
      return 'production';
    }
    
    if (process.env.NODE_ENV === 'test') {
      return 'test';
    }
    
    // Check if running in test context (vitest, jest, etc.)
    if (process.env.VITEST === 'true' || 
        process.argv.some(arg => arg.includes('vitest')) ||
        process.argv.some(arg => arg.includes('test'))) {
      return 'test';
    }

    // Default to development
    return 'development';
  }

  /**
   * Check if current environment is test
   */
  static isTestEnvironment(): boolean {
    return DatabaseFactory.detectEnvironment() === 'test';
  }

  /**
   * Check if current environment is production
   */
  static isProductionEnvironment(): boolean {
    return DatabaseFactory.detectEnvironment() === 'production';
  }
}