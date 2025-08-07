/**
 * Repository Interface for Node CRUD Operations
 * 
 * Defines the contract for repository implementations that handle
 * node data persistence operations as specified in PRD section 7.1
 */

/**
 * Generic repository interface for managing nodes of type T
 * 
 * This interface follows the Repository pattern and provides basic CRUD operations
 * for nodes stored in the profiles.filteredData JSON field.
 * 
 * All operations are scoped to a specific profileId to ensure data isolation.
 * 
 * @template T - The node type that extends BaseNode
 */
export interface IRepository<T> {
  /**
   * Retrieve all nodes of type T for a specific profile
   * 
   * @param profileId - The profile ID to retrieve nodes for
   * @returns Promise resolving to array of nodes
   */
  findAll(profileId: number): Promise<T[]>;

  /**
   * Retrieve a specific node by ID for a profile
   * 
   * @param profileId - The profile ID that owns the node
   * @param id - The unique identifier of the node
   * @returns Promise resolving to the node or null if not found
   */
  findById(profileId: number, id: string): Promise<T | null>;

  /**
   * Create a new node for a profile
   * 
   * @param profileId - The profile ID to create the node for
   * @param data - The node data excluding the ID (which will be generated)
   * @returns Promise resolving to the created node with generated ID
   */
  create(profileId: number, data: Omit<T, 'id'>): Promise<T>;

  /**
   * Update an existing node for a profile
   * 
   * @param profileId - The profile ID that owns the node
   * @param id - The unique identifier of the node to update
   * @param data - Partial node data with fields to update
   * @returns Promise resolving to the updated node or null if not found
   */
  update(profileId: number, id: string, data: Partial<T>): Promise<T | null>;

  /**
   * Delete a node for a profile
   * 
   * @param profileId - The profile ID that owns the node
   * @param id - The unique identifier of the node to delete
   * @returns Promise resolving to true if deleted, false if not found
   */
  delete(profileId: number, id: string): Promise<boolean>;
}

/**
 * Query options for filtering and pagination in repository operations
 * 
 * These options can be extended by specific repository implementations
 * to support advanced querying capabilities.
 */
export interface RepositoryQueryOptions {
  /** Maximum number of items to return */
  limit?: number;
  
  /** Number of items to skip for pagination */
  offset?: number;
  
  /** Field to order by */
  orderBy?: string;
  
  /** Sort direction */
  orderDirection?: 'asc' | 'desc';
  
  /** Date range filter for startDate */
  startDateAfter?: string;
  startDateBefore?: string;
  
  /** Date range filter for endDate */
  endDateAfter?: string;
  endDateBefore?: string;
  
  /** Text search in title and description */
  searchText?: string;
}

/**
 * Extended repository interface with query capabilities
 * 
 * Repositories can optionally implement this interface to provide
 * advanced querying features as specified in PRD Milestone 3.
 */
export interface IAdvancedRepository<T> extends IRepository<T> {
  /**
   * Find nodes with advanced query options
   * 
   * @param profileId - The profile ID to search within
   * @param options - Query options for filtering and pagination
   * @returns Promise resolving to filtered nodes
   */
  findWithOptions(profileId: number, options: RepositoryQueryOptions): Promise<T[]>;

  /**
   * Count total nodes matching query options
   * 
   * @param profileId - The profile ID to count within
   * @param options - Query options for filtering
   * @returns Promise resolving to total count
   */
  count(profileId: number, options?: Omit<RepositoryQueryOptions, 'limit' | 'offset'>): Promise<number>;

  /**
   * Search nodes by text across title and description fields
   * 
   * @param profileId - The profile ID to search within
   * @param searchText - Text to search for
   * @param limit - Maximum number of results
   * @returns Promise resolving to matching nodes
   */
  search(profileId: number, searchText: string, limit?: number): Promise<T[]>;
}