/**
 * Career Transition Service Implementation
 * 
 * Handles business logic for career transition nodes including validation,
 * business rules, and data transformation.
 * 
 * Key business rules:
 * - Required fields: title, transitionType
 * - Validate transition logic (from/to consistency)
 * - Salary change calculations and validations
 * - Duration and timeline consistency
 */

import type { CareerTransition } from '../types/node-types';
import type { IRepository } from '../core/interfaces/repository.interface';
import type { INodeService } from '../core/interfaces/service.interface';
import { BaseService, ValidationError, BusinessRuleError } from './base-service';
import { 
  careerTransitionCreateSchema, 
  careerTransitionUpdateSchema,
  type CareerTransitionCreateDTO,
  type CareerTransitionUpdateDTO 
} from '@shared/schema';

/**
 * Career Transition Service
 * 
 * Extends BaseService with career transition specific business logic and validation.
 * Implements INodeService for date-based operations and transition analysis.
 */
export class CareerTransitionService 
  extends BaseService<CareerTransition, CareerTransitionCreateDTO, CareerTransitionUpdateDTO>
  implements INodeService<CareerTransition, CareerTransitionCreateDTO, CareerTransitionUpdateDTO> {

  constructor(repository: IRepository<CareerTransition>) {
    super(repository, 'Career Transition');
  }

  /**
   * Get career transitions by type
   */
  async getByType(
    profileId: number, 
    transitionType: 'job-change' | 'role-change' | 'industry-change' | 'career-pivot' | 'promotion' | 'lateral-move'
  ): Promise<CareerTransition[]> {
    this.validateProfileId(profileId);
    
    const allTransitions = await this.getAll(profileId);
    return allTransitions.filter(transition => transition.transitionType === transitionType);
  }

  /**
   * Get career transitions by company (from or to)
   */
  async getByCompany(profileId: number, company: string): Promise<CareerTransition[]> {
    this.validateProfileId(profileId);
    
    const allTransitions = await this.getAll(profileId);
    return allTransitions.filter(transition => 
      (transition.fromCompany && transition.fromCompany.toLowerCase().includes(company.toLowerCase())) ||
      (transition.toCompany && transition.toCompany.toLowerCase().includes(company.toLowerCase()))
    );
  }

  /**
   * Get career transitions by industry (from or to)
   */
  async getByIndustry(profileId: number, industry: string): Promise<CareerTransition[]> {
    this.validateProfileId(profileId);
    
    const allTransitions = await this.getAll(profileId);
    return allTransitions.filter(transition => 
      (transition.fromIndustry && transition.fromIndustry.toLowerCase().includes(industry.toLowerCase())) ||
      (transition.toIndustry && transition.toIndustry.toLowerCase().includes(industry.toLowerCase()))
    );
  }

  /**
   * Get transitions within a specific date range
   */
  async getByDateRange(profileId: number, startDate: string, endDate: string): Promise<CareerTransition[]> {
    this.validateProfileId(profileId);
    
    if (!this.validateDateFormat(startDate) || !this.validateDateFormat(endDate)) {
      throw new ValidationError('Invalid date format');
    }
    
    const allTransitions = await this.getAll(profileId);
    const rangeStart = new Date(startDate);
    const rangeEnd = new Date(endDate);
    
    return allTransitions.filter(transition => {
      try {
        const transitionStart = transition.startDate ? new Date(transition.startDate) : null;
        const transitionEnd = transition.endDate ? new Date(transition.endDate) : null;
        
        // For career transitions, check if the transition occurred within the range
        if (transitionStart && transitionStart >= rangeStart && transitionStart <= rangeEnd) return true;
        if (transitionEnd && transitionEnd >= rangeStart && transitionEnd <= rangeEnd) return true;
        
        // Check if the transition spans the entire range
        if (transitionStart && transitionEnd && transitionStart <= rangeStart && transitionEnd >= rangeEnd) return true;
        
        return false;
      } catch {
        return false; // Invalid date format
      }
    });
  }

  /**
   * Get transitions sorted by date (most recent first)
   */
  async getAllSorted(profileId: number): Promise<CareerTransition[]> {
    this.validateProfileId(profileId);
    
    const allTransitions = await this.getAll(profileId);
    return allTransitions.sort((a, b) => {
      const aDate = a.startDate || a.createdAt;
      const bDate = b.startDate || b.createdAt;
      
      if (!aDate && !bDate) return 0;
      if (!aDate) return 1;
      if (!bDate) return -1;
      
      return new Date(bDate).getTime() - new Date(aDate).getTime();
    });
  }

  /**
   * Analyze salary progression across transitions
   */
  async getSalaryProgression(profileId: number): Promise<{
    totalTransitions: number;
    salaryIncreases: number;
    salaryDecreases: number;
    averageIncrease?: number;
    largestIncrease?: number;
  }> {
    this.validateProfileId(profileId);
    
    const allTransitions = await this.getAll(profileId);
    const transitionsWithSalaryChange = allTransitions.filter(t => t.salaryChange?.value);
    
    if (transitionsWithSalaryChange.length === 0) {
      return {
        totalTransitions: allTransitions.length,
        salaryIncreases: 0,
        salaryDecreases: 0
      };
    }
    
    const increases = transitionsWithSalaryChange.filter(t => t.salaryChange!.value > 0);
    const decreases = transitionsWithSalaryChange.filter(t => t.salaryChange!.value < 0);
    
    const averageIncrease = increases.length > 0 
      ? increases.reduce((sum, t) => sum + t.salaryChange!.value, 0) / increases.length 
      : undefined;
    
    const largestIncrease = increases.length > 0 
      ? Math.max(...increases.map(t => t.salaryChange!.value)) 
      : undefined;
    
    return {
      totalTransitions: allTransitions.length,
      salaryIncreases: increases.length,
      salaryDecreases: decreases.length,
      averageIncrease,
      largestIncrease
    };
  }

  /**
   * Create career transition with business rule validation
   */
  async create(profileId: number, data: CareerTransitionCreateDTO): Promise<CareerTransition> {
    this.validateCreateData(data);
    
    // Validate business rules
    await this.validateBusinessRules(data);
    
    return super.create(profileId, data);
  }

  /**
   * Update career transition with validation
   */
  async update(profileId: number, id: string, data: CareerTransitionUpdateDTO): Promise<CareerTransition> {
    this.validateUpdateData(data);
    
    // Get current transition for business rule validation
    const currentTransition = await this.getById(profileId, id);
    if (!currentTransition) {
      throw new ValidationError('Career transition not found');
    }
    
    // Validate business rules for update
    const updatedData = { ...currentTransition, ...data };
    await this.validateBusinessRules(updatedData);
    
    return super.update(profileId, id, data);
  }

  /**
   * Validate career transition creation data
   */
  protected validateCreateData(data: CareerTransitionCreateDTO): void {
    try {
      careerTransitionCreateSchema.parse(data);
    } catch (error: any) {
      throw new ValidationError('Invalid career transition data', error.errors);
    }
  }

  /**
   * Validate career transition update data
   */
  protected validateUpdateData(data: CareerTransitionUpdateDTO): void {
    try {
      careerTransitionUpdateSchema.parse(data);
    } catch (error: any) {
      throw new ValidationError('Invalid career transition update data', error.errors);
    }
  }

  /**
   * Validate business rules for career transitions
   */
  private async validateBusinessRules(data: CareerTransitionCreateDTO | (CareerTransition & CareerTransitionUpdateDTO)): Promise<void> {
    // Validate date consistency
    if (data.startDate && data.endDate) {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      
      if (start >= end) {
        throw new BusinessRuleError('Start date must be before end date');
      }
    }
    
    // Validate transition type consistency
    this.validateTransitionConsistency(data);
    
    // Validate salary change data
    if (data.salaryChange) {
      this.validateSalaryChange(data.salaryChange);
    }
  }

  /**
   * Validate transition type consistency with from/to fields
   */
  private validateTransitionConsistency(data: CareerTransitionCreateDTO | (CareerTransition & CareerTransitionUpdateDTO)): void {
    switch (data.transitionType) {
      case 'job-change':
        if (!data.fromCompany || !data.toCompany) {
          throw new BusinessRuleError('Job changes must specify both from and to companies');
        }
        break;
        
      case 'industry-change':
        if (!data.fromIndustry || !data.toIndustry) {
          throw new BusinessRuleError('Industry changes must specify both from and to industries');
        }
        break;
        
      case 'role-change':
        if (!data.fromRole || !data.toRole) {
          throw new BusinessRuleError('Role changes must specify both from and to roles');
        }
        break;
        
      case 'promotion':
        if (data.salaryChange && data.salaryChange.value < 0) {
          throw new BusinessRuleError('Promotions typically include salary increases');
        }
        break;
    }
  }

  /**
   * Validate salary change data
   */
  private validateSalaryChange(salaryChange: { type: 'percentage' | 'amount'; value: number; currency?: string }): void {
    if (salaryChange.type === 'percentage') {
      if (salaryChange.value < -100) {
        throw new BusinessRuleError('Salary percentage change cannot be less than -100%');
      }
      if (salaryChange.value > 500) {
        throw new BusinessRuleError('Salary percentage increase exceeds realistic bounds (>500%)');
      }
    } else if (salaryChange.type === 'amount') {
      if (Math.abs(salaryChange.value) > 1000000) {
        throw new BusinessRuleError('Salary amount change exceeds realistic bounds');
      }
    }
  }
}