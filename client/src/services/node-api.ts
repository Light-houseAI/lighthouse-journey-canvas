/**
 * Node API Service
 * Handles all CRUD operations for different node types
 */

import {
  nodeTypeSchema,
  jobSchema,
  educationSchema,
  projectSchema,
  eventSchema,
  actionSchema,
  careerTransitionSchema,
  jobCreateSchema,
  educationCreateSchema,
  projectCreateSchema,
  eventCreateSchema,
  actionCreateSchema,
  careerTransitionCreateSchema
} from '@shared/schema';
import type { z } from 'zod';

// Use shared Zod schemas instead of custom interfaces
export type NodeType = z.infer<typeof nodeTypeSchema>;
export type JobNode = z.infer<typeof jobSchema>;
export type EducationNode = z.infer<typeof educationSchema>;
export type ProjectNode = z.infer<typeof projectSchema>;
export type EventNode = z.infer<typeof eventSchema>;
export type ActionNode = z.infer<typeof actionSchema>;
export type CareerTransitionNode = z.infer<typeof careerTransitionSchema>;

export type NodeData = JobNode | EducationNode | ProjectNode | EventNode | ActionNode | CareerTransitionNode;

// Create DTOs for API requests
export type JobCreateData = z.infer<typeof jobCreateSchema>;
export type EducationCreateData = z.infer<typeof educationCreateSchema>;
export type ProjectCreateData = z.infer<typeof projectCreateSchema>;
export type EventCreateData = z.infer<typeof eventCreateSchema>;
export type ActionCreateData = z.infer<typeof actionCreateSchema>;
export type CareerTransitionCreateData = z.infer<typeof careerTransitionCreateSchema>;

export type NodeCreateData = JobCreateData | EducationCreateData | ProjectCreateData | EventCreateData | ActionCreateData | CareerTransitionCreateData;

class NodeApiService {
  private baseUrl = '/api/v1';

  /**
   * Get the API endpoint for a specific node type, supporting parent-child relationships
   */
  private getEndpoint(
    profileId: number,
    nodeType: NodeType,
    parentId?: string,
    parentType?: 'job' | 'education' | 'careerTransition'
  ): string {
    // Handle nested endpoints for child nodes
    if (parentId && parentType) {
      const parentTypeUrl = this.getParentTypeUrl(parentType);
      const childTypeUrl = this.getChildTypeUrl(nodeType);
      return `${this.baseUrl}/profiles/${profileId}/${parentTypeUrl}/${parentId}/${childTypeUrl}`;
    }

    // Handle standalone endpoints
    const endpoints: Record<NodeType, string> = {
      job: `${this.baseUrl}/profiles/${profileId}/jobs`,
      education: `${this.baseUrl}/profiles/${profileId}/educations`,
      project: `${this.baseUrl}/profiles/${profileId}/projects`,
      event: `${this.baseUrl}/profiles/${profileId}/events`,
      action: `${this.baseUrl}/profiles/${profileId}/actions`,
      careerTransition: `${this.baseUrl}/profiles/${profileId}/career-transitions`,
    };
    return endpoints[nodeType];
  }

  /**
   * Get the URL segment for parent types
   */
  private getParentTypeUrl(parentType: 'job' | 'education' | 'careerTransition'): string {
    switch (parentType) {
      case 'careerTransition':
        return 'career-transitions';
      case 'job':
        return 'jobs';
      case 'education':
        return 'educations';
      default:
        return parentType;
    }
  }

  /**
   * Get the URL segment for child types (plural form)
   */
  private getChildTypeUrl(nodeType: NodeType): string {
    switch (nodeType) {
      case 'project':
        return 'projects';
      case 'event':
        return 'events';
      case 'action':
        return 'actions';
      case 'careerTransition':
        return 'career-transitions';
      default:
        return `${nodeType}s`;
    }
  }

  /**
   * Create a new job
   */
  async createJob(profileId: number, jobData: JobCreateData): Promise<JobNode> {
    const endpoint = this.getEndpoint(profileId, 'job');
    const validatedData = jobCreateSchema.parse(jobData);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(validatedData),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to create job' }));
      throw new Error(error.message || 'Failed to create job');
    }

    const result = await response.json();
    return this.validateResponseData(result, 'job') as JobNode;
  }

  /**
   * Create a new education record
   */
  async createEducation(profileId: number, educationData: EducationCreateData): Promise<EducationNode> {
    const endpoint = this.getEndpoint(profileId, 'education');
    const validatedData = educationCreateSchema.parse(educationData);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(validatedData),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to create education' }));
      throw new Error(error.message || 'Failed to create education');
    }

    const result = await response.json();
    return this.validateResponseData(result, 'education') as EducationNode;
  }

  /**
   * Create a new project (standalone or under a parent)
   */
  async createProject(profileId: number, projectData: ProjectCreateData, parentId?: string, parentType?: 'job' | 'education' | 'careerTransition'): Promise<ProjectNode> {
    const endpoint = this.getEndpoint(profileId, 'project', parentId, parentType);
    const validatedData = projectCreateSchema.parse(projectData);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(validatedData),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to create project' }));
      throw new Error(error.message || 'Failed to create project');
    }

    const result = await response.json();
    return this.validateResponseData(result, 'project') as ProjectNode;
  }

  /**
   * Create a new event (standalone or under a parent)
   */
  async createEvent(profileId: number, eventData: EventCreateData, parentId?: string, parentType?: 'job' | 'education' | 'careerTransition'): Promise<EventNode> {
    const endpoint = this.getEndpoint(profileId, 'event', parentId, parentType);
    const validatedData = eventCreateSchema.parse(eventData);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(validatedData),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to create event' }));
      throw new Error(error.message || 'Failed to create event');
    }

    const result = await response.json();
    return this.validateResponseData(result, 'event') as EventNode;
  }

  /**
   * Create a new action (standalone or under a parent)
   */
  async createAction(profileId: number, actionData: ActionCreateData, parentId?: string, parentType?: 'job' | 'education' | 'careerTransition'): Promise<ActionNode> {
    const endpoint = this.getEndpoint(profileId, 'action', parentId, parentType);
    const validatedData = actionCreateSchema.parse(actionData);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(validatedData),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to create action' }));
      throw new Error(error.message || 'Failed to create action');
    }

    const result = await response.json();
    return this.validateResponseData(result, 'action') as ActionNode;
  }

  /**
   * Create a new career transition
   */
  async createCareerTransition(profileId: number, transitionData: CareerTransitionCreateData): Promise<CareerTransitionNode> {
    const endpoint = this.getEndpoint(profileId, 'careerTransition');
    const validatedData = careerTransitionCreateSchema.parse(transitionData);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(validatedData),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to create career transition' }));
      throw new Error(error.message || 'Failed to create career transition');
    }

    const result = await response.json();
    return this.validateResponseData(result, 'careerTransition') as CareerTransitionNode;
  }

  /**
   * Update an existing node (standalone or child)
   */
  async updateNode(
    profileId: number,
    nodeId: string,
    nodeData: Partial<NodeCreateData> & { type: NodeType },
    parentId?: string,
    parentType?: 'job' | 'education' | 'careerTransition'
  ): Promise<NodeData> {
    const endpoint = `${this.getEndpoint(profileId, nodeData.type, parentId, parentType)}/${nodeId}`;

    const { type, ...updateData } = nodeData;

    const response = await fetch(endpoint, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(updateData),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to update node' }));
      throw new Error(error.message || `Failed to update ${nodeData.type}`);
    }

    const result = await response.json();
    return this.validateResponseData(result, nodeData.type);
  }

  /**
   * Delete a node (standalone or child)
   */
  async deleteNode(
    profileId: number,
    nodeType: NodeType,
    nodeId: string,
    parentId?: string,
    parentType?: 'job' | 'education' | 'careerTransition'
  ): Promise<void> {
    const endpoint = `${this.getEndpoint(profileId, nodeType, parentId, parentType)}/${nodeId}`;

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
      ? nodes.map(node => this.validateResponseData(node, nodeType))
      : [];
  }

  /**
   * Get a single node (standalone or child)
   */
  async getNode(
    profileId: number,
    nodeType: NodeType,
    nodeId: string,
    parentId?: string,
    parentType?: 'job' | 'education' | 'careerTransition'
  ): Promise<NodeData> {
    const endpoint = `${this.getEndpoint(profileId, nodeType, parentId, parentType)}/${nodeId}`;

    const response = await fetch(endpoint, {
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to fetch node' }));
      throw new Error(error.message || `Failed to fetch ${nodeType}`);
    }

    const result = await response.json();
    return this.validateResponseData(result, nodeType);
  }

  /**
   * Get child nodes of a specific parent
   */
  async getChildNodes(
    profileId: number,
    nodeType: NodeType,
    parentId: string,
    parentType: 'job' | 'education' | 'careerTransition'
  ): Promise<NodeData[]> {
    const endpoint = this.getEndpoint(profileId, nodeType, parentId, parentType);

    const response = await fetch(endpoint, {
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to fetch child nodes' }));
      throw new Error(error.message || `Failed to fetch child ${nodeType} nodes`);
    }

    const result = await response.json();
    const nodes = result.data || result.items || result;

    return Array.isArray(nodes)
      ? nodes.map(node => this.validateResponseData(node, nodeType))
      : [];
  }

  /**
   * Validate response data using Zod schemas
   */
  private validateResponseData(apiData: any, nodeType: NodeType): NodeData {

    switch (nodeType) {
      case 'job':
        return jobSchema.parse(apiData.data);
      case 'education':
        return educationSchema.parse(apiData.data);
      case 'project':
        return projectSchema.parse(apiData.data);
      case 'event':
        return eventSchema.parse(apiData.data);
      case 'action':
        return actionSchema.parse(apiData.data);
      case 'careerTransition':
        return careerTransitionSchema.parse(apiData.data);
      default:
        throw new Error(`Unknown node type: ${nodeType}`);
    }
  }
}

// Export singleton instance
export const nodeApi = new NodeApiService();
