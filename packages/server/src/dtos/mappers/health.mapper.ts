/**
 * Mappers for Health API
 * Transform between service layer and controller DTOs
 */

import type { HealthCheckResponse } from '@journey/schema';

import { MappedResponse } from '../../middleware/response-validation.middleware';

export class HealthMapper {
  /**
   * Map health check result to response
   * Returns MappedResponse for fluent validation: .withSchema(healthCheckResponseSchema)
   */
  static toHealthCheckResponse(
    result: any
  ): MappedResponse<HealthCheckResponse> {
    return new MappedResponse(result);
  }

  /**
   * Map health data to response
   * Returns MappedResponse for fluent validation: .withSchema(healthCheckResponseSchema)
   */
  static toHealthDataResponse(data: any): MappedResponse<HealthCheckResponse> {
    return new MappedResponse(data);
  }
}
