/**
 * Repository interfaces barrel export
 */

// Simple query options interface
export interface QueryOptions {
  limit?: number;
  offset?: number;
}

// Re-export all interfaces
export * from './user.repository.interface';
export * from './hierarchy.repository.interface';
export * from './insight.repository.interface';
export * from './node-permission.repository.interface';
export * from './organization.repository.interface';
export * from './refresh-token.repository.interface';
