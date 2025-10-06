import { eq, sql, and, ne, gte, lt } from 'drizzle-orm';
import { timelineNodes, users, type Database } from '@journey/schema';
import { TrajectoryEmbeddingService } from './trajectory-matching/trajectory-embedding.service.js';

export interface InterviewContext {
  nodeId: string;
  userId: number;
}

export interface InterviewMatch {
  userId: number;
  userName: string;
  email: string;

  interviewNodeId: string;
  company: string;
  role: string;
  interviewDate: string;
  interviewStage?: string;
  outcome?: string;

  score: number;
  roleSimilarity: number;
  outcomeScore: number;
  recencyScore: number;
  stageScore: number;

  preparation?: {
    projects: any[];
    courses: any[];
    durationMonths: number;
  };
}

export interface InterviewInsights {
  successRate: number;
  totalInterviews: number;
  offerCount: number;

  successPatterns: {
    preparationTimeline: {
      median: number;
      range: [number, number];
    };
    commonProjects: {
      types: string[];
      avgCount: number;
      percentage: number;
    };
    commonCourses: Array<{
      name: string;
      percentage: number;
    }>;
  };

  recommendations: string[];
}

export interface InterviewMatchResult {
  matches: InterviewMatch[];
  insights: InterviewInsights;
  totalMatches: number;
}

export class InterviewMatchingService {
  constructor(
    private db: Database,
    private embeddingService: TrajectoryEmbeddingService
  ) {}

  async findInterviewMatches(context: InterviewContext): Promise<InterviewMatchResult> {
    const userInterview = await this.db
      .select()
      .from(timelineNodes)
      .where(eq(timelineNodes.id, context.nodeId))
      .limit(1);

    if (userInterview.length === 0) {
      throw new Error('Interview node not found');
    }

    const interview = userInterview[0];
    const { organizer: company, title } = interview.meta as any;

    if (!company) {
      throw new Error('Interview must have company (organizer) specified');
    }

    const candidateInterviews = await this.db
      .select({
        nodeId: timelineNodes.id,
        userId: timelineNodes.userId,
        meta: timelineNodes.meta,
        createdAt: timelineNodes.createdAt,
      })
      .from(timelineNodes)
      .where(
        and(
          eq(timelineNodes.type, 'event'),
          sql`${timelineNodes.meta}->>'eventType' = 'interview'`,
          sql`${timelineNodes.meta}->>'organizer' = ${company}`,
          ne(timelineNodes.userId, context.userId)
        )
      );

    const scoredMatches = await Promise.all(
      candidateInterviews.map(async (candidate) => {
        return await this.scoreInterviewMatch(interview, candidate);
      })
    );

    const sortedMatches = scoredMatches
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    const enrichedMatches = await Promise.all(
      sortedMatches.map(async (match) => {
        const prep = await this.getPreparationTimeline(
          match.userId,
          match.interviewDate,
          6
        );
        return { ...match, preparation: prep };
      })
    );

    const insights = this.analyzeSuccessPatterns(enrichedMatches);

    return {
      matches: enrichedMatches,
      insights,
      totalMatches: candidateInterviews.length,
    };
  }

  private async scoreInterviewMatch(
    userInterview: any,
    candidateInterview: any
  ): Promise<InterviewMatch> {
    const userMeta = userInterview.meta as any;
    const candidateMeta = candidateInterview.meta as any;

    const userRole = this.extractRole(userMeta.title || '');
    const candidateRole = this.extractRole(candidateMeta.title || '');

    const roleSim = await this.calculateRoleSimilarity(userRole, candidateRole);

    const outcomeScore = this.getOutcomeScore(candidateMeta.outcome);
    const recency = this.calculateRecency(candidateMeta.date || candidateMeta.startDate);
    const stageScore = this.getStageScore(candidateMeta.interviewStage);

    const finalScore = 0.4 * roleSim + 0.3 * outcomeScore + 0.2 * recency + 0.1 * stageScore;

    const user = await this.db
      .select({
        userName: users.userName,
        email: users.email,
      })
      .from(users)
      .where(eq(users.id, candidateInterview.userId))
      .limit(1);

    return {
      userId: candidateInterview.userId,
      userName: user[0]?.userName || 'Unknown',
      email: user[0]?.email || '',

      interviewNodeId: candidateInterview.nodeId,
      company: candidateMeta.organizer || '',
      role: candidateRole,
      interviewDate: candidateMeta.date || candidateMeta.startDate || '',
      interviewStage: candidateMeta.interviewStage,
      outcome: candidateMeta.outcome,

      score: finalScore,
      roleSimilarity: roleSim,
      outcomeScore,
      recencyScore: recency,
      stageScore,
    };
  }

  private extractRole(title: string): string {
    const rolePatterns = [
      /(.+?)\s+Interview/i,
      /Interview\s+for\s+(.+)/i,
      /(.+?)\s+Role/i,
      /(.+?)\s+Position/i,
    ];

    for (const pattern of rolePatterns) {
      const match = title.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    return title;
  }

  private async calculateRoleSimilarity(role1: string, role2: string): Promise<number> {
    const r1 = role1.toLowerCase();
    const r2 = role2.toLowerCase();

    if (r1 === r2) return 1.0;

    const words1 = new Set(r1.split(/\s+/));
    const words2 = new Set(r2.split(/\s+/));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    const jaccardSim = intersection.size / union.size;

    return jaccardSim;
  }

  private getOutcomeScore(outcome?: string): number {
    if (!outcome) return 0.3;

    const outcomeMap: Record<string, number> = {
      offer: 1.0,
      rejection: 0.5,
      pending: 0.3,
      withdrew: 0.2,
      ghosted: 0.2,
    };

    return outcomeMap[outcome.toLowerCase()] || 0.3;
  }

  private calculateRecency(dateStr: string): number {
    if (!dateStr) return 0;

    const interviewDate = new Date(dateStr);
    const now = new Date();
    const monthsAgo = (now.getTime() - interviewDate.getTime()) / (1000 * 60 * 60 * 24 * 30);

    return Math.exp(-monthsAgo / 24);
  }

  private getStageScore(stage?: string): number {
    if (!stage) return 0.5;

    const stageMap: Record<string, number> = {
      screening: 0.3,
      technical: 0.5,
      onsite: 0.8,
      offer: 1.0,
    };

    return stageMap[stage.toLowerCase()] || 0.5;
  }

  private async getPreparationTimeline(
    userId: number,
    interviewDate: string,
    monthsLookback: number
  ) {
    if (!interviewDate) {
      return {
        projects: [],
        courses: [],
        durationMonths: monthsLookback,
      };
    }

    const interviewDateObj = new Date(interviewDate + '-01');
    const cutoffDate = new Date(interviewDateObj);
    cutoffDate.setMonth(cutoffDate.getMonth() - monthsLookback);

    const prep = await this.db
      .select()
      .from(timelineNodes)
      .where(
        and(
          eq(timelineNodes.userId, userId),
          sql`${timelineNodes.meta}->>'startDate' IS NOT NULL`,
          sql`${timelineNodes.meta}->>'startDate' != ''`
        )
      );

    const filteredPrep = prep.filter(n => {
      const startDate = (n.meta as any).startDate;
      if (!startDate) return false;

      const nodeDate = new Date(startDate.length === 7 ? startDate + '-01' : startDate);
      return nodeDate >= cutoffDate && nodeDate < interviewDateObj;
    });

    return {
      projects: filteredPrep.filter(n => n.type === 'project'),
      courses: filteredPrep.filter(
        n => n.type === 'event' &&
        ['course', 'certification', 'bootcamp'].includes((n.meta as any).eventType)
      ),
      durationMonths: monthsLookback,
    };
  }

  private analyzeSuccessPatterns(matches: InterviewMatch[]): InterviewInsights {
    const offerMatches = matches.filter(m => m.outcome === 'offer');
    const successRate = matches.length > 0 ? offerMatches.length / matches.length : 0;

    const prepTimelines = offerMatches
      .filter(m => m.preparation)
      .map(m => m.preparation!.durationMonths);

    const projectCounts = offerMatches
      .filter(m => m.preparation)
      .map(m => m.preparation!.projects.length);

    const avgProjectCount = projectCounts.length > 0
      ? projectCounts.reduce((a, b) => a + b, 0) / projectCounts.length
      : 0;

    const hasProjects = offerMatches.filter(m =>
      m.preparation && m.preparation.projects.length >= 2
    ).length;

    const projectPercentage = offerMatches.length > 0
      ? (hasProjects / offerMatches.length) * 100
      : 0;

    return {
      successRate,
      totalInterviews: matches.length,
      offerCount: offerMatches.length,

      successPatterns: {
        preparationTimeline: {
          median: prepTimelines.length > 0 ? this.median(prepTimelines) : 6,
          range: prepTimelines.length > 0
            ? [Math.min(...prepTimelines), Math.max(...prepTimelines)]
            : [0, 6],
        },
        commonProjects: {
          types: [],
          avgCount: avgProjectCount,
          percentage: projectPercentage,
        },
        commonCourses: [],
      },

      recommendations: this.generateRecommendations(offerMatches, matches),
    };
  }

  private median(values: number[]): number {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  private generateRecommendations(offerMatches: InterviewMatch[], allMatches: InterviewMatch[]): string[] {
    const recommendations: string[] = [];

    const withPrep = offerMatches.filter(m => m.preparation);
    const avgProjects = withPrep.length > 0
      ? withPrep.reduce((sum, m) => sum + m.preparation!.projects.length, 0) / withPrep.length
      : 0;

    if (avgProjects >= 2) {
      recommendations.push(`Build ${Math.ceil(avgProjects)} relevant projects before interviewing`);
    }

    const withCourses = withPrep.filter(m => m.preparation!.courses.length > 0).length;
    const coursePercentage = withPrep.length > 0 ? (withCourses / withPrep.length) * 100 : 0;

    if (coursePercentage >= 50) {
      recommendations.push('Complete relevant courses/certifications (60% of successful candidates did)');
    }

    if (offerMatches.length > 0 && allMatches.length > 0) {
      const successRate = (offerMatches.length / allMatches.length) * 100;
      recommendations.push(`Success rate for this role: ${successRate.toFixed(0)}%`);
    }

    return recommendations;
  }
}