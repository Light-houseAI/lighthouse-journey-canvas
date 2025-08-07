/**
 * API Types and Interfaces
 *
 * Defines the structure for API requests and responses following REST conventions.
 * These types ensure consistency across all API endpoints as specified in PRD section 5.
 */

import { CreateNodeDTO, UpdateNodeDTO } from '../core/interfaces/dto.interface';
import { Job, Education, Project, Event, Action, CareerTransition, AnyNode } from './node-types';

/**
 * HTTP Status Codes
 */
export enum HttpStatusCode {
  // Success codes
  OK = 200,
  CREATED = 201,
  NO_CONTENT = 204,

  // Client error codes
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  UNPROCESSABLE_ENTITY = 422,

  // Server error codes
  INTERNAL_SERVER_ERROR = 500,
  NOT_IMPLEMENTED = 501,
  BAD_GATEWAY = 502,
  SERVICE_UNAVAILABLE = 503,
}

/**
 * API Error Codes for consistent error handling
 */
export enum ApiErrorCode {
  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',

  // Authorization errors
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',

  // Resource errors
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  RESOURCE_CONFLICT = 'RESOURCE_CONFLICT',

  // Operation errors
  OPERATION_FAILED = 'OPERATION_FAILED',
  DEPENDENCY_ERROR = 'DEPENDENCY_ERROR',

  // System errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
}

/**
 * Base API Request structure
 */
export interface ApiRequest<T = any> {
  /** Request body data */
  body?: T;

  /** URL parameters */
  params?: Record<string, string>;

  /** Query parameters */
  query?: Record<string, string>;

  /** Authenticated user information */
  user?: {
    id: number;
    email: string;
    profileId?: number;
  };

  /** Request headers */
  headers?: Record<string, string>;
}

/**
 * API Error structure
 */
export interface ApiError {
  /** Error code for programmatic handling */
  code: ApiErrorCode;

  /** Human-readable error message */
  message: string;

  /** HTTP status code */
  statusCode?: HttpStatusCode;

  /** Additional error details */
  details?: Record<string, any>;

  /** Error stack trace (development only) */
  stack?: string;

  /** Field-specific validation errors */
  validationErrors?: {
    field: string;
    message: string;
    value?: any;
  }[];
}

/**
 * Base API Response structure
 */
export interface ApiResponse<T = any> {
  /** Indicates if the operation was successful */
  success: boolean;

  /** Response data (present when successful) */
  data?: T;

  /** Error information (present when unsuccessful) */
  error?: ApiError;

  /** Additional response metadata */
  meta?: {
    /** Response timestamp */
    timestamp?: string;

    /** Request ID for tracing */
    requestId?: string;

    /** API version */
    version?: string;

    /** Pagination info (for list responses) */
    pagination?: PaginationMeta;
  };
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  /** Current page number (1-based) */
  page: number;

  /** Items per page */
  limit: number;

  /** Total number of items */
  total: number;

  /** Total number of pages */
  pages: number;

  /** Whether there's a next page */
  hasNext: boolean;

  /** Whether there's a previous page */
  hasPrevious: boolean;
}

/**
 * Paginated response structure
 */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: {
    pagination: PaginationMeta;
    timestamp?: string;
    requestId?: string;
  };
}

/**
 * Work Experience API Types
 */

/** Work Experience creation request */
export interface WorkExperienceCreateRequest extends CreateNodeDTO {
  /** Company name (required) */
  company: string;

  /** Position title (required) */
  position: string;

  /** Work location */
  location?: string;

  /** Job responsibilities */
  responsibilities?: string[];

  /** Achievements and accomplishments */
  achievements?: string[];

  /** Technologies and skills used */
  technologies?: string[];

  /** Team size */
  teamSize?: number;

  /** Employment type */
  employmentType?: 'full-time' | 'part-time' | 'contract' | 'internship' | 'freelance';

  /** Salary information */
  salary?: {
    amount?: number;
    currency?: string;
    frequency?: 'hourly' | 'monthly' | 'yearly';
  };

  /** Manager name */
  manager?: string;

  /** Industry */
  industry?: string;
}

/** Work Experience update request */
export interface WorkExperienceUpdateRequest extends UpdateNodeDTO {
  /** Updated company name */
  company?: string;

  /** Updated position title */
  position?: string;

  /** Updated location */
  location?: string;

  /** Updated responsibilities */
  responsibilities?: string[];

  /** Updated achievements */
  achievements?: string[];

  /** Updated technologies */
  technologies?: string[];

  /** Updated team size */
  teamSize?: number;

  /** Updated employment type */
  employmentType?: 'full-time' | 'part-time' | 'contract' | 'internship' | 'freelance';

  /** Updated salary information */
  salary?: {
    amount?: number;
    currency?: string;
    frequency?: 'hourly' | 'monthly' | 'yearly';
  };

  /** Reason for leaving */
  reasonForLeaving?: string;

  /** Updated manager */
  manager?: string;

  /** Updated industry */
  industry?: string;
}

/** Work Experience response */
export interface WorkExperienceResponse extends ApiResponse<Job> {}

/**
 * Education API Types
 */

/** Education creation request */
export interface EducationCreateRequest extends CreateNodeDTO {
  /** Institution name (required) */
  institution: string;

  /** Degree type */
  degree?: string;

  /** Field of study */
  field?: string;

  /** Institution location */
  location?: string;

  /** GPA */
  gpa?: number;

  /** Academic honors */
  honors?: string[];

  /** Relevant courses */
  relevantCourses?: string[];

  /** Academic projects */
  projects?: string[];

  /** Extracurricular activities */
  activities?: string[];

  /** Thesis title */
  thesis?: string;

  /** Academic advisor */
  advisor?: string;

  /** Education level */
  level?: 'high-school' | 'associates' | 'bachelors' | 'masters' | 'doctorate' | 'certification' | 'bootcamp';
}

/** Education update request */
export interface EducationUpdateRequest extends UpdateNodeDTO {
  /** Updated institution */
  institution?: string;

  /** Updated degree */
  degree?: string;

  /** Updated field */
  field?: string;

  /** Updated location */
  location?: string;

  /** Updated GPA */
  gpa?: number;

  /** Updated honors */
  honors?: string[];

  /** Updated relevant courses */
  relevantCourses?: string[];

  /** Updated projects */
  projects?: string[];

  /** Updated activities */
  activities?: string[];

  /** Updated thesis */
  thesis?: string;

  /** Updated advisor */
  advisor?: string;

  /** Updated education level */
  level?: 'high-school' | 'associates' | 'bachelors' | 'masters' | 'doctorate' | 'certification' | 'bootcamp';
}

/** Education response */
export interface EducationResponse extends ApiResponse<Education> {}

/**
 * Project API Types
 */

/** Project creation request */
export interface ProjectCreateRequest extends CreateNodeDTO {
  /** Project status (required) */
  status: 'planning' | 'in-progress' | 'completed' | 'on-hold' | 'cancelled';

  /** Technologies used */
  technologies?: string[];

  /** Repository URL */
  repositoryUrl?: string;

  /** Live project URL */
  liveUrl?: string;

  /** Role in project */
  role?: string;

  /** Team size */
  teamSize?: number;

  /** Key features */
  keyFeatures?: string[];

  /** Challenges faced */
  challenges?: string[];

  /** Project outcomes */
  outcomes?: string[];

  /** Client organization */
  clientOrganization?: string;

  /** Project budget */
  budget?: number;

  /** Project type */
  projectType?: 'personal' | 'professional' | 'academic' | 'freelance' | 'open-source';
}

/** Project update request */
export interface ProjectUpdateRequest extends UpdateNodeDTO {
  /** Updated status */
  status?: 'planning' | 'in-progress' | 'completed' | 'on-hold' | 'cancelled';

  /** Updated technologies */
  technologies?: string[];

  /** Updated repository URL */
  repositoryUrl?: string;

  /** Updated live URL */
  liveUrl?: string;

  /** Updated role */
  role?: string;

  /** Updated team size */
  teamSize?: number;

  /** Updated key features */
  keyFeatures?: string[];

  /** Updated challenges */
  challenges?: string[];

  /** Updated outcomes */
  outcomes?: string[];

  /** Updated client organization */
  clientOrganization?: string;

  /** Updated budget */
  budget?: number;

  /** Updated project type */
  projectType?: 'personal' | 'professional' | 'academic' | 'freelance' | 'open-source';
}

/** Project response */
export interface ProjectResponse extends ApiResponse<Project> {}

/**
 * Event API Types (Future Implementation)
 */

/** Event creation request */
export interface EventCreateRequest extends CreateNodeDTO {
  eventType: 'conference' | 'meetup' | 'workshop' | 'webinar' | 'presentation' | 'networking' | 'competition';
  location?: string;
  organizer?: string;
  role?: 'attendee' | 'speaker' | 'organizer' | 'sponsor' | 'volunteer';
  topic?: string;
  attendees?: number;
  keyTakeaways?: string[];
  networking?: string[];
  eventUrl?: string;
  certificates?: string[];
}

/** Event update request */
export interface EventUpdateRequest extends UpdateNodeDTO {
  eventType?: 'conference' | 'meetup' | 'workshop' | 'webinar' | 'presentation' | 'networking' | 'competition';
  location?: string;
  organizer?: string;
  role?: 'attendee' | 'speaker' | 'organizer' | 'sponsor' | 'volunteer';
  topic?: string;
  attendees?: number;
  keyTakeaways?: string[];
  networking?: string[];
  eventUrl?: string;
  certificates?: string[];
}

/** Event response */
export interface EventResponse extends ApiResponse<Event> {}

/**
 * Action API Types (Future Implementation)
 */

/** Action creation request */
export interface ActionCreateRequest extends CreateNodeDTO {
  actionType: 'certification' | 'achievement' | 'milestone' | 'award' | 'publication' | 'speaking' | 'volunteer';
  category: 'professional-development' | 'community' | 'personal' | 'academic' | 'leadership';
  status: 'planned' | 'in-progress' | 'completed' | 'verified';
  effort?: 'low' | 'medium' | 'high';
  impact?: 'minor' | 'moderate' | 'significant' | 'major';
  skills?: string[];
  evidence?: string;
  nextSteps?: string[];
  issuingOrganization?: string;
  expirationDate?: string;
}

/** Action update request */
export interface ActionUpdateRequest extends UpdateNodeDTO {
  actionType?: 'certification' | 'achievement' | 'milestone' | 'award' | 'publication' | 'speaking' | 'volunteer';
  category?: 'professional-development' | 'community' | 'personal' | 'academic' | 'leadership';
  status?: 'planned' | 'in-progress' | 'completed' | 'verified';
  effort?: 'low' | 'medium' | 'high';
  impact?: 'minor' | 'moderate' | 'significant' | 'major';
  skills?: string[];
  evidence?: string;
  nextSteps?: string[];
  issuingOrganization?: string;
  expirationDate?: string;
}

/** Action response */
export interface ActionResponse extends ApiResponse<Action> {}

/**
 * Career Transition API Types (Future Implementation)
 */

/** Career Transition creation request */
export interface CareerTransitionCreateRequest extends CreateNodeDTO {
  transitionType: 'job-change' | 'role-change' | 'industry-change' | 'career-pivot' | 'promotion' | 'lateral-move';
  fromRole?: string;
  toRole?: string;
  fromCompany?: string;
  toCompany?: string;
  fromIndustry?: string;
  toIndustry?: string;
  motivations?: string[];
  challenges?: string[];
  preparations?: string[];
  outcomes?: string[];
  lessonsLearned?: string[];
  salaryChange?: {
    type: 'percentage' | 'amount';
    value: number;
    currency?: string;
  };
  duration?: string;
}

/** Career Transition update request */
export interface CareerTransitionUpdateRequest extends UpdateNodeDTO {
  transitionType?: 'job-change' | 'role-change' | 'industry-change' | 'career-pivot' | 'promotion' | 'lateral-move';
  fromRole?: string;
  toRole?: string;
  fromCompany?: string;
  toCompany?: string;
  fromIndustry?: string;
  toIndustry?: string;
  motivations?: string[];
  challenges?: string[];
  preparations?: string[];
  outcomes?: string[];
  lessonsLearned?: string[];
  salaryChange?: {
    type: 'percentage' | 'amount';
    value: number;
    currency?: string;
  };
  duration?: string;
}

/** Career Transition response */
export interface CareerTransitionResponse extends ApiResponse<CareerTransition> {}

/**
 * Node Aggregation Types
 */

/** Response for retrieving all nodes for a profile */
export interface NodeListResponse extends ApiResponse<AnyNode[]> {}

/** Response for retrieving nodes with pagination */
export interface NodeListPaginatedResponse extends PaginatedResponse<AnyNode> {}

/**
 * Common Query Parameters
 */
export interface NodeQueryParams {
  /** Page number for pagination */
  page?: string;

  /** Items per page */
  limit?: string;

  /** Sort field */
  sortBy?: string;

  /** Sort direction */
  sortOrder?: 'asc' | 'desc';

  /** Text search */
  search?: string;

  /** Filter by node type */
  type?: string;

  /** Filter by start date (after) */
  startDateAfter?: string;

  /** Filter by start date (before) */
  startDateBefore?: string;

  /** Filter by end date (after) */
  endDateAfter?: string;

  /** Filter by end date (before) */
  endDateBefore?: string;

  /** Only show ongoing items */
  onlyOngoing?: string;

  /** Only show completed items */
  onlyCompleted?: string;
}

/**
 * Common Path Parameters
 */
export interface NodePathParams {
  /** Profile ID */
  profileId: string;

  /** Node ID (for specific node operations) */
  id?: string;
}

/**
 * Utility types for API endpoints
 */

/** Create operation request type */
export type CreateRequest<T> = ApiRequest<T>;

/** Update operation request type */
export type UpdateRequest<T> = ApiRequest<T>;

/** Get single item request type */
export type GetRequest = ApiRequest<never>;

/** Delete operation request type */
export type DeleteRequest = ApiRequest<never>;

/** List operation request type */
export type ListRequest = ApiRequest<never>;
