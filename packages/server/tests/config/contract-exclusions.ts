/**
 * Contract Test Exclusions
 *
 * List of API endpoints excluded from automated contract validation.
 * Each exclusion must be justified with a reason.
 */

export interface ContractExclusion {
  /** HTTP method (GET, POST, PUT, DELETE, etc.) */
  method: string;
  /** Path pattern (supports regex) */
  path: string | RegExp;
  /** Reason for exclusion */
  reason: string;
}

export const CONTRACT_EXCLUSIONS: ContractExclusion[] = [
  // Authentication flows with side effects
  {
    method: 'POST',
    path: '/api/auth/signin',
    reason: 'Modifies session state, requires specific test data setup',
  },
  {
    method: 'POST',
    path: '/api/auth/signup',
    reason: 'Creates database records, cannot be safely fuzzed',
  },
  {
    method: 'POST',
    path: '/api/auth/signout',
    reason: 'Invalidates tokens, has side effects on session state',
  },
  {
    method: 'POST',
    path: '/api/auth/refresh',
    reason: 'Requires valid refresh token, complex state dependencies',
  },

  // Endpoints with file uploads
  {
    method: 'POST',
    path: /\/api\/.*\/upload$/,
    reason: 'File upload endpoints require multipart/form-data',
  },

  // WebSocket endpoints
  {
    method: 'GET',
    path: /\/ws\/.*/,
    reason: 'WebSocket connections not compatible with REST validation',
  },

  // Health check (no OpenAPI contract)
  {
    method: 'GET',
    path: '/health',
    reason: 'Simple health check without OpenAPI definition',
  },
];

/**
 * Check if an endpoint should be excluded from contract validation
 */
export function isExcluded(method: string, path: string): boolean {
  return CONTRACT_EXCLUSIONS.some((exclusion) => {
    if (exclusion.method.toUpperCase() !== method.toUpperCase()) {
      return false;
    }

    if (typeof exclusion.path === 'string') {
      return exclusion.path === path;
    }

    return exclusion.path.test(path);
  });
}
