/**
 * API Types Generated from OpenAPI Schema
 *
 * NOTE: The current schema uses Swagger 2.0 format.
 * To auto-generate types with openapi-typescript, the schema needs to be upgraded to OpenAPI 3.0+
 *
 * For now, these types are manually defined based on the API structure.
 * Once the schema is upgraded to OpenAPI 3.0, run:
 * ```bash
 * npx openapi-typescript openapi-schema.yaml -o tests/types/api-types.ts
 * ```
 */

// Common response wrapper types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ApiMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

export interface ApiMeta {
  timestamp: string;
  requestId: string;
  [key: string]: any;
}

// User types
export interface User {
  id: string;
  email: string;
  name?: string;
  createdAt: string;
  updatedAt: string;
}

// Auth types
export interface SignInRequest {
  email: string;
  password: string;
}

export interface SignUpRequest {
  email: string;
  password: string;
  name?: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

// Timeline node types
export interface TimelineNode {
  id: string;
  type: 'company' | 'role' | 'event' | 'project' | 'skill';
  parentId?: string;
  meta: Record<string, any>;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

// Update types
export interface Update {
  id: string;
  nodeId: string;
  meta: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

// Organization types
export interface Organization {
  id: string;
  name: string;
  description?: string;
  meta?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

// Type guards
export function isApiError(response: any): response is ApiResponse & { success: false; error: ApiError } {
  return response && response.success === false && response.error;
}

export function isApiSuccess<T>(response: any): response is ApiResponse<T> & { success: true; data: T } {
  return response && response.success === true && response.data !== undefined;
}