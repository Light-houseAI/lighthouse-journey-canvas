/**
 * Action Repository Implementation
 * 
 * Concrete repository for managing action nodes in the profiles.filteredData field.
 * Extends BaseRepository to provide domain-specific validation and business logic.
 */

import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { BaseRepository } from './base-repository';
import type { Action } from '../types/node-types';
import { NodeType } from '../core/interfaces/base-node.interface';
import { actionSchema } from '@shared/schema';

/**
 * Repository for managing action nodes
 * 
 * Provides CRUD operations for action data stored in profiles.filteredData.actions
 * with domain-specific validation and business rules.
 */
export class ActionRepository extends BaseRepository<Action> {
  
  constructor(db: NodePgDatabase<any>) {
    super(db, 'actions', NodeType.Action);
  }

  /**
   * Create a new action with validation
   * 
   * @param profileId - The profile ID to create the action for
   * @param data - Action data without ID and timestamps
   * @returns The created action with generated ID and timestamps
   */
  async create(profileId: number, data: Omit<Action, 'id' | 'createdAt' | 'updatedAt'>): Promise<Action> {
    // Validate the data using Zod schema (excluding runtime fields)
    const validatedData = this.validateActionData(data);
    
    // Call parent create method with validated data
    return super.create(profileId, validatedData);
  }

  /**
   * Update an existing action with validation
   * 
   * @param profileId - The profile ID that owns the action
   * @param id - The action ID to update
   * @param data - Partial action data to update
   * @returns The updated action or null if not found
   */
  async update(profileId: number, id: string, data: Partial<Action>): Promise<Action | null> {
    // Validate partial data if provided
    if (Object.keys(data).length > 0) {
      const validatedData = this.validatePartialActionData(data);
      return super.update(profileId, id, validatedData);
    }
    
    return super.update(profileId, id, data);
  }

  /**
   * Find actions by status
   * 
   * @param profileId - The profile ID to search within
   * @param status - Action status to filter by
   * @returns Actions with the specified status
   */
  async findByStatus(
    profileId: number, 
    status: 'planned' | 'in-progress' | 'completed' | 'verified'
  ): Promise<Action[]> {
    const allActions = await this.findAll(profileId);
    return allActions.filter(action => action.status === status);
  }

  /**
   * Find actions by category
   * 
   * @param profileId - The profile ID to search within
   * @param category - Action category to filter by
   * @returns Actions in the specified category
   */
  async findByCategory(
    profileId: number, 
    category: 'professional-development' | 'community' | 'personal' | 'academic' | 'leadership'
  ): Promise<Action[]> {
    const allActions = await this.findAll(profileId);
    return allActions.filter(action => action.category === category);
  }

  /**
   * Find actions by type
   * 
   * @param profileId - The profile ID to search within
   * @param actionType - Action type to filter by
   * @returns Actions of the specified type
   */
  async findByType(
    profileId: number, 
    actionType: 'certification' | 'achievement' | 'milestone' | 'award' | 'publication' | 'speaking' | 'volunteer'
  ): Promise<Action[]> {
    const allActions = await this.findAll(profileId);
    return allActions.filter(action => action.actionType === actionType);
  }

  /**
   * Validate action data using Zod schema
   * 
   * @param data - Action data to validate
   * @returns Validated action data
   * @throws ValidationError if data is invalid
   */
  private validateActionData(data: any): Omit<Action, 'id' | 'createdAt' | 'updatedAt'> {
    try {
      // Use the action schema but exclude runtime fields
      const { id, createdAt, updatedAt, ...schemaWithoutRuntime } = actionSchema.shape;
      const validationSchema = actionSchema.omit({ id: true, createdAt: true, updatedAt: true });
      
      return validationSchema.parse(data);
    } catch (error: any) {
      throw new Error(`Action validation failed: ${error.message}`);
    }
  }

  /**
   * Validate partial action data for updates
   * 
   * @param data - Partial action data to validate
   * @returns Validated partial action data
   * @throws ValidationError if data is invalid
   */
  private validatePartialActionData(data: Partial<Action>): Partial<Action> {
    try {
      // For partial updates, make all fields optional
      const { id, createdAt, updatedAt, ...schemaWithoutRuntime } = actionSchema.shape;
      const validationSchema = actionSchema.omit({ id: true, createdAt: true, updatedAt: true }).partial();
      
      return validationSchema.parse(data);
    } catch (error: any) {
      throw new Error(`Action validation failed: ${error.message}`);
    }
  }
}