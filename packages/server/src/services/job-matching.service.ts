import type { Database } from '../types/database.js';
import type {
  ExtractedSkills,
  LLMSkillExtractionService,
} from './llm-skill-extraction.service.js';
import { ActivityScoringService } from './activity-scoring.service.js';

export interface JobMatchContext {
  nodeId: string;
  userId: number;
  limit?: number;
  includeActivitySignals?: boolean;
  includeInsights?: boolean;
}

export interface JobMatch {
  nodeId: string;
  userId: number;
  title: string;
  role: string;
  company: string;
  extractedSkills: ExtractedSkills;
  score: number;
  skillsSimilarity: number;
  roleMatch: number;
  seniorityMatch: number;
  industryMatch: number;
  activityScore?: number;
  insightRelevance?: number;
  activitySignals?: string[];
  relevantInsights?: Array<{
    id: string;
    description: string;
    relevanceScore: number;
  }>;
}

export interface JobMatchResult {
  matches: JobMatch[];
  querySkills: ExtractedSkills;
  totalCandidates: number;
}

const SENIORITY_LEVELS: Record<string, number> = {
  intern: 1,
  junior: 2,
  mid: 3,
  senior: 4,
  staff: 5,
  principal: 6,
  lead: 6,
  director: 7,
  vp: 8,
  cto: 9,
  ceo: 10,
};

export class JobMatchingService {
  private activityService: ActivityScoringService;

  constructor(
    private db: Database,
    private skillExtractor: LLMSkillExtractionService
  ) {
    this.activityService = new ActivityScoringService(db, skillExtractor);
  }

  async findMatches(context: JobMatchContext): Promise<JobMatchResult> {
    const queryNode = await this.db.query.timelineNodes.findFirst({
      where: (nodes, { eq }) => eq(nodes.id, context.nodeId),
    });

    if (!queryNode) {
      throw new Error(`Job node ${context.nodeId} not found`);
    }

    const querySkills = await this.skillExtractor.extractSkills({
      nodeType: 'job',
      title: queryNode.meta.title || '',
      role: queryNode.meta.role || '',
      description: queryNode.meta.description || '',
      technologies: queryNode.meta.technologies || [],
    });

    const permittedNodes = await this.db.query.timelineNodes.findMany({
      where: (nodes, { eq, ne, and }) =>
        and(
          eq(nodes.type, 'job'),
          ne(nodes.id, context.nodeId),
          eq(nodes.userId, context.userId)
        ),
      limit: 100,
    });

    const matches: JobMatch[] = [];

    for (const candidate of permittedNodes) {
      const candidateSkills = await this.skillExtractor.extractSkills({
        nodeType: 'job',
        title: candidate.meta.title || '',
        role: candidate.meta.role || '',
        description: candidate.meta.description || '',
        technologies: candidate.meta.technologies || [],
      });

      const skillsSimilarity = this.calculateSkillsSimilarity(
        querySkills.normalizedSkills,
        candidateSkills.normalizedSkills
      );

      const roleMatch = this.calculateRoleMatch(
        queryNode.meta.role || queryNode.meta.title || '',
        candidate.meta.role || candidate.meta.title || ''
      );

      const seniorityMatch = this.calculateSeniorityMatch(
        queryNode.meta.role || queryNode.meta.title || '',
        candidate.meta.role || candidate.meta.title || ''
      );

      const industryMatch = 0.5;

      // Get activity score if requested
      let activityScore = 0;
      let activitySignals: string[] | undefined;
      if (context.includeActivitySignals) {
        const activity = await this.activityService.getActivityScore(candidate.userId);
        activityScore = activity.score;
        activitySignals = activity.signals;
      }

      // Get insight relevance if requested
      let insightRelevance = 0;
      let relevantInsights: JobMatch['relevantInsights'] | undefined;
      if (context.includeInsights) {
        const insights = await this.activityService.getInsightRelevance(
          context.nodeId,
          candidate.userId
        );
        insightRelevance = insights.score;
        relevantInsights = insights.relevantInsights;
      }

      // Calculate final score with new weights if activity/insights included
      let finalScore: number;
      if (context.includeActivitySignals || context.includeInsights) {
        finalScore =
          0.4 * skillsSimilarity +
          0.2 * roleMatch +
          0.15 * seniorityMatch +
          0.15 * activityScore +
          0.1 * insightRelevance;
      } else {
        // Original scoring
        finalScore =
          0.5 * skillsSimilarity +
          0.25 * roleMatch +
          0.15 * seniorityMatch +
          0.1 * industryMatch;
      }

      matches.push({
        nodeId: candidate.id,
        userId: candidate.userId,
        title: candidate.meta.title || candidate.meta.role || 'Untitled Job',
        role: candidate.meta.role || candidate.meta.title || '',
        company: candidate.meta.company || '',
        extractedSkills: candidateSkills,
        score: finalScore,
        skillsSimilarity,
        roleMatch,
        seniorityMatch,
        industryMatch,
        activityScore: context.includeActivitySignals ? activityScore : undefined,
        insightRelevance: context.includeInsights ? insightRelevance : undefined,
        activitySignals,
        relevantInsights,
      });
    }

    matches.sort((a, b) => b.score - a.score);
    const limitedMatches = matches.slice(0, context.limit || 10);

    return {
      matches: limitedMatches,
      querySkills,
      totalCandidates: permittedNodes.length,
    };
  }

  private calculateSkillsSimilarity(
    skills1: string[],
    skills2: string[]
  ): number {
    if (skills1.length === 0 || skills2.length === 0) return 0;

    const set1 = new Set(skills1);
    const set2 = new Set(skills2);
    const intersection = new Set([...set1].filter((s) => set2.has(s)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }

  private calculateRoleMatch(role1: string, role2: string): number {
    const norm1 = role1.toLowerCase().trim();
    const norm2 = role2.toLowerCase().trim();

    if (norm1 === norm2) return 1.0;

    if (norm1.includes(norm2) || norm2.includes(norm1)) {
      return 0.7;
    }

    const roleFamilies = [
      ['engineer', 'developer', 'programmer', 'swe'],
      ['manager', 'lead', 'director'],
      ['designer', 'ux', 'ui'],
      ['analyst', 'scientist', 'researcher'],
      ['pm', 'product manager', 'product owner'],
    ];

    for (const family of roleFamilies) {
      const in1 = family.some((r) => norm1.includes(r));
      const in2 = family.some((r) => norm2.includes(r));
      if (in1 && in2) {
        return 0.6;
      }
    }

    return 0.3;
  }

  private calculateSeniorityMatch(title1: string, title2: string): number {
    const level1 = this.getSeniorityLevel(title1);
    const level2 = this.getSeniorityLevel(title2);

    if (level1 === level2) return 1.0;

    const maxDistance = 9;
    const distance = Math.abs(level1 - level2);

    return Math.max(0, 1 - distance / maxDistance);
  }

  private getSeniorityLevel(title: string): number {
    const lower = title.toLowerCase();
    for (const [key, level] of Object.entries(SENIORITY_LEVELS)) {
      if (lower.includes(key)) {
        return level;
      }
    }
    return 3;
  }
}
