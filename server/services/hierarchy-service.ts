import { HierarchyRepository, type CreateNodeRequest, type UpdateNodeRequest } from '../repositories/hierarchy-repository';
import { InsightRepository, type CreateInsightRequest } from '../repositories/insight-repository';
import { ValidationService } from './validation-service';
import { nodeMetaSchema, type TimelineNode, type NodeInsight, type InsightCreateDTO, type InsightUpdateDTO } from '../../shared/schema';
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

export interface HierarchicalNode extends TimelineNode {
  children: HierarchicalNode[];
  parent?: {
    id: string;
    type: string;
    title?: string;
  } | null;
}

export class HierarchyService {
  private repository: HierarchyRepository;
  private insightRepository: InsightRepository;
  private validation: ValidationService;
  private logger: Logger;

  constructor({ hierarchyRepository, insightRepository, validationService, logger }: {
    hierarchyRepository: HierarchyRepository;
    insightRepository: InsightRepository;
    validationService: ValidationService;
    logger: Logger;
  }) {
    this.repository = hierarchyRepository;
    this.insightRepository = insightRepository;
    this.validation = validationService;
    this.logger = logger;
  }

  /**
   * Create a new timeline node with full validation
   */
  async createNode(dto: CreateNodeDTO, userId: number): Promise<NodeWithParent> {
    this.logger.debug('Creating node via service', { dto, userId });

    // Validate metadata against type-specific schema
    const validatedMeta = this.validation.validateNodeMeta({
      type: dto.type,
      meta: dto.meta || {}
    });

    // Business rule validation for parent-child relationships
    if (dto.parentId) {
      await this.validateParentChildBusinessRules(dto.parentId, dto.type, userId);
    }

    const createRequest: CreateNodeRequest = {
      type: dto.type,
      parentId: dto.parentId,
      meta: validatedMeta,
      userId
    };

    const created = await this.repository.createNode(createRequest);

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

    // Get current node for validation
    const currentNode = await this.repository.getById(nodeId, userId);
    if (!currentNode) {
      throw new Error('Node not found');
    }

    // Validate and merge metadata if provided
    let validatedMeta = currentNode.meta;
    if (dto.meta !== undefined) {
      const mergedMeta = { ...currentNode.meta, ...dto.meta };
      validatedMeta = this.validation.validateNodeMeta({
        type: currentNode.type,
        meta: mergedMeta
      });
    }

    const updateRequest: UpdateNodeRequest = {
      id: nodeId,
      userId,
      ...(dto.meta && { meta: validatedMeta })
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

    // Check if node exists and belongs to user
    const node = await this.repository.getById(nodeId, userId);
    if (!node) {
      throw new Error('Node not found');
    }

    // Get children count for logging
    const children = await this.repository.getChildren(nodeId, userId);

    if (children.length > 0) {
      this.logger.info(`Deleting node with ${children.length} children - they will become orphaned`, {
        nodeId,
        userId,
        childrenCount: children.length
      });
    }

    return await this.repository.deleteNode(nodeId, userId);
  }

  /**
   * Get direct children of a node
   */
  async getChildren(parentId: string, userId: number): Promise<NodeWithParent[]> {
    const children = await this.repository.getChildren(parentId, userId);

    return Promise.all(
      children.map(child => this.enrichWithParentInfo(child, userId))
    );
  }

  /**
   * Get ancestor chain (path to root)
   */
  async getAncestors(nodeId: string, userId: number): Promise<NodeWithParent[]> {
    const ancestors = await this.repository.getAncestors(nodeId, userId);

    return Promise.all(
      ancestors.map(ancestor => this.enrichWithParentInfo(ancestor, userId))
    );
  }

  /**
   * Get complete subtree with hierarchical structure
   */
  async getSubtree(nodeId: string, userId: number, maxDepth: number = 10): Promise<HierarchicalNode | null> {
    const subtreeNodes = await this.repository.getSubtree(nodeId, userId, maxDepth);

    if (subtreeNodes.length === 0) {
      return null;
    }

    return this.buildHierarchicalStructure(subtreeNodes, nodeId);
  }

  /**
   * Get all root nodes (no parent)
   */
  async getRootNodes(userId: number): Promise<NodeWithParent[]> {
    const roots = await this.repository.getRootNodes(userId);

    return Promise.all(
      roots.map(root => this.enrichWithParentInfo(root, userId))
    );
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
   * Get complete hierarchical tree
   */
  async getFullTree(userId: number): Promise<HierarchicalNode[]> {
    const tree = await this.repository.getFullTree(userId);

    return tree.map(this.convertToHierarchicalNode);
  }

  /**

      nodeId,
      newParentId,
      userId
    });

    if (!moved) {
      return null;
    }

    return this.enrichWithParentInfo(moved, userId);
  }

  /**
   * Get nodes by type with optional filtering
   */
  async getNodesByType(
    type: string,
    userId: number,
    options: { parentId?: string } = {}
  ): Promise<NodeWithParent[]> {
    const nodes = await this.repository.getNodesByType(type, userId, options);

    return Promise.all(
      nodes.map(node => this.enrichWithParentInfo(node, userId))
    );
  }

  /**
   * Get hierarchy statistics
   */
  async getHierarchyStats(userId: number) {
    return await this.repository.getHierarchyStats(userId);
  }

  /**
   * Validate parent-child business rules
   */
  private async validateParentChildBusinessRules(parentId: string, childType: string, userId: number): Promise<void> {
    const parent = await this.repository.getById(parentId, userId);

    if (!parent) {
      throw new Error('Parent node not found');
    }

    // User isolation check (redundant but explicit)
    if (parent.userId !== userId) {
      throw new Error('Access denied: parent node belongs to different user');
    }

    // Type compatibility is handled at repository level, but we can add additional business rules here
    // For example, depth limits, special conditions, etc.

    const ancestors = await this.repository.getAncestors(parentId, userId);
    const currentDepth = ancestors.length;

    // Business rule: maximum hierarchy depth
    if (currentDepth >= 10) {
      throw new Error('Maximum hierarchy depth exceeded (10 levels)');
    }

    // Additional business rules can be added here
    // For example: certain node types have special constraints
    if (childType === 'careerTransition' && ancestors.some(a => a.type === 'careerTransition')) {
      throw new Error('Career transitions cannot be nested within other career transitions');
    }
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

  /**
   * Build hierarchical structure from flat array of nodes
   */
  private buildHierarchicalStructure(nodes: TimelineNode[], rootId: string): HierarchicalNode | null {
    const nodeMap = new Map<string, HierarchicalNode>();

    // Initialize all nodes with empty children
    nodes.forEach(node => {
      nodeMap.set(node.id, {
        ...node,
        children: [],
        parent: null
      });
    });

    // Build parent-child relationships and set parent info
    let root: HierarchicalNode | null = null;

    nodes.forEach(node => {
      const hierarchicalNode = nodeMap.get(node.id)!;

      if (node.id === rootId) {
        root = hierarchicalNode;
      }

      if (node.parentId) {
        const parent = nodeMap.get(node.parentId);
        if (parent) {
          parent.children.push(hierarchicalNode);
          hierarchicalNode.parent = {
            id: parent.id,
            type: parent.type,
            title: parent.meta?.title as string
          };
        }
      }
    });

    return root;
  }

  /**
   * Convert tree node to hierarchical node
   */
  private convertToHierarchicalNode = (treeNode: any): HierarchicalNode => {
    return {
      ...treeNode,
      children: treeNode.children?.map(this.convertToHierarchicalNode) || [],
      parent: treeNode.parent || null
    };
  };

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
