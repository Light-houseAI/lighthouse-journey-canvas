/**
 * Career Transition Repository Implementation
 * 
 * Concrete repository for managing career transition nodes in the profiles.filteredData field.
 * Extends BaseRepository to provide domain-specific validation and business logic.
 */

import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { BaseRepository } from './base-repository';
import type { CareerTransition } from '../types/node-types';
import { NodeType } from '../core/interfaces/base-node.interface';
import { careerTransitionSchema } from '@shared/schema';

/**
 * Repository for managing career transition nodes
 * 
 * Provides CRUD operations for career transition data stored in profiles.filteredData.careerTransitions
 * with domain-specific validation and business rules.
 */
export class CareerTransitionRepository extends BaseRepository<CareerTransition> {
  
  constructor(db: NodePgDatabase<any>) {
    super(db, 'careerTransitions', NodeType.CareerTransition);
  }

  /**
   * Create a new career transition with validation
   * 
   * @param profileId - The profile ID to create the career transition for
   * @param data - Career transition data without ID and timestamps
   * @returns The created career transition with generated ID and timestamps
   */
  async create(profileId: number, data: Omit<CareerTransition, 'id' | 'createdAt' | 'updatedAt'>): Promise<CareerTransition> {
    // Validate the data using Zod schema (excluding runtime fields)
    const validatedData = this.validateCareerTransitionData(data);
    
    // Call parent create method with validated data
    return super.create(profileId, validatedData);
  }

  /**
   * Update an existing career transition with validation
   * 
   * @param profileId - The profile ID that owns the career transition
   * @param id - The career transition ID to update
   * @param data - Partial career transition data to update
   * @returns The updated career transition or null if not found
   */
  async update(profileId: number, id: string, data: Partial<CareerTransition>): Promise<CareerTransition | null> {
    // Validate partial data if provided
    if (Object.keys(data).length > 0) {
      const validatedData = this.validatePartialCareerTransitionData(data);
      return super.update(profileId, id, validatedData);
    }
    
    return super.update(profileId, id, data);
  }

  /**
   * Find career transitions by type
   * 
   * @param profileId - The profile ID to search within
   * @param transitionType - Transition type to filter by
   * @returns Career transitions of the specified type
   */
  async findByType(
    profileId: number, 
    transitionType: 'job-change' | 'role-change' | 'industry-change' | 'career-pivot' | 'promotion' | 'lateral-move'
  ): Promise<CareerTransition[]> {
    const allTransitions = await this.findAll(profileId);
    return allTransitions.filter(transition => transition.transitionType === transitionType);
  }

  /**
   * Find career transitions by company (from or to)
   * 
   * @param profileId - The profile ID to search within
   * @param company - Company name to search for
   * @returns Career transitions involving the specified company
   */
  async findByCompany(profileId: number, company: string): Promise<CareerTransition[]> {
    const allTransitions = await this.findAll(profileId);
    return allTransitions.filter(transition => 
      (transition.fromCompany && transition.fromCompany.toLowerCase().includes(company.toLowerCase())) ||
      (transition.toCompany && transition.toCompany.toLowerCase().includes(company.toLowerCase()))
    );
  }

  /**
   * Find career transitions by industry (from or to)
   * 
   * @param profileId - The profile ID to search within
   * @param industry - Industry name to search for
   * @returns Career transitions involving the specified industry
   */
  async findByIndustry(profileId: number, industry: string): Promise<CareerTransition[]> {
    const allTransitions = await this.findAll(profileId);
    return allTransitions.filter(transition => 
      (transition.fromIndustry && transition.fromIndustry.toLowerCase().includes(industry.toLowerCase())) ||
      (transition.toIndustry && transition.toIndustry.toLowerCase().includes(industry.toLowerCase()))
    );
  }

  /**
   * Find career transitions by role (from or to)
   * 
   * @param profileId - The profile ID to search within
   * @param role - Role name to search for
   * @returns Career transitions involving the specified role
   */
  async findByRole(profileId: number, role: string): Promise<CareerTransition[]> {
    const allTransitions = await this.findAll(profileId);
    return allTransitions.filter(transition => 
      (transition.fromRole && transition.fromRole.toLowerCase().includes(role.toLowerCase())) ||
      (transition.toRole && transition.toRole.toLowerCase().includes(role.toLowerCase()))
    );
  }

  /**
   * Validate career transition data using Zod schema
   * 
   * @param data - Career transition data to validate
   * @returns Validated career transition data
   * @throws ValidationError if data is invalid
   */
  private validateCareerTransitionData(data: any): Omit<CareerTransition, 'id' | 'createdAt' | 'updatedAt'> {
    try {
      // Use the career transition schema but exclude runtime fields
      const { id, createdAt, updatedAt, ...schemaWithoutRuntime } = careerTransitionSchema.shape;
      const validationSchema = careerTransitionSchema.omit({ id: true, createdAt: true, updatedAt: true });
      
      return validationSchema.parse(data);
    } catch (error: any) {
      throw new Error(`Career transition validation failed: ${error.message}`);
    }
  }

  /**
   * Validate partial career transition data for updates
   * 
   * @param data - Partial career transition data to validate
   * @returns Validated partial career transition data
   * @throws ValidationError if data is invalid
   */
  private validatePartialCareerTransitionData(data: Partial<CareerTransition>): Partial<CareerTransition> {
    try {
      // For partial updates, make all fields optional
      const { id, createdAt, updatedAt, ...schemaWithoutRuntime } = careerTransitionSchema.shape;
      const validationSchema = careerTransitionSchema.omit({ id: true, createdAt: true, updatedAt: true }).partial();
      
      return validationSchema.parse(data);
    } catch (error: any) {
      throw new Error(`Career transition validation failed: ${error.message}`);
    }
  }
}