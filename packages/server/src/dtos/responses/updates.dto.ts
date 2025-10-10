/**
 * Response DTOs for Updates API
 */

/**
 * Individual update item
 */
export interface UpdateDto {
  id: string;
  nodeId: string;
  content: string;
  status?: string;
  createdAt: string;
  updatedAt: string;
  userId: number;
}

/**
 * Paginated updates list response
 */
export interface PaginatedUpdatesDto {
  items: UpdateDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
