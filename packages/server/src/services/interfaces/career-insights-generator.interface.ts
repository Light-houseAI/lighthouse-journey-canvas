import { ApplicationStatus } from '@journey/schema';

/**
 * Request for generating career insights for a matched candidate
 * LIG-207: Career Transition Insights
 */
export interface CandidateInsightRequest {
  candidateUserId: number;
  candidateName: string;
  jobApplicationNodeId: string;
  currentStatus: ApplicationStatus;
  targetRole?: string;
  targetCompany?: string;
}

/**
 * Career insight returned for a matched candidate
 * Provides actionable information about what the candidate did during their job search
 */
export interface CareerInsight {
  text: string; // "Practiced system design for 3 weeks before onsite"
  relevance: 'high' | 'medium';
  category: 'transition' | 'skill-building' | 'networking' | 'preparation';
}

/**
 * Service interface for generating LLM-enhanced career insights
 * from candidate update history
 */
export interface ICareerInsightsGenerator {
  /**
   * Generate actionable insights from a matched candidate's update history
   *
   * @param request - Details about the candidate and target position
   * @returns Array of career insights (2-3 items)
   */
  generateInsights(request: CandidateInsightRequest): Promise<CareerInsight[]>;
}
