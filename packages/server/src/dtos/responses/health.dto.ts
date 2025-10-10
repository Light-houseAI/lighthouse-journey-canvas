/**
 * Response DTOs for Health API
 */

/**
 * Health check result for a specific component
 */
export interface HealthCheckComponentDto {
  status: 'pass' | 'warn' | 'fail';
  timestamp: string;
  duration?: number;
  message?: string;
  details?: any;
}

/**
 * Overall health check response
 */
export interface HealthCheckDto {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  checks: Record<string, HealthCheckComponentDto>;
}

/**
 * Readiness probe response
 */
export interface ReadinessDto {
  status: 'ready' | 'not ready';
  timestamp: string;
  message?: string;
  error?: string;
}

/**
 * Liveness probe response
 */
export interface LivenessDto {
  status: 'alive';
  timestamp: string;
  uptime: number;
  pid: number;
}

/**
 * API v2 health response data
 */
export interface ApiV2HealthDto {
  version: string;
  status: string;
  timestamp: string;
  features: {
    timeline: boolean;
    nodeTypes: string[];
    apiEndpoints: string[];
  };
}
