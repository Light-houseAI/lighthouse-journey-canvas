/**
 * Service Interface for Business Logic Operations
 * 
 * Defines the contract for service implementations that handle
 * business logic and orchestrate repository operations as specified in PRD section 7.1
 */

import { CreateDTO, UpdateDTO, ListRequestDTO, ResponseDTO, BulkOperationDTO, BulkOperationResultDTO } from './dto.interface';

/**
 * Generic service interface for managing entities of type T
 * 
 * This interface follows the Service pattern and provides business logic operations
 * for entities. Services orchestrate repository calls, perform validation,
 * and enforce business rules.
 * 
 * All operations are scoped to a specific profileId to ensure data isolation.
 * 
 * @template T - The entity type that the service manages
 * @template TCreateDTO - The DTO type for create operations
 * @template TUpdateDTO - The DTO type for update operations
 */
export interface IService<T, TCreateDTO extends CreateDTO = CreateDTO, TUpdateDTO extends UpdateDTO = UpdateDTO> {
  /**
   * Retrieve all entities of type T for a specific profile
   * 
   * @param profileId - The profile ID to retrieve entities for
   * @returns Promise resolving to array of entities
   */
  getAll(profileId: number): Promise<T[]>;

  /**
   * Retrieve a specific entity by ID for a profile
   * Throws an error if the entity is not found
   * 
   * @param profileId - The profile ID that owns the entity
   * @param id - The unique identifier of the entity
   * @returns Promise resolving to the entity
   * @throws Error if entity not found
   */
  getById(profileId: number, id: string): Promise<T>;

  /**
   * Create a new entity for a profile
   * Validates the input data and generates a unique ID
   * 
   * @param profileId - The profile ID to create the entity for
   * @param data - The entity creation data
   * @returns Promise resolving to the created entity
   * @throws Error if validation fails
   */
  create(profileId: number, data: TCreateDTO): Promise<T>;

  /**
   * Update an existing entity for a profile
   * Validates the input data and updates timestamps
   * 
   * @param profileId - The profile ID that owns the entity
   * @param id - The unique identifier of the entity to update
   * @param data - Partial entity data with fields to update
   * @returns Promise resolving to the updated entity
   * @throws Error if entity not found or validation fails
   */
  update(profileId: number, id: string, data: TUpdateDTO): Promise<T>;

  /**
   * Delete an entity for a profile
   * 
   * @param profileId - The profile ID that owns the entity
   * @param id - The unique identifier of the entity to delete
   * @returns Promise resolving when deletion is complete
   * @throws Error if entity not found
   */
  delete(profileId: number, id: string): Promise<void>;
}

/**
 * Extended service interface with advanced query capabilities
 * 
 * Services can optionally implement this interface to provide
 * advanced features like pagination, filtering, and bulk operations
 * as specified in PRD Milestone 3.
 */
export interface IAdvancedService<T, TCreateDTO extends CreateDTO = CreateDTO, TUpdateDTO extends UpdateDTO = UpdateDTO> 
  extends IService<T, TCreateDTO, TUpdateDTO> {
  
  /**
   * Retrieve entities with advanced filtering and pagination
   * 
   * @param profileId - The profile ID to search within
   * @param options - Query options for filtering and pagination
   * @returns Promise resolving to response with filtered entities and metadata
   */
  list(profileId: number, options: ListRequestDTO): Promise<ResponseDTO<T[]>>;

  /**
   * Search entities by text across relevant fields
   * 
   * @param profileId - The profile ID to search within
   * @param searchText - Text to search for
   * @param limit - Maximum number of results
   * @returns Promise resolving to matching entities
   */
  search(profileId: number, searchText: string, limit?: number): Promise<T[]>;

  /**
   * Count total entities matching filter criteria
   * 
   * @param profileId - The profile ID to count within
   * @param filters - Filter criteria
   * @returns Promise resolving to total count
   */
  count(profileId: number, filters?: Record<string, any>): Promise<number>;

  /**
   * Perform bulk operations on multiple entities
   * 
   * @param profileId - The profile ID to operate within
   * @param operation - Bulk operation details
   * @returns Promise resolving to operation results
   */
  bulkOperation(profileId: number, operation: BulkOperationDTO<T>): Promise<BulkOperationResultDTO>;

  /**
   * Validate entity data without persisting
   * 
   * @param data - Entity data to validate
   * @returns Promise resolving to validation result
   */
  validate(data: TCreateDTO | TUpdateDTO): Promise<{ valid: boolean; errors?: string[] }>;
}

/**
 * Service interface for node-specific operations
 * 
 * Extends the basic service interface with node-specific features
 * like date validation and status management.
 */
export interface INodeService<T, TCreateDTO extends CreateDTO = CreateDTO, TUpdateDTO extends UpdateDTO = UpdateDTO> 
  extends IService<T, TCreateDTO, TUpdateDTO> {
  
  /**
   * Get entities within a specific date range
   * 
   * @param profileId - The profile ID to search within
   * @param startDate - Filter by start date (inclusive)
   * @param endDate - Filter by end date (inclusive)
   * @returns Promise resolving to entities in date range
   */
  getByDateRange(profileId: number, startDate: string, endDate: string): Promise<T[]>;

  /**
   * Get currently active entities (where endDate is "Present" or null)
   * 
   * @param profileId - The profile ID to search within
   * @returns Promise resolving to active entities
   */
  getActive(profileId: number): Promise<T[]>;

  /**
   * Get completed entities (where endDate is set and not "Present")
   * 
   * @param profileId - The profile ID to search within
   * @returns Promise resolving to completed entities
   */
  getCompleted(profileId: number): Promise<T[]>;

  /**
   * Validate date fields for logical consistency
   * 
   * @param startDate - The start date to validate
   * @param endDate - The end date to validate
   * @returns Promise resolving to validation result
   */
  validateDates(startDate?: string, endDate?: string): Promise<{ valid: boolean; error?: string }>;
}

/**
 * Service interface for entities with insights
 * 
 * Extends the node service interface with insight management capabilities
 * as specified in PRD Milestone 3.
 */
export interface IInsightService<T, TCreateDTO extends CreateDTO = CreateDTO, TUpdateDTO extends UpdateDTO = UpdateDTO> 
  extends INodeService<T, TCreateDTO, TUpdateDTO> {
  
  /**
   * Generate insights for an entity
   * 
   * @param profileId - The profile ID
   * @param entityId - The entity ID to generate insights for
   * @returns Promise resolving to generated insights
   */
  generateInsights(profileId: number, entityId: string): Promise<string[]>;

  /**
   * Get stored insights for an entity
   * 
   * @param profileId - The profile ID
   * @param entityId - The entity ID to get insights for
   * @returns Promise resolving to stored insights
   */
  getInsights(profileId: number, entityId: string): Promise<string[]>;

  /**
   * Update insights for an entity
   * 
   * @param profileId - The profile ID
   * @param entityId - The entity ID to update insights for
   * @param insights - Array of insight strings
   * @returns Promise resolving when insights are updated
   */
  updateInsights(profileId: number, entityId: string, insights: string[]): Promise<void>;
}