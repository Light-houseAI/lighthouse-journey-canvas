/**
 * InsightRepository Interface
 * Contract for node insight database operations
 */

import type { NodeInsight, InsightCreateDTO, InsightUpdateDTO } from '@shared/schema';

export interface CreateInsightRequest extends InsightCreateDTO {
  nodeId: string;
}

export interface IInsightRepository {
  /**
   * Find all insights for a specific node
   */
  findByNodeId(nodeId: string): Promise<NodeInsight[]>;

  /**
   * Find insight by ID
   */
  findById(id: string): Promise<NodeInsight | null>;

  /**
   * Create a new insight
   */
  create(data: CreateInsightRequest): Promise<NodeInsight>;

  /**
   * Update an existing insight
   */
  update(id: string, data: InsightUpdateDTO): Promise<NodeInsight | null>;

  /**
   * Delete an insight by ID
   */
  delete(id: string): Promise<boolean>;

  /**
   * Delete all insights for a specific node
   */
  deleteByNodeId(nodeId: string): Promise<number>;
}