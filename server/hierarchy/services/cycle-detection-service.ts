import { injectable, inject } from 'tsyringe';
import { HierarchyRepository } from '../infrastructure/hierarchy-repository';
import { HIERARCHY_TOKENS } from '../di/tokens';
import type { Logger } from '../../core/logger';
import type { TimelineNode } from '../../../shared/schema';

export interface CycleDetectionResult {
  wouldCreateCycle: boolean;
  cyclePath?: string[];
  reason?: string;
}

export interface PathAnalysis {
  depth: number;
  nodeIds: string[];
  hasLoop: boolean;
  loopStartIndex?: number;
}

@injectable()
export class CycleDetectionService {
  constructor(
    @inject(HIERARCHY_TOKENS.HIERARCHY_REPOSITORY) private repository: HierarchyRepository,
    @inject(HIERARCHY_TOKENS.LOGGER) private logger: Logger
  ) {}

  /**
   * Check if moving a node would create a cycle
   * This is the primary method used by the service layer
   */
  async wouldCreateCycle(
    nodeId: string, 
    proposedParentId: string, 
    userId: number
  ): Promise<boolean> {
    const result = await this.detectCycleForMove(nodeId, proposedParentId, userId);
    return result.wouldCreateCycle;
  }

  /**
   * Comprehensive cycle detection with detailed analysis
   */
  async detectCycleForMove(
    nodeId: string,
    proposedParentId: string,
    userId: number
  ): Promise<CycleDetectionResult> {
    this.logger.debug('Detecting cycle for move operation', {
      nodeId,
      proposedParentId,
      userId
    });

    try {
      // Basic validation
      if (nodeId === proposedParentId) {
        return {
          wouldCreateCycle: true,
          cyclePath: [nodeId],
          reason: 'Node cannot be parent of itself'
        };
      }

      // Get proposed parent's ancestor chain
      const proposedParentAncestors = await this.repository.getAncestors(proposedParentId, userId);
      
      // Check if nodeId appears in the ancestor chain of proposed parent
      const cycleNode = proposedParentAncestors.find(ancestor => ancestor.id === nodeId);
      
      if (cycleNode) {
        // Build the cycle path for debugging
        const cyclePath = this.buildCyclePath(proposedParentAncestors, nodeId, proposedParentId);
        
        return {
          wouldCreateCycle: true,
          cyclePath,
          reason: `Moving node would create cycle: ${cyclePath.join(' -> ')}`
        };
      }

      return {
        wouldCreateCycle: false
      };

    } catch (error) {
      this.logger.error('Error during cycle detection', {
        nodeId,
        proposedParentId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      // In case of error, be conservative and assume cycle would be created
      return {
        wouldCreateCycle: true,
        reason: 'Error during cycle detection - operation blocked for safety'
      };
    }
  }

  /**
   * Analyze the complete hierarchy for any existing cycles (diagnostic tool)
   */
  async analyzeHierarchyForCycles(userId: number): Promise<{
    hasCycles: boolean;
    cycles: Array<{
      cycleId: string;
      nodes: string[];
      severity: 'minor' | 'major';
    }>;
    orphanedNodes: string[];
    maxDepth: number;
  }> {
    this.logger.debug('Analyzing hierarchy for cycles', { userId });

    const allNodes = await this.getAllUserNodes(userId);
    const analysis = {
      hasCycles: false,
      cycles: [] as Array<{
        cycleId: string;
        nodes: string[];
        severity: 'minor' | 'major';
      }>,
      orphanedNodes: [] as string[],
      maxDepth: 0
    };

    // Build adjacency map for cycle detection
    const childToParent = new Map<string, string>();
    const parentToChildren = new Map<string, string[]>();
    
    allNodes.forEach(node => {
      if (node.parentId) {
        childToParent.set(node.id, node.parentId);
        
        if (!parentToChildren.has(node.parentId)) {
          parentToChildren.set(node.parentId, []);
        }
        parentToChildren.get(node.parentId)!.push(node.id);
      }
    });

    // Detect cycles using DFS
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    
    for (const node of allNodes) {
      if (!visited.has(node.id)) {
        const cycleResult = this.dfsCycleDetection(
          node.id,
          childToParent,
          visited,
          recursionStack,
          []
        );
        
        if (cycleResult.hasLoop) {
          analysis.hasCycles = true;
          analysis.cycles.push({
            cycleId: `cycle-${analysis.cycles.length + 1}`,
            nodes: cycleResult.nodeIds,
            severity: cycleResult.nodeIds.length > 5 ? 'major' : 'minor'
          });
        }
      }
    }

    // Find orphaned nodes (exist in parent references but not as actual nodes)
    const existingNodeIds = new Set(allNodes.map(n => n.id));
    const referencedParentIds = new Set(
      allNodes
        .filter(n => n.parentId)
        .map(n => n.parentId!)
    );

    referencedParentIds.forEach(parentId => {
      if (!existingNodeIds.has(parentId)) {
        analysis.orphanedNodes.push(parentId);
      }
    });

    // Calculate max depth
    const rootNodes = allNodes.filter(n => !n.parentId);
    for (const root of rootNodes) {
      const depth = this.calculateMaxDepth(root.id, parentToChildren);
      analysis.maxDepth = Math.max(analysis.maxDepth, depth);
    }

    this.logger.info('Hierarchy analysis complete', {
      userId,
      hasCycles: analysis.hasCycles,
      cycleCount: analysis.cycles.length,
      orphanedCount: analysis.orphanedNodes.length,
      maxDepth: analysis.maxDepth
    });

    return analysis;
  }

  /**
   * Validate that a proposed hierarchy change is safe
   */
  async validateHierarchyChange(
    changes: Array<{
      nodeId: string;
      newParentId: string | null;
    }>,
    userId: number
  ): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const result = {
      isValid: true,
      errors: [] as string[],
      warnings: [] as string[]
    };

    // Check each change individually for potential cycles
    for (const change of changes) {
      if (change.newParentId) {
        const cycleCheck = await this.detectCycleForMove(
          change.nodeId,
          change.newParentId,
          userId
        );

        if (cycleCheck.wouldCreateCycle) {
          result.isValid = false;
          result.errors.push(
            `Node ${change.nodeId} cannot be moved to ${change.newParentId}: ${cycleCheck.reason}`
          );
        }
      }
    }

    // Check for potential issues with bulk changes
    if (changes.length > 1) {
      result.warnings.push(
        `Bulk hierarchy changes (${changes.length} changes) should be applied with caution`
      );

      // Check for conflicting changes
      const nodeIds = changes.map(c => c.nodeId);
      const uniqueNodeIds = new Set(nodeIds);
      if (nodeIds.length !== uniqueNodeIds.size) {
        result.isValid = false;
        result.errors.push('Duplicate node IDs found in change set');
      }
    }

    return result;
  }

  /**
   * Get recovery suggestions for fixing detected cycles
   */
  async getRecoverySuggestions(userId: number): Promise<Array<{
    issue: string;
    severity: 'low' | 'medium' | 'high';
    suggestion: string;
    automaticFix?: {
      action: 'remove_parent' | 'delete_node' | 'move_node';
      nodeId: string;
      details: string;
    };
  }>> {
    const analysis = await this.analyzeHierarchyForCycles(userId);
    const suggestions = [];

    // Suggestions for cycles
    for (const cycle of analysis.cycles) {
      suggestions.push({
        issue: `Cycle detected involving nodes: ${cycle.nodes.join(', ')}`,
        severity: cycle.severity === 'major' ? 'high' : 'medium' as const,
        suggestion: `Break the cycle by removing parent relationship from one of the nodes in the cycle`,
        automaticFix: {
          action: 'remove_parent' as const,
          nodeId: cycle.nodes[cycle.nodes.length - 1], // Last node in cycle
          details: `Remove parent relationship from ${cycle.nodes[cycle.nodes.length - 1]} to break the cycle`
        }
      });
    }

    // Suggestions for orphaned nodes
    for (const orphanId of analysis.orphanedNodes) {
      suggestions.push({
        issue: `Orphaned parent reference: ${orphanId}`,
        severity: 'medium' as const,
        suggestion: `Remove references to non-existent parent node ${orphanId}`,
        automaticFix: {
          action: 'remove_parent' as const,
          nodeId: orphanId,
          details: `Clean up references to deleted parent node ${orphanId}`
        }
      });
    }

    // Suggestions for excessive depth
    if (analysis.maxDepth > 10) {
      suggestions.push({
        issue: `Hierarchy depth exceeds recommended limit (${analysis.maxDepth} levels)`,
        severity: 'low' as const,
        suggestion: 'Consider flattening the hierarchy by promoting some child nodes to higher levels'
      });
    }

    return suggestions;
  }

  /**
   * DFS-based cycle detection algorithm
   */
  private dfsCycleDetection(
    nodeId: string,
    childToParent: Map<string, string>,
    visited: Set<string>,
    recursionStack: Set<string>,
    currentPath: string[]
  ): PathAnalysis {
    visited.add(nodeId);
    recursionStack.add(nodeId);
    currentPath.push(nodeId);

    const parentId = childToParent.get(nodeId);
    
    if (parentId) {
      if (recursionStack.has(parentId)) {
        // Cycle detected
        const cycleStartIndex = currentPath.indexOf(parentId);
        return {
          depth: currentPath.length,
          nodeIds: currentPath.slice(cycleStartIndex),
          hasLoop: true,
          loopStartIndex: cycleStartIndex
        };
      }

      if (!visited.has(parentId)) {
        const result = this.dfsCycleDetection(
          parentId,
          childToParent,
          visited,
          recursionStack,
          [...currentPath]
        );
        
        if (result.hasLoop) {
          return result;
        }
      }
    }

    recursionStack.delete(nodeId);
    
    return {
      depth: currentPath.length,
      nodeIds: currentPath,
      hasLoop: false
    };
  }

  /**
   * Build cycle path for error reporting
   */
  private buildCyclePath(ancestors: TimelineNode[], nodeId: string, proposedParentId: string): string[] {
    const path = [nodeId, proposedParentId];
    
    let currentId = proposedParentId;
    for (const ancestor of ancestors) {
      path.push(ancestor.id);
      if (ancestor.id === nodeId) {
        break;
      }
    }
    
    return path;
  }

  /**
   * Calculate maximum depth from a root node
   */
  private calculateMaxDepth(
    nodeId: string, 
    parentToChildren: Map<string, string[]>,
    currentDepth: number = 0
  ): number {
    const children = parentToChildren.get(nodeId) || [];
    
    if (children.length === 0) {
      return currentDepth;
    }

    let maxChildDepth = currentDepth;
    for (const childId of children) {
      const childDepth = this.calculateMaxDepth(childId, parentToChildren, currentDepth + 1);
      maxChildDepth = Math.max(maxChildDepth, childDepth);
    }

    return maxChildDepth;
  }

  /**
   * Get all nodes for a user (helper method)
   */
  private async getAllUserNodes(userId: number): Promise<TimelineNode[]> {
    // This would typically be implemented in the repository
    // For now, we'll get the full tree which contains all nodes
    const tree = await this.repository.getFullTree(userId);
    
    // Flatten tree structure to get all nodes with cycle protection
    const allNodes: TimelineNode[] = [];
    const visited = new Set<string>();
    
    const flattenTree = (nodes: any[], depth = 0) => {
      // Protect against infinite recursion
      if (depth > 100) {
        this.logger.warn('Maximum depth reached while flattening tree', { userId, depth });
        return;
      }
      
      nodes.forEach(node => {
        if (!node?.id || visited.has(node.id)) {
          return; // Skip duplicates and invalid nodes
        }
        
        visited.add(node.id);
        allNodes.push(node);
        
        if (node.children && node.children.length > 0) {
          flattenTree(node.children, depth + 1);
        }
      });
    };

    flattenTree(tree);
    return allNodes;
  }
}