// Mock implementation of ProfileVectorManager for testing when vector DB is unavailable

export class ProfileVectorManagerMock {
  async storeMilestone(userId: string, milestone: any) {
    console.log(`Mock: Storing milestone for user ${userId}:`, milestone.title);
    return Promise.resolve();
  }

  async storeExperience(userId: string, experience: any) {
    console.log(`Mock: Storing experience for user ${userId}:`, experience.title);
    return Promise.resolve();
  }

  async storeEducation(userId: string, education: any) {
    console.log(`Mock: Storing education for user ${userId}:`, education.school);
    return Promise.resolve();
  }

  async storeConversation(userId: string, conversation: any) {
    console.log(`Mock: Storing conversation for user ${userId}`);
    return Promise.resolve();
  }

  async searchProfileHistory(userId: string, query: string, options: any = {}) {
    console.log(`Mock: Searching profile history for user ${userId} with query: "${query}"`);
    // Return empty results for mock
    return Promise.resolve([]);
  }

  async importProfileData(userId: string, profileData: any) {
    console.log(`Mock: Importing profile data for user ${userId}`);
    return Promise.resolve();
  }
}

export const profileVectorManagerMock = new ProfileVectorManagerMock();