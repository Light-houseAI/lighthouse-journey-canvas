/**
 * In-Memory HierarchyService Implementation
 * For integration testing without database dependencies
 * This extends the real HierarchyService to work with in-memory repositories
 */

import { HierarchyService, type CreateNodeDTO } from '../../services/hierarchy-service';
import type { NodeWithParent, TimelineNode } from '@shared/schema';
import { InMemoryHierarchyRepository } from './hierarchy.repository.inmemory';
import { InMemoryNodePermissionRepository } from './node-permission.repository.inmemory';

export class InMemoryHierarchyService extends HierarchyService {
  private hierarchyRepository: InMemoryHierarchyRepository;
  private nodePermissionRepository: InMemoryNodePermissionRepository;

  constructor({ 
    hierarchyRepository, 
    nodePermissionRepository,
    logger 
  }: { 
    hierarchyRepository: InMemoryHierarchyRepository;
    nodePermissionRepository: InMemoryNodePermissionRepository;
    logger: any;
  }) {
    // Create a mock insight repository for the parent constructor
    const mockInsightRepository = {
      getByNodeId: async () => [],
      create: async () => ({}),
      update: async () => ({}),
      delete: async () => true
    };

    super({ 
      hierarchyRepository: hierarchyRepository as any, 
      insightRepository: mockInsightRepository as any, 
      logger 
    });
    
    this.hierarchyRepository = hierarchyRepository;
    this.nodePermissionRepository = nodePermissionRepository;
  }

  /**
   * Create a node and establish ownership
   * This is the real workflow that integrates hierarchy and permissions
   */
  async createNode(dto: CreateNodeDTO, userId: number): Promise<NodeWithParent> {
    // 1. Create the node using the parent service logic
    const node = await super.createNode(dto, userId);

    // 2. Establish ownership in the permission system
    // This is what would happen in the real system when a node is created
    this.nodePermissionRepository.establishNodeOwnership(node.id, userId);

    return node;
  }

  /**
   * Clear all test data
   */
  clearAll(): void {
    this.hierarchyRepository.clearAll();
  }
}