/**
 * Mappers for Updates API
 * Transform between service layer and controller DTOs
 */

import type { LegacyPaginatedUpdates, UpdateItem } from '@journey/schema';

import { MappedResponse } from '../middleware/response-validation.middleware';

export class UpdatesMapper {
  /**
   * Map single update to DTO
   */
  static toUpdateDto(update: any): UpdateItem {
    return {
      id: update.id,
      nodeId: update.nodeId,
      content: update.content,
      status: update.status,
      createdAt: update.updatedAt?.toISOString
        ? update.createdAt.toISOString()
        : update.createdAt,
      updatedAt: update.updatedAt?.toISOString
        ? update.updatedAt.toISOString()
        : update.updatedAt,
      userId: update.userId,
    };
  }

  /**
   * Map paginated updates to DTO
   */
  static toPaginatedUpdatesDto(result: any): LegacyPaginatedUpdates {
    return {
      items: result.items?.map((item: any) => this.toUpdateDto(item)) || [],
      total: result.total || 0,
      page: result.page || 1,
      limit: result.limit || 20,
      totalPages: result.totalPages || 0,
    };
  }

  /**
   * Wrap update response for validation
   * Returns MappedResponse for fluent validation: .withSchema(updateItemSchema)
   */
  static toUpdateResponse(update: UpdateItem): MappedResponse<UpdateItem> {
    return new MappedResponse(update);
  }

  /**
   * Wrap paginated updates response for validation
   * Returns MappedResponse for fluent validation: .withSchema(legacyPaginatedUpdatesSchema)
   */
  static toPaginatedResponse(
    data: LegacyPaginatedUpdates
  ): MappedResponse<LegacyPaginatedUpdates> {
    return new MappedResponse(data);
  }
}
