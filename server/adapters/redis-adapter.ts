import Database from '@replit/database';

/**
 * Redis-compatible adapter for Replit Database
 * Provides a Redis-like interface for existing code that expects Redis methods
 */
export class RedisAdapter {
  private db: Database;

  constructor() {
    this.db = new Database();
  }

  async get(key: string): Promise<string | null> {
    try {
      let value = await this.db.get(key);
      
      if (!value) return null;
      
      // Unwrap nested Replit Database response structure
      // Replit Database sometimes wraps responses in {ok: true, value: ...} 
      while (value && typeof value === 'object' && 'ok' in value && 'value' in value) {
        value = value.value;
      }
      
      if (!value) return null;
      
      // If the final value is an object, stringify it
      if (typeof value === 'object') {
        return JSON.stringify(value);
      }
      
      return String(value);
    } catch (error) {
      console.warn('Database get error (non-critical):', error);
      return null;
    }
  }

  async set(key: string, value: string, mode?: string, duration?: number): Promise<string> {
    try {
      // Try to parse as JSON to store as object if possible (more efficient for Replit DB)
      let parsedValue: any;
      try {
        parsedValue = JSON.parse(value);
      } catch {
        // If not JSON, store as string
        parsedValue = value;
      }
      
      await this.db.set(key, parsedValue);
      // Replit Database doesn't support TTL, but we can simulate with timestamps
      if (mode === 'EX' && duration) {
        await this.db.set(`${key}:ttl`, Date.now() + (duration * 1000));
      }
      return 'OK';
    } catch (error) {
      console.warn('Database set error (non-critical):', error);
      return 'OK';
    }
  }

  async setex(key: string, seconds: number, value: string): Promise<string> {
    return this.set(key, value, 'EX', seconds);
  }

  async del(key: string): Promise<number> {
    try {
      await this.db.delete(key);
      await this.db.delete(`${key}:ttl`);
      return 1;
    } catch (error) {
      console.warn('Database delete error (non-critical):', error);
      return 0;
    }
  }

  async keys(pattern: string): Promise<string[]> {
    try {
      const result = await this.db.list();
      const allKeys = Array.isArray(result) ? result : [];
      // Simple pattern matching for basic cases
      if (pattern === '*') return allKeys;
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return allKeys.filter((key: string) => regex.test(key));
    } catch (error) {
      console.warn('Database keys error (non-critical):', error);
      return [];
    }
  }

  // Helper method to check if a key has expired (for TTL simulation)
  async isExpired(key: string): Promise<boolean> {
    try {
      const ttl = await this.db.get(`${key}:ttl`);
      if (!ttl) return false;
      return Date.now() > Number(ttl);
    } catch (error) {
      return false;
    }
  }

  // Helper method to clean up expired keys
  async cleanExpired(): Promise<void> {
    try {
      const allKeys = await this.keys('*:ttl');
      for (const ttlKey of allKeys) {
        const key = ttlKey.replace(':ttl', '');
        if (await this.isExpired(key)) {
          await this.del(key);
        }
      }
    } catch (error) {
      console.warn('Database cleanup error (non-critical):', error);
    }
  }
}

// Singleton instance
export const redisAdapter = new RedisAdapter();

// Type for Redis-compatible interface
export type RedisCompatible = RedisAdapter;