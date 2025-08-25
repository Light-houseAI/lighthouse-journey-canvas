import {
  type InsightCreateDTO,
  type InsightUpdateDTO,
  type NodeInsight,
  PermissionAction,
  type TimelineNode,
  VisibilityLevel,
} from '../../shared/schema';
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

  constructor({
    hierarchyRepository,
    insightRepository,
    nodePermissionService,
    organizationRepository,
    userService,
    logger,
  }: {
    hierarchyRepository: IHierarchyRepository;
    insightRepository: IInsightRepository;
    nodePermissionService: NodePermissionService;
    organizationRepository: IOrganizationRepository;
    userService: UserService;
    logger: Logger;
  }) {
    this.repository = hierarchyRepository;
    this.insightRepository = insightRepository;
    this.nodePermissionService = nodePermissionService;
    this.organizationRepository = organizationRepository;
    this.userService = userService;
    this.logger = logger;
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

    return this.enrichWithParentInfo(updated, userId);
  }

  /**
   * Delete node with cascade handling
   */
  async deleteNode(nodeId: string, userId: number): Promise<boolean> {
    this.logger.debug('Deleting node via service', { nodeId, userId });

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
        filter = NodeFilter.Of(requestingUserId)
          .build();

        this.logger.debug('Fetching own nodes via username', {
          currentUserId: requestingUserId,
          username,
        });
      } else {
        // Create filter for viewing another user's nodes with specified permissions
        filter = NodeFilter.Of(requestingUserId)
          .For(targetUser.id)
          .build();

        this.logger.debug('Fetching nodes with permission filter', {
          currentUserId: requestingUserId,
          targetUserId: targetUser.id,
          username
        });
      }
    } else {
      // Create filter for viewing own nodes with specified permissions
      filter = NodeFilter.Of(requestingUserId)
        .build();
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
      nodesWithParent.map((node) => this.enrichWithPermissions(node, requestingUserId, isOwnerView))
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
  private async enrichWithOrganizationInfo(node: NodeWithParent): Promise<void> {
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
            orgName: organization.name
          });
        }
      } catch (error) {
        this.logger.warn('Failed to enrich node with organization data', {
          nodeId: node.id,
          orgId,
          error: error instanceof Error ? error.message : String(error)
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
        accessLevel: canViewFull ? VisibilityLevel.Full : VisibilityLevel.Overview,
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

    return await this.insightRepository.create(createRequest);
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

    return await this.insightRepository.update(insightId, data);
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

    return await this.insightRepository.delete(insightId);
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
