import type { IHierarchyRepository, CreateNodeRequest, UpdateNodeRequest } from '../repositories/interfaces/hierarchy.repository.interface';
import type { IInsightRepository, CreateInsightRequest } from '../repositories/interfaces/insight.repository.interface';
import { type TimelineNode, type NodeInsight, type InsightCreateDTO, type InsightUpdateDTO } from '../../shared/schema';
import type { NodePermissionService } from './node-permission.service';
import type { Logger } from '../core/logger';

export interface CreateNodeDTO {
  type: 'job' | 'education' | 'project' | 'event' | 'action' | 'careerTransition';
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


export class HierarchyService {
  private repository: IHierarchyRepository;
  private insightRepository: IInsightRepository;
  private nodePermissionService: NodePermissionService;
  private logger: Logger;

  constructor({ hierarchyRepository, insightRepository, nodePermissionService, logger }: {
    hierarchyRepository: IHierarchyRepository;
    insightRepository: IInsightRepository;
    nodePermissionService: NodePermissionService;
    logger: Logger;
  }) {
    this.repository = hierarchyRepository;
    this.insightRepository = insightRepository;
    this.nodePermissionService = nodePermissionService;
    this.logger = logger;
  }

  /**
   * Create a new timeline node with full validation
   */
  async createNode(dto: CreateNodeDTO, userId: number): Promise<NodeWithParent> {
    this.logger.debug('Creating node via service', { dto, userId });

    const createRequest: CreateNodeRequest = {
      type: dto.type,
      parentId: dto.parentId,
      meta: dto.meta || {},
      userId
    };

    const created = await this.repository.createNode(createRequest);

    // Establish default permissions for the newly created node
    // This ensures the owner has full access and the permission repository knows about ownership
    try {
      await this.nodePermissionService.setNodePermissions(created.id, userId, {
        policies: [] // Empty policies array means only owner has access (default behavior)
      });

      this.logger.debug('Default permissions established for new node', {
        nodeId: created.id,
        userId
      });
    } catch (error) {
      this.logger.warn('Failed to establish default permissions for new node', {
        nodeId: created.id,
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      // Don't fail node creation if permission setup fails
    }

    // Enrich response with parent information if applicable
    return this.enrichWithParentInfo(created, userId);
  }

  /**
   * Get node by ID with parent information
   */
  async getNodeById(nodeId: string, userId: number): Promise<NodeWithParent | null> {
    const node = await this.repository.getById(nodeId, userId);

    if (!node) {
      return null;
    }

    return this.enrichWithParentInfo(node, userId);
  }

  /**
   * Update node with validation
   */
  async updateNode(nodeId: string, dto: UpdateNodeDTO, userId: number): Promise<NodeWithParent | null> {
    this.logger.debug('Updating node via service', { nodeId, dto, userId });


    const updateRequest: UpdateNodeRequest = {
      id: nodeId,
      userId,
      ...(dto.meta && { meta: dto.meta })
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
   * Get all nodes as a flat list (needed for UI timeline)
   */
  async getAllNodes(userId: number): Promise<NodeWithParent[]> {
    // Get all nodes from repository - we'll add a method to repository for this
    const allNodes = await this.repository.getAllNodes(userId);

    return Promise.all(
      allNodes.map(node => this.enrichWithParentInfo(node, userId))
    );
  }



  /**
   * Enrich node with parent information
   */
  private async enrichWithParentInfo(node: TimelineNode, userId: number): Promise<NodeWithParent> {
    const enriched: NodeWithParent = { ...node, parent: null };

    if (node.parentId) {
      const parent = await this.repository.getById(node.parentId, userId);
      if (parent) {
        enriched.parent = {
          id: parent.id,
          type: parent.type,
          title: parent.meta?.title as string
        };
      }
    }

    return enriched;
  }


  // Insights Operations

  /**
   * Get insights for a specific node
   */
  async getNodeInsights(nodeId: string, userId: number): Promise<NodeInsight[]> {
    this.logger.debug('Getting insights for node', { nodeId, userId });

    // Verify node exists and belongs to user
    await this.verifyNodeOwnership(nodeId, userId);

    return await this.insightRepository.findByNodeId(nodeId);
  }

  /**
   * Create a new insight for a node
   */
  async createInsight(nodeId: string, data: InsightCreateDTO, userId: number): Promise<NodeInsight> {
    this.logger.debug('Creating insight for node', { nodeId, data, userId });

    // Verify node exists and belongs to user
    await this.verifyNodeOwnership(nodeId, userId);

    const createRequest: CreateInsightRequest = {
      nodeId,
      ...data
    };

    return await this.insightRepository.create(createRequest);
  }

  /**
   * Update an existing insight
   */
  async updateInsight(insightId: string, data: InsightUpdateDTO, userId: number): Promise<NodeInsight | null> {
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
  private async verifyNodeOwnership(nodeId: string, userId: number): Promise<void> {
    const node = await this.repository.getById(nodeId, userId);
    if (!node) {
      throw new Error('Node not found or access denied');
    }
  }

}
