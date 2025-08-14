import { injectable, inject } from 'tsyringe';
import { eq, desc } from 'drizzle-orm';
import { NodeInsight, InsightCreateDTO, InsightUpdateDTO, nodeInsights } from '@shared/schema';
import { HIERARCHY_TOKENS } from '../core/hierarchy-tokens';

export interface CreateInsightRequest extends InsightCreateDTO {
  nodeId: string;
}

@injectable()
export class InsightRepository {
  constructor(
    @inject(HIERARCHY_TOKENS.DATABASE) private db: any
  ) {}

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