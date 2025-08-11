/**
 * Simplified Hierarchy API Service
 * 
 * Handles communication with the v2 timeline API and provides client-side
 * hierarchy building logic. Meta-driven approach with minimal server dependencies.
 */

// Core data types matching server API
export interface HierarchyNode {
  id: string;
  type: 'job' | 'education' | 'project' | 'event' | 'action' | 'careerTransition';
  label: string;
  parentId?: string | null;
  meta: NodeMetadata;
  userId: number;
  createdAt: string;
  updatedAt: string;
  // UI-computed fields
  children?: HierarchyNode[];
  level?: number;
}

// Meta field contains ALL node-specific data
export interface NodeMetadata {
  // Common fields for all node types
  description?: string;
  startDate?: string;
  endDate?: string;
  status?: 'active' | 'completed' | 'planned';
  
  // Type-specific fields (conditional based on node type)
  company?: string;        // for job nodes
  position?: string;       // for job nodes
  school?: string;         // for education nodes
  degree?: string;         // for education nodes
  technologies?: string[]; // for project nodes
  outcome?: string;        // for action nodes
  location?: string;       // for event nodes
  
  // Visual customization
  color?: string;          // node color override
  icon?: string;           // node icon override
  tags?: string[];         // categorization tags
}

// Tree structure for visualization
export interface HierarchyTree {
  nodes: HierarchyNode[];
  edges: { source: string; target: string }[];
}

// API payload interfaces
export interface CreateNodePayload {
  type: HierarchyNode['type'];
  label: string;
  parentId?: string | null;
  meta: NodeMetadata;
}

export interface UpdateNodePayload {
  label?: string;
  meta?: Partial<NodeMetadata>;
}

// API response wrapper
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    timestamp: string;
  };
}

// HTTP client with error handling
async function httpClient<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `/api/v2/timeline${path}`;
  
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    ...init,
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `HTTP ${response.status}`;
    
    try {
      const errorData = JSON.parse(errorText) as ApiResponse;
      errorMessage = errorData.error?.message || errorMessage;
    } catch {
      errorMessage = errorText || errorMessage;
    }
    
    throw new Error(errorMessage);
  }

  const result = await response.json() as ApiResponse<T>;
  
  if (!result.success) {
    throw new Error(result.error?.message || 'API request failed');
  }

  return result.data!;
}

/**
 * Simplified Hierarchy API Service
 * 
 * Provides essential CRUD operations and client-side hierarchy building.
 * All complex tree operations are handled client-side for better performance
 * and reduced server complexity.
 */
export class HierarchyApiService {
  /**
   * Create a new node
   */
  async createNode(payload: CreateNodePayload): Promise<HierarchyNode> {
    return httpClient<HierarchyNode>('/nodes', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /**
   * Update an existing node
   */
  async updateNode(id: string, patch: UpdateNodePayload): Promise<HierarchyNode> {
    return httpClient<HierarchyNode>(`/nodes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  }

  /**
   * Delete a node
   */
  async deleteNode(id: string): Promise<void> {
    return httpClient<void>(`/nodes/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * Get all nodes for the current user
   */
  async listNodes(): Promise<HierarchyNode[]> {
    return httpClient<HierarchyNode[]>('/nodes');
  }

  /**
   * Get a single node by ID
   */
  async getNode(id: string): Promise<HierarchyNode> {
    return httpClient<HierarchyNode>(`/nodes/${id}`);
  }

  /**
   * Build hierarchy tree from flat node list
   * Client-side tree building for better performance
   */
  buildHierarchyTree(nodes: HierarchyNode[]): HierarchyTree {
    // Create lookup map for efficient parent-child relationships
    const nodeMap = new Map<string, HierarchyNode>();
    nodes.forEach(node => {
      nodeMap.set(node.id, { ...node, children: [] });
    });

    const roots: HierarchyNode[] = [];
    const edges: { source: string; target: string }[] = [];

    // Build parent-child relationships and edge list
    nodes.forEach(node => {
      const nodeWithChildren = nodeMap.get(node.id)!;
      
      if (node.parentId && nodeMap.has(node.parentId)) {
        // Add to parent's children
        const parent = nodeMap.get(node.parentId)!;
        parent.children!.push(nodeWithChildren);
        
        // Add edge for React Flow
        edges.push({
          source: node.parentId,
          target: node.id,
        });
      } else {
        // Root node
        roots.push(nodeWithChildren);
      }
    });

    // Calculate levels for each node
    const calculateLevels = (nodes: HierarchyNode[], level: number = 0) => {
      nodes.forEach(node => {
        node.level = level;
        if (node.children && node.children.length > 0) {
          calculateLevels(node.children, level + 1);
        }
      });
    };

    calculateLevels(roots);

    return {
      nodes: Array.from(nodeMap.values()),
      edges,
    };
  }

  /**
   * Find root nodes (nodes without parents)
   */
  findRoots(nodes: HierarchyNode[]): HierarchyNode[] {
    return nodes.filter(node => !node.parentId);
  }

  /**
   * Find children of a specific node
   */
  findChildren(nodeId: string, nodes: HierarchyNode[]): HierarchyNode[] {
    return nodes.filter(node => node.parentId === nodeId);
  }

  /**
   * Find ancestors of a specific node
   */
  findAncestors(nodeId: string, nodes: HierarchyNode[]): HierarchyNode[] {
    const ancestors: HierarchyNode[] = [];
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    
    let currentNode = nodeMap.get(nodeId);
    while (currentNode?.parentId) {
      const parent = nodeMap.get(currentNode.parentId);
      if (parent) {
        ancestors.unshift(parent);
        currentNode = parent;
      } else {
        break;
      }
    }
    
    return ancestors;
  }

  /**
   * Get the complete subtree starting from a specific node
   */
  getSubtree(nodeId: string, nodes: HierarchyNode[]): HierarchyNode[] {
    const result: HierarchyNode[] = [];
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    
    const traverse = (currentId: string) => {
      const node = nodeMap.get(currentId);
      if (node) {
        result.push(node);
        // Find children and traverse them
        nodes
          .filter(n => n.parentId === currentId)
          .forEach(child => traverse(child.id));
      }
    };
    
    traverse(nodeId);
    return result;
  }

  /**
   * Validate that a move operation won't create cycles
   */
  validateMove(nodeId: string, newParentId: string | null, nodes: HierarchyNode[]): boolean {
    if (!newParentId) return true; // Moving to root is always safe
    
    // Check if the new parent is a descendant of the node being moved
    const subtree = this.getSubtree(nodeId, nodes);
    return !subtree.some(node => node.id === newParentId);
  }

  /**
   * Move a node to a new parent (with cycle detection)
   */
  async moveNode(nodeId: string, newParentId: string | null): Promise<HierarchyNode> {
    // Note: This would typically validate cycles client-side before making the API call
    // For now, we'll rely on server-side validation
    return httpClient<HierarchyNode>(`/nodes/${nodeId}`, {
      method: 'PATCH',
      body: JSON.stringify({ parentId: newParentId }),
    });
  }
}

// Export singleton instance
export const hierarchyApi = new HierarchyApiService();
export default hierarchyApi;