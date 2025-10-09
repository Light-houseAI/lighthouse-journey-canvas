import type { NodeInsight, TimelineNode } from '../types';

// ============================================================================
// NODE CRUD ENDPOINTS
// ============================================================================

export interface CreateNodeSuccessResponse {
  success: true;
  data: {
    node: TimelineNode;
  };
}

export interface GetNodeSuccessResponse {
  success: true;
  data: {
    node: TimelineNode;
  };
}

export interface UpdateNodeSuccessResponse {
  success: true;
  data: {
    node: TimelineNode;
  };
}

export interface DeleteNodeSuccessResponse {
  success: true;
  data: {
    message: string;
    nodeId: string;
  };
}

export interface ListNodesSuccessResponse {
  success: true;
  data: {
    nodes: TimelineNode[];
    count: number;
  };
}

// ============================================================================
// INSIGHT ENDPOINTS
// ============================================================================

export interface GetInsightsSuccessResponse {
  success: true;
  data: {
    insights: NodeInsight[];
    count: number;
  };
}

export interface CreateInsightSuccessResponse {
  success: true;
  data: {
    insight: NodeInsight;
  };
}

export interface UpdateInsightSuccessResponse {
  success: true;
  data: {
    insight: NodeInsight;
  };
}

export interface DeleteInsightSuccessResponse {
  success: true;
  data: {
    message: string;
    insightId: string;
  };
}
