/**
 * Progress Snapshot API Service
 * Fetches LLM-generated progress snapshots for status updates
 */

import type {
  GenerateProgressSnapshotRequest,
  GenerateProgressSnapshotResponse,
  ProgressSnapshotLLMResponse,
} from '@journey/schema';

import { httpClient } from './http-client';

/**
 * Request options for generating a progress snapshot
 */
export interface GenerateSnapshotOptions {
  nodeId: string;
  rangeLabel: string;
  journeyName: string;
  days: number;
}

/**
 * Generate an LLM-powered progress snapshot for a node
 * Returns outcome-oriented themes suitable for status updates
 * 
 * Note: httpClient.request unwraps the server's {success, data} envelope,
 * so we receive the inner data directly. We reconstruct the response
 * format expected by the hook.
 */
export async function generateProgressSnapshot(
  options: GenerateSnapshotOptions
): Promise<GenerateProgressSnapshotResponse> {
  const request: GenerateProgressSnapshotRequest = {
    nodeId: options.nodeId,
    rangeLabel: options.rangeLabel,
    journeyName: options.journeyName,
    days: options.days,
  };

  try {
    // httpClient unwraps {success: true, data: T} to just T
    const data = await httpClient.request<ProgressSnapshotLLMResponse>(
      '/api/v2/sessions/progress-snapshot',
      {
        method: 'POST',
        body: JSON.stringify(request),
      }
    );

    // Reconstruct the response format expected by the hook
    return {
      success: true,
      data,
      useFallback: false,
    };
  } catch (error) {
    // On error, signal fallback should be used
    console.error('Progress snapshot generation failed:', error);
    return {
      success: false,
      data: null,
      useFallback: true,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Re-export types for convenience
export type {
  GenerateProgressSnapshotRequest,
  GenerateProgressSnapshotResponse,
  ProgressSnapshotLLMResponse,
};


