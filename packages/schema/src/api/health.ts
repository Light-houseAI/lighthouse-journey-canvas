// ============================================================================
// HEALTH CHECK TYPES
// ============================================================================

export interface HealthCheckSuccessResponse {
  success: true;
  data: {
    status: 'healthy';
    timestamp: string;
    checks: Record<string, { status: 'pass' | 'fail'; message?: string }>;
  };
}

// ============================================================================
// READINESS CHECK ENDPOINT
// ============================================================================

export interface ReadinessSuccessResponse {
  success: true;
  data: {
    status: 'ready';
    timestamp: string;
  };
}

// ============================================================================
// LIVENESS CHECK ENDPOINT
// ============================================================================

export interface LivenessSuccessResponse {
  success: true;
  data: {
    status: 'alive';
    timestamp: string;
    uptime: number;
  };
}

// ============================================================================
// V2 HEALTH CHECK ENDPOINT
// ============================================================================

export interface V2HealthSuccessResponse {
  success: true;
  data: {
    status: 'healthy';
    version: string;
    timestamp: string;
    uptime: number;
  };
}
