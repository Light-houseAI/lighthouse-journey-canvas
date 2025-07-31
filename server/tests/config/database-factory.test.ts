/**
 * Database Factory Tests
 * 
 * Tests for the database factory and configuration system
 * These tests do not create actual database connections, just configuration
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseFactory } from '../../config/database-factory.js';

describe('Database Factory', () => {
  let originalEnv: any;

  beforeEach(() => {
    // Store original environment
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
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
  });

  test('detects test environment correctly', () => {
    const originalEnv = process.env.NODE_ENV;
    
    // Test with NODE_ENV=test
    process.env.NODE_ENV = 'test';
    expect(DatabaseFactory.isTestEnvironment()).toBe(true);
    
    // Test with production
    process.env.NODE_ENV = 'production';
    expect(DatabaseFactory.isTestEnvironment()).toBe(false);
    expect(DatabaseFactory.isProductionEnvironment()).toBe(true);
    
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
});