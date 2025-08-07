/**
 * Base Repository Implementation
 *
 * Abstract implementation of IRepository<T> providing core JSON field operations
 * for managing nodes in the profiles.filteredData field.
 *
 * This class handles common CRUD operations and JSON manipulation utilities
 * while allowing specific repositories to extend with domain-specific behavior.
 */

import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { baseNodeSchema, profiles } from '@shared/schema';
import type { IRepository } from '../core/interfaces/repository.interface';
import type { BaseNode, NodeType } from '../core/interfaces/base-node.interface';

/**
 * Type mapping for filteredData structure
 * Maps node types to their corresponding field names in the JSON structure
 */
type FilteredDataStructure = {
  jobs: any[];
  education: any[];
  projects: any[];
  events: any[];
  actions: any[];
  careerTransitions: any[];
};

type NodeFieldName = keyof FilteredDataStructure;

/**
 * Abstract base repository implementing core JSON field operations
 *
 * Provides standardized CRUD operations for all node types stored in the
 * profiles.filteredData JSON field. Concrete repositories extend this class
 * to add domain-specific validation and business logic.
 *
 * @template T - The node type that extends BaseNode
 */
export abstract class BaseRepository<T extends typeof baseNodeSchema> implements IRepository<T> {

  /**
   * Initialize base repository with database connection and node configuration
   *
   * @param db - Drizzle database instance
   * @param fieldName - Field name in filteredData JSON (e.g., 'workExperiences')
   * @param nodeType - Node type enum value for validation
   */
  constructor(
    protected readonly db: NodePgDatabase<any>,
    protected readonly fieldName: NodeFieldName,
    protected readonly nodeType: NodeType
  ) {}

  /**
   * Retrieve all nodes of type T for a specific profile
   */
  async findAll(profileId: number): Promise<T[]> {
    const profile = await this.getProfile(profileId);
    if (!profile?.filteredData) {
      return [];
    }

    const nodes = profile.filteredData[this.fieldName];
    if (!Array.isArray(nodes)) {
      return [];
    }

    return nodes.filter(this.isValidNode.bind(this)) as T[];
  }

  /**
   * Retrieve a specific node by ID for a profile
   */
  async findById(profileId: number, id: string): Promise<T | null> {
    const nodes = await this.findAll(profileId);
    return nodes.find(node => node.id === id) || null;
  }

  /**
   * Create a new node for a profile
   */
  async create(profileId: number, data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    const profile = await this.getProfile(profileId);
    if (!profile) {
      throw new Error(`Profile with ID ${profileId} not found`);
    }

    // Generate new node with ID and timestamps
    const newNode = this.createNodeWithMetadata(data);

    // Get current nodes or initialize empty structure
    const filteredData = this.ensureFilteredDataStructure(profile.filteredData);
    const currentNodes = filteredData[this.fieldName] || [];

    // Add new node
    const updatedNodes = [...currentNodes, newNode];
    filteredData[this.fieldName] = updatedNodes;

    // Save to database
    await this.updateProfileFilteredData(profileId, filteredData);

    return newNode;
  }

  /**
   * Update an existing node for a profile
   */
  async update(profileId: number, id: string, updates: Partial<T>): Promise<T | null> {
    const profile = await this.getProfile(profileId);
    if (!profile?.filteredData) {
      return null;
    }

    const filteredData = profile.filteredData;
    const currentNodes = filteredData[this.fieldName] || [];
    const nodeIndex = currentNodes.findIndex((node: any) => node.id === id);

    if (nodeIndex === -1) {
      return null;
    }

    // Update node with new data and timestamp
    const updatedNode = {
      ...currentNodes[nodeIndex],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    // Replace node in array
    const updatedNodes = [...currentNodes];
    updatedNodes[nodeIndex] = updatedNode;
    filteredData[this.fieldName] = updatedNodes;

    // Save to database
    await this.updateProfileFilteredData(profileId, filteredData);

    return updatedNode as T;
  }

  /**
   * Delete a node for a profile
   */
  async delete(profileId: number, id: string): Promise<boolean> {
    const profile = await this.getProfile(profileId);
    if (!profile?.filteredData) {
      return false;
    }

    const filteredData = profile.filteredData;
    const currentNodes = filteredData[this.fieldName] || [];
    const nodeIndex = currentNodes.findIndex((node: any) => node.id === id);

    if (nodeIndex === -1) {
      return false;
    }

    // Remove node from array
    const updatedNodes = currentNodes.filter((node: any) => node.id !== id);
    filteredData[this.fieldName] = updatedNodes;

    // Save to database
    await this.updateProfileFilteredData(profileId, filteredData);

    return true;
  }

  /**
   * Protected helper methods
   */

  /**
   * Fetch profile by ID
   */
  protected async getProfile(profileId: number): Promise<any> {
    const result = await this.db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, profileId))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Update profile's filteredData field
   */
  protected async updateProfileFilteredData(
    profileId: number,
    filteredData: FilteredDataStructure
  ): Promise<void> {
    await this.db
      .update(profiles)
      .set({ filteredData })
      .where(eq(profiles.userId, profileId));
  }

  /**
   * Ensure filteredData has proper structure
   */
  protected ensureFilteredDataStructure(
    filteredData: any
  ): FilteredDataStructure {
    if (!filteredData || typeof filteredData !== 'object') {
      return {
        workExperiences: [],
        education: [],
        projects: [],
        events: [],
        actions: [],
        careerTransitions: [],
      };
    }

    return {
      workExperiences: Array.isArray(filteredData.workExperiences) ? filteredData.workExperiences : [],
      education: Array.isArray(filteredData.education) ? filteredData.education : [],
      projects: Array.isArray(filteredData.projects) ? filteredData.projects : [],
      events: Array.isArray(filteredData.events) ? filteredData.events : [],
      actions: Array.isArray(filteredData.actions) ? filteredData.actions : [],
      careerTransitions: Array.isArray(filteredData.careerTransitions) ? filteredData.careerTransitions : [],
    };
  }

  /**
   * Create a new node with generated ID and timestamps
   */
  protected createNodeWithMetadata(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): T {
    const now = new Date().toISOString();
    const id = this.generateNodeId();

    return {
      ...data,
      id,
      type: this.nodeType,
      createdAt: now,
      updatedAt: now,
    } as T;
  }

  /**
   * Generate unique node ID using crypto.randomUUID()
   */
  protected generateNodeId(): string {
    return crypto.randomUUID();
  }

  /**
   * Validate that a node has the correct type and structure
   */
  protected isValidNode(node: any): node is T {
    if (!node || typeof node !== 'object') {
      return false;
    }

    return (
      (node.type === this.nodeType || node.type === this.nodeType.toString()) &&
      typeof node.id === 'string' &&
      typeof node.title === 'string'
      // Note: For backward compatibility, we don't strictly require createdAt/updatedAt
      // as these may be added during migration from existing data
    );
  }

  /**
   * Get the field name for this repository's node type
   * Used internally for field mapping
   */
  protected getNodeFieldName(): NodeFieldName {
    return this.fieldName;
  }
}

/**
 * Error classes for repository operations
 */
export class RepositoryError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'RepositoryError';
  }
}

export class ProfileNotFoundError extends RepositoryError {
  constructor(profileId: number) {
    super(`Profile with ID ${profileId} not found`, 'PROFILE_NOT_FOUND');
  }
}

export class NodeNotFoundError extends RepositoryError {
  constructor(nodeId: string, nodeType: string) {
    super(`${nodeType} node with ID ${nodeId} not found`, 'NODE_NOT_FOUND');
  }
}

export class InvalidNodeDataError extends RepositoryError {
  constructor(reason: string) {
    super(`Invalid node data: ${reason}`, 'INVALID_NODE_DATA');
  }
}

/**
 * Type guard utilities for JSON data validation
 */
export function isValidBaseNode(obj: any): obj is BaseNode {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.type === 'string' &&
    typeof obj.title === 'string' &&
    typeof obj.createdAt === 'string' &&
    typeof obj.updatedAt === 'string' &&
    (obj.description === undefined || typeof obj.description === 'string') &&
    (obj.startDate === undefined || typeof obj.startDate === 'string') &&
    (obj.endDate === undefined || typeof obj.endDate === 'string')
  );
}

/**
 * Utility function to safely parse JSON field data
 */
export function safeParseJsonField<T>(data: any, defaultValue: T): T {
  if (data === null || data === undefined) {
    return defaultValue;
  }

  if (typeof data === 'object') {
    return data;
  }

  try {
    return JSON.parse(data);
  } catch {
    return defaultValue;
  }
}
