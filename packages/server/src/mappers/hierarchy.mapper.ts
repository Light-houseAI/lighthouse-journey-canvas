/**
 * Mappers for Hierarchy/Timeline API
 * Transform between service layer and controller DTOs
 */

import type {
  CareerInsightResponse,
  TimelineNodeResponse,
} from '@journey/schema';

import { MappedResponse } from '../middleware/response-validation.middleware';

export class HierarchyMapper {
  /**
   * Map timeline node to response
   * Returns MappedResponse for fluent validation: .withSchema(timelineNodeResponseSchema)
   */
  static toTimelineNodeResponse(
    node: any
  ): MappedResponse<TimelineNodeResponse> {
    return new MappedResponse<TimelineNodeResponse>(node);
  }

  /**
   * Map array of timeline nodes to response
   * Returns MappedResponse for fluent validation: .withSchema(z.array(timelineNodeResponseSchema))
   */
  static toTimelineNodesResponse(
    nodes: any[]
  ): MappedResponse<TimelineNodeResponse[]> {
    return new MappedResponse<TimelineNodeResponse[]>(nodes);
  }

  /**
   * Map null response (for deletes)
   * Returns MappedResponse for fluent validation: .withSchema(z.null())
   */
  static toNullResponse(): MappedResponse<null> {
    return new MappedResponse<null>(null);
  }

  /**
   * Map insight data to response
   * Returns MappedResponse for fluent validation: .withSchema(careerInsightResponseSchema)
   */
  static toInsightResponse(
    insight: any
  ): MappedResponse<CareerInsightResponse> {
    return new MappedResponse(insight);
  }

  /**
   * Map insights array to response
   * Returns MappedResponse for fluent validation: .withSchema(z.array(careerInsightResponseSchema))
   */
  static toInsightsResponse(
    insights: any[]
  ): MappedResponse<CareerInsightResponse[]> {
    return new MappedResponse(insights);
  }
}
