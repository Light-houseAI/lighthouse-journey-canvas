/**
 * In-Memory InsightRepository Implementation
 * For integration testing without database dependencies
 */

import { randomUUID } from 'crypto';
import type { NodeInsight, InsightUpdateDTO } from '@shared/schema';
import type { IInsightRepository, CreateInsightRequest } from '../../repositories/interfaces/insight.repository.interface';

export class InMemoryInsightRepository implements IInsightRepository {
  private insights: Map<string, NodeInsight> = new Map();
  private logger: any;

  constructor({ logger }: { logger: any }) {
    this.logger = logger;
  }

  /**
   * Find all insights for a specific node
   */
  async findByNodeId(nodeId: string): Promise<NodeInsight[]> {
    const nodeInsights = Array.from(this.insights.values())
      .filter(insight => insight.nodeId === nodeId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    return nodeInsights;
  }

  /**
   * Find insight by ID
   */
  async findById(id: string): Promise<NodeInsight | null> {
    return this.insights.get(id) || null;
  }

  /**
   * Create a new insight
   */
  /**
   * Create a new insight
   */
  async create(data: CreateInsightRequest): Promise<NodeInsight> {
    const insight: NodeInsight = {
      id: randomUUID(),
      nodeId: data.nodeId,
      description: data.description,
      resources: data.resources || [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.insights.set(insight.id, insight);
    
    this.logger.info('Insight created in memory', {
      insightId: insight.id,
      nodeId: insight.nodeId,
      description: insight.description.substring(0, 50) + '...'
    });

    return insight;
  }

  /**
   * Update an existing insight
   */
  async update(id: string, data: InsightUpdateDTO): Promise<NodeInsight | null> {
    const existing = this.insights.get(id);
    if (!existing) {
      return null;
    }

    const updated: NodeInsight = {
      ...existing,
      ...data,
      updatedAt: new Date()
    };

    this.insights.set(id, updated);
    return updated;
  }

  /**
   * Delete an insight by ID
   */
  async delete(id: string): Promise<boolean> {
    return this.insights.delete(id);
  }

  /**
   * Delete all insights for a specific node
   */
  async deleteByNodeId(nodeId: string): Promise<number> {
    const toDelete = Array.from(this.insights.entries())
      .filter(([_, insight]) => insight.nodeId === nodeId)
      .map(([id, _]) => id);

    let deletedCount = 0;
    for (const id of toDelete) {
      if (this.insights.delete(id)) {
        deletedCount++;
      }
    }

    return deletedCount;
  }
}