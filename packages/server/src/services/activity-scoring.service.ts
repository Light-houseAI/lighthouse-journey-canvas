import type { Database } from '../types/database.js';
import { eq, and, desc, sql } from 'drizzle-orm';
import { updates, nodeInsights, timelineNodes } from '@journey/schema';
import type { LLMSkillExtractionService } from './llm-skill-extraction.service.js';

export interface ActivityScore {
  score: number;
  activeJobSearch: boolean;
  interviewActivity: boolean;
  recentOffers: boolean;
  recentApplications: boolean;
  signals: string[];
  recentActivityCount: number;
  isActiveSeeker: boolean;
}

export interface InsightRelevance {
  score: number;
  relevantInsights: Array<{
    id: string;
    description: string;
    relevanceScore: number;
  }>;
}

export class ActivityScoringService {
  constructor(
    private db: Database,
    private llmService?: LLMSkillExtractionService
  ) {}

  /**
   * Calculate activity score based on job search signals from updates
   */
  async getActivityScore(userId: number): Promise<ActivityScore> {
    // Get recent updates (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentUpdates = await this.db
      .select({
        id: updates.id,
        meta: updates.meta,
        createdAt: updates.createdAt,
      })
      .from(updates)
      .innerJoin(timelineNodes, eq(updates.nodeId, timelineNodes.id))
      .where(
        and(
          eq(timelineNodes.userId, userId),
          sql`${updates.createdAt} > ${thirtyDaysAgo}`
        )
      )
      .orderBy(desc(updates.createdAt))
      .limit(10);

    let score = 0;
    const signals: string[] = [];
    let activeJobSearch = false;
    let interviewActivity = false;
    let recentOffers = false;
    let recentApplications = false;

    // Analyze updates for job search activity
    for (const update of recentUpdates) {
      const meta = update.meta as any || {};

      // Check for job application activity (30% weight)
      if (meta.appliedToJobs) {
        score += 0.3;
        signals.push('Recent job applications');
        activeJobSearch = true;
        recentApplications = true;
      }

      // Check for interview activity (25% weight)
      if (meta.pendingInterviews || meta.hadInterviews) {
        score += 0.25;
        signals.push('Interview activity');
        interviewActivity = true;
        activeJobSearch = true;
      }

      // Check for offers (20% weight)
      if (meta.receivedOffers) {
        score += 0.2;
        signals.push('Recent offers');
        recentOffers = true;
        activeJobSearch = true;
      }

      // Check for rejections (shows active search) (10% weight)
      if (meta.receivedRejections) {
        score += 0.1;
        signals.push('Active job search');
        activeJobSearch = true;
      }

      // Check for profile updates (15% weight)
      if (meta.updatedProfile || meta.updatedResume) {
        score += 0.15;
        signals.push('Profile/resume updates');
      }
    }

    // Cap score at 1.0
    score = Math.min(score, 1.0);

    // Boost score if multiple signals present
    if (signals.length >= 3) {
      score = Math.min(score * 1.2, 1.0);
    }

    return {
      score,
      activeJobSearch,
      interviewActivity,
      recentOffers,
      recentApplications,
      signals,
      recentActivityCount: recentUpdates.length,
      isActiveSeeker: activeJobSearch || interviewActivity,
    };
  }

  /**
   * Calculate insight relevance score using LLM
   */
  async getInsightRelevance(
    queryNodeId: string,
    candidateUserId: number
  ): Promise<InsightRelevance> {
    // Get the query node
    const queryNode = await this.db
      .select()
      .from(timelineNodes)
      .where(eq(timelineNodes.id, queryNodeId))
      .limit(1);

    if (!queryNode || queryNode.length === 0) {
      return { score: 0, relevantInsights: [] };
    }

    // Get candidate's insights
    const candidateInsights = await this.db
      .select()
      .from(nodeInsights)
      .innerJoin(timelineNodes, eq(nodeInsights.nodeId, timelineNodes.id))
      .where(eq(timelineNodes.userId, candidateUserId))
      .limit(10);

    if (candidateInsights.length === 0) {
      return { score: 0, relevantInsights: [] };
    }

    const relevantInsights: Array<{
      id: string;
      description: string;
      relevanceScore: number;
    }> = [];

    let totalRelevance = 0;

    // If we have LLM service, use it for relevance scoring
    if (this.llmService) {
      const queryMeta = queryNode[0].meta as any;
      const queryTitle = queryMeta?.role || queryMeta?.school || queryMeta?.title || queryNode[0].type;
      const queryDesc = queryMeta?.description || queryMeta?.summary || '';
      const queryContext = `${queryTitle} ${queryDesc}`;

      for (const insight of candidateInsights) {
        const insightText = insight.node_insights?.description || '';

        // Use LLM to calculate semantic relevance (in real implementation)
        // For now, use simple keyword matching as fallback
        const relevanceScore = await this.calculateSemanticRelevance(
          queryContext,
          insightText
        );

        if (relevanceScore > 0.3) {
          relevantInsights.push({
            id: insight.node_insights?.id || '',
            description: insightText.substring(0, 200),
            relevanceScore,
          });
          totalRelevance += relevanceScore;
        }
      }
    } else {
      // Fallback: Simple keyword matching
      const queryKeywords = this.extractKeywords(queryContext);

      for (const insight of candidateInsights) {
        const insightText = insight.node_insights?.description || '';
        const insightKeywords = this.extractKeywords(insightText);

        const relevanceScore = this.calculateKeywordOverlap(
          queryKeywords,
          insightKeywords
        );

        if (relevanceScore > 0.2) {
          relevantInsights.push({
            id: insight.node_insights?.id || '',
            description: insightText.substring(0, 200),
            relevanceScore,
          });
          totalRelevance += relevanceScore;
        }
      }
    }

    // Sort by relevance
    relevantInsights.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Calculate final score (average of top 3 relevant insights)
    const topInsights = relevantInsights.slice(0, 3);
    const avgScore = topInsights.length > 0
      ? topInsights.reduce((sum, i) => sum + i.relevanceScore, 0) / topInsights.length
      : 0;

    return {
      score: avgScore,
      relevantInsights: topInsights,
    };
  }

  /**
   * Calculate semantic relevance using LLM (placeholder for now)
   */
  private async calculateSemanticRelevance(
    queryContext: string,
    insightText: string
  ): Promise<number> {
    // In real implementation, this would use LLM to calculate relevance
    // For now, use simple keyword matching
    const queryKeywords = this.extractKeywords(queryContext);
    const insightKeywords = this.extractKeywords(insightText);
    return this.calculateKeywordOverlap(queryKeywords, insightKeywords);
  }

  /**
   * Extract keywords from text
   */
  private extractKeywords(text: string): Set<string> {
    const stopWords = new Set([
      'the', 'is', 'at', 'which', 'on', 'a', 'an', 'as', 'are', 'was',
      'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did',
      'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can',
      'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it',
      'we', 'they', 'what', 'where', 'when', 'how', 'why', 'all', 'each',
      'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such',
      'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'for',
      'with', 'about', 'against', 'between', 'into', 'through', 'during',
      'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down',
      'in', 'out', 'off', 'over', 'under', 'again', 'further', 'then',
      'once', 'and', 'but', 'if', 'or', 'because', 'until', 'while', 'of',
    ]);

    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));

    return new Set(words);
  }

  /**
   * Calculate keyword overlap between two sets
   */
  private calculateKeywordOverlap(set1: Set<string>, set2: Set<string>): number {
    if (set1.size === 0 || set2.size === 0) return 0;

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }

  /**
   * Get activity signals for a user
   */
  async getActivitySignals(userId: number): Promise<string[]> {
    const activityScore = await this.getActivityScore(userId);
    return activityScore.signals;
  }

  /**
   * Check if user is actively job searching
   */
  async isActiveJobSeeker(userId: number): Promise<boolean> {
    const activityScore = await this.getActivityScore(userId);
    return activityScore.activeJobSearch;
  }
}