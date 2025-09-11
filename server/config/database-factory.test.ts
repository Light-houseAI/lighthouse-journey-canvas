/**
 * Database Factory Configuration Tests
 * 
 * Pure configuration tests without any database connections or agent creation
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseFactory } from './database-factory';

describe('Database Factory Configuration', () => {
  let originalEnv: Record<string, string | undefined>;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    Object.keys(process.env).forEach(key => {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    });
    Object.assign(process.env, originalEnv);
  });

  test('creates correct PostgreSQL config structure', async () => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    
    const config = await DatabaseFactory.createConfig({ 
      environment: 'production' 
    });
    
    expect(config).toMatchObject({
      type: 'postgresql',
      connectionString: 'postgresql://test:test@localhost:5432/test',
      schemaName: 'mastra_ai',
      ssl: false,
      pgPoolOptions: {
        max: 10,
        idleTimeoutMillis: 60000,
        connectionTimeoutMillis: 10000,
      }
    });
  });

  test('creates correct PGlite config structure', async () => {
    const config = await DatabaseFactory.createConfig({ 
      environment: 'test',
      testId: 'test_123'
    });
    
    expect(config.type).toBe('pglite');
    expect(config.connectionString).toBe('pglite://memory/test_123');
    expect(config).toMatchObject({
      type: 'pglite',
      schemaName: 'mastra_ai',
      inMemory: true,
      extensions: { vector: true },
      pgPoolOptions: {
        max: 1,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      }
    });
  });

  test('environment detection works correctly', () => {
    // Test NODE_ENV=test
    process.env.NODE_ENV = 'test';
    expect(DatabaseFactory.isTestEnvironment()).toBe(true);
    expect(DatabaseFactory.isProductionEnvironment()).toBe(false);
    
    // Test NODE_ENV=production  
    process.env.NODE_ENV = 'production';
    expect(DatabaseFactory.isTestEnvironment()).toBe(false);
    expect(DatabaseFactory.isProductionEnvironment()).toBe(true);
    
    // Test VITEST flag
    process.env.NODE_ENV = 'development';
    process.env.VITEST = 'true';
    expect(DatabaseFactory.isTestEnvironment()).toBe(true);
    
    delete process.env.VITEST;
    expect(DatabaseFactory.isTestEnvironment()).toBe(false);
  });

  test('creates unique test connection strings', async () => {
    const config1 = await DatabaseFactory.createConfig({ 
      environment: 'test',
      testId: 'unique_test_1'
    });
    
    const config2 = await DatabaseFactory.createConfig({ 
      environment: 'test',
      testId: 'unique_test_2'
    });
    
    expect(config1.connectionString).toBe('pglite://memory/unique_test_1');
    expect(config2.connectionString).toBe('pglite://memory/unique_test_2');
    expect(config1.connectionString).not.toBe(config2.connectionString);
  });

  test('auto-generates test IDs when not provided', async () => {
    const config1 = await DatabaseFactory.createConfig({ environment: 'test' });
    const config2 = await DatabaseFactory.createConfig({ environment: 'test' });
    
    expect(config1.connectionString).toMatch(/^pglite:\/\/memory\/test_\d+_[a-z0-9]+$/);
    expect(config2.connectionString).toMatch(/^pglite:\/\/memory\/test_\d+_[a-z0-9]+$/);
    expect(config1.connectionString).not.toBe(config2.connectionString);
  });

  test('throws error for production without DATABASE_URL', async () => {
    delete process.env.DATABASE_URL;
    
    await expect(
      DatabaseFactory.createConfig({ environment: 'production' })
    ).rejects.toThrow('DATABASE_URL must be set for production environment');
  });

  test('respects custom schema names', async () => {
    process.env.DATABASE_URL = 'postgresql://test@localhost/test';
    
    const config = await DatabaseFactory.createConfig({ 
      environment: 'production',
      schemaName: 'custom_schema_name'
    });
    
    expect(config.schemaName).toBe('custom_schema_name');
  });

  test('respects custom connection strings', async () => {
    const customUrl = 'postgresql://custom:secret@example.com:5432/mydb';
    
    const config = await DatabaseFactory.createConfig({ 
      environment: 'production',
      connectionString: customUrl
    });
    
    expect(config.connectionString).toBe(customUrl);
  });

  test('detects development with USE_TEST_DB override', async () => {
    process.env.NODE_ENV = 'development';
    process.env.USE_TEST_DB = 'true';
    
    const config = await DatabaseFactory.createConfig({ environment: 'development' });
    
    expect(config.type).toBe('pglite');
  });
});