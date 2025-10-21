/**
 * Health Check API Schemas
 * Request and response schemas for health monitoring endpoints
 */

import { z } from 'zod';

// ============================================================================
// Response Schemas
// ============================================================================

/**
 * Health Check Response Schema
 */
export const healthCheckResponseSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  timestamp: z.string(),
  uptime: z.number().optional(),
  version: z.string().optional(),
  environment: z.string().optional(),
  service: z.string().optional(),
  pid: z.number().optional(),
  stats: z.record(z.unknown()).optional(),
  checks: z.record(z.unknown()).optional(),
  features: z.record(z.unknown()).optional(),
});

export type HealthCheckResponse = z.infer<typeof healthCheckResponseSchema>;
