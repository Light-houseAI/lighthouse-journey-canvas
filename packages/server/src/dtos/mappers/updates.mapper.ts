/**
 * Mappers for Updates API
 * Transform between service layer and controller DTOs
 */

import type { PaginatedUpdatesDto, UpdateDto } from '../responses/updates.dto';

export class UpdatesMapper {
  /**
   * Map single update to DTO
   */
  static toUpdateDto(update: any): UpdateDto {
    return {
      id: update.id,
      nodeId: update.nodeId,
      content: update.content,
      status: update.status,
      createdAt: update.createdAt?.toISOString ? update.createdAt.toISOString() : update.createdAt,
      updatedAt: update.updatedAt?.toISOString ? update.updatedAt.toISOString() : update.updatedAt,
      userId: update.userId,
    };
  }

  /**
   * Map paginated updates to DTO
   */
  static toPaginatedUpdatesDto(result: any): PaginatedUpdatesDto {
    return {
      items: result.items?.map((item: any) => this.toUpdateDto(item)) || [],
      total: result.total || 0,
      page: result.page || 1,
      limit: result.limit || 20,
      totalPages: result.totalPages || 0,
    };
  }
}
