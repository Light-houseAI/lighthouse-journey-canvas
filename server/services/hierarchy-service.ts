import { PermissionAction, VisibilityLevel } from '../../shared/enums';
import { type TimelineNode } from '../../shared/schema';
import {
  type InsightCreateDTO,
  type InsightUpdateDTO,
  type NodeInsight,
} from '../../shared/types';
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
}

export interface NodeWithParent extends TimelineNode {
  parent?: {
    id: string;
    type: string;
    title?: string;
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
  };
}

export class HierarchyService {
  private repository: IHierarchyRepository;
  private insightRepository: IInsightRepository;
  private nodePermissionService: NodePermissionService;
  private organizationRepository: IOrganizationRepository;
  private userService: UserService;
  private logger: Logger;
  private pgvectorService?: PgVectorGraphRAGService;
  private embeddingService?: OpenAIEmbeddingService;

  constructor({
    hierarchyRepository,
    insightRepository,
    nodePermissionService,
    organizationRepository,
    userService,
    logger,
    pgVectorGraphRAGService,
    openAIEmbeddingService,
  }: {
    hierarchyRepository: IHierarchyRepository;
    insightRepository: IInsightRepository;
    nodePermissionService: NodePermissionService;
    organizationRepository: IOrganizationRepository;
    userService: UserService;
    logger: Logger;
    pgVectorGraphRAGService?: PgVectorGraphRAGService;
    openAIEmbeddingService?: OpenAIEmbeddingService;
  }) {
    this.repository = hierarchyRepository;
    this.insightRepository = insightRepository;
    this.nodePermissionService = nodePermissionService;
    this.organizationRepository = organizationRepository;
    this.userService = userService;
    this.logger = logger;
    this.pgvectorService = pgVectorGraphRAGService;
    this.embeddingService = openAIEmbeddingService;
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
      const nodeText = this.generateNodeText(node);
      const embedding = await this.embeddingService.generateEmbedding(nodeText);

      // Fetch insights for this node to include in metadata
      let nodeMetaWithInsights = { ...node.meta };

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
        embedding: embedding,
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
      const pgvectorRepo = (this.pgvectorService as any).repository;

      // Remove chunks associated with this node
      await pgvectorRepo.removeChunksByNodeId(nodeId);

      this.logger.debug('Node removed from pgvector successfully', { nodeId });
    } catch (error) {
      this.logger.warn('Failed to remove node from pgvector', {
        nodeId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Generate searchable text from node data
   */
  private generateNodeText(node: TimelineNode): string {
    const parts: string[] = [];

    // Add node type
    parts.push(`${node.type} entry`);

    // Extract meaningful text from meta based on node type
    if (node.meta) {
      switch (node.type) {
        case 'job':
          if (node.meta.company) parts.push(`at ${node.meta.company}`);
          if (node.meta.role) parts.push(`as ${node.meta.role}`);
          if (node.meta.description) parts.push(node.meta.description);
          break;
        case 'education':
          if (node.meta.institution) parts.push(`at ${node.meta.institution}`);
          if (node.meta.degree) parts.push(`${node.meta.degree}`);
          if (node.meta.field) parts.push(`in ${node.meta.field}`);
          break;
        case 'project':
          if (node.meta.title) parts.push(node.meta.title);
          if (node.meta.description) parts.push(node.meta.description);
          if (node.meta.technologies) {
            const techs = Array.isArray(node.meta.technologies)
              ? node.meta.technologies.join(', ')
              : node.meta.technologies;
            parts.push(`using ${techs}`);
          }
          break;
        default:
          if (node.meta.title) parts.push(node.meta.title);
          if (node.meta.description) parts.push(node.meta.description);
      }
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

    const createRequest: CreateNodeRequest = {
      type: dto.type,
      parentId: dto.parentId,
      meta: dto.meta || {},
      userId,
    };

    const created = await this.repository.createNode(createRequest);

    // Sync to pgvector for search functionality
    await this.syncNodeToPgvector(created);

    // Establish default permissions for the newly created node
    // This ensures the owner has full access and the permission repository knows about ownership
    try {
      await this.nodePermissionService.setNodePermissions(userId, {
        policies: [], // Empty policies array means only owner has access (default behavior)
      });

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
  ): Promise<NodeWithParent | null> {
    const node = await this.repository.getById(nodeId, userId);

    if (!node) {
      return null;
    }

    return this.enrichWithParentInfo(node, userId);
  }

  /**
   * Update node with validation
   */
  async updateNode(
    nodeId: string,
    dto: UpdateNodeDTO,
    userId: number
  ): Promise<NodeWithParent | null> {
    this.logger.debug('Updating node via service', { nodeId, dto, userId });

    const updateRequest: UpdateNodeRequest = {
      id: nodeId,
      userId,
      ...(dto.meta && { meta: dto.meta }),
    };

    const updated = await this.repository.updateNode(updateRequest);

    if (!updated) {
      return null;
    }

    // Sync updated node to pgvector for search functionality
    await this.syncNodeToPgvector(updated);

    return this.enrichWithParentInfo(updated, userId);
  }

  /**
   * Delete node with cascade handling
   */
  async deleteNode(nodeId: string, userId: number): Promise<boolean> {
    this.logger.debug('Deleting node via service', { nodeId, userId });

    // Remove from pgvector before deleting from PostgreSQL
    await this.removeNodeFromPgvector(nodeId);

    // Delegate to repository - it will handle non-existent nodes gracefully
    return await this.repository.deleteNode(nodeId, userId);
  }

  /**
   * Get all nodes as a flat list with optional permission filtering for username-based viewing
   * Now supports enhanced permission levels and actions
   */
  async getAllNodes(
    requestingUserId: number,
    username?: string
  ): Promise<NodeWithParent[]> {
    let filter: NodeFilter;

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
        filter = NodeFilter.Of(requestingUserId).build();

        this.logger.debug('Fetching own nodes via username', {
          currentUserId: requestingUserId,
          username,
        });
      } else {
        // Create filter for viewing another user's nodes with specified permissions
        filter = NodeFilter.Of(requestingUserId).For(targetUser.id).build();

        this.logger.debug('Fetching nodes with permission filter', {
          currentUserId: requestingUserId,
          targetUserId: targetUser.id,
          username,
        });
      }
    } else {
      // Create filter for viewing own nodes with specified permissions
      filter = NodeFilter.Of(requestingUserId).build();
    }

    // Get filtered nodes from repository
    const allNodes = await this.repository.getAllNodes(filter);

    this.logger.debug('Retrieved nodes', {
      count: allNodes.length,
      currentUserId: filter.currentUserId,
      targetUserId: filter.targetUserId,
      action: filter.action,
      level: filter.level,
    });

    // Enrich with parent information
    return Promise.all(
      allNodes.map((node) => this.enrichWithParentInfo(node, node.userId))
    );
  }

  /**
   * Get all nodes with permission metadata for server-driven permission system
   * Owner views get full permissions without checks, viewer get calculated permissions
   */
  async getAllNodesWithPermissions(
    requestingUserId: number,
    username?: string
  ): Promise<NodeWithParentAndPermissions[]> {
    // First get the regular nodes (this handles permission filtering)
    const nodesWithParent = await this.getAllNodes(requestingUserId, username);

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
   * Enrich node with parent information
   */
  private async enrichWithParentInfo(
    node: TimelineNode,
    userId: number
  ): Promise<NodeWithParent> {
    const enriched: NodeWithParent = { ...node, parent: null };

    if (node.parentId) {
      const parent = await this.repository.getById(node.parentId, userId);
      if (parent) {
        enriched.parent = {
          id: parent.id,
          type: parent.type,
          title: parent.meta?.title as string,
        };
      }
    }

    // Enrich with organization data for job and education nodes
    await this.enrichWithOrganizationInfo(enriched);

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
   * Enrich node with permission metadata for server-driven permissions
   */
  private async enrichWithPermissions(
    node: NodeWithParent,
    requestingUserId: number,
    isOwnerView: boolean
  ): Promise<NodeWithParentAndPermissions> {
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
        },
      };
    }

    // Viewer view: Calculate permissions using permission service
    const canView = await this.nodePermissionService.canAccess(
      requestingUserId,
      node.id,
      PermissionAction.View,
      VisibilityLevel.Overview
    );

    const canViewFull = await this.nodePermissionService.canAccess(
      requestingUserId,
      node.id,
      PermissionAction.View,
      VisibilityLevel.Full
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
      userId,
      nodeId,
      PermissionAction.View,
      VisibilityLevel.Full
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
