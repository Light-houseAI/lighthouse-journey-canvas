import {
  type InsightCreateDTO,
  type InsightUpdateDTO,
  isEducationNode,
  isJobNode,
  isProjectNode,
  type NodeInsight,
  type TimelineNode,
  TimelineNodeType,
  VisibilityLevel,
} from '@journey/schema';

import type { Logger } from '../core/logger';
import { NodeFilter } from '../repositories/filters/node-filter';
import type {
  BatchAuthorizationResult,
  CreateNodeRequest,
  IHierarchyRepository,
  UpdateNodeRequest,
} from '../repositories/interfaces/hierarchy.repository.interface';
import type {
  CreateInsightRequest,
  IInsightRepository,
} from '../repositories/interfaces/insight.repository.interface';
import type { IOrganizationRepository } from '../repositories/interfaces/organization.repository.interface';
import type { GcsUploadService } from './gcs-upload.service';
import type {
  IExperienceMatchesService,
  IHierarchyService,
} from './interfaces';
import type { LLMSummaryService } from './llm-summary.service';
import type { NodePermissionService } from './node-permission.service';
import type { OpenAIEmbeddingService } from './openai-embedding.service';
import type { PgVectorGraphRAGService } from './pgvector-graphrag.service';
import { UserService } from './user-service';

export interface CreateNodeDTO {
  type:
    | 'job'
    | 'education'
    | 'project'
    | 'event'
    | 'action'
    | 'careerTransition';
  parentId?: string | null;
  meta?: Record<string, unknown>;
}

export interface UpdateNodeDTO {
  meta?: Record<string, unknown>;
  parentId?: string | null;
}

export interface NodeWithParent extends TimelineNode {
  parent?: {
    id: string;
    type: string;
    title?: string;
  } | null;
  owner?: {
    id: number;
    userName?: string;
    firstName?: string;
    lastName?: string;
    email: string;
  } | null;
  permissions?: {
    canView: boolean;
    canEdit: boolean;
    canShare: boolean;
    canDelete: boolean;
    accessLevel: VisibilityLevel;
    shouldShowMatches: boolean;
  } | null;
}

/**
 * Enhanced node interface with permission metadata for API responses
 */
export interface NodeWithParentAndPermissions extends NodeWithParent {
  permissions: {
    canView: boolean;
    canEdit: boolean;
    canShare: boolean;
    canDelete: boolean;
    accessLevel: VisibilityLevel;
    shouldShowMatches: boolean;
  };
}

export class HierarchyService implements IHierarchyService {
  private repository: IHierarchyRepository;
  private insightRepository: IInsightRepository;
  private nodePermissionService: NodePermissionService;
  private organizationRepository: IOrganizationRepository;
  private userService: UserService;
  private logger: Logger;
  private pgvectorService: PgVectorGraphRAGService;
  private embeddingService: OpenAIEmbeddingService;
  private experienceMatchesService: IExperienceMatchesService;
  private llmSummaryService?: LLMSummaryService;
  private gcsUploadService?: GcsUploadService;

  constructor({
    hierarchyRepository,
    insightRepository,
    nodePermissionService,
    organizationRepository,
    userService,
    logger,
    pgVectorGraphRAGService,
    openAIEmbeddingService,
    experienceMatchesService,
    llmSummaryService,
    gcsUploadService,
  }: {
    hierarchyRepository: IHierarchyRepository;
    insightRepository: IInsightRepository;
    nodePermissionService: NodePermissionService;
    organizationRepository: IOrganizationRepository;
    userService: UserService;
    logger: Logger;
    pgVectorGraphRAGService: PgVectorGraphRAGService;
    openAIEmbeddingService: OpenAIEmbeddingService;
    experienceMatchesService: IExperienceMatchesService;
    llmSummaryService?: LLMSummaryService;
    gcsUploadService?: GcsUploadService;
  }) {
    this.repository = hierarchyRepository;
    this.insightRepository = insightRepository;
    this.nodePermissionService = nodePermissionService;
    this.organizationRepository = organizationRepository;
    this.userService = userService;
    this.logger = logger;
    this.pgvectorService = pgVectorGraphRAGService;
    this.embeddingService = openAIEmbeddingService;
    this.experienceMatchesService = experienceMatchesService;
    this.llmSummaryService = llmSummaryService;
    this.gcsUploadService = gcsUploadService;
  }

  /**
   * Sync timeline node to pgvector for search functionality
   * Called automatically after node create/update operations
   */
  private async syncNodeToPgvector(node: TimelineNode): Promise<void> {
    if (!this.pgvectorService) {
      return;
    }

    try {
      const nodeText = await this.generateNodeText(node);
      const embedding = await this.embeddingService.generateEmbedding(nodeText);

      // Fetch insights for this node to include in metadata
      const nodeMetaWithInsights = { ...node.meta };

      try {
        const insights = await this.insightRepository.findByNodeId(node.id);
        if (insights && insights.length > 0) {
          // Transform insights to match the expected format for GraphRAG
          nodeMetaWithInsights.insights = insights.map((insight) => {
            // Ensure resources is always an array
            let resources = [];
            if (insight.resources) {
              if (Array.isArray(insight.resources)) {
                resources = insight.resources;
              } else if (typeof insight.resources === 'string') {
                try {
                  resources = JSON.parse(insight.resources);
                  if (!Array.isArray(resources)) {
                    resources = [];
                  }
                } catch {
                  resources = [];
                }
              }
            }

            return {
              text: insight.description,
              category: 'general', // You might want to add a category field to insights
              resources: resources,
            };
          });

          this.logger.debug('Included insights in node sync', {
            nodeId: node.id,
            insightCount: insights.length,
          });
        }
      } catch (insightError) {
        this.logger.warn(
          'Failed to fetch insights for node sync, continuing without',
          {
            nodeId: node.id,
            error:
              insightError instanceof Error
                ? insightError.message
                : String(insightError),
          }
        );
      }

      const chunkResult = await this.pgvectorService.createChunk({
        userId: node.userId,
        nodeId: node.id,
        chunkText: nodeText,
        embedding: Array.from(embedding),
        nodeType: node.type,
        meta: nodeMetaWithInsights, // Now includes insights
        tenantId: 'default',
      });

      this.logger.debug('Node synced to pgvector successfully', {
        nodeId: node.id,
        chunkResult: chunkResult,
        embeddingLength: embedding.length,
        nodeTextLength: nodeText.length,
        hasInsights: !!nodeMetaWithInsights.insights,
      });
    } catch (error) {
      this.logger.warn('Failed to sync node to pgvector', {
        nodeId: node.id,
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw error - pgvector sync should not break main operations
    }
  }

  /**
   * Remove node from pgvector tables
   */
  private async removeNodeFromPgvector(nodeId: string): Promise<void> {
    if (!this.pgvectorService) {
      return;
    }

    try {
      const pgvectorRepo = (
        this.pgvectorService as unknown as { repository: unknown }
      ).repository;

      // Remove chunks associated with this node
      await (pgvectorRepo as any).removeChunksByNodeId(nodeId);

      this.logger.debug('Node removed from pgvector successfully', { nodeId });
    } catch (error) {
      this.logger.warn('Failed to remove node from pgvector', {
        nodeId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Generate searchable text from node data with organization info
   */
  private async generateNodeText(node: TimelineNode): Promise<string> {
    const parts: string[] = [];

    // Add node type
    parts.push(`${node.type} entry`);

    // Extract meaningful text from meta using type guards for type safety
    if (isJobNode(node)) {
      // TypeScript now knows node.meta is JobMeta
      // Fetch organization name for better search matching
      if (node.meta.orgId) {
        try {
          const org = await this.organizationRepository.getById(
            node.meta.orgId
          );
          if (org?.name) {
            parts.push(`at ${org.name}`);
          }
        } catch (error) {
          this.logger.warn('Failed to fetch organization for job node', {
            orgId: node.meta.orgId,
            error,
          });
        }
      }
      if (node.meta.role) parts.push(`as ${node.meta.role}`);
      if (node.meta.description) parts.push(node.meta.description);
      if (node.meta.location) parts.push(`in ${node.meta.location}`);
    } else if (isEducationNode(node)) {
      // TypeScript now knows node.meta is EducationMeta
      // Fetch institution name for better search matching
      if (node.meta.orgId) {
        try {
          const org = await this.organizationRepository.getById(
            node.meta.orgId
          );
          if (org?.name) {
            parts.push(`at ${org.name}`);
          }
        } catch (error) {
          this.logger.warn('Failed to fetch organization for education node', {
            orgId: node.meta.orgId,
            error,
          });
        }
      }
      if (node.meta.degree) parts.push(`${node.meta.degree}`);
      if (node.meta.field) parts.push(`in ${node.meta.field}`);
      if (node.meta.description) parts.push(node.meta.description);
    } else if (isProjectNode(node)) {
      // TypeScript now knows node.meta is ProjectMeta
      if (node.meta.name) parts.push(node.meta.name);
      if (node.meta.description) parts.push(node.meta.description);
      if (node.meta.technologies) {
        parts.push(`using ${node.meta.technologies.join(', ')}`);
      }
    } else {
      // Fallback for other node types (Event, Action, CareerTransition)
      const meta = node.meta as Record<string, any>;
      if (meta.title) parts.push(meta.title);
      if (meta.description) parts.push(meta.description);
    }

    return parts.join(' ').trim();
  }

  /**
   * Create a new timeline node with full validation
   */
  async createNode(
    dto: CreateNodeDTO,
    userId: number
  ): Promise<NodeWithParent> {
    this.logger.debug('Creating node via service', { dto, userId });

    // Enrich meta with LLM summaries if this is a job application event
    let enrichedMeta = dto.meta || {};
    if (this.llmSummaryService) {
      // Fetch user info for third-person narratives
      let userInfo = undefined;
      try {
        const user = await this.userService.getUserById(userId);
        if (user) {
          userInfo = {
            firstName: user.firstName ?? undefined,
            lastName: user.lastName ?? undefined,
          };
        }
      } catch (error) {
        this.logger.warn('Failed to fetch user info for LLM summary', {
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      try {
        enrichedMeta =
          await this.llmSummaryService.enrichApplicationWithSummaries(
            enrichedMeta,
            dto.type,
            userId,
            userInfo
          );
      } catch (error) {
        this.logger.warn('Failed to enrich node with LLM summaries', {
          userId,
          nodeType: dto.type,
          error: error instanceof Error ? error.message : String(error),
        });
        // Continue with original meta if LLM enrichment fails
      }
    }

    const createRequest: CreateNodeRequest = {
      type: dto.type,
      parentId: dto.parentId,
      meta: enrichedMeta,
      userId,
    };

    const created = await this.repository.createNode(createRequest);

    // Sync to pgvector for search functionality
    await this.syncNodeToPgvector(created);

    // Establish default permissions for the newly created node
    // This ensures the owner has full access and the permission repository knows about ownership
    try {
      await this.nodePermissionService.setNodePermissions(
        created.id,
        {
          policies: [], // Empty policies array means only owner has access (default behavior)
        },
        userId
      );

      this.logger.debug('Default permissions established for new node', {
        nodeId: created.id,
        userId,
      });
    } catch (error) {
      this.logger.warn('Failed to establish default permissions for new node', {
        nodeId: created.id,
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't fail node creation if permission setup fails
    }

    // Enrich response with parent information if applicable
    return this.enrichWithParentInfo(created, userId);
  }

  /**
   * Get node by ID with parent information
   */
  async getNodeById(
    nodeId: string,
    userId: number
  ): Promise<NodeWithParentAndPermissions | null> {
    const node = await this.repository.getById(nodeId, userId);

    if (!node) {
      return null;
    }

    const enrichedNode = await this.enrichWithParentInfo(node, userId);
    const isOwnerView = enrichedNode.userId === userId;
    return this.enrichWithPermissions(enrichedNode, userId, isOwnerView);
  }

  /**
   * Replace node with validation (PUT semantics - full replacement)
   */
  async replaceNode(
    nodeId: string,
    dto: UpdateNodeDTO,
    userId: number
  ): Promise<NodeWithParent | null> {
    this.logger.debug('Replacing node via service', { nodeId, dto, userId });

    const replaceRequest: UpdateNodeRequest = {
      id: nodeId,
      userId,
      ...(dto.meta && { meta: dto.meta }),
      ...(dto.parentId !== undefined && { parentId: dto.parentId }),
    };

    const replaced = await this.repository.replaceNode(replaceRequest);

    if (!replaced) {
      return null;
    }

    // Sync replaced node to pgvector
    this.syncNodeToPgvector(replaced).catch((error) => {
      this.logger.warn('Failed to sync replaced node to pgvector', {
        nodeId,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    return this.enrichWithParentInfo(replaced, userId);
  }

  /**
   * Update node with validation (PATCH semantics - partial update with merge)
   */
  async updateNode(
    nodeId: string,
    dto: UpdateNodeDTO,
    userId: number
  ): Promise<NodeWithParent | null> {
    this.logger.debug('Updating node via service', { nodeId, dto, userId });

    // Get the existing node to check its type
    const existingNode = await this.repository.getById(nodeId, userId);
    if (!existingNode) {
      return null;
    }

    // Enrich meta with LLM summaries if this is a job application event
    let enrichedMeta = dto.meta;
    if (
      this.llmSummaryService &&
      dto.meta &&
      existingNode.type === TimelineNodeType.Event
    ) {
      // Only enrich event nodes
      // Fetch user info for third-person narratives
      let userInfo = undefined;
      try {
        const user = await this.userService.getUserById(userId);
        if (user) {
          userInfo = {
            firstName: user.firstName ?? undefined,
            lastName: user.lastName ?? undefined,
          };
        }
      } catch (error) {
        this.logger.warn('Failed to fetch user info for LLM summary', {
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // Force regeneration - clear existing LLM summaries from statusData
      const metaWithClearedSummaries = {
        ...dto.meta,
        llmInterviewContext: undefined,
        // Clear LLM summaries from statusData while preserving user-entered data
        statusData: dto.meta.statusData
          ? Object.fromEntries(
              Object.entries(dto.meta.statusData as Record<string, any>).map(
                ([status, data]) => [
                  status,
                  {
                    todos: data.todos,
                    interviewContext: data.interviewContext,
                    // llmSummary intentionally omitted to trigger regeneration
                  },
                ]
              )
            )
          : undefined,
      };

      try {
        enrichedMeta =
          await this.llmSummaryService.enrichApplicationWithSummaries(
            metaWithClearedSummaries,
            existingNode.type,
            userId,
            userInfo
          );
      } catch (error) {
        this.logger.warn('Failed to enrich node with LLM summaries', {
          userId,
          nodeId,
          nodeType: existingNode.type,
          error: error instanceof Error ? error.message : String(error),
        });
        // Continue with cleared meta if LLM enrichment fails
        enrichedMeta = metaWithClearedSummaries;
      }
    }

    // Enrich application materials with LLM summaries if this is a career transition node
    this.logger.info('Checking application materials enrichment conditions', {
      hasLLMService: !!this.llmSummaryService,
      hasMeta: !!dto.meta,
      nodeType: existingNode.type,
      isCareerTransition:
        existingNode.type === TimelineNodeType.CareerTransition,
    });

    if (
      this.llmSummaryService &&
      dto.meta &&
      existingNode.type === TimelineNodeType.CareerTransition
    ) {
      this.logger.info('Triggering application materials enrichment', {
        userId,
        nodeId,
      });
      try {
        enrichedMeta =
          await this.llmSummaryService.enrichApplicationMaterialsWithSummaries(
            enrichedMeta || dto.meta,
            existingNode.type,
            userId
          );
        this.logger.info('Application materials enrichment completed', {
          userId,
          nodeId,
        });
      } catch (error) {
        this.logger.warn(
          'Failed to enrich application materials with LLM summaries',
          {
            userId,
            nodeId,
            error: error instanceof Error ? error.message : String(error),
          }
        );
        // Continue without material summaries if enrichment fails
      }

      // Generate networking summaries if networking data exists
      const networkingData = (enrichedMeta as any)?.networkingData;
      this.logger.info('Checking for networking data', {
        userId,
        nodeId,
        hasNetworkingData: !!networkingData,
        networkingDataType: typeof networkingData,
        hasActivities: !!networkingData?.activities,
      });

      if (networkingData && typeof networkingData === 'object') {
        const activitiesByType = networkingData.activities;

        // Flatten activities from all types
        const allActivities: any[] = [];
        if (activitiesByType && typeof activitiesByType === 'object') {
          for (const activities of Object.values(activitiesByType)) {
            if (Array.isArray(activities)) {
              allActivities.push(...activities);
            }
          }
        }

        this.logger.info('Flattened activities', {
          userId,
          nodeId,
          activityCount: allActivities.length,
          activitiesByType: Object.keys(activitiesByType || {}).length,
        });

        if (allActivities.length > 0) {
          this.logger.info('Triggering networking summaries generation', {
            userId,
            nodeId,
            activityCount: allActivities.length,
          });
          try {
            // Get user info for first name
            const user = await this.userService.getUserById(userId);
            const userInfo = {
              firstName: user?.firstName ?? undefined,
              lastName: user?.lastName ?? undefined,
            };

            const networkingSummaries =
              await this.llmSummaryService.generateNetworkingSummaries(
                allActivities,
                userInfo,
                userId
              );

            // Merge networking summaries into networkingData object
            const mergedNetworkingData = {
              ...networkingData,
              ...networkingSummaries,
            };

            enrichedMeta = {
              ...enrichedMeta,
              networkingData: mergedNetworkingData,
            };

            this.logger.info('Networking summaries generation completed', {
              userId,
              nodeId,
              hasOverallSummary: !!networkingSummaries.overallSummary,
              summaryCount: Object.keys(networkingSummaries.summaries || {})
                .length,
              keyPointsCount: Object.keys(networkingSummaries.keyPoints || {})
                .length,
              mergedKeys: Object.keys(mergedNetworkingData),
            });
          } catch (error) {
            this.logger.warn('Failed to generate networking summaries', {
              userId,
              nodeId,
              error: error instanceof Error ? error.message : String(error),
            });
            // Continue without networking summaries if generation fails
          }
        }
      }

      // Process brand building summaries if brandBuildingData exists
      const brandBuildingData = enrichedMeta?.brandBuildingData as any;
      if (brandBuildingData?.activities) {
        const activitiesByPlatform =
          brandBuildingData.activities as Record<string, any[]>;

        // Flatten activities from all platforms
        const allActivities: any[] = [];
        if (activitiesByPlatform && typeof activitiesByPlatform === 'object') {
          for (const activities of Object.values(activitiesByPlatform)) {
            if (Array.isArray(activities)) {
              allActivities.push(...activities);
            }
          }
        }

        this.logger.info('Flattened brand building activities', {
          userId,
          nodeId,
          activityCount: allActivities.length,
          activitiesByPlatform: Object.keys(activitiesByPlatform || {}).length,
        });

        if (allActivities.length > 0) {
          this.logger.info(
            'Triggering brand building summaries generation',
            {
              userId,
              nodeId,
              activityCount: allActivities.length,
            }
          );
          try {
            // Get user info for first name
            const user = await this.userService.getUserById(userId);
            const userInfo = {
              firstName: user?.firstName ?? undefined,
              lastName: user?.lastName ?? undefined,
            };

            const brandBuildingSummaries =
              await this.llmSummaryService.generateBrandBuildingSummaries(
                allActivities,
                userInfo,
                userId
              );

            // Merge brand building summaries into brandBuildingData object
            const mergedBrandBuildingData = {
              ...brandBuildingData,
              ...brandBuildingSummaries,
            };

            enrichedMeta = {
              ...enrichedMeta,
              brandBuildingData: mergedBrandBuildingData,
            };

            this.logger.info(
              'Brand building summaries generation completed',
              {
                userId,
                nodeId,
                hasOverallSummary: !!brandBuildingSummaries.overallSummary,
                summaryCount: Object.keys(
                  brandBuildingSummaries.summaries || {}
                ).length,
                keyPointsCount: Object.keys(
                  brandBuildingSummaries.keyPoints || {}
                ).length,
                mergedKeys: Object.keys(mergedBrandBuildingData),
              }
            );
          } catch (error) {
            this.logger.warn('Failed to generate brand building summaries', {
              userId,
              nodeId,
              error: error instanceof Error ? error.message : String(error),
            });
            // Continue without brand building summaries if generation fails
          }
        }
      }
    } else {
      this.logger.info('Skipping application materials enrichment', {
        reason: !this.llmSummaryService
          ? 'No LLM service'
          : !dto.meta
            ? 'No meta'
            : 'Not a career transition node',
      });
    }

    const updateRequest: UpdateNodeRequest = {
      id: nodeId,
      userId,
      ...(enrichedMeta && { meta: enrichedMeta }),
      ...(dto.parentId !== undefined && { parentId: dto.parentId }),
    };

    const updated = await this.repository.updateNode(updateRequest);

    if (!updated) {
      return null;
    }

    // Sync updated node to pgvector for search functionality (async, non-blocking)
    this.syncNodeToPgvector(updated).catch((error) => {
      this.logger.warn('Failed to sync updated node to pgvector', {
        nodeId,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    return this.enrichWithParentInfo(updated, userId);
  }

  /**
   * Delete node with cascade handling
   */
  async deleteNode(nodeId: string, userId: number): Promise<boolean> {
    this.logger.debug('Deleting node via service', { nodeId, userId });

    // Remove from pgvector (async, non-blocking) - can happen after deletion
    this.removeNodeFromPgvector(nodeId).catch((error) => {
      this.logger.warn('Failed to remove deleted node from pgvector', {
        nodeId,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    // Delegate to repository - it will handle non-existent nodes gracefully
    return await this.repository.deleteNode(nodeId, userId);
  }

  /**
   * Get all nodes as a flat list with optional permission filtering for username-based viewing
   * Now supports enhanced permission levels and actions
   */
  async getAllNodes(
    userId: number,
    filter?: NodeFilter
  ): Promise<NodeWithParent[]> {
    const requestingUserId = userId;
    const username = filter as any;
    let nodeFilter: NodeFilter;

    if (username) {
      // Look up target user by username
      const targetUser = await this.userService.getUserByUsername(username);
      if (!targetUser) {
        this.logger.debug('User not found for username', { username });
        return [];
      }

      // Check if requesting user is viewing their own nodes by username
      if (targetUser.id === requestingUserId) {
        // Create filter for viewing own nodes (no permission filtering needed)
        nodeFilter = NodeFilter.Of(requestingUserId).build();

        this.logger.debug('Fetching own nodes via username', {
          currentUserId: requestingUserId,
          username,
        });
      } else {
        // Create filter for viewing another user's nodes with specified permissions
        nodeFilter = NodeFilter.Of(requestingUserId).For(targetUser.id).build();

        this.logger.debug('Fetching nodes with permission filter', {
          currentUserId: requestingUserId,
          targetUserId: targetUser.id,
          username,
        });
      }
    } else {
      // Create filter for viewing own nodes with specified permissions
      nodeFilter = NodeFilter.Of(requestingUserId).build();
    }

    // Get filtered nodes from repository
    const allNodes = await this.repository.getAllNodes(nodeFilter);

    this.logger.debug('Retrieved nodes', {
      count: allNodes.length,
      currentUserId: nodeFilter.currentUserId,
      targetUserId: nodeFilter.targetUserId,
      action: nodeFilter.action,
      level: nodeFilter.level,
    });

    // Enrich with parent information
    return allNodes;
  }

  /**
   * Get all nodes with permission metadata for server-driven permission system
   * Owner views get full permissions without checks, viewer get calculated permissions
   */
  async getAllNodesWithPermissions(
    userId: number,
    filter?: NodeFilter
  ): Promise<NodeWithParentAndPermissions[]> {
    const requestingUserId = userId;
    const username = filter as any;
    // First get the regular nodes (this handles permission filtering)
    const nodesWithParent = await this.getAllNodes(
      requestingUserId,
      username as any
    );

    // Determine if this is an owner view or viewer view
    let isOwnerView = !username;

    if (username) {
      // Look up target user by username
      const targetUser = await this.userService.getUserByUsername(username);
      if (targetUser && targetUser.id === requestingUserId) {
        isOwnerView = true;
      }
    }

    // Enrich each node with permission metadata
    return Promise.all(
      nodesWithParent.map((node) =>
        this.enrichWithPermissions(node, requestingUserId, isOwnerView)
      )
    );
  }

  /**
   * Check permissions for multiple nodes efficiently
   * Prevents N+1 query problems when checking permissions for lists of nodes
   */
  async checkBatchAuthorization(
    requestingUserId: number,
    nodeIds: string[],
    targetUserId?: number,
    action: 'view' = 'view',
    level: 'overview' | 'full' = 'overview'
  ): Promise<BatchAuthorizationResult> {
    this.logger.debug('Checking batch authorization', {
      requestingUserId,
      targetUserId,
      nodeCount: nodeIds.length,
      action,
      level,
    });

    if (nodeIds.length === 0) {
      return { authorized: [], unauthorized: [], notFound: [] };
    }

    const filter = targetUserId
      ? NodeFilter.ForNodes(requestingUserId, nodeIds)
          .For(targetUserId)
          .WithAction(action)
          .AtLevel(level)
          .build()
      : NodeFilter.ForNodes(requestingUserId, nodeIds)
          .WithAction(action)
          .AtLevel(level)
          .build();

    return await this.repository.checkBatchAuthorization(filter);
  }

  /**
   * Enrich node with parent information, owner information, and permissions
   */
  private async enrichWithParentInfo(
    node: TimelineNode,
    userId: number
  ): Promise<NodeWithParent> {
    const enriched: NodeWithParent = {
      ...node,
      owner: null,
      permissions: null,
    };

    // Fetch owner information
    try {
      const owner = await this.userService.getUserById(node.userId);
      if (owner) {
        enriched.owner = {
          id: owner.id,
          userName: owner.userName ?? undefined,
          firstName: owner.firstName ?? undefined,
          lastName: owner.lastName ?? undefined,
          email: owner.email,
        };
      }
    } catch (error) {
      this.logger.warn('Failed to fetch owner information for node', {
        nodeId: node.id,
        userId: node.userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Compute permissions for the node
    try {
      // Check if user is owner
      const isOwner = node.userId === userId;

      // Check if node should show matches
      let shouldShowMatches = false;
      try {
        shouldShowMatches =
          await this.experienceMatchesService.shouldShowMatches(
            node.id,
            userId
          );
      } catch {
        this.logger.debug('Failed to determine shouldShowMatches for node', {
          nodeId: node.id,
          userId,
        });
        shouldShowMatches = false;
      }

      if (isOwner) {
        // Owner has full permissions
        enriched.permissions = {
          canView: true,
          canEdit: true,
          canShare: true,
          canDelete: true,
          accessLevel: VisibilityLevel.Full,
          shouldShowMatches,
        };
      } else {
        // Check viewer permissions
        const canView = await this.nodePermissionService.canAccess(
          node.id,
          userId
        );

        enriched.permissions = {
          canView,
          canEdit: false,
          canShare: false,
          canDelete: false,
          accessLevel: canView
            ? VisibilityLevel.Full
            : VisibilityLevel.Overview,
          shouldShowMatches,
        };
      }
    } catch (error) {
      this.logger.warn('Failed to compute permissions for node', {
        nodeId: node.id,
        error: error instanceof Error ? error.message : String(error),
      });
      // Set null permissions on error
      enriched.permissions = null;
    }

    // Enrich with organization data for job and education nodes
    await this.enrichWithOrganizationInfo(enriched);

    // Enrich application materials with download URLs
    await this.enrichWithApplicationMaterialUrls(enriched, userId);

    return enriched;
  }

  /**
   * Enrich node with organization information if orgId is present
   */
  private async enrichWithOrganizationInfo(
    node: NodeWithParent
  ): Promise<void> {
    const orgId = node.meta?.orgId as number;

    if (orgId && (node.type === 'job' || node.type === 'education')) {
      try {
        const organization = await this.organizationRepository.getById(orgId);
        if (organization) {
          // Add organization data to meta for client consumption
          node.meta = {
            ...node.meta,
            organizationName: organization.name,
            organizationType: organization.type,
          };

          this.logger.debug('Enriched node with organization data', {
            nodeId: node.id,
            orgId,
            orgName: organization.name,
          });
        }
      } catch (error) {
        this.logger.warn('Failed to enrich node with organization data', {
          nodeId: node.id,
          orgId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Enrich application materials with download URLs from storage keys
   * Generates signed URLs on-demand for secure file access
   */
  private async enrichWithApplicationMaterialUrls(
    node: NodeWithParent,
    userId: number
  ): Promise<void> {
    if (!this.gcsUploadService) {
      return;
    }

    // Check if node has application materials
    const applicationMaterials = node.meta?.applicationMaterials as {
      items?: Array<{
        resumeVersion?: {
          url?: string;
          storageKey?: string;
          [key: string]: unknown;
        };
        [key: string]: unknown;
      }>;
      [key: string]: unknown;
    };

    if (
      !applicationMaterials?.items ||
      applicationMaterials.items.length === 0
    ) {
      return;
    }

    // Enrich each item with download URL if storageKey exists
    for (const item of applicationMaterials.items) {
      if (item.resumeVersion?.storageKey && !item.resumeVersion.url) {
        try {
          const result = await this.gcsUploadService.getDownloadUrl(
            item.resumeVersion.storageKey,
            userId
          );
          item.resumeVersion.url = result.downloadUrl;

          this.logger.debug('Enriched resume with download URL', {
            nodeId: node.id,
            storageKey: item.resumeVersion.storageKey,
          });
        } catch (error) {
          this.logger.warn('Failed to generate download URL for resume', {
            nodeId: node.id,
            storageKey: item.resumeVersion.storageKey,
            error: error instanceof Error ? error.message : String(error),
          });
          // Continue without URL if generation fails
        }
      }
    }
  }

  /**
   * Enrich node with permission metadata for server-driven permissions
   */
  private async enrichWithPermissions(
    node: NodeWithParent,
    requestingUserId: number,
    isOwnerView: boolean
  ): Promise<NodeWithParentAndPermissions> {
    // Check if node should show matches using experience service
    let shouldShowMatches = false;
    try {
      shouldShowMatches = await this.experienceMatchesService.shouldShowMatches(
        node.id,
        requestingUserId
      );
    } catch (error) {
      this.logger.error(
        'Failed to determine shouldShowMatches for node',
        error instanceof Error ? error : new Error(String(error)),
        {
          nodeId: node.id,
          userId: requestingUserId,
        }
      );
      shouldShowMatches = false; // Default to false on error
    }

    if (isOwnerView) {
      // Owner view: Full permissions without checks
      return {
        ...node,
        permissions: {
          canView: true,
          canEdit: true,
          canShare: true,
          canDelete: true,
          accessLevel: VisibilityLevel.Full,
          shouldShowMatches,
        },
      };
    }

    // Viewer view: Calculate permissions using permission service
    const canView = await this.nodePermissionService.canAccess(
      node.id,
      requestingUserId
    );

    const canViewFull = await this.nodePermissionService.canAccess(
      node.id,
      requestingUserId
    );

    return {
      ...node,
      permissions: {
        canView,
        canEdit: false, // Viewers cannot edit (only owners can edit)
        canShare: false, // Viewers cannot change sharing settings
        canDelete: false, // Viewers cannot delete
        accessLevel: canViewFull
          ? VisibilityLevel.Full
          : VisibilityLevel.Overview,
        shouldShowMatches,
      },
    };
  }

  // Insights Operations

  /**
   * Get insights for a specific node
   */
  async getNodeInsights(
    nodeId: string,
    userId: number
  ): Promise<NodeInsight[]> {
    this.logger.debug('Getting insights for node', { nodeId, userId });

    // Check if user has Full access level or is owner to view insights
    const canViewFull = await this.nodePermissionService.canAccess(
      nodeId,
      userId
    );

    if (!canViewFull) {
      throw new Error('Full access required to view node insights');
    }

    return await this.insightRepository.findByNodeId(nodeId);
  }

  /**
   * Create a new insight for a node
   */
  async createInsight(
    nodeId: string,
    data: InsightCreateDTO,
    userId: number
  ): Promise<NodeInsight> {
    this.logger.debug('Creating insight for node', { nodeId, data, userId });

    // Verify node exists and belongs to user
    await this.verifyNodeOwnership(nodeId, userId);

    const createRequest: CreateInsightRequest = {
      nodeId,
      ...data,
    };

    const insight = await this.insightRepository.create(createRequest);

    // Re-sync node to pgvector with updated insights
    try {
      const node = await this.repository.getById(nodeId, userId);
      if (node) {
        await this.syncNodeToPgvector(node);
        this.logger.debug('Node re-synced to pgvector after insight creation', {
          nodeId,
        });
      }
    } catch (error) {
      this.logger.warn('Failed to re-sync node after insight creation', {
        nodeId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return insight;
  }

  /**
   * Update an existing insight
   */
  async updateInsight(
    insightId: string,
    data: InsightUpdateDTO,
    userId: number
  ): Promise<NodeInsight | null> {
    this.logger.debug('Updating insight', { insightId, data, userId });

    // Verify insight exists and node belongs to user
    const insight = await this.insightRepository.findById(insightId);
    if (!insight) {
      throw new Error('Insight not found');
    }

    await this.verifyNodeOwnership(insight.nodeId, userId);

    const updatedInsight = await this.insightRepository.update(insightId, data);

    // Re-sync node to pgvector with updated insights
    if (updatedInsight) {
      try {
        const node = await this.repository.getById(insight.nodeId, userId);
        if (node) {
          await this.syncNodeToPgvector(node);
          this.logger.debug('Node re-synced to pgvector after insight update', {
            nodeId: insight.nodeId,
            insightId,
          });
        }
      } catch (error) {
        this.logger.warn('Failed to re-sync node after insight update', {
          nodeId: insight.nodeId,
          insightId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return updatedInsight;
  }

  /**
   * Delete an insight
   */
  async deleteInsight(insightId: string, userId: number): Promise<boolean> {
    this.logger.debug('Deleting insight', { insightId, userId });

    // Verify insight exists and node belongs to user
    const insight = await this.insightRepository.findById(insightId);
    if (!insight) {
      throw new Error('Insight not found');
    }

    await this.verifyNodeOwnership(insight.nodeId, userId);

    const deleted = await this.insightRepository.delete(insightId);

    // Re-sync node to pgvector with updated insights (insights removed)
    if (deleted) {
      try {
        const node = await this.repository.getById(insight.nodeId, userId);
        if (node) {
          await this.syncNodeToPgvector(node);
          this.logger.debug(
            'Node re-synced to pgvector after insight deletion',
            {
              nodeId: insight.nodeId,
              insightId,
            }
          );
        }
      } catch (error) {
        this.logger.warn('Failed to re-sync node after insight deletion', {
          nodeId: insight.nodeId,
          insightId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return deleted;
  }

  /**
   * Verify that a node exists and belongs to the user
   */
  private async verifyNodeOwnership(
    nodeId: string,
    userId: number
  ): Promise<void> {
    const node = await this.repository.getById(nodeId, userId);
    if (!node) {
      throw new Error('Node not found or access denied');
    }
  }
}
