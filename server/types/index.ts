/**
 * Types Index
 *
 * Central export point for all type definitions.
 */

// Node types
export * from './node-types';

// API types
export * from './api-types';

// Re-export commonly used node types
export type {
  Job as WorkExperience,
  Education,
  Project,
  Event,
  Action,
  CareerTransition,
  AnyNode,
  isWorkExperience,
  isEducation,
  isProject,
  isEvent,
  isAction,
  isCareerTransition,
  getNodeType,
  createNode
} from './node-types';

// Re-export commonly used API types
export type {
  ApiRequest,
  ApiResponse,
  ApiError,
  HttpStatusCode,
  ApiErrorCode,
  WorkExperienceCreateRequest,
  WorkExperienceUpdateRequest,
  WorkExperienceResponse,
  EducationCreateRequest,
  EducationUpdateRequest,
  EducationResponse,
  ProjectCreateRequest,
  ProjectUpdateRequest,
  ProjectResponse,
  NodeListResponse,
  PaginatedResponse,
  NodeQueryParams,
  NodePathParams
} from './api-types';
