#!/usr/bin/env tsx

import { PgVector } from '@mastra/pg';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env' });

async function initializeVectorDatabase() {
  console.log('🚀 Initializing vector database...');

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  try {
    const vectorStore = new PgVector({
      connectionString: process.env.DATABASE_URL,
      schemaName: 'mastra_ai',
      pgPoolOptions: {
        max: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      },
    });

    console.log('📦 Creating user_entities index...');
    
    // Create the main index for all user entities
    await vectorStore.createIndex({
      indexName: 'user_entities',
      dimension: 1536, // OpenAI text-embedding-3-small dimension
      metric: 'cosine'
    });

    console.log('✅ Vector database initialized successfully!');
    console.log('📋 Created index: user_entities (dimension: 1536, metric: cosine)');
    
    await vectorStore.disconnect();
    process.exit(0);

  } catch (error) {
    console.error('❌ Failed to initialize vector database:', error);
    
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      
      // Check for common issues
      if (error.message.includes('does not exist')) {
        console.log('\n💡 Tip: Make sure the PostgreSQL database exists and the pgvector extension is installed.');
        console.log('   Run: CREATE EXTENSION IF NOT EXISTS vector;');
      }
      
      if (error.message.includes('permission denied')) {
        console.log('\n💡 Tip: Make sure the database user has sufficient permissions.');
      }
      
      if (error.message.includes('connection')) {
        console.log('\n💡 Tip: Check your DATABASE_URL and ensure PostgreSQL is running.');
      }
    }
    
    process.exit(1);
  }
}

// Run the initialization
if (require.main === module) {
  initializeVectorDatabase();
}

export { initializeVectorDatabase };