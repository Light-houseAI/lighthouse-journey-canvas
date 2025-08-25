// Import the simplified career agent
import { processCareerConversation, createSimplifiedCareerAgent } from './simplified-career-agent';

// Export the main processing function
export { processCareerConversation };

// Legacy function for backward compatibility with existing code
export async function createCareerAgent() {
  console.log('🔄 Using simplified career agent');
  
  // Return the actual simplified agent
  return await createSimplifiedCareerAgent();
}

// Legacy export for backward compatibility
export { processCareerConversation as executeCareerWorkflow };
