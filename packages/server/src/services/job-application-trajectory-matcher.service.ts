import type { TimelineNode } from '@journey/schema';

import type { Logger } from '../core/logger.js';
import type { IJobApplicationTrajectoryMatcherService } from './interfaces/job-application-trajectory-matcher.interface';
import { AnchoredAlignmentEngine } from './job-application-trajectory-matcher/anchored-alignment-engine';
import { CareerSequenceExtractor } from './job-application-trajectory-matcher/career-sequence-extractor';
import {
  DEFAULT_CONFIG,
  MIN_CAREER_STEPS,
} from './job-application-trajectory-matcher/config';
import { TrajectoryScorer } from './job-application-trajectory-matcher/trajectory-scorer';
import { TrajectoryMatchResult } from './job-application-trajectory-matcher/types';

/**
 * Main service for matching job applications based on career trajectories
 *
 * Uses anchored Smith-Waterman alignment to find candidates with similar
 * career paths leading to the same target role/company.
 */
export class JobApplicationTrajectoryMatcherService
  implements IJobApplicationTrajectoryMatcherService
{
  private readonly alignmentEngine: AnchoredAlignmentEngine;
  private readonly sequenceExtractor: CareerSequenceExtractor;
  private readonly scorer: TrajectoryScorer;
  private readonly logger: Logger;

  constructor({
    logger,
    anchoredAlignmentEngine,
    careerSequenceExtractor,
    trajectoryScorer,
  }: {
    logger: Logger;
    anchoredAlignmentEngine: AnchoredAlignmentEngine;
    careerSequenceExtractor: CareerSequenceExtractor;
    trajectoryScorer: TrajectoryScorer;
  }) {
    this.logger = logger;
    this.scorer = trajectoryScorer;
    this.alignmentEngine = anchoredAlignmentEngine;
    this.sequenceExtractor = careerSequenceExtractor;
  }

  /**
   * Match candidates based on career trajectory similarity
   *
   * @param userTimeline - User's timeline nodes
   * @param candidateTimelines - Array of candidate timelines with user IDs
   * @param targetRole - Target job role
   * @param targetCompany - Target company
   * @returns Ranked list of trajectory matches
   */
  async matchTrajectories(
    userTimeline: TimelineNode[],
    candidateTimelines: Array<{ userId: number; timeline: TimelineNode[] }>,
    targetRole?: string,
    targetCompany?: string
  ): Promise<TrajectoryMatchResult[]> {
    // Input validation
    if (!Array.isArray(userTimeline)) {
      this.logger.error('Invalid userTimeline: not an array', {
        type: typeof userTimeline,
      });
      throw new Error('userTimeline must be an array');
    }

    if (!Array.isArray(candidateTimelines)) {
      this.logger.error('Invalid candidateTimelines: not an array', {
        type: typeof candidateTimelines,
      });
      throw new Error('candidateTimelines must be an array');
    }

    // Filter out invalid candidates
    const validCandidates = candidateTimelines.filter(
      (c) => c && typeof c.userId === 'number' && Array.isArray(c.timeline)
    );

    if (validCandidates.length < candidateTimelines.length) {
      this.logger.warn('Found invalid candidates, filtering them out', {
        invalidCount: candidateTimelines.length - validCandidates.length,
        totalCandidates: candidateTimelines.length,
      });
    }

    if (validCandidates.length === 0) {
      this.logger.info('No valid candidates to match');
      return [];
    }

    try {
      // Extract user's career trajectory
      const userTrajectory = this.sequenceExtractor.extractTrajectory(
        userTimeline,
        targetCompany,
        targetRole
      );

      // Check minimum career steps
      if (userTrajectory.steps.length < MIN_CAREER_STEPS) {
        this.logger.info(
          'Insufficient career history for trajectory matching',
          {
            userSteps: userTrajectory.steps.length,
            minRequired: MIN_CAREER_STEPS,
          }
        );
        return [];
      }

      // Match against each candidate
      const matches: TrajectoryMatchResult[] = [];

      for (const { userId, timeline } of validCandidates) {
        try {
          const candidateTrajectory = this.sequenceExtractor.extractTrajectory(
            timeline,
            targetCompany,
            targetRole
          );

          // Skip if candidate has insufficient history
          if (candidateTrajectory.steps.length < MIN_CAREER_STEPS) {
            continue;
          }

          // Perform alignment
          const alignment = this.alignmentEngine.align(
            userTrajectory.steps,
            candidateTrajectory.steps
          );

          // Validate alignment result
          if (!alignment || typeof alignment.normalizedScore !== 'number') {
            this.logger.error('Invalid alignment result', {
              userId,
              hasAlignment: !!alignment,
            });
            continue;
          }

          // Create match result with explanation
          const match: TrajectoryMatchResult = {
            userId,
            score: alignment.normalizedScore / 100, // Normalize to 0-1
            subscores: this.calculateSubscores(alignment, candidateTrajectory),
            alignmentPath: this.convertAlignmentPath(alignment.alignmentPath),
            explanation: this.generateExplanation(
              alignment,
              candidateTrajectory
            ),
          };

          matches.push(match);
        } catch (error) {
          // Log unexpected errors with stack traces
          this.logger.error('Unexpected error matching candidate trajectory', {
            userId,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          });
          // Continue with other candidates for resilience
        }
      }

      // Sort by score descending and return top N
      const sortedMatches = matches.sort((a, b) => b.score - a.score);
      const topMatches = sortedMatches.slice(0, DEFAULT_CONFIG.maxCandidates);

      this.logger.info('Trajectory matching completed', {
        userSteps: userTrajectory.steps.length,
        candidatesEvaluated: validCandidates.length,
        matchesFound: matches.length,
        topMatchesReturned: topMatches.length,
      });

      return topMatches;
    } catch (error) {
      this.logger.error('Error in trajectory matching', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Calculate subscores from alignment result
   */
  private calculateSubscores(
    alignment: any,
    candidateTrajectory: any
  ): TrajectoryMatchResult['subscores'] {
    // Extract key metrics from alignment path
    const path = alignment.alignmentPath;

    // Validate alignment path
    if (!Array.isArray(path) || path.length === 0) {
      this.logger.warn('Empty alignment path in subscore calculation', {
        alignmentScore: alignment.score,
        normalizedScore: alignment.normalizedScore,
      });
      return {
        roleAlignment: 0,
        levelProgression: 0,
        companyMatch: 0,
        recency: 0,
      };
    }

    let roleMatches = 0;
    let totalSteps = 0;
    let companyMatches = 0;

    for (const op of path) {
      if (!op || typeof op.type !== 'string') {
        this.logger.warn('Malformed alignment operation', { operation: op });
        continue;
      }

      if (op.type === 'match' || op.type === 'mismatch') {
        totalSteps++;
        if (typeof op.score === 'number' && op.score > 3.0) {
          // High role similarity
          roleMatches++;
        }
        if (typeof op.score === 'number' && op.score > 4.0) {
          // Company match included
          companyMatches++;
        }
      }
    }

    if (totalSteps === 0) {
      this.logger.info('No match/mismatch operations in alignment', {
        pathLength: path.length,
      });
    }

    // Calculate recency based on candidate's most recent career step
    const recency = this.calculateRecency(candidateTrajectory.steps);

    return {
      roleAlignment: totalSteps > 0 ? roleMatches / totalSteps : 0,
      levelProgression: alignment.normalizedScore / 100, // Use overall score as proxy
      companyMatch: totalSteps > 0 ? companyMatches / totalSteps : 0,
      recency,
    };
  }

  /**
   * Calculate recency score based on trajectory steps
   * More recent career progression gets higher scores
   */
  private calculateRecency(steps: any[]): number {
    if (!steps || steps.length === 0) {
      return 0;
    }

    // Get the most recent step
    const mostRecentStep = steps[steps.length - 1];
    if (!mostRecentStep || !mostRecentStep.startDate) {
      return 0.5; // Default neutral score
    }

    const startDate = new Date(mostRecentStep.startDate);
    const now = new Date();
    const yearsAgo =
      (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);

    // Apply exponential decay: exp(-lambda * years)
    // Lambda = 0.15 from config (recencyDecayLambda)
    const recencyScore = Math.exp(
      -DEFAULT_CONFIG.recencyDecayLambda * yearsAgo
    );

    return Math.max(0, Math.min(1, recencyScore)); // Clamp to [0, 1]
  }

  /**
   * Convert alignment path to simpler format
   */
  private convertAlignmentPath(path: any[]): Array<[number, number]> {
    return path
      .filter((op) => op.type === 'match' || op.type === 'mismatch')
      .map(
        (op) =>
          [op.userIndex ?? -1, op.candidateIndex ?? -1] as [number, number]
      )
      .filter(([u, c]) => u >= 0 && c >= 0);
  }

  /**
   * Generate human-readable explanation
   */
  private generateExplanation(
    alignment: any,
    candidateTrajectory: any
  ): string[] {
    const explanation: string[] = [];

    // Overall similarity
    const score = alignment.normalizedScore;
    if (score >= 75) {
      explanation.push('Very similar career trajectory');
    } else if (score >= 50) {
      explanation.push('Similar career progression');
    } else if (score >= 30) {
      explanation.push('Some similar career experiences');
    } else {
      explanation.push('Different career path');
    }

    // Analyze path
    const matches = alignment.alignmentPath.filter(
      (op: any) => op.type === 'match'
    );
    const gaps = alignment.alignmentPath.filter(
      (op: any) => op.type === 'gap-user' || op.type === 'gap-candidate'
    );

    if (matches.length > 0) {
      explanation.push(`${matches.length} matching career steps`);
    }

    if (gaps.length > 0) {
      explanation.push(`${gaps.length} unique experiences`);
    }

    // Target reached
    if (candidateTrajectory.targetCompany || candidateTrajectory.targetRole) {
      explanation.push('Successfully reached target position');
    }

    return explanation;
  }

  /**
   * Check if trajectory matching is available for a timeline
   */
  canMatchTrajectory(timeline: TimelineNode[]): boolean {
    if (!Array.isArray(timeline)) {
      return false;
    }
    const trajectory = this.sequenceExtractor.extractTrajectory(timeline);
    return trajectory.steps.length >= MIN_CAREER_STEPS;
  }
}
