// ============================================================================
// EXPERIENCE MATCHES TYPES
// ============================================================================

export interface ExperienceMatch {
  id: string;
  userId: number;
  userName: string;
  firstName: string;
  lastName: string;
  matchScore: number;
  matchedExperiences: Array<{
    nodeId: string;
    title: string;
    organization: string | null;
    dateRange: string;
    matchScore: number;
  }>;
}

// ============================================================================
// GET EXPERIENCE MATCHES ENDPOINT
// ============================================================================

export interface ExperienceMatchesSuccessResponse {
  success: true;
  data: {
    nodeId: string;
    matches: ExperienceMatch[];
    count: number;
    timestamp: string;
  };
}
