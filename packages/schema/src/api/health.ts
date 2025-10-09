import type { SuccessResponse } from './common';
export interface HealthCheckData {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    uptime: number;
    version: string;
    environment: string;
    checks: {
        [key: string]: {
            status: 'pass' | 'warn' | 'fail';
            timestamp: string;
            duration?: number;
            message?: string;
            details?: any;
        };
    };
}
export interface ReadinessData {
    status: 'ready' | 'not ready';
    timestamp: string;
    message: string;
}
export interface LivenessData {
    status: 'alive';
    timestamp: string;
    uptime: number;
    pid: number;
}
export interface V2HealthData {
    version: string;
    status: string;
    timestamp: string;
    features: {
        timeline: boolean;
        nodeTypes: string[];
        apiEndpoints: string[];
    };
}
export type HealthCheckSuccessResponse = SuccessResponse<HealthCheckData>;
export type ReadinessSuccessResponse = SuccessResponse<ReadinessData>;
export type LivenessSuccessResponse = SuccessResponse<LivenessData>;
export type V2HealthSuccessResponse = SuccessResponse<V2HealthData>;
//# sourceMappingURL=health.d.ts.map