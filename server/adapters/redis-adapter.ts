import { createClient } from 'redis';
import type { RedisClientType } from 'redis';

/**
 * Redis adapter for Upstash/Redis database
 * Provides a Redis interface for AI chat memory and session management
 */
export class RedisAdapter {
  private client: RedisClientType;
  private connected: boolean = false;

  constructor() {
    if (!process.env.REDIS_URL) {
      throw new Error('REDIS_URL environment variable is required');
    }

    this.client = createClient({
      url: process.env.REDIS_URL,
      socket: {
        reconnectStrategy: (retries) => Math.min(retries * 50, 500),
      },
    });

    this.client.on('error', (err) => {
      console.warn('Redis connection error (non-critical):', err);
      this.connected = false;
    });

    this.client.on('connect', () => {
      console.log('✅ Redis connected successfully');
      this.connected = true;
    });

    this.client.on('ready', () => {
      console.log('✅ Redis ready for commands');
      this.connected = true;
    });

    this.client.on('end', () => {
      console.log('📡 Redis connection ended');
      this.connected = false;
    });

    // Connect to Redis
    this.connect();
  }

  private async connect(): Promise<void> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
        this.connected = true;
      }
    } catch (error) {
      console.warn('Failed to connect to Redis:', error);
      this.connected = false;
    }
  }

  private async ensureConnection(): Promise<void> {
    if (!this.connected || !this.client.isOpen) {
      await this.connect();
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      await this.ensureConnection();
      const value = await this.client.get(key);
      return value;
    } catch (error) {
      console.warn('Redis get error (non-critical):', error);
      return null;
    }
  }

  async set(key: string, value: string, mode?: string, duration?: number): Promise<string> {
    try {
      await this.ensureConnection();
      
      if (mode === 'EX' && duration) {
        await this.client.setEx(key, duration, value);
      } else {
        await this.client.set(key, value);
      }
      
      return 'OK';
    } catch (error) {
      console.warn('Redis set error (non-critical):', error);
      return 'OK';
    }
  }

  async setex(key: string, seconds: number, value: string): Promise<string> {
    try {
      await this.ensureConnection();
      await this.client.setEx(key, seconds, value);
      return 'OK';
    } catch (error) {
      console.warn('Redis setex error (non-critical):', error);
      return 'OK';
    }
  }

  async del(key: string): Promise<number> {
    try {
      await this.ensureConnection();
      const result = await this.client.del(key);
      return result;
    } catch (error) {
      console.warn('Redis delete error (non-critical):', error);
      return 0;
    }
  }

  async keys(pattern: string): Promise<string[]> {
    try {
      await this.ensureConnection();
      const keys = await this.client.keys(pattern);
      return keys;
    } catch (error) {
      console.warn('Redis keys error (non-critical):', error);
      return [];
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.ensureConnection();
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.warn('Redis exists error (non-critical):', error);
      return false;
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      await this.ensureConnection();
      const result = await this.client.ttl(key);
      return result;
    } catch (error) {
      console.warn('Redis TTL error (non-critical):', error);
      return -1;
    }
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    try {
      await this.ensureConnection();
      const result = await this.client.expire(key, seconds);
      return result === 1;
    } catch (error) {
      console.warn('Redis expire error (non-critical):', error);
      return false;
    }
  }

  // Helper method for cleanup (Redis handles TTL automatically)
  async cleanExpired(): Promise<void> {
    // Redis automatically handles expired keys, so this is a no-op
    // We keep it for compatibility with existing code
  }

  // Graceful shutdown
  async disconnect(): Promise<void> {
    try {
      if (this.client.isOpen) {
        await this.client.disconnect();
        this.connected = false;
        console.log('🔌 Redis connection closed gracefully');
      }
    } catch (error) {
      console.warn('Error disconnecting from Redis:', error);
    }
  }
}

// Singleton instance
export const redisAdapter = new RedisAdapter();

// Type for Redis-compatible interface
export type RedisCompatible = RedisAdapter;