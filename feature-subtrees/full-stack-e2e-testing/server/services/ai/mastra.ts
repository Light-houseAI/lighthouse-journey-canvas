import { Mastra } from '@mastra/core';
import { LibSQLStore } from '@mastra/libsql';

// Initialize LibSQL storage for workflow persistence
// LibSQL auto-initializes schema and handles migrations
const libSQLStore = new LibSQLStore({
  url: 'file:mastra-workflows.db',
});

// Initialize Mastra instance with LibSQL storage - workflows deprecated in favor of simplified agent
export const mastra = new Mastra({
  workflows: {
    // No workflows - using simplified career agent instead
  },
  storage: libSQLStore,
});

// Legacy function - deprecated in favor of simplified career agent
export function getCareerWorkflow() {
  throw new Error('Career workflow has been deprecated. Use processCareerConversation from simplified-career-agent.ts instead.');
}
