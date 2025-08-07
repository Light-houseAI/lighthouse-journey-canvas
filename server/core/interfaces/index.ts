/**
 * Core Interfaces Index
 * 
 * Central export point for all core interfaces and types.
 * This makes it easy to import interfaces across the application.
 */

// Base interfaces
export * from './base-node.interface';
export * from './repository.interface';
export * from './service.interface';
export * from './dto.interface';

// Re-export commonly used types
export type {
  BaseNode,
  NodeType,
  isBaseNode,
  createBaseNode
} from './base-node.interface';

export type {
  IRepository,
  IAdvancedRepository,
  RepositoryQueryOptions
} from './repository.interface';

export type {
  IService,
  IAdvancedService,
  INodeService,
  IInsightService
} from './service.interface';

export type {
  CreateDTO,
  UpdateDTO,
  CreateNodeDTO,
  UpdateNodeDTO,
  ResponseDTO,
  PaginationDTO,
  FilterDTO,
  ListRequestDTO,
  BulkOperationDTO,
  BulkOperationResultDTO,
  ValidationErrorDTO,
  ErrorResponseDTO
} from './dto.interface';