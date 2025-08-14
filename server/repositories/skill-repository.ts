import { eq, and, gte, like, desc } from 'drizzle-orm';
import { userSkills } from '@shared/schema';
import type { ISkillRepository, SkillRecord, SkillInput, SkillQueryOptions, SkillStats } from './interfaces';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

export class SkillRepository implements ISkillRepository {
  constructor(private db: NodePgDatabase<any>) {}

  async findByUserId(userId: number, options: SkillQueryOptions = {}): Promise<SkillRecord[]> {
    let conditions = [eq(userSkills.userId, userId)];

    if (options.category) {
      conditions.push(eq(userSkills.category, options.category));
    }

    if (options.isActive !== undefined) {
      conditions.push(eq(userSkills.isActive, options.isActive));
    }

    if (options.minConfidence !== undefined) {
      conditions.push(gte(userSkills.confidence, options.minConfidence));
    }

    let query = this.db
      .select()
      .from(userSkills)
      .where(and(...conditions))
      .orderBy(desc(userSkills.confidence), desc(userSkills.lastMentioned));

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const results = await query;
    return results.map(this.mapToSkillRecord);
  }

  async findByCategory(userId: number, category: string): Promise<SkillRecord[]> {
    const results = await this.db
      .select()
      .from(userSkills)
      .where(and(
        eq(userSkills.userId, userId),
        eq(userSkills.category, category),
        eq(userSkills.isActive, true)
      ))
      .orderBy(desc(userSkills.confidence));

    return results.map(this.mapToSkillRecord);
  }

  async create(userId: number, skill: SkillInput): Promise<SkillRecord> {
    const keywordsJson = JSON.stringify(skill.keywords || []);

    const result = await this.db
      .insert(userSkills)
      .values({
        userId,
        name: skill.name,
        category: skill.category,
        level: skill.level,
        confidence: skill.confidence,
        source: skill.source,
        context: skill.context,
        keywords: keywordsJson,
      })
      .returning();

    return this.mapToSkillRecord(result[0]);
  }

  async update(id: number, updates: Partial<SkillRecord>): Promise<SkillRecord | null> {
    const updateData: any = { ...updates };

    if (updates.keywords) {
      updateData.keywords = JSON.stringify(updates.keywords);
    }

    updateData.updatedAt = new Date();

    const result = await this.db
      .update(userSkills)
      .set(updateData)
      .where(eq(userSkills.id, id))
      .returning();

    return result[0] ? this.mapToSkillRecord(result[0]) : null;
  }

  async upsert(userId: number, skill: SkillInput): Promise<SkillRecord> {
    // Try to find existing skill
    const existing = await this.db
      .select()
      .from(userSkills)
      .where(and(
        eq(userSkills.userId, userId),
        eq(userSkills.name, skill.name),
        eq(userSkills.category, skill.category)
      ))
      .limit(1);

    if (existing.length > 0) {
      // Update existing skill
      const updates = {
        confidence: Math.max(existing[0].confidence, skill.confidence),
        level: skill.level || existing[0].level,
        context: skill.context || existing[0].context,
        keywords: JSON.stringify(skill.keywords || []),
        lastMentioned: new Date(),
        mentionCount: existing[0].mentionCount + 1,
        updatedAt: new Date(),
      };

      const result = await this.db
        .update(userSkills)
        .set(updates)
        .where(eq(userSkills.id, existing[0].id))
        .returning();

      return this.mapToSkillRecord(result[0]);
    } else {
      // Create new skill
      return await this.create(userId, skill);
    }
  }

  async search(userId: number, query: string, limit: number = 10): Promise<SkillRecord[]> {
    const searchPattern = `%${query}%`;

    const results = await this.db
      .select()
      .from(userSkills)
      .where(and(
        eq(userSkills.userId, userId),
        eq(userSkills.isActive, true),
        // Note: This is a simplified search. In a real implementation,
        // you might want to use PostgreSQL's full-text search capabilities
        like(userSkills.name, searchPattern)
      ))
      .orderBy(desc(userSkills.confidence), desc(userSkills.lastMentioned))
      .limit(limit);

    return results.map(this.mapToSkillRecord);
  }

  async getStats(userId: number): Promise<SkillStats> {
    // Get total skills and average confidence
    const totalResult = await this.db
      .select({
        total: userSkills.id,
        avgConfidence: userSkills.confidence,
      })
      .from(userSkills)
      .where(and(
        eq(userSkills.userId, userId),
        eq(userSkills.isActive, true)
      ));

    // Get skills by category
    const categoryResults = await this.db
      .select({
        category: userSkills.category,
        count: userSkills.id,
      })
      .from(userSkills)
      .where(and(
        eq(userSkills.userId, userId),
        eq(userSkills.isActive, true)
      ));

    // Get recent skills (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentResults = await this.db
      .select()
      .from(userSkills)
      .where(and(
        eq(userSkills.userId, userId),
        eq(userSkills.isActive, true),
        gte(userSkills.lastMentioned, thirtyDaysAgo)
      ));

    // Process results
    const skillsByCategory: Record<string, number> = {};
    const categoryCount: Record<string, number> = {};

    categoryResults.forEach(row => {
      categoryCount[row.category] = (categoryCount[row.category] || 0) + 1;
    });

    const totalSkills = totalResult.length;
    const averageConfidence = totalSkills > 0
      ? totalResult.reduce((sum, row) => sum + row.avgConfidence, 0) / totalSkills
      : 0;

    return {
      totalSkills,
      skillsByCategory: categoryCount,
      averageConfidence,
      recentSkills: recentResults.length,
    };
  }

  async updateActivity(userId: number, skillName: string, isActive: boolean): Promise<boolean> {
    const result = await this.db
      .update(userSkills)
      .set({
        isActive,
        updatedAt: new Date(),
      })
      .where(and(
        eq(userSkills.userId, userId),
        eq(userSkills.name, skillName)
      ))
      .returning();

    return result.length > 0;
  }

  private mapToSkillRecord(row: any): SkillRecord {
    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      category: row.category,
      level: row.level,
      confidence: row.confidence,
      source: row.source,
      context: row.context,
      keywords: JSON.parse(row.keywords || '[]'),
      firstMentioned: new Date(row.firstMentioned),
      lastMentioned: new Date(row.lastMentioned),
      mentionCount: row.mentionCount,
      isActive: row.isActive,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }
}
