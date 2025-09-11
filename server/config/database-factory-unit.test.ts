/**
 * Database Factory Unit Tests
 * 
 * Pure unit tests for database factory without dependencies on agents or setup
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseFactory } from './database-factory';

// Override setup files for these unit tests
vi.mock('../setup/parallel-setup.js', () => ({}));

describe('Database Factory Unit Tests', () => {
  let originalEnv: Record<string, string | undefined>;

  beforeEach(() => {
    // Store original environment
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore original environment
    Object.keys(process.env).forEach(key => {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    });
    Object.assign(process.env, originalEnv);
  });

  test('creates PostgreSQL config for production', async () => {
    // Mock environment
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    
    const config = await DatabaseFactory.createConfig({ 
      environment: 'production' 
    });
    
    expect(config.type).toBe('postgresql');
    expect(config.connectionString).toBe('postgresql://test:test@localhost:5432/test');
    expect(config.schemaName).toBe('mastra_ai');
    expect((config as any).ssl).toBe(false); // Not production NODE_ENV
    expect(config.pgPoolOptions).toEqual({
      max: 10,
      idleTimeoutMillis: 60000,
      connectionTimeoutMillis: 10000,
    });
  });

  test('creates PGlite config for testing', async () => {
    const config = await DatabaseFactory.createConfig({ 
      environment: 'test',
      testId: 'test_123'
    });
    
    expect(config.type).toBe('pglite');
    expect(config.connectionString).toContain('pglite://memory/test_123');
    expect(config.schemaName).toBe('mastra_ai');
    expect((config as any).inMemory).toBe(true);
    expect((config as any).extensions?.vector).toBe(true);
    expect(config.pgPoolOptions).toEqual({
      max: 1,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  });

  test('detects test environment correctly', () => {
    const originalEnv = process.env.NODE_ENV;
    
    // Test with NODE_ENV=test
    process.env.NODE_ENV = 'test';
    expect(DatabaseFactory.isTestEnvironment()).toBe(true);
    expect(DatabaseFactory.isProductionEnvironment()).toBe(false);
    
    // Test with production
    process.env.NODE_ENV = 'production';
    expect(DatabaseFactory.isTestEnvironment()).toBe(false);
    expect(DatabaseFactory.isProductionEnvironment()).toBe(true);
    
    // Test with VITEST environment variable
    process.env.NODE_ENV = 'development';
    process.env.VITEST = 'true';
    expect(DatabaseFactory.isTestEnvironment()).toBe(true);
    
    // Clean up
    delete process.env.VITEST;
    
    // Restore original environment
    process.env.NODE_ENV = originalEnv;
  });

  test('creates unique test configs', async () => {
    const config1 = await DatabaseFactory.createConfig({ 
      environment: 'test',
      testId: 'test_1'
    });
    
    const config2 = await DatabaseFactory.createConfig({ 
      environment: 'test',
      testId: 'test_2'
    });
    
    expect(config1.connectionString).not.toBe(config2.connectionString);
    expect(config1.connectionString).toContain('test_1');
    expect(config2.connectionString).toContain('test_2');
  });

  test('generates unique test IDs when not provided', async () => {
    const config1 = await DatabaseFactory.createConfig({ 
      environment: 'test'
    });
    
    const config2 = await DatabaseFactory.createConfig({ 
      environment: 'test'
    });
    
    expect(config1.connectionString).not.toBe(config2.connectionString);
    expect(config1.connectionString).toMatch(/pglite:\/\/memory\/test_\d+_[a-z0-9]+/);
    expect(config2.connectionString).toMatch(/pglite:\/\/memory\/test_\d+_[a-z0-9]+/);
  });

  test('throws error when DATABASE_URL missing for production', async () => {
    delete process.env.DATABASE_URL;
    
    await expect(
      DatabaseFactory.createConfig({ environment: 'production' })
    ).rejects.toThrow('DATABASE_URL must be set for production environment');
  });

  test('uses custom schema name when provided', async () => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    
    const config = await DatabaseFactory.createConfig({ 
      environment: 'production',
      schemaName: 'custom_schema'
    });
    
    expect(config.schemaName).toBe('custom_schema');
  });

  test('uses custom connection string when provided', async () => {
    const customConnectionString = 'postgresql://custom:custom@localhost:5432/custom';
    
    const config = await DatabaseFactory.createConfig({ 
      environment: 'production',
      connectionString: customConnectionString
    });
    
    expect(config.connectionString).toBe(customConnectionString);
  });
});