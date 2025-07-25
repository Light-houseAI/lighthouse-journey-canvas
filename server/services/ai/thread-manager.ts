import { nanoid } from 'nanoid';
import Database from '@replit/database';
import { ConversationSummarizer } from './conversation-summarizer';

// Thread rotation configuration
const THREAD_ROTATION_INTERVAL = 30 * 60 * 1000; // 30 minutes in milliseconds

export interface ThreadInfo {
  threadId: string;
  userId: string;
  startTime: number;
  messageCount: number;
  lastActivity: number;
  isActive: boolean;
}

export class ThreadManager {
  private redis: Redis;
  private summarizer: ConversationSummarizer;

  constructor(redis: Redis) {
    this.redis = redis;
    this.summarizer = new ConversationSummarizer();
  }

  // Get or create thread for user
  async getActiveThread(userId: string): Promise<string> {
    const threadKey = `active_thread:${userId}`;
    const threadData = await this.redis.get(threadKey);

    if (threadData) {
      const thread: ThreadInfo = JSON.parse(threadData);

      // Check if thread should be rotated
      if (this.shouldRotateThread(thread)) {
        // return await this.rotateThread(userId, thread);
        return await this.createNewThread(userId);
      }

      // Update last activity
      thread.lastActivity = Date.now();
      await this.redis.set(threadKey, JSON.stringify(thread));

      return thread.threadId;
    }

    // Create new thread
    return await this.createNewThread(userId);
  }

  // Create a new thread
  private async createNewThread(userId: string): Promise<string> {
    const threadId = `chat_${userId}_${nanoid()}`;
    const now = Date.now();

    const thread: ThreadInfo = {
      threadId,
      userId,
      startTime: now,
      messageCount: 0,
      lastActivity: now,
      isActive: true,
    };

    const threadKey = `active_thread:${userId}`;
    await this.redis.set(threadKey, JSON.stringify(thread));

    console.log(`🆕 Created new thread ${threadId} for user ${userId}`);
    return threadId;
  }

  // Check if thread should be rotated
  private shouldRotateThread(thread: ThreadInfo): boolean {
    const now = Date.now();
    const threadAge = now - thread.startTime;

    return threadAge >= THREAD_ROTATION_INTERVAL;
  }

  // Rotate thread (summarize old one and create new one)
  private async rotateThread(userId: string, oldThread: ThreadInfo): Promise<string> {
    try {
      console.log(`🔄 Rotating thread ${oldThread.threadId} for user ${userId}`);

      // 1. Summarize the old thread
      await this.summarizer.summarizeAndArchiveThread(oldThread.threadId, userId);

      // 2. Mark old thread as inactive
      oldThread.isActive = false;
      const oldThreadKey = `archived_thread:${oldThread.threadId}`;
      await this.redis.set(oldThreadKey, JSON.stringify(oldThread));

      // 3. Create new thread
      const newThreadId = await this.createNewThread(userId);

      console.log(`✅ Thread rotated: ${oldThread.threadId} → ${newThreadId}`);
      return newThreadId;

    } catch (error) {
      console.error(`❌ Failed to rotate thread for user ${userId}:`, error);
      // Return the old thread if rotation fails
      return oldThread.threadId;
    }
  }

  // Increment message count for thread
  async incrementMessageCount(userId: string): Promise<void> {
    const threadKey = `active_thread:${userId}`;
    const threadData = await this.redis.get(threadKey);

    if (threadData) {
      const thread: ThreadInfo = JSON.parse(threadData);
      thread.messageCount++;
      thread.lastActivity = Date.now();
      await this.redis.set(threadKey, JSON.stringify(thread));
    }
  }

  // Get thread statistics
  async getThreadStats(userId: string): Promise<ThreadInfo | null> {
    const threadKey = `active_thread:${userId}`;
    const threadData = await this.redis.get(threadKey);

    return threadData ? JSON.parse(threadData) : null;
  }

  // Force thread rotation (manual)
  async forceRotateThread(userId: string): Promise<string> {
    const threadKey = `active_thread:${userId}`;
    const threadData = await this.redis.get(threadKey);

    if (threadData) {
      const thread: ThreadInfo = JSON.parse(threadData);
      return await this.rotateThread(userId, thread);
    }

    return await this.createNewThread(userId);
  }

  // Get archived threads for user
  async getArchivedThreads(userId: string, limit: number = 10): Promise<ThreadInfo[]> {
    const pattern = `archived_thread:chat_${userId}_*`;
    const keys = await this.redis.keys(pattern);

    const threads = await Promise.all(
      keys.slice(0, limit).map(async (key) => {
        const data = await this.redis.get(key);
        return data ? JSON.parse(data) : null;
      })
    );

    return threads.filter(Boolean).sort((a, b) => b.startTime - a.startTime);
  }

  // Cleanup old archived threads (older than 30 days)
  async cleanupOldThreads(): Promise<void> {
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const pattern = 'archived_thread:*';
    const keys = await this.redis.keys(pattern);

    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        const thread: ThreadInfo = JSON.parse(data);
        if (thread.startTime < thirtyDaysAgo) {
          await this.redis.del(key);
          console.log(`🗑️ Cleaned up old thread: ${thread.threadId}`);
        }
      }
    }
  }
}

// Initialize Replit Database for thread manager  
const db = new Database();

// Create Redis-compatible adapter
const redis = {
  async get(key: string): Promise<string | null> {
    try {
      const value = await db.get(key);
      return value ? String(value) : null;
    } catch (error) {
      console.warn('Database get error (non-critical):', error);
      return null;
    }
  },
  
  async set(key: string, value: string, mode?: string, duration?: number): Promise<string> {
    try {
      await db.set(key, value);
      if (mode === 'EX' && duration) {
        await db.set(`${key}:ttl`, Date.now() + (duration * 1000));
      }
      return 'OK';
    } catch (error) {
      console.warn('Database set error (non-critical):', error);
      return 'OK';
    }
  },
  
  async setex(key: string, seconds: number, value: string): Promise<string> {
    return this.set(key, value, 'EX', seconds);
  },
  
  async del(key: string): Promise<number> {
    try {
      await db.delete(key);
      await db.delete(`${key}:ttl`);
      return 1;
    } catch (error) {
      console.warn('Database delete error (non-critical):', error);
      return 0;
    }
  },
  
  async keys(pattern: string): Promise<string[]> {
    try {
      const result = await db.list();
      const allKeys = Array.isArray(result) ? result : [];
      if (pattern === '*') return allKeys;
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return allKeys.filter((key: string) => regex.test(key));
    } catch (error) {
      console.warn('Database keys error (non-critical):', error);
      return [];
    }
  }
};

export const threadManager = new ThreadManager(redis);
