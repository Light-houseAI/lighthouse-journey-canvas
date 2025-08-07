/**
 * Action Service Implementation
 * 
 * Handles business logic for action nodes including validation,
 * business rules, and data transformation.
 * 
 * Key business rules:
 * - Required fields: title, actionType, category, status
 * - Status progression validation (planned -> in-progress -> completed/verified)
 * - Validation of effort and impact combinations
 * - Expiration date validation for certifications
 */

import type { Action } from '../types/node-types';
import type { IRepository } from '../core/interfaces/repository.interface';
import type { INodeService } from '../core/interfaces/service.interface';
import { BaseService, ValidationError, BusinessRuleError } from './base-service';
import { 
  actionCreateSchema, 
  actionUpdateSchema,
  type ActionCreateDTO,
  type ActionUpdateDTO 
} from '@shared/schema';

/**
 * Action Service
 * 
 * Extends BaseService with action specific business logic and validation.
 * Implements INodeService for date-based operations and status management.
 */
export class ActionService 
  extends BaseService<Action, ActionCreateDTO, ActionUpdateDTO>
  implements INodeService<Action, ActionCreateDTO, ActionUpdateDTO> {

  constructor(repository: IRepository<Action>) {
    super(repository, 'Action');
  }

  /**
   * Get actions by status
   */
  async getByStatus(profileId: number, status: 'planned' | 'in-progress' | 'completed' | 'verified'): Promise<Action[]> {
    this.validateProfileId(profileId);
    
    const allActions = await this.getAll(profileId);
    return allActions.filter(action => action.status === status);
  }

  /**
   * Get actions by category
   */
  async getByCategory(
    profileId: number, 
    category: 'professional-development' | 'community' | 'personal' | 'academic' | 'leadership'
  ): Promise<Action[]> {
    this.validateProfileId(profileId);
    
    const allActions = await this.getAll(profileId);
    return allActions.filter(action => action.category === category);
  }

  /**
   * Get actions by type
   */
  async getByType(
    profileId: number, 
    actionType: 'certification' | 'achievement' | 'milestone' | 'award' | 'publication' | 'speaking' | 'volunteer'
  ): Promise<Action[]> {
    this.validateProfileId(profileId);
    
    const allActions = await this.getAll(profileId);
    return allActions.filter(action => action.actionType === actionType);
  }

  /**
   * Get expiring certifications (within 30 days)
   */
  async getExpiringCertifications(profileId: number): Promise<Action[]> {
    this.validateProfileId(profileId);
    
    const allActions = await this.getAll(profileId);
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    
    return allActions.filter(action => {
      if (action.actionType !== 'certification' || !action.expirationDate) {
        return false;
      }
      
      try {
        const expirationDate = new Date(action.expirationDate);
        return expirationDate <= thirtyDaysFromNow && expirationDate > new Date();
      } catch {
        return false; // Invalid date format
      }
    });
  }

  /**
   * Get completed actions sorted by completion date
   */
  async getAllSorted(profileId: number): Promise<Action[]> {
    this.validateProfileId(profileId);
    
    const allActions = await this.getAll(profileId);
    return allActions.sort((a, b) => {
      // Sort by status first (completed/verified first), then by date
      const statusOrder = { 'verified': 0, 'completed': 1, 'in-progress': 2, 'planned': 3 };
      const aStatus = statusOrder[a.status];
      const bStatus = statusOrder[b.status];
      
      if (aStatus !== bStatus) {
        return aStatus - bStatus;
      }
      
      // Then sort by end date, start date, or updated date
      const aDate = a.endDate || a.startDate || a.updatedAt;
      const bDate = b.endDate || b.startDate || b.updatedAt;
      
      if (!aDate && !bDate) return 0;
      if (!aDate) return 1;
      if (!bDate) return -1;
      
      return new Date(bDate).getTime() - new Date(aDate).getTime();
    });
  }

  /**
   * Create action with business rule validation
   */
  async create(profileId: number, data: ActionCreateDTO): Promise<Action> {
    this.validateCreateData(data);
    
    // Validate business rules
    await this.validateBusinessRules(data);
    
    return super.create(profileId, data);
  }

  /**
   * Update action with status progression validation
   */
  async update(profileId: number, id: string, data: ActionUpdateDTO): Promise<Action> {
    this.validateUpdateData(data);
    
    // Get current action to validate status progression
    const currentAction = await this.getById(profileId, id);
    if (!currentAction) {
      throw new ValidationError('Action not found');
    }
    
    // Validate status progression if status is being changed
    if (data.status && data.status !== currentAction.status) {
      this.validateStatusProgression(currentAction.status, data.status);
    }
    
    return super.update(profileId, id, data);
  }

  /**
   * Validate action creation data
   */
  protected validateCreateData(data: ActionCreateDTO): void {
    try {
      actionCreateSchema.parse(data);
    } catch (error: any) {
      throw new ValidationError('Invalid action data', error.errors);
    }
  }

  /**
   * Validate action update data
   */
  protected validateUpdateData(data: ActionUpdateDTO): void {
    try {
      actionUpdateSchema.parse(data);
    } catch (error: any) {
      throw new ValidationError('Invalid action update data', error.errors);
    }
  }

  /**
   * Validate business rules for actions
   */
  private async validateBusinessRules(data: ActionCreateDTO): Promise<void> {
    // Validate expiration date for certifications
    if (data.actionType === 'certification' && data.expirationDate) {
      const expDate = new Date(data.expirationDate);
      const now = new Date();
      
      if (expDate <= now) {
        throw new BusinessRuleError('Certification expiration date must be in the future');
      }
    }
    
    // Validate effort and impact combination
    if (data.effort === 'low' && data.impact === 'major') {
      throw new BusinessRuleError('Low effort actions typically do not have major impact');
    }
    
    // Validate date consistency
    if (data.startDate && data.endDate) {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      
      if (start >= end) {
        throw new BusinessRuleError('Start date must be before end date');
      }
    }
  }

  /**
   * Validate status progression rules
   */
  private validateStatusProgression(
    currentStatus: 'planned' | 'in-progress' | 'completed' | 'verified',
    newStatus: 'planned' | 'in-progress' | 'completed' | 'verified'
  ): void {
    const validTransitions: Record<string, string[]> = {
      'planned': ['in-progress', 'completed'],
      'in-progress': ['completed', 'planned'],
      'completed': ['verified', 'in-progress'],
      'verified': ['completed']
    };
    
    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new BusinessRuleError(
        `Invalid status transition from ${currentStatus} to ${newStatus}`
      );
    }
  }
}