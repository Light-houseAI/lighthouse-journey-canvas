// TODO: This adapter is currently disabled as Mastra handles its own storage
import { nanoid } from 'nanoid';

// Custom storage adapter that maps to our database tables  
export class StorageAdapter {
  // Define which storage features are supported
  public supports = {
    selectByIncludeResourceScope: true,
    selectByExcludeResourceScope: true,
    vectorSearch: true,
    workingMemory: true,
  };

  constructor() {}

  // Store a new message (stub - Mastra handles storage)
  async storeMessage(params: {
    id: string;
    resourceId: string;
    threadId: string;
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    metadata?: Record<string, any>;
  }) {
    // Mastra handles message storage
    return;
  }

  // Get messages for a conversation (stub)
  async getMessages(params: {
    resourceId: string;
    threadId: string;
    limit?: number;
    before?: string;
  }) {
    // Mastra handles message retrieval
    return [];
  }

  // Store conversation embedding (stub)
  async storeConversationEmbedding(params: {
    id: string;
    resourceId: string;
    threadId: string;
    content: string;
    embedding: number[];
    metadata?: Record<string, any>;
  }) {
    // Mastra handles embeddings
    return;
  }

  // Search similar conversations (stub)
  async searchSimilarConversations(params: {
    resourceId: string;
    embedding: number[];
    limit?: number;
    threshold?: number;
  }) {
    // Mastra handles vector search
    return [];
  }

  // Store working memory (stub)
  async storeWorkingMemory(params: {
    resourceId: string;
    threadId: string;
    key: string;
    value: any;
  }) {
    // Mastra handles working memory
    return;
  }

  // Get working memory (stub)
  async getWorkingMemory(params: {
    resourceId: string;
    threadId: string;
    key?: string;
  }) {
    // Mastra handles working memory
    return null;
  }

  // Update working memory (stub)
  async updateWorkingMemory(params: {
    resourceId: string;
    threadId: string;
    key: string;
    value: any;
  }) {
    // Mastra handles working memory
    return;
  }

  // Clear working memory (stub)
  async clearWorkingMemory(params: {
    resourceId: string;
    threadId: string;
    key?: string;
  }) {
    // Mastra handles working memory
    return;
  }
}