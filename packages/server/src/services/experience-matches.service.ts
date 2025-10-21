/**
 * Experience Matches Service (LIG-182, LIG-193, LIG-207)
 *
 * Service for detecting and fetching matches for current experience nodes (jobs, education, and career transitions).
 * Integrates with GraphRAG search to find relevant profiles and opportunities.
 *
 * LIG-193: Enhanced to include recent update notes for CareerTransition nodes in search queries.
 * LIG-207: Added hybrid matching for job applications (GraphRAG + trajectory-based matching).
 */

import type { TimelineNode, UpdatesListResponse } from '@journey/schema';
import type { GraphRAGSearchResponse } from '@journey/schema';
import { TimelineNodeType } from '@journey/schema';
import { ApplicationStatus } from '@journey/schema';

import type { Logger } from '../core/logger';
import { NodeFilter } from '../repositories/filters/node-filter';
import type { IHierarchyRepository } from '../repositories/interfaces/hierarchy.repository.interface';
import {
  buildSearchQuery,
  isCurrentExperience,
} from '../utils/experience-utils';
import type { IPgVectorGraphRAGService } from './interfaces';
import type { IExperienceMatchesService } from './interfaces';
import type { ICareerInsightsGenerator } from './interfaces/career-insights-generator.interface';
import type { IHybridJobApplicationMatchingService } from './interfaces/hybrid-job-application-matching.interface';

/**
 * Minimal interface for UpdatesService dependency (LIG-193)
 * Only includes the method needed by ExperienceMatchesService
 */
export interface IUpdatesService {
  getUpdatesByNodeId(
    userId: number,
    nodeId: string,
    options: { page: number; limit: number }
  ): Promise<UpdatesListResponse>;
}

export interface ExperienceMatchesServiceDependencies {
  logger: Logger;
  hierarchyRepository: IHierarchyRepository;
  pgVectorGraphRAGService: IPgVectorGraphRAGService;
  updatesService: IUpdatesService; // LIG-193: For fetching career transition updates
  hybridJobApplicationMatchingService?: IHybridJobApplicationMatchingService; // LIG-207: Optional for hybrid matching
  careerInsightsGeneratorService?: ICareerInsightsGenerator; // LIG-207: Optional for career insights
}

export class ExperienceMatchesService implements IExperienceMatchesService {
  private readonly logger: Logger;
  private readonly hierarchyRepository: IHierarchyRepository;
  private readonly pgVectorGraphRAGService: IPgVectorGraphRAGService;
  private readonly updatesService: IUpdatesService; // LIG-193
  private readonly hybridJobApplicationMatchingService?: IHybridJobApplicationMatchingService; // LIG-207
  private readonly careerInsightsGeneratorService?: ICareerInsightsGenerator; // LIG-207

  // Cache configuration
  private readonly DEFAULT_MATCH_LIMIT = 3;

  // LIG-193: Update fetching configuration
  private readonly UPDATE_WINDOW_DAYS = 30; // Only include updates from last 30 days
  private readonly PAGINATION_LIMIT = 100; // Updates per page when fetching
  private readonly QUERY_LENGTH_WARNING_THRESHOLD = 2000; // Warn if query exceeds this length

  constructor({
    logger,
    hierarchyRepository,
    pgVectorGraphRAGService,
    updatesService,
    hybridJobApplicationMatchingService,
    careerInsightsGeneratorService,
  }: ExperienceMatchesServiceDependencies) {
    this.logger = logger;
    this.hierarchyRepository = hierarchyRepository;
    this.pgVectorGraphRAGService = pgVectorGraphRAGService;
    this.updatesService = updatesService; // LIG-193
    this.hybridJobApplicationMatchingService =
      hybridJobApplicationMatchingService; // LIG-207
    this.careerInsightsGeneratorService = careerInsightsGeneratorService; // LIG-207
  }

  /**
   * Check if node is a job application (LIG-206 Phase 6)
   */
  private isJobApplication(node: TimelineNode): boolean {
    return node.type === 'event' && node.meta?.eventType === 'job-application';
  }

  /**
   * Build search query from job application fields (LIG-206 Phase 6, LIG-207 Enhanced)
   * Uses status-aware context to find candidates who progressed past user's stage
   */
  private buildJobApplicationQuery(node: TimelineNode): string {
    const company = node.meta?.company || '';
    const jobTitle = node.meta?.jobTitle || '';
    const status = node.meta?.applicationStatus;

    // Base: company + role
    let query = `${company} ${jobTitle}`;

    // Status-specific context - find people who COMPLETED/PASSED this stage
    if (status) {
      const statusContext = this.getStatusSearchContext(status);
      query += ` ${statusContext}`;
    } else {
      // Fallback for applications without status
      query += ' interview experience feedback';
    }

    // Enrich with LLM summary if available (user-specific prep notes)
    if (status && node.meta?.statusData?.[status]?.llmSummary) {
      query += ` ${node.meta.statusData[status].llmSummary}`;
    }

    // LIG-207: Also include general interview context for richer matching
    if (node.meta?.llmInterviewContext) {
      query += ` ${node.meta.llmInterviewContext}`;
    }

    return query.trim();
  }

  /**
   * Get search context based on application status
   * Maps status to what candidates SHOULD HAVE DONE to help current user
   * Focus: Find people who progressed PAST this stage with real feedback
   */
  private getStatusSearchContext(status: string): string {
    const statusContextMap: Record<string, string> = {
      // Early stages: Find people who PASSED these stages
      [ApplicationStatus.Applied]: 'passed application review got interview',
      [ApplicationStatus.RecruiterScreen]:
        'passed recruiter screening phone interview feedback',

      // Interview stages: Find people who COMPLETED and PASSED
      [ApplicationStatus.PhoneInterview]:
        'completed phone interview technical round feedback notes',
      [ApplicationStatus.TechnicalInterview]:
        'passed technical interview onsite preparation feedback',
      [ApplicationStatus.OnsiteInterview]:
        'completed onsite interview final round feedback experience',
      [ApplicationStatus.FinalInterview]:
        'passed final interview received offer feedback',

      // Success stages: Find people who ACHIEVED this
      [ApplicationStatus.Offer]:
        'received offer accepted negotiation experience',
      [ApplicationStatus.OfferAccepted]:
        'accepted offer joined company onboarding experience',

      // Failure stages: Find people who RECOVERED or learned from similar
      [ApplicationStatus.Rejected]:
        'interview feedback rejection lessons learned reapplied',
      [ApplicationStatus.OfferDeclined]:
        'declined offer decision factors alternative choices',
      [ApplicationStatus.Withdrawn]: 'withdrew application decision experience',
      [ApplicationStatus.Ghosted]:
        'no response follow-up strategies alternative approaches',
    };

    return statusContextMap[status] || 'interview experience feedback';
  }

  /**
   * Get immediate children of a career transition node that are job applications
   * Filters to job application events only and respects user permissions
   *
   * @returns Job application children or empty array on error (graceful fallback)
   */
  private async getCareerTransitionChildren(
    parentNodeId: string,
    userId: number
  ): Promise<TimelineNode[]> {
    try {
      // Fetch all user nodes with permission filtering
      const nodeFilter = NodeFilter.Of(userId).build();
      const allNodes = await this.hierarchyRepository.getAllNodes(nodeFilter);

      // Filter to immediate children that are job applications
      const children = allNodes.filter(
        (node) =>
          node.parentId === parentNodeId &&
          node.type === 'event' &&
          node.meta?.eventType === 'job-application'
      );

      this.logger.debug('Fetched career transition children', {
        parentNodeId,
        userId,
        totalNodes: allNodes.length,
        childrenFound: children.length,
      });

      return children;
    } catch (error) {
      this.logger.warn('Failed to fetch career transition children', {
        parentNodeId,
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return []; // Graceful fallback
    }
  }

  /**
   * Get matches for an experience node
   * Returns GraphRAG search response format for consistency
   */
  async getExperienceMatches(
    nodeId: string,
    userId: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _forceRefresh = false // Reserved for future cache implementation
  ): Promise<GraphRAGSearchResponse | null> {
    try {
      // Fetch the node
      const node = await this.hierarchyRepository.getById(nodeId, userId);

      if (!node) {
        this.logger.warn('Node not found', { nodeId });
        return null;
      }

      // User access already verified by getById method

      // LIG-206 Phase 6: Check if it's a job application or experience node
      const isJobApp = this.isJobApplication(node);
      const isExperienceNode =
        node.type === TimelineNodeType.Job ||
        node.type === TimelineNodeType.Education ||
        node.type === TimelineNodeType.CareerTransition;

      if (!isJobApp && !isExperienceNode) {
        this.logger.info('Node is not an experience type or job application', {
          nodeId,
          type: node.type,
        });
        return null;
      }

      // LIG-207: Use hybrid matching for job applications if service available
      if (isJobApp && this.hybridJobApplicationMatchingService) {
        try {
          // Fetch user's full timeline for trajectory matching
          const nodeFilter = NodeFilter.Of(userId).build();
          const userTimeline =
            await this.hierarchyRepository.getAllNodes(nodeFilter);

          // Extract target role and company from job application metadata
          // LIG-207: Always use the node's OWN company and role, not siblings
          const targetRole = node.meta?.jobTitle;
          const targetCompany = node.meta?.company;

          this.logger.info('Using hybrid matching for job application', {
            nodeId,
            userId,
            targetRole,
            targetCompany,
            userTimelineLength: userTimeline.length,
          });

          // Run hybrid matching (GraphRAG + Trajectory) with status-aware context
          const hybridResults =
            await this.hybridJobApplicationMatchingService.findMatchesForJobApplication(
              nodeId,
              userId,
              userTimeline,
              targetRole,
              targetCompany,
              node.meta?.applicationStatus // LIG-207: Pass status for status-aware matching
            );

          // LIG-207: Enrich profiles with career insights if service available
          if (
            this.careerInsightsGeneratorService &&
            hybridResults.profiles.length > 0
          ) {
            try {
              const enrichedProfiles = await this.enrichProfilesWithInsights(
                hybridResults.profiles,
                node,
                userId
              );
              return {
                ...hybridResults,
                profiles: enrichedProfiles,
              };
            } catch (error) {
              // Graceful degradation: return results without insights on error
              this.logger.warn(
                'Failed to enrich profiles with career insights',
                {
                  nodeId,
                  userId,
                  error: error instanceof Error ? error.message : String(error),
                }
              );
            }
          }

          return hybridResults;
        } catch (error) {
          // Graceful degradation: fall back to GraphRAG-only if hybrid fails
          this.logger.warn(
            'Hybrid matching failed, falling back to GraphRAG-only',
            {
              nodeId,
              userId,
              error: error instanceof Error ? error.message : String(error),
            }
          );
          // Continue to GraphRAG-only matching below
        }
      }

      // Check if it's a current experience (only for experience nodes, not job applications)
      if (isExperienceNode && !isCurrentExperience(node)) {
        this.logger.info('Experience is not current', { nodeId });
        // Return empty GraphRAG response
        return {
          query: '',
          totalResults: 0,
          profiles: [],
          timestamp: new Date().toISOString(),
        };
      }

      // LIG-193: Fetch updates for CareerTransition nodes
      // This enhances the search query with recent activity notes to provide
      // more context to the GraphRAG matching system
      let updateNotes: string[] | undefined;

      if (node.type === TimelineNodeType.CareerTransition) {
        try {
          // Fetch ALL updates using pagination
          // Important: We loop through all pages to ensure we don't miss any updates
          const allUpdates: any[] = [];
          let page = 1;
          let hasMore = true;

          while (hasMore) {
            const result = await this.updatesService.getUpdatesByNodeId(
              userId,
              nodeId,
              { page, limit: this.PAGINATION_LIMIT }
            );
            allUpdates.push(...result.updates);
            hasMore = result.pagination.hasNext;
            page++;
          }

          // Filter to last N days to keep queries relevant and focused
          // Older updates are less relevant for current matching
          const windowStartDate = new Date();
          windowStartDate.setDate(
            windowStartDate.getDate() - this.UPDATE_WINDOW_DAYS
          );

          const recentUpdates = allUpdates.filter(
            (update) => new Date(update.createdAt) >= windowStartDate
          );

          // Extract notes from UpdateResponse objects
          // Sort reverse chronological (most recent first) for better context
          updateNotes = recentUpdates
            .sort(
              (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime()
            )
            .map((u) => u.notes)
            .filter((note): note is string => !!note && note.trim().length > 0);

          // Enhanced logging for monitoring and debugging
          this.logger.info('Including updates in query', {
            nodeId,
            updateCount: updateNotes.length,
            paginationCalls: page - 1,
            dateRange:
              recentUpdates.length > 0
                ? {
                    oldest: recentUpdates[recentUpdates.length - 1].createdAt,
                    newest: recentUpdates[0].createdAt,
                  }
                : null,
          });
        } catch (error) {
          // Graceful degradation: if we can't fetch updates, continue with node-only matching
          // This ensures the feature doesn't break existing functionality
          this.logger.warn(
            'Failed to fetch updates, continuing with node-only matching',
            {
              nodeId,
              error: error instanceof Error ? error.message : String(error),
            }
          );
        }
      }

      // LIG-206 Phase 6: Build search query based on node type
      let searchQuery: string;
      if (isJobApp) {
        searchQuery = this.buildJobApplicationQuery(node);
        this.logger.debug('Built job application query', {
          nodeId,
          queryLength: searchQuery.length,
        });
      } else {
        searchQuery = buildSearchQuery(node, updateNotes);
        this.logger.debug('Built experience query', {
          nodeId,
          queryLength: searchQuery.length,
        });
      }

      // Query length monitoring to prevent potential GraphRAG performance issues
      // The 2000-character threshold is a soft limit based on typical GraphRAG performance
      if (searchQuery.length > this.QUERY_LENGTH_WARNING_THRESHOLD) {
        const baseQuery = buildSearchQuery(node);
        this.logger.warn('Query length exceeds recommended limit', {
          nodeId,
          totalLength: searchQuery.length,
          baseLength: baseQuery.length,
          updatesLength: searchQuery.length - baseQuery.length,
          updateCount: updateNotes?.length || 0,
        });
      }

      this.logger.debug('Search query built', {
        nodeId,
        queryLength: searchQuery.length,
      });

      if (!searchQuery) {
        this.logger.warn('Unable to build search query from node', { nodeId });
        // Return empty GraphRAG response
        return {
          query: '',
          totalResults: 0,
          profiles: [],
          timestamp: new Date().toISOString(),
        };
      }

      // Call GraphRAG service to find matches
      // This returns the full ProfileResult with whyMatched, skills, matchedNodes, etc.
      const searchResults = await this.pgVectorGraphRAGService.searchProfiles({
        query: searchQuery,
        limit: this.DEFAULT_MATCH_LIMIT,
        excludeUserId: userId, // Exclude the user's own profile
        requestingUserId: userId, // Pass requesting user for permission checks
      });

      // Return the GraphRAG response directly
      // This ensures consistency with /api/v2/graphrag/search
      return searchResults;
    } catch (error) {
      this.logger.error('Failed to get experience matches', error as Error, {
        nodeId,
      });
      throw error;
    }
  }

  /**
   * Validate if a node should show matches (LIG-206 Phase 6: Updated to support job applications)
   */
  async shouldShowMatches(nodeId: string, userId: number): Promise<boolean> {
    try {
      const node = await this.hierarchyRepository.getById(nodeId, userId);

      if (!node) {
        return false;
      }

      // LIG-206 Phase 6: Show matches for job applications and current experience nodes
      if (this.isJobApplication(node)) {
        return true;
      }

      // Only show for current experience nodes
      const isExperienceNode =
        node.type === TimelineNodeType.Job ||
        node.type === TimelineNodeType.Education ||
        node.type === TimelineNodeType.CareerTransition;

      return isExperienceNode && isCurrentExperience(node);
    } catch (error) {
      this.logger.error(
        'Failed to check if should show matches',
        error as Error,
        { nodeId }
      );
      return false;
    }
  }

  /**
   * Invalidate cache for a specific node
   * Called when a node is updated
   */
  async invalidateCache(nodeId: string): Promise<void> {
    // In a real implementation, this would invalidate Redis/cache layer
    // For now, we rely on TanStack Query's cache invalidation on the frontend
    this.logger.info('Cache invalidated for node', { nodeId });
  }

  /**
   * LIG-207: Enrich matched profiles with career transition insights
   *
   * For each matched candidate:
   * 1. Query candidate's timeline to find job application nodes
   * 2. Filter to job applications matching target company/role
   * 3. Extract ApplicationStatus from the job application metadata
   * 4. Generate career insights using CareerInsightsGeneratorService
   * 5. Add insights to profile.careerInsights
   *
   * Graceful degradation: On any error, profile is returned without insights
   */
  private async enrichProfilesWithInsights(
    profiles: any[], // ProfileResult[]
    targetNode: TimelineNode
  ): Promise<any[]> {
    // Extract target context from the job application node
    const targetRole = targetNode.meta?.jobTitle;
    const targetCompany = targetNode.meta?.company;

    this.logger.info('Enriching profiles with career insights', {
      profileCount: profiles.length,
      targetRole,
      targetCompany,
      targetNodeId: targetNode.id,
    });

    // Enrich each profile concurrently
    const enrichedProfiles = await Promise.all(
      profiles.map(async (profile) => {
        try {
          const candidateUserId = Number(profile.id);

          // Fetch candidate's full timeline to find job application nodes
          const nodeFilter = NodeFilter.Of(candidateUserId).build();
          const candidateTimeline =
            await this.hierarchyRepository.getAllNodes(nodeFilter);

          this.logger.debug('Fetched candidate timeline for insights', {
            candidateUserId,
            timelineNodeCount: candidateTimeline.length,
          });

          // Find job application nodes matching target company/role
          // Use case-insensitive partial matching for flexibility
          const normalizeString = (str?: string) =>
            str?.toLowerCase().trim() || '';

          const normalizedTargetCompany = normalizeString(targetCompany);
          const normalizedTargetRole = normalizeString(targetRole);

          const matchingJobApps = candidateTimeline.filter((node) => {
            if (
              node.type !== 'event' ||
              node.meta?.eventType !== 'job-application'
            ) {
              return false;
            }

            const candidateCompany = normalizeString(node.meta?.company);
            const candidateRole = normalizeString(node.meta?.jobTitle);

            // Match if company or role contains/is contained by target (partial match)
            const companyMatch =
              normalizedTargetCompany &&
              candidateCompany &&
              (candidateCompany.includes(normalizedTargetCompany) ||
                normalizedTargetCompany.includes(candidateCompany));

            const roleMatch =
              normalizedTargetRole &&
              candidateRole &&
              (candidateRole.includes(normalizedTargetRole) ||
                normalizedTargetRole.includes(candidateRole));

            const matched = companyMatch || roleMatch;

            // Enhanced logging for debugging
            if (candidateUserId === 3 || candidateUserId === 6) {
              this.logger.debug('Job app matching logic for user', {
                candidateUserId,
                candidateCompany,
                candidateRole,
                targetCompany: normalizedTargetCompany,
                targetRole: normalizedTargetRole,
                companyMatch,
                roleMatch,
                matched,
                nodeId: node.id,
              });
            }

            return matched;
          });

          this.logger.debug('Found matching job applications', {
            candidateUserId,
            matchingCount: matchingJobApps.length,
            targetCompany,
            targetRole,
          });

          if (matchingJobApps.length === 0) {
            this.logger.warn(
              'No matching job applications found for candidate, skipping insights',
              {
                candidateUserId,
                candidateName: profile.name,
                targetCompany,
                targetRole,
                totalJobApps: candidateTimeline.filter(
                  (n) =>
                    n.type === 'event' &&
                    n.meta?.eventType === 'job-application'
                ).length,
              }
            );
            return profile;
          }

          // Use the most recent matching job application
          const jobAppNode = matchingJobApps.sort(
            (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
          )[0];

          // Extract application status from job application metadata
          const currentStatus = jobAppNode.meta?.applicationStatus;
          if (!currentStatus) {
            this.logger.warn(
              'No application status found for job application, skipping insights',
              {
                candidateUserId,
                candidateName: profile.name,
                jobAppNodeId: jobAppNode.id,
                jobAppCompany: jobAppNode.meta?.company,
                jobAppRole: jobAppNode.meta?.jobTitle,
                availableMetaKeys: Object.keys(jobAppNode.meta || {}),
              }
            );
            return profile;
          }

          // Generate career insights
          const insights =
            await this.careerInsightsGeneratorService!.generateInsights({
              candidateUserId,
              candidateName: profile.name,
              jobApplicationNodeId: jobAppNode.id,
              currentStatus: currentStatus as ApplicationStatus,
              targetRole,
              targetCompany,
            });

          this.logger.debug('Generated career insights for candidate', {
            candidateUserId,
            insightCount: insights.length,
          });

          // Add insights to profile
          const enrichedProfile = {
            ...profile,
            careerInsights: insights,
          };

          this.logger.debug('Enriched profile with insights', {
            candidateUserId,
            hasCareerInsights: 'careerInsights' in enrichedProfile,
            careerInsightsLength: enrichedProfile.careerInsights?.length || 0,
            profileKeys: Object.keys(enrichedProfile),
          });

          return enrichedProfile;
        } catch (error) {
          // Graceful degradation: log error but return profile without insights
          this.logger.warn('Failed to generate insights for candidate', {
            candidateUserId: profile.id,
            error: error instanceof Error ? error.message : String(error),
          });
          return profile;
        }
      })
    );

    this.logger.info('Profile enrichment completed', {
      enrichedCount: enrichedProfiles.filter(
        (p) => p.careerInsights?.length > 0
      ).length,
      totalProfiles: profiles.length,
    });

    return enrichedProfiles;
  }
}
