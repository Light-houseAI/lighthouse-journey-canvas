/**
 * Node API Service
 * Handles all CRUD operations for different node types
 */

export type NodeType = 'job' | 'education' | 'project' | 'event' | 'action' | 'careerTransition';

interface BaseNode {
  id?: string;
  title: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  isOngoing?: boolean;
}

interface JobNode extends BaseNode {
  type: 'job';
  company: string;
  position: string;
  location?: string;
}

interface EducationNode extends BaseNode {
  type: 'education';
  institution: string;
  degree?: string;
  field?: string;
}

interface ProjectNode extends BaseNode {
  type: 'project';
  status?: string; // Required on server but we'll handle default in transformForApi
  technologies?: string;
  parentExperienceId?: string;
}

interface EventNode extends BaseNode {
  type: 'event';
  eventType: string;
  location?: string;
  organizer?: string;
}

interface ActionNode extends BaseNode {
  type: 'action';
  actionType?: string; // Required on server but we'll handle default
  category: string;
  status?: string; // Required on server
  impact?: string;
  verification?: string;
}

interface CareerTransitionNode extends BaseNode {
  type: 'careerTransition';
  transitionType: string; // This is required
  fromRole?: string;
  toRole?: string;
  reason?: string;
  outcome?: string;
}

export type NodeData = JobNode | EducationNode | ProjectNode | EventNode | ActionNode | CareerTransitionNode;

class NodeApiService {
  private baseUrl = '/api/v1';

  /**
   * Get the API endpoint for a specific node type
   */
  private getEndpoint(profileId: number, nodeType: NodeType): string {
    const endpoints: Record<NodeType, string> = {
      job: `${this.baseUrl}/profiles/${profileId}/jobs`,
      education: `${this.baseUrl}/profiles/${profileId}/education`,
      project: `${this.baseUrl}/profiles/${profileId}/projects`,
      event: `${this.baseUrl}/profiles/${profileId}/events`,
      action: `${this.baseUrl}/profiles/${profileId}/actions`,
      careerTransition: `${this.baseUrl}/profiles/${profileId}/career-transitions`,
    };
    return endpoints[nodeType];
  }

  /**
   * Create a new node
   */
  async createNode(profileId: number, nodeData: NodeData): Promise<NodeData> {
    const endpoint = this.getEndpoint(profileId, nodeData.type);
    
    // Transform the data to match API expectations
    const apiData = this.transformForApi(nodeData);
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(apiData),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to create node' }));
      throw new Error(error.message || `Failed to create ${nodeData.type}`);
    }

    // Handle cases where server doesn't return JSON
    let result;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      result = await response.json();
    } else {
      // If no JSON response, return the original node data with a generated ID
      const transformedData = this.transformForApi(nodeData);
      result = {
        id: Date.now().toString(), // Temporary ID
        ...transformedData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
    
    return this.transformFromApi(result, nodeData.type);
  }

  /**
   * Update an existing node
   */
  async updateNode(profileId: number, nodeId: string, nodeData: NodeData): Promise<NodeData> {
    const endpoint = `${this.getEndpoint(profileId, nodeData.type)}/${nodeId}`;
    
    const apiData = this.transformForApi(nodeData);
    
    const response = await fetch(endpoint, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(apiData),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to update node' }));
      throw new Error(error.message || `Failed to update ${nodeData.type}`);
    }

    const result = await response.json();
    return this.transformFromApi(result, nodeData.type);
  }

  /**
   * Delete a node
   */
  async deleteNode(profileId: number, nodeType: NodeType, nodeId: string): Promise<void> {
    const endpoint = `${this.getEndpoint(profileId, nodeType)}/${nodeId}`;
    
    const response = await fetch(endpoint, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to delete node' }));
      throw new Error(error.message || `Failed to delete ${nodeType}`);
    }
  }

  /**
   * Get all nodes of a specific type
   */
  async getNodes(profileId: number, nodeType: NodeType): Promise<NodeData[]> {
    const endpoint = this.getEndpoint(profileId, nodeType);
    
    const response = await fetch(endpoint, {
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to fetch nodes' }));
      throw new Error(error.message || `Failed to fetch ${nodeType} nodes`);
    }

    const result = await response.json();
    const nodes = result.data || result.items || result;
    
    return Array.isArray(nodes) 
      ? nodes.map(node => this.transformFromApi(node, nodeType))
      : [];
  }

  /**
   * Get a single node
   */
  async getNode(profileId: number, nodeType: NodeType, nodeId: string): Promise<NodeData> {
    const endpoint = `${this.getEndpoint(profileId, nodeType)}/${nodeId}`;
    
    const response = await fetch(endpoint, {
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to fetch node' }));
      throw new Error(error.message || `Failed to fetch ${nodeType}`);
    }

    const result = await response.json();
    return this.transformFromApi(result, nodeType);
  }

  /**
   * Transform client data to API format
   */
  private transformForApi(nodeData: NodeData): any {
    const { type, ...data } = nodeData;
    
    // Minimal transformations - mostly just removing the type field
    const transformed: any = { ...data };
    
    // Remove client-only fields
    delete transformed.type;
    
    // Transform date fields from client format to API format
    if ('start' in transformed) {
      transformed.startDate = transformed.start;
      delete transformed.start;
    }
    if ('end' in transformed) {
      transformed.endDate = transformed.end;
      delete transformed.end;
    }
    
    // Type-specific transformations (only where absolutely necessary)
    switch (type) {
      case 'education':
        // Transform school to institution
        if ('school' in transformed) {
          transformed.institution = transformed.school;
          delete transformed.school;
        }
        break;
      case 'project':
        if (transformed.technologies && typeof transformed.technologies === 'string') {
          transformed.technologies = transformed.technologies.split(',').map((t: string) => t.trim());
        }
        // Ensure status is set (required field)
        if (!transformed.status) {
          transformed.status = 'in-progress'; // default
        }
        break;
      case 'action':
        // Ensure actionType is set (required field)
        if (!transformed.actionType) {
          transformed.actionType = 'achievement'; // default
        }
        // Ensure status is set (required field)
        if (!transformed.status) {
          transformed.status = 'completed'; // default
        }
        break;
      case 'careerTransition':
        if (transformed.transitionType) {
          transformed.type = transformed.transitionType;
          delete transformed.transitionType;
        }
        break;
    }

    return transformed;
  }

  /**
   * Transform API data to client format
   */
  private transformFromApi(apiData: any, nodeType: NodeType): NodeData {
    const baseData = {
      id: apiData.id,
      title: apiData.title || apiData.position || apiData.name,
      description: apiData.description,
      startDate: apiData.startDate,
      endDate: apiData.endDate,
      isOngoing: apiData.isOngoing || (!apiData.endDate && !!apiData.startDate),
    };

    switch (nodeType) {
      case 'job':
        return {
          ...baseData,
          type: 'job',
          company: apiData.company,
          position: apiData.position || apiData.title,
          location: apiData.location,
        } as JobNode;

      case 'education':
        return {
          ...baseData,
          type: 'education',
          institution: apiData.institution,
          degree: apiData.degree,
          field: apiData.field,
        } as EducationNode;

      case 'project':
        return {
          ...baseData,
          type: 'project',
          status: apiData.status,
          technologies: Array.isArray(apiData.technologies) 
            ? apiData.technologies.join(', ')
            : apiData.technologies,
          parentExperienceId: apiData.parentExperienceId,
        } as ProjectNode;

      case 'event':
        return {
          ...baseData,
          type: 'event',
          eventType: apiData.eventType,
          location: apiData.location,
          organizer: apiData.organizer,
        } as EventNode;

      case 'action':
        return {
          ...baseData,
          type: 'action',
          actionType: apiData.actionType,
          category: apiData.category,
          status: apiData.status,
          impact: apiData.impact,
          verification: apiData.verification,
        } as ActionNode;

      case 'careerTransition':
        return {
          ...baseData,
          type: 'careerTransition',
          transitionType: apiData.transitionType || apiData.type, // Handle both fields
          fromRole: apiData.fromRole,
          toRole: apiData.toRole,
          reason: apiData.reason,
          outcome: apiData.outcome,
        } as CareerTransitionNode;

      default:
        throw new Error(`Unknown node type: ${nodeType}`);
    }
  }
}

// Export singleton instance
export const nodeApi = new NodeApiService();