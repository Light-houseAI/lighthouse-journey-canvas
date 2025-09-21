import { nodeInsights } from '@journey/schema';
import { InsightUpdateDTO,NodeInsight } from '@journey/schema';
import { desc,eq } from 'drizzle-orm';

import type { CreateInsightRequest,IInsightRepository } from './interfaces/insight.repository.interface.js';

export class InsightRepository implements IInsightRepository {
  private db: any;

  constructor({ database }: {
    database: any;
  }) {
    this.db = database;
  }

  async findByNodeId(nodeId: string): Promise<NodeInsight[]> {
    return await this.db
      .select()
      .from(nodeInsights)
      .where(eq(nodeInsights.nodeId, nodeId))
      .orderBy(desc(nodeInsights.createdAt));
  }

  async findById(id: string): Promise<NodeInsight | null> {
    const results = await this.db
      .select()
      .from(nodeInsights)
      .where(eq(nodeInsights.id, id))
      .limit(1);

    return results[0] || null;
  }

  async create(data: CreateInsightRequest): Promise<NodeInsight> {
    const results = await this.db
      .insert(nodeInsights)
      .values(data)
      .returning();

    return results[0];
  }

  async update(id: string, data: InsightUpdateDTO): Promise<NodeInsight | null> {
    const results = await this.db
      .update(nodeInsights)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(nodeInsights.id, id))
      .returning();

    return results[0] || null;
  }

  async delete(id: string): Promise<boolean> {
    const results = await this.db
      .delete(nodeInsights)
      .where(eq(nodeInsights.id, id))
      .returning();

    return results.length > 0;
  }

  async deleteByNodeId(nodeId: string): Promise<number> {
    const results = await this.db
      .delete(nodeInsights)
      .where(eq(nodeInsights.nodeId, nodeId))
      .returning();

    return results.length;
  }
}
