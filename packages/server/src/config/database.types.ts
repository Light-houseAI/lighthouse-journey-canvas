/**
 * Database Configuration Types and Interfaces
 * 
 * Defines configuration structure for PostgreSQL with unique database names
 * to enable parallel testing isolation.
 */

export interface DatabaseConfig {
  connectionString: string;
  schemaName: string;
  type: 'postgresql' | 'testing';
  ssl?: boolean;
  pgPoolOptions?: {
    max?: number;
    idleTimeoutMillis?: number;
    connectionTimeoutMillis?: number;
  };
}

export interface TestingConfig extends DatabaseConfig {
  type: 'testing';
  testDatabaseName: string;
  testId: string;
}

export interface PostgresConfig extends DatabaseConfig {
  type: 'postgresql';
  ssl?: boolean;
  pgPoolOptions: {
    max?: number;
    idleTimeoutMillis?: number;
    connectionTimeoutMillis?: number;
  };
}

export type DatabaseEnvironment = 'production' | 'test' | 'development';

export interface DatabaseFactoryOptions {
  environment?: DatabaseEnvironment;
  testId?: string;
  connectionString?: string;
  schemaName?: string;
}