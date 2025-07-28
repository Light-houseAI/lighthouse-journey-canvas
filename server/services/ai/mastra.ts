import { Mastra } from '@mastra/core';
import { LibSQLStore } from '@mastra/libsql';
import { careerJourneyWorkflow } from './career-workflow';

// Initialize LibSQL storage for workflow persistence
// LibSQL auto-initializes schema and handles migrations
const libSQLStore = new LibSQLStore({
  url: 'file:mastra-workflows.db',
});

// Initialize Mastra instance with LibSQL storage and workflows
export const mastra = new Mastra({
  workflows: {
    'career-journey-workflow': careerJourneyWorkflow,
  },
  storage: libSQLStore,
});

// Export workflow getter for easier access
export function getCareerWorkflow() {
  return mastra.getWorkflow('career-journey-workflow');
}
