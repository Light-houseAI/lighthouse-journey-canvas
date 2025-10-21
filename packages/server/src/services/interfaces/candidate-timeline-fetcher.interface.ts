/**
 * Interface for fetching candidate timelines with permission checks
 * Part of LIG-207 Career Trajectory Matching
 */

import type { TimelineNode } from '@journey/schema';
import type { MatchedTimelineNode as MatchedNode } from '@journey/schema';

export interface ICandidateTimelineFetcher {
  /**
   * Fetch timelines for candidate users with permission filtering
   *
   * @param candidateUserIds - Array of candidate user IDs from GraphRAG
   * @param requestingUserId - User requesting the timelines (for permission checks)
   * @param matchedNodesByUser - Optional pre-filtered matched nodes from GraphRAG (preferred)
   * @returns Array of timelines with user IDs, filtered by permissions
   */
  fetchTimelinesForCandidates(
    candidateUserIds: number[],
    requestingUserId: number,
    matchedNodesByUser?: Map<number, MatchedNode[]>
  ): Promise<Array<{ userId: number; timeline: TimelineNode[] }>>;
}
