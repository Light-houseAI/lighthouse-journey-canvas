/**
 * Interface for job application trajectory matching service
 * Part of LIG-207 Career Trajectory Matching
 */

import type { TimelineNode } from '@journey/schema';

import type { TrajectoryMatchResult } from '../job-application-trajectory-matcher/types';

export interface IJobApplicationTrajectoryMatcherService {
  /**
   * Match candidates based on career trajectory similarity
   *
   * @param userTimeline - User's timeline nodes
   * @param candidateTimelines - Array of candidate timelines with user IDs
   * @param targetRole - Target job role
   * @param targetCompany - Target company
   * @returns Ranked list of trajectory matches
   */
  matchTrajectories(
    userTimeline: TimelineNode[],
    candidateTimelines: Array<{ userId: number; timeline: TimelineNode[] }>,
    targetRole?: string,
    targetCompany?: string
  ): Promise<TrajectoryMatchResult[]>;

  /**
   * Check if trajectory matching is available for a timeline
   *
   * @param timeline - Timeline nodes to check
   * @returns True if timeline has sufficient career steps
   */
  canMatchTrajectory(timeline: TimelineNode[]): boolean;
}
