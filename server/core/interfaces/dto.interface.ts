/**
 * Data Transfer Object (DTO) Interfaces
 * 
 * Defines the structure for data transfer objects used in API requests
 * and service method calls as specified in PRD section 7.1
 */

/**
 * Base DTO for creating new entities
 * Contains the minimum required fields for any create operation
 */
export interface CreateDTO {
  /** Human-readable title/name for the entity */
  title: string;
  
  /** Optional detailed description */
  description?: string;
}

/**
 * Base DTO for updating existing entities
 * All fields are optional to support partial updates
 */
export interface UpdateDTO {
  /** Optional updated title/name */
  title?: string;
  
  /** Optional updated description */
  description?: string;
}

/**
 * DTO for creating node entities
 * Extends CreateDTO with node-specific fields like dates
 */
export interface CreateNodeDTO extends CreateDTO {
  /** Optional start date in ISO string format */
  startDate?: string;
  
  /** Optional end date in ISO string format (or "Present" for ongoing) */
  endDate?: string;
}

/**
 * DTO for updating node entities
 * Extends UpdateDTO with optional node-specific fields
 */
export interface UpdateNodeDTO extends UpdateDTO {
  /** Optional updated start date */
  startDate?: string;
  
  /** Optional updated end date */
  endDate?: string;
}

/**
 * Response DTO for API operations
 * Provides consistent response structure across all endpoints
 */
export interface ResponseDTO<T> {
  /** Indicates if the operation was successful */
  success: boolean;
  
  /** The response data (if successful) */
  data?: T;
  
  /** Error message (if unsuccessful) */
  error?: string;
  
  /** Additional metadata about the response */
  meta?: {
    /** Total count for paginated responses */
    total?: number;
    
    /** Current page number */
    page?: number;
    
    /** Items per page */
    limit?: number;
    
    /** Timestamp of the response */
    timestamp?: string;
  };
}

/**
 * DTO for paginated requests
 * Used for list operations with pagination support
 */
export interface PaginationDTO {
  /** Page number (1-based) */
  page?: number;
  
  /** Number of items per page */
  limit?: number;
  
  /** Field to sort by */
  sortBy?: string;
  
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

/**
 * DTO for filtering requests
 * Used for advanced filtering in list operations
 */
export interface FilterDTO {
  /** Text search across title and description */
  search?: string;
  
  /** Filter by start date (after this date) */
  startDateAfter?: string;
  
  /** Filter by start date (before this date) */
  startDateBefore?: string;
  
  /** Filter by end date (after this date) */
  endDateAfter?: string;
  
  /** Filter by end date (before this date) */
  endDateBefore?: string;
  
  /** Include only ongoing items (where endDate is "Present" or null) */
  onlyOngoing?: boolean;
  
  /** Include only completed items (where endDate is set and not "Present") */
  onlyCompleted?: boolean;
}

/**
 * Combined DTO for list requests with pagination and filtering
 */
export interface ListRequestDTO extends PaginationDTO, FilterDTO {}

/**
 * DTO for bulk operations
 * Used when performing operations on multiple items
 */
export interface BulkOperationDTO<T> {
  /** Array of item IDs to operate on */
  ids: string[];
  
  /** Operation to perform */
  operation: 'delete' | 'update' | 'archive';
  
  /** Data for update operations */
  updateData?: Partial<T>;
}

/**
 * DTO for bulk operation results
 */
export interface BulkOperationResultDTO {
  /** Number of items successfully processed */
  successCount: number;
  
  /** Number of items that failed processing */
  failureCount: number;
  
  /** Details of any failures */
  failures?: {
    id: string;
    error: string;
  }[];
}

/**
 * Validation error DTO
 * Used to return structured validation errors
 */
export interface ValidationErrorDTO {
  /** Field name that failed validation */
  field: string;
  
  /** Validation error message */
  message: string;
  
  /** The value that failed validation */
  value?: any;
  
  /** Validation rule that was violated */
  rule?: string;
}

/**
 * Error response DTO
 * Used for consistent error responses across all endpoints
 */
export interface ErrorResponseDTO {
  /** Indicates the operation failed */
  success: false;
  
  /** General error message */
  error: string;
  
  /** HTTP status code */
  statusCode?: number;
  
  /** Detailed validation errors (if applicable) */
  validationErrors?: ValidationErrorDTO[];
  
  /** Additional error context */
  context?: Record<string, any>;
  
  /** Timestamp when the error occurred */
  timestamp?: string;
}