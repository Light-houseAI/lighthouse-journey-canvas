// ============================================================================
// GRAPHRAG PROFILE SEARCH TYPES
// ============================================================================

export interface ProfileSearchResult {
  userId: number;
  userName: string;
  firstName: string;
  lastName: string;
  email: string;
  similarityScore: number;
  matchedExperiences: Array<{
    title: string;
    organization: string | null;
    type: string;
  }>;
}

// ============================================================================
// SEARCH PROFILES ENDPOINT
// ============================================================================

export interface SearchProfilesSuccessResponse {
  success: true;
  data: {
    query: string;
    totalResults: number;
    profiles: ProfileSearchResult[];
    timestamp: string;
  };
}

// ============================================================================
// GET STATS ENDPOINT
// ============================================================================

export interface GetStatsSuccessResponse {
  success: true;
  data: {
    totalProfiles: number;
    totalEmbeddings: number;
    lastUpdated: string;
    averageVectorDimensions: number;
  };
}
