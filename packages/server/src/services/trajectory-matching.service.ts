import type { Database } from '../types/database.js';
import { eq, sql, and, ne, desc } from 'drizzle-orm';
import { timelineNodes, users } from '@journey/schema';

export interface CareerStep {
  role: string;
  company: string;
  level: number; // Seniority level
  industry: string;
  duration: number; // Months
  skills?: string[];
}

export interface CareerTrajectory {
  userId: number;
  steps: CareerStep[];
  embedding?: number[];
}

export interface TrajectoryMatch {
  userId: number;
  userName: string;
  similarity: number;
  alignmentScore: number;
  trajectoryLength: number;
  currentRole: string;
  currentCompany: string;
  nextSteps: CareerStep[];
  commonPatterns: string[];
}

export interface TrajectoryMatchResult {
  matches: TrajectoryMatch[];
  queryTrajectory: CareerTrajectory;
  searchMode: 'career-path' | 'goal-achievement';
  pathClusters?: PathCluster[];
}

export interface PathCluster {
  pattern: string;
  frequency: number;
  averageTimeline: number;
  exampleUsers: number[];
  steps: CareerStep[];
}

// Seniority level mapping
const SENIORITY_LEVELS: Record<string, number> = {
  intern: 1,
  junior: 2,
  mid: 3,
  senior: 4,
  staff: 5,
  principal: 6,
  lead: 6,
  manager: 7,
  director: 8,
  vp: 9,
  cto: 10,
  ceo: 10,
};

export class TrajectoryMatchingService {
  constructor(
    private db: Database,
    private embeddingService?: any // Optional embedding service
  ) {}

  /**
   * Smith-Waterman sequence alignment for career trajectories
   * This is the core algorithm for trajectory matching
   */
  private smithWatermanAlignment(
    seq1: CareerStep[],
    seq2: CareerStep[],
    matchScore = 3,
    mismatchPenalty = -1,
    gapPenalty = -2
  ): { score: number; alignment: [number, number][] } {
    const m = seq1.length;
    const n = seq2.length;

    // Initialize scoring matrix
    const matrix: number[][] = Array(m + 1)
      .fill(0)
      .map(() => Array(n + 1).fill(0));

    // Track maximum score and position
    let maxScore = 0;
    let maxI = 0;
    let maxJ = 0;

    // Fill the scoring matrix
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const match = this.calculateStepSimilarity(seq1[i - 1], seq2[j - 1]) * matchScore;
        const mismatch = match < 0 ? mismatchPenalty : match;

        const scores = [
          0, // Start new alignment
          matrix[i - 1][j - 1] + mismatch, // Match/mismatch
          matrix[i - 1][j] + gapPenalty, // Deletion
          matrix[i][j - 1] + gapPenalty, // Insertion
        ];

        matrix[i][j] = Math.max(...scores);

        if (matrix[i][j] > maxScore) {
          maxScore = matrix[i][j];
          maxI = i;
          maxJ = j;
        }
      }
    }

    // Traceback to find alignment
    const alignment: [number, number][] = [];
    let i = maxI;
    let j = maxJ;

    while (i > 0 && j > 0 && matrix[i][j] > 0) {
      const current = matrix[i][j];
      const diagonal = matrix[i - 1][j - 1];
      const up = matrix[i - 1][j];
      const left = matrix[i][j - 1];

      if (current === diagonal + this.calculateStepSimilarity(seq1[i - 1], seq2[j - 1]) * matchScore ||
          current === diagonal + mismatchPenalty) {
        alignment.unshift([i - 1, j - 1]);
        i--;
        j--;
      } else if (current === up + gapPenalty) {
        i--;
      } else if (current === left + gapPenalty) {
        j--;
      } else {
        break;
      }
    }

    return { score: maxScore, alignment };
  }

  /**
   * Calculate similarity between two career steps
   */
  private calculateStepSimilarity(step1: CareerStep, step2: CareerStep): number {
    let similarity = 0;

    // Role similarity (40%)
    if (this.normalizeRole(step1.role) === this.normalizeRole(step2.role)) {
      similarity += 0.4;
    } else if (this.areSimilarRoles(step1.role, step2.role)) {
      similarity += 0.2;
    }

    // Industry similarity (20%)
    if (step1.industry === step2.industry) {
      similarity += 0.2;
    } else if (this.areSimilarIndustries(step1.industry, step2.industry)) {
      similarity += 0.1;
    }

    // Seniority progression (20%)
    const levelDiff = Math.abs(step1.level - step2.level);
    if (levelDiff === 0) {
      similarity += 0.2;
    } else if (levelDiff === 1) {
      similarity += 0.15;
    } else if (levelDiff === 2) {
      similarity += 0.1;
    }

    // Company type similarity (10%)
    if (this.getCompanyType(step1.company) === this.getCompanyType(step2.company)) {
      similarity += 0.1;
    }

    // Skills overlap (10%)
    if (step1.skills && step2.skills) {
      const overlap = this.calculateSkillOverlap(step1.skills, step2.skills);
      similarity += overlap * 0.1;
    }

    return similarity;
  }

  /**
   * Extract career trajectory from user's timeline
   */
  async extractTrajectory(userId: number): Promise<CareerTrajectory> {
    const jobs = await this.db
      .select()
      .from(timelineNodes)
      .where(and(
        eq(timelineNodes.userId, userId),
        eq(timelineNodes.type, 'job')
      ));

    const steps: CareerStep[] = jobs.map(job => ({
      role: job.meta?.role || job.title || '',
      company: job.meta?.company || '',
      level: this.extractSeniorityLevel(job.meta?.role || job.title || ''),
      industry: job.meta?.industry || 'Technology',
      duration: this.calculateDuration(job.startDate, job.endDate),
      skills: job.meta?.skills || [],
    }));

    return {
      userId,
      steps,
    };
  }

  /**
   * Find matching trajectories using Smith-Waterman algorithm
   */
  async findMatches(
    userId: number,
    mode: 'career-path' | 'goal-achievement' = 'career-path',
    targetRole?: string,
    limit = 10
  ): Promise<TrajectoryMatchResult> {
    // Extract query trajectory
    const queryTrajectory = await this.extractTrajectory(userId);

    if (queryTrajectory.steps.length === 0) {
      return {
        matches: [],
        queryTrajectory,
        searchMode: mode,
      };
    }

    // Get candidate trajectories
    const candidateUsers = await this.db
      .select({ userId: users.id })
      .from(users)
      .innerJoin(timelineNodes, eq(users.id, timelineNodes.userId))
      .where(and(
        ne(users.id, userId),
        eq(timelineNodes.type, 'job')
      ))
      .groupBy(users.id)
      .limit(100); // Process top 100 candidates

    const matches: TrajectoryMatch[] = [];

    for (const candidate of candidateUsers) {
      const candidateTrajectory = await this.extractTrajectory(candidate.userId);

      if (candidateTrajectory.steps.length === 0) continue;

      // Apply Smith-Waterman algorithm
      const alignment = this.smithWatermanAlignment(
        queryTrajectory.steps,
        candidateTrajectory.steps
      );

      // Calculate overall similarity
      const similarity = this.calculateOverallSimilarity(
        queryTrajectory,
        candidateTrajectory,
        alignment
      );

      // Extract next steps and patterns
      const nextSteps = this.extractNextSteps(
        queryTrajectory.steps,
        candidateTrajectory.steps,
        alignment
      );

      const patterns = this.extractCommonPatterns(
        queryTrajectory.steps,
        candidateTrajectory.steps,
        alignment
      );

      // Get user details
      const userDetails = await this.getUserDetails(candidate.userId);

      matches.push({
        userId: candidate.userId,
        userName: userDetails.name,
        similarity,
        alignmentScore: alignment.score,
        trajectoryLength: candidateTrajectory.steps.length,
        currentRole: candidateTrajectory.steps[candidateTrajectory.steps.length - 1]?.role || '',
        currentCompany: candidateTrajectory.steps[candidateTrajectory.steps.length - 1]?.company || '',
        nextSteps,
        commonPatterns: patterns,
      });
    }

    // Sort by similarity
    matches.sort((a, b) => b.similarity - a.similarity);

    // Cluster paths if in career-path mode
    let pathClusters: PathCluster[] | undefined;
    if (mode === 'career-path') {
      pathClusters = this.clusterCareerPaths(matches);
    }

    return {
      matches: matches.slice(0, limit),
      queryTrajectory,
      searchMode: mode,
      pathClusters,
    };
  }

  /**
   * Cluster similar career paths
   */
  private clusterCareerPaths(matches: TrajectoryMatch[]): PathCluster[] {
    const pathMap = new Map<string, PathCluster>();

    matches.forEach(match => {
      const pathKey = match.nextSteps
        .map(step => `${this.normalizeRole(step.role)}`)
        .join(' → ');

      if (!pathKey) return;

      if (!pathMap.has(pathKey)) {
        pathMap.set(pathKey, {
          pattern: pathKey,
          frequency: 0,
          averageTimeline: 0,
          exampleUsers: [],
          steps: match.nextSteps,
        });
      }

      const cluster = pathMap.get(pathKey)!;
      cluster.frequency++;
      cluster.exampleUsers.push(match.userId);
      cluster.averageTimeline += match.nextSteps.reduce((sum, step) => sum + step.duration, 0);
    });

    // Calculate averages
    pathMap.forEach(cluster => {
      cluster.averageTimeline = Math.round(cluster.averageTimeline / cluster.frequency);
      cluster.exampleUsers = cluster.exampleUsers.slice(0, 3); // Keep top 3 examples
    });

    return Array.from(pathMap.values())
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 5); // Return top 5 clusters
  }

  /**
   * Helper methods
   */
  private extractSeniorityLevel(role: string): number {
    const normalizedRole = role.toLowerCase();
    for (const [keyword, level] of Object.entries(SENIORITY_LEVELS)) {
      if (normalizedRole.includes(keyword)) {
        return level;
      }
    }
    return 3; // Default to mid-level
  }

  private normalizeRole(role: string): string {
    return role
      .toLowerCase()
      .replace(/senior|junior|staff|principal|lead/gi, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }

  private areSimilarRoles(role1: string, role2: string): boolean {
    const normalized1 = this.normalizeRole(role1);
    const normalized2 = this.normalizeRole(role2);

    // Check for common keywords
    const keywords1 = new Set(normalized1.split(' '));
    const keywords2 = new Set(normalized2.split(' '));

    const intersection = new Set([...keywords1].filter(x => keywords2.has(x)));
    return intersection.size > 0;
  }

  private areSimilarIndustries(industry1: string, industry2: string): boolean {
    const techIndustries = ['Technology', 'Software', 'IT', 'SaaS'];
    const financeIndustries = ['Finance', 'FinTech', 'Banking', 'Financial Services'];

    return (
      (techIndustries.includes(industry1) && techIndustries.includes(industry2)) ||
      (financeIndustries.includes(industry1) && financeIndustries.includes(industry2))
    );
  }

  private getCompanyType(company: string): string {
    const lower = company.toLowerCase();
    if (lower.includes('startup') || lower.includes('labs')) return 'startup';
    if (['google', 'meta', 'amazon', 'apple', 'microsoft'].some(big => lower.includes(big))) return 'bigtech';
    if (lower.includes('bank') || lower.includes('financial')) return 'finance';
    return 'other';
  }

  private calculateSkillOverlap(skills1: string[], skills2: string[]): number {
    const set1 = new Set(skills1.map(s => s.toLowerCase()));
    const set2 = new Set(skills2.map(s => s.toLowerCase()));
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    return intersection.size / Math.max(set1.size, set2.size);
  }

  private calculateDuration(startDate: Date | null, endDate: Date | null): number {
    if (!startDate) return 12; // Default to 1 year
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : new Date();
    return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30));
  }

  private calculateOverallSimilarity(
    trajectory1: CareerTrajectory,
    trajectory2: CareerTrajectory,
    alignment: { score: number; alignment: [number, number][] }
  ): number {
    const maxLength = Math.max(trajectory1.steps.length, trajectory2.steps.length);
    const alignmentRatio = alignment.alignment.length / maxLength;
    const normalizedScore = alignment.score / (maxLength * 3); // Normalize by max possible score

    return (alignmentRatio * 0.5 + normalizedScore * 0.5) * 100;
  }

  private extractNextSteps(
    querySteps: CareerStep[],
    candidateSteps: CareerStep[],
    alignment: { score: number; alignment: [number, number][] }
  ): CareerStep[] {
    if (alignment.alignment.length === 0) return [];

    const lastAlignment = alignment.alignment[alignment.alignment.length - 1];
    const candidateIndex = lastAlignment[1];

    // Return the next steps after the last aligned position
    return candidateSteps.slice(candidateIndex + 1, candidateIndex + 3);
  }

  private extractCommonPatterns(
    querySteps: CareerStep[],
    candidateSteps: CareerStep[],
    alignment: { score: number; alignment: [number, number][] }
  ): string[] {
    const patterns: string[] = [];

    alignment.alignment.forEach(([i, j]) => {
      const queryStep = querySteps[i];
      const candidateStep = candidateSteps[j];

      if (this.calculateStepSimilarity(queryStep, candidateStep) > 0.5) {
        patterns.push(`${queryStep.role} → ${candidateStep.role}`);
      }
    });

    return [...new Set(patterns)].slice(0, 3);
  }

  private async getUserDetails(userId: number): Promise<{ name: string }> {
    const user = await this.db
      .select({
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user.length > 0) {
      return { name: `${user[0].firstName} ${user[0].lastName}` };
    }

    return { name: 'Unknown User' };
  }
}