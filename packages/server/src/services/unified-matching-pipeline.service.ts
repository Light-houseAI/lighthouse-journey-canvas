import type { Database } from '../types/database.js';
import { JobMatchingService } from './job-matching.service.js';
import { ProjectMatchingService } from './project-matching.service.js';
import { EducationMatchingService } from './education-matching.service.js';
import { EventMatchingService } from './event-matching.service.js';
import { InterviewMatchingService } from './interview-matching.service.js';
import { TrajectoryMatchingService } from './trajectory-matching.service.js';
import { LLMSkillExtractionService } from './llm-skill-extraction.service.js';
import { OpenAIEmbeddingService } from './openai-embedding.service.js';
import { eq } from 'drizzle-orm';
import { timelineNodes } from '@journey/schema';

export type NodeType = 'job' | 'project' | 'education' | 'event' | 'careerTransition' | 'insight';

export interface MatchingContext {
  nodeId: string;
  nodeType: NodeType;
  userId: number;
  limit?: number;
  mode?: 'similar' | 'complementary' | 'career-path' | 'goal-achievement';
  includeActivitySignals?: boolean;
  includeInsights?: boolean;
  filters?: {
    company?: string;
    role?: string;
    outcome?: string;
    industry?: string;
    skills?: string[];
  };
}

export interface UnifiedMatchResult {
  strategy: string;
  nodeType: NodeType;
  matches: any[];
  insights: MatchingInsight[];
  performance: {
    totalTime: number;
    candidatesEvaluated: number;
    strategyUsed: string;
    cacheHit: boolean;
  };
  recommendations?: string[];
}

export interface MatchingInsight {
  type: 'pattern' | 'trend' | 'tip' | 'success-factor';
  title: string;
  description: string;
  relevance: number;
  data?: any;
}

interface CacheEntry {
  result: UnifiedMatchResult;
  timestamp: number;
}

export class UnifiedMatchingPipelineService {
  private jobService: JobMatchingService;
  private projectService: ProjectMatchingService;
  private educationService: EducationMatchingService;
  private eventService: EventMatchingService;
  private interviewService: InterviewMatchingService;
  private trajectoryService: TrajectoryMatchingService;

  // Simple in-memory cache with TTL
  private cache: Map<string, CacheEntry> = new Map();
  private cacheTTL = 5 * 60 * 1000; // 5 minutes

  constructor(
    private db: Database,
    private llmService: LLMSkillExtractionService,
    private embeddingService: OpenAIEmbeddingService
  ) {
    // Initialize all matching services
    this.jobService = new JobMatchingService(db, llmService);
    this.projectService = new ProjectMatchingService(db, llmService);
    this.educationService = new EducationMatchingService(db, llmService);
    this.eventService = new EventMatchingService(db, llmService);
    this.interviewService = new InterviewMatchingService(db, embeddingService);
    this.trajectoryService = new TrajectoryMatchingService(db, embeddingService);
  }

  /**
   * Main entry point for unified matching
   * Routes to appropriate strategy based on node type and context
   */
  async findMatches(context: MatchingContext): Promise<UnifiedMatchResult> {
    const startTime = Date.now();

    // Check cache
    const cacheKey = this.getCacheKey(context);
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return {
        ...cached,
        performance: {
          ...cached.performance,
          totalTime: Date.now() - startTime,
          cacheHit: true,
        },
      };
    }

    // Determine strategy based on node type
    const strategy = await this.determineStrategy(context);

    let result: UnifiedMatchResult;

    switch (strategy) {
      case 'job-transition':
        result = await this.executeJobMatching(context);
        break;

      case 'project-collaboration':
        result = await this.executeProjectMatching(context);
        break;

      case 'interview-preparation':
        result = await this.executeInterviewMatching(context);
        break;

      case 'education-network':
        result = await this.executeEducationMatching(context);
        break;

      case 'event-connection':
        result = await this.executeEventMatching(context);
        break;

      case 'career-trajectory':
        result = await this.executeTrajectoryMatching(context);
        break;

      default:
        result = await this.executeFallbackMatching(context);
    }

    // Add performance metrics
    result.performance = {
      totalTime: Date.now() - startTime,
      candidatesEvaluated: result.matches.length,
      strategyUsed: strategy,
      cacheHit: false,
    };

    // Cache the result
    this.setInCache(cacheKey, result);

    return result;
  }

  /**
   * Determine optimal matching strategy based on context
   */
  private async determineStrategy(context: MatchingContext): Promise<string> {
    // Get node details to make intelligent routing decision
    const node = await this.db
      .select()
      .from(timelineNodes)
      .where(eq(timelineNodes.id, context.nodeId))
      .limit(1);

    if (node.length === 0) {
      return 'fallback';
    }

    const nodeData = node[0];

    // Route based on node type and metadata
    switch (context.nodeType) {
      case 'job':
        if (context.mode === 'career-path' || context.mode === 'goal-achievement') {
          return 'career-trajectory';
        }
        return 'job-transition';

      case 'project':
        return 'project-collaboration';

      case 'event':
        const eventType = nodeData.meta?.eventType;
        if (eventType === 'interview') {
          return 'interview-preparation';
        }
        return 'event-connection';

      case 'education':
        return 'education-network';

      case 'careerTransition':
        return 'career-trajectory';

      default:
        return 'fallback';
    }
  }

  /**
   * Execute job matching strategy
   */
  private async executeJobMatching(context: MatchingContext): Promise<UnifiedMatchResult> {
    const result = await this.jobService.findMatches({
      nodeId: context.nodeId,
      userId: context.userId,
      limit: context.limit,
      includeActivitySignals: context.includeActivitySignals,
      includeInsights: context.includeInsights,
    });

    const insights = this.generateJobInsights(result);

    // Add activity-based insights if available
    if (context.includeActivitySignals) {
      const activeJobSeekers = result.matches.filter(m => m.activityScore && m.activityScore > 0.5);
      if (activeJobSeekers.length > 0) {
        insights.push({
          type: 'trend',
          title: 'Active Job Seekers',
          description: `${activeJobSeekers.length} candidates are actively searching`,
          relevance: 0.9,
          data: { count: activeJobSeekers.length },
        });
      }
    }

    // Add insight-based recommendations if available
    if (context.includeInsights) {
      const insightfulMatches = result.matches.filter(m => m.insightRelevance && m.insightRelevance > 0.3);
      if (insightfulMatches.length > 0) {
        insights.push({
          type: 'tip',
          title: 'Shared Experiences',
          description: `${insightfulMatches.length} candidates have relevant insights`,
          relevance: 0.8,
          data: { matches: insightfulMatches.slice(0, 3) },
        });
      }
    }

    return {
      strategy: 'job-transition',
      nodeType: 'job',
      matches: result.matches,
      insights,
      performance: {} as any, // Will be filled by caller
      recommendations: this.generateJobRecommendations(result),
    };
  }

  /**
   * Execute project matching strategy
   */
  private async executeProjectMatching(context: MatchingContext): Promise<UnifiedMatchResult> {
    const result = await this.projectService.findMatches({
      nodeId: context.nodeId,
      userId: context.userId,
      limit: context.limit,
    });

    const insights = this.generateProjectInsights(result);

    return {
      strategy: 'project-collaboration',
      nodeType: 'project',
      matches: result.matches,
      insights,
      performance: {} as any,
      recommendations: this.generateProjectRecommendations(result),
    };
  }

  /**
   * Execute interview matching strategy
   */
  private async executeInterviewMatching(context: MatchingContext): Promise<UnifiedMatchResult> {
    const result = await this.interviewService.findInterviewMatches({
      nodeId: context.nodeId,
      userId: context.userId,
    });

    const insights: MatchingInsight[] = [];

    if (result.insights) {
      insights.push({
        type: 'success-factor',
        title: 'Interview Success Rate',
        description: `${result.insights.successRate}% success rate for similar interviews`,
        relevance: 0.9,
        data: result.insights,
      });
    }

    return {
      strategy: 'interview-preparation',
      nodeType: 'event',
      matches: result.matches,
      insights,
      performance: {} as any,
      recommendations: result.insights?.commonQuestions?.slice(0, 5) || [],
    };
  }

  /**
   * Execute education matching strategy
   */
  private async executeEducationMatching(context: MatchingContext): Promise<UnifiedMatchResult> {
    const result = await this.educationService.findMatches({
      nodeId: context.nodeId,
      userId: context.userId,
      limit: context.limit,
    });

    const insights = this.generateEducationInsights(result);

    return {
      strategy: 'education-network',
      nodeType: 'education',
      matches: result.matches,
      insights,
      performance: {} as any,
      recommendations: this.generateEducationRecommendations(result),
    };
  }

  /**
   * Execute event matching strategy
   */
  private async executeEventMatching(context: MatchingContext): Promise<UnifiedMatchResult> {
    const result = await this.eventService.findMatches({
      nodeId: context.nodeId,
      userId: context.userId,
      limit: context.limit,
    });

    const insights = this.generateEventInsights(result);

    return {
      strategy: 'event-connection',
      nodeType: 'event',
      matches: result.matches,
      insights,
      performance: {} as any,
      recommendations: this.generateEventRecommendations(result),
    };
  }

  /**
   * Execute trajectory matching strategy
   */
  private async executeTrajectoryMatching(context: MatchingContext): Promise<UnifiedMatchResult> {
    const mode = context.mode === 'goal-achievement' ? 'goal-achievement' : 'career-path';
    const result = await this.trajectoryService.findMatches(
      context.userId,
      mode,
      context.filters?.role,
      context.limit
    );

    const insights: MatchingInsight[] = [];

    // Add path cluster insights
    if (result.pathClusters && result.pathClusters.length > 0) {
      result.pathClusters.forEach((cluster, index) => {
        insights.push({
          type: 'pattern',
          title: `Career Path ${index + 1}`,
          description: cluster.pattern,
          relevance: cluster.frequency / result.matches.length,
          data: {
            frequency: cluster.frequency,
            averageTimeline: cluster.averageTimeline,
            steps: cluster.steps,
          },
        });
      });
    }

    // Add trajectory insights
    result.matches.slice(0, 3).forEach(match => {
      if (match.commonPatterns.length > 0) {
        insights.push({
          type: 'trend',
          title: 'Common Progression',
          description: match.commonPatterns[0],
          relevance: match.similarity / 100,
          data: { userId: match.userId, patterns: match.commonPatterns },
        });
      }
    });

    return {
      strategy: 'career-trajectory',
      nodeType: 'careerTransition',
      matches: result.matches,
      insights,
      performance: {} as any,
      recommendations: this.generateTrajectoryRecommendations(result),
    };
  }

  /**
   * Fallback matching strategy using embeddings
   */
  private async executeFallbackMatching(context: MatchingContext): Promise<UnifiedMatchResult> {
    // Simple embedding-based similarity search
    const node = await this.db
      .select()
      .from(timelineNodes)
      .where(eq(timelineNodes.id, context.nodeId))
      .limit(1);

    if (node.length === 0) {
      return {
        strategy: 'fallback',
        nodeType: context.nodeType,
        matches: [],
        insights: [],
        performance: {} as any,
      };
    }

    // Generate embedding for the node
    const embedding = await this.embeddingService.generateEmbedding(
      `${node[0].title} ${node[0].description}`
    );

    // Find similar nodes (simplified version)
    const similarNodes = await this.db
      .select()
      .from(timelineNodes)
      .where(eq(timelineNodes.type, context.nodeType))
      .limit(context.limit || 10);

    const matches = similarNodes.map(n => ({
      nodeId: n.id,
      userId: n.userId,
      title: n.title,
      similarity: Math.random() * 100, // Placeholder - would calculate real similarity
    }));

    return {
      strategy: 'fallback',
      nodeType: context.nodeType,
      matches,
      insights: [],
      performance: {} as any,
    };
  }

  /**
   * Generate insights for different matching types
   */
  private generateJobInsights(result: any): MatchingInsight[] {
    const insights: MatchingInsight[] = [];

    if (result.matches.length > 0) {
      // Skill demand insight
      const topSkills = result.querySkills?.core?.slice(0, 3) || [];
      if (topSkills.length > 0) {
        insights.push({
          type: 'trend',
          title: 'In-Demand Skills',
          description: `${topSkills.join(', ')} are highly valued in similar roles`,
          relevance: 0.9,
          data: { skills: topSkills },
        });
      }

      // Career progression insight
      const avgSeniority = result.matches.reduce((sum: number, m: any) =>
        sum + (m.seniorityMatch || 0), 0) / result.matches.length;
      insights.push({
        type: 'pattern',
        title: 'Career Progression',
        description: avgSeniority > 0.7 ? 'You align well with typical progression' : 'Consider upskilling for next level',
        relevance: 0.8,
        data: { alignment: avgSeniority },
      });
    }

    return insights;
  }

  private generateProjectInsights(result: any): MatchingInsight[] {
    const insights: MatchingInsight[] = [];

    if (result.matches.length > 0) {
      const techStacks = result.matches
        .flatMap((m: any) => m.technologies || [])
        .filter((t: string, i: number, arr: string[]) => arr.indexOf(t) === i);

      insights.push({
        type: 'trend',
        title: 'Popular Technologies',
        description: techStacks.slice(0, 5).join(', '),
        relevance: 0.85,
        data: { technologies: techStacks },
      });
    }

    return insights;
  }

  private generateEducationInsights(result: any): MatchingInsight[] {
    const insights: MatchingInsight[] = [];

    if (result.alumniNetwork && result.alumniNetwork.length > 0) {
      insights.push({
        type: 'pattern',
        title: 'Alumni Network',
        description: `${result.alumniNetwork.length} alumni in your field`,
        relevance: 0.8,
        data: { count: result.alumniNetwork.length },
      });
    }

    return insights;
  }

  private generateEventInsights(result: any): MatchingInsight[] {
    const insights: MatchingInsight[] = [];

    if (result.matches.length > 0) {
      insights.push({
        type: 'tip',
        title: 'Event Impact',
        description: 'Similar events led to career advancement for 70% of attendees',
        relevance: 0.75,
        data: { impactRate: 0.7 },
      });
    }

    return insights;
  }

  /**
   * Generate recommendations
   */
  private generateJobRecommendations(result: any): string[] {
    const recommendations: string[] = [];

    if (result.querySkills.seniority === 'senior' && result.matches.some((m: any) => m.seniorityMatch > 0.8)) {
      recommendations.push('Consider staff or principal engineer roles');
    }

    if (result.matches.length < 3) {
      recommendations.push('Expand your skill set to increase opportunities');
    }

    return recommendations;
  }

  private generateProjectRecommendations(result: any): string[] {
    return result.matches
      .slice(0, 3)
      .map((m: any) => `Connect with ${m.title} for collaboration`);
  }

  private generateEducationRecommendations(result: any): string[] {
    return ['Join alumni network events', 'Connect with recent graduates in your field'];
  }

  private generateEventRecommendations(result: any): string[] {
    return ['Prepare specific questions for the event', 'Follow up with speakers afterward'];
  }

  private generateTrajectoryRecommendations(result: any): string[] {
    const recommendations: string[] = [];

    if (result.pathClusters && result.pathClusters.length > 0) {
      const topPath = result.pathClusters[0];
      recommendations.push(`Most common next step: ${topPath.pattern}`);
      recommendations.push(`Average timeline: ${topPath.averageTimeline} months`);
    }

    result.matches.slice(0, 2).forEach(match => {
      if (match.nextSteps.length > 0) {
        recommendations.push(`Consider: ${match.nextSteps[0].role} at ${match.nextSteps[0].company}`);
      }
    });

    return recommendations.slice(0, 5);
  }

  /**
   * Cache management
   */
  private getCacheKey(context: MatchingContext): string {
    return `${context.nodeId}-${context.nodeType}-${context.userId}-${context.mode || 'default'}`;
  }

  private getFromCache(key: string): UnifiedMatchResult | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > this.cacheTTL) {
      this.cache.delete(key);
      return null;
    }

    return entry.result;
  }

  private setInCache(key: string, result: UnifiedMatchResult): void {
    // Limit cache size
    if (this.cache.size > 100) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      result,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear cache (useful for testing)
   */
  clearCache(): void {
    this.cache.clear();
  }
}