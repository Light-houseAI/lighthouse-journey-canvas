/**
 * Mappers for PgVector GraphRAG API
 * Transform between service layer and controller DTOs
 */

import type {
  GraphRAGSearchResponse,
  HealthCheckResponse,
} from '@journey/schema';

import { MappedResponse } from '../middleware/response-validation.middleware';

export class PgVectorMapper {
  /**
   * Map search response to DTO
   * Returns MappedResponse for fluent validation: .withSchema(graphragSearchResponseSchema)
   */
  static toSearchResponse(
    response: GraphRAGSearchResponse
  ): MappedResponse<GraphRAGSearchResponse> {
    return new MappedResponse(response);
  }

  /**
   * Map health check data to response
   * Returns MappedResponse for fluent validation: .withSchema(healthCheckResponseSchema)
   */
  static toHealthResponse(data: any): MappedResponse<HealthCheckResponse> {
    return new MappedResponse(data);
  }

  /**
   * Map stats data to response
   * Returns MappedResponse for fluent validation: .withSchema(healthCheckResponseSchema)
   */
  static toStatsResponse(data: any): MappedResponse<HealthCheckResponse> {
    return new MappedResponse(data);
  }
}
