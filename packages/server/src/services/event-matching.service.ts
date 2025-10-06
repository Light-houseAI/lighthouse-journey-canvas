import type { Database } from '../types/database.js';
import type {
  ExtractedSkills,
  LLMSkillExtractionService,
} from './llm-skill-extraction.service.js';
import type { NodePermissionService } from './node-permission.service.js';

export interface EventMatchContext {
  nodeId: string;
  userId: number;
  limit?: number;
}

export interface EventMatch {
  nodeId: string;
  userId: number;
  title: string;
  eventType: string;
  extractedSkills: ExtractedSkills;
  score: number;
  skillsSimilarity: number;
  eventTypeMatch: number;
  topicRelevance: number;
}

export interface EventMatchResult {
  matches: EventMatch[];
  querySkills: ExtractedSkills;
  totalCandidates: number;
}

export class EventMatchingService {
  constructor(
    private db: Database,
    private skillExtractor: LLMSkillExtractionService,
    private permissionService: NodePermissionService
  ) {}

  async findMatches(context: EventMatchContext): Promise<EventMatchResult> {
    // 1. Get query event node
    const queryNode = await this.db.query.timelineNodes.findFirst({
      where: (nodes, { eq }) => eq(nodes.id, context.nodeId),
    });

    if (!queryNode) {
      throw new Error(`Event node ${context.nodeId} not found`);
    }

    // 2. Extract skills from query event
    const querySkills = await this.skillExtractor.extractSkills({
      nodeType: 'event',
      title: queryNode.meta.title || '',
      description: queryNode.meta.description || '',
      technologies: queryNode.meta.technologies || [],
    });

    // 3. Get all event nodes (except query) with user-scoped filtering
    const permittedNodes = await this.db.query.timelineNodes.findMany({
      where: (nodes, { eq, ne, and }) =>
        and(
          eq(nodes.type, 'event'),
          ne(nodes.id, context.nodeId),
          eq(nodes.userId, context.userId)
        ),
      limit: 100,
    });

    // 5. Extract skills and calculate similarity
    const matches: EventMatch[] = [];

    for (const candidate of permittedNodes) {
      const candidateSkills = await this.skillExtractor.extractSkills({
        nodeType: 'event',
        title: candidate.meta.title || '',
        description: candidate.meta.description || '',
        technologies: candidate.meta.technologies || [],
      });

      // Skills similarity
      const skillsSimilarity = this.calculateSkillsSimilarity(
        querySkills.normalizedSkills,
        candidateSkills.normalizedSkills
      );

      // Event type match (conference, workshop, course, etc.)
      const eventTypeMatch = this.calculateEventTypeMatch(
        queryNode.meta.eventType || queryNode.meta.type || '',
        candidate.meta.eventType || candidate.meta.type || ''
      );

      // Topic relevance via skills
      const topicRelevance = skillsSimilarity; // Same as skills for simplicity

      // Final score: 60% skills + 25% event type + 15% topic
      const finalScore =
        0.6 * skillsSimilarity + 0.25 * eventTypeMatch + 0.15 * topicRelevance;

      matches.push({
        nodeId: candidate.id,
        userId: candidate.userId,
        title: candidate.meta.title || 'Untitled Event',
        eventType: candidate.meta.eventType || candidate.meta.type || 'general',
        extractedSkills: candidateSkills,
        score: finalScore,
        skillsSimilarity,
        eventTypeMatch,
        topicRelevance,
      });
    }

    // 6. Sort and limit
    matches.sort((a, b) => b.score - a.score);
    const limitedMatches = matches.slice(0, context.limit || 10);

    return {
      matches: limitedMatches,
      querySkills,
      totalCandidates: permittedNodes.length,
    };
  }

  private calculateSkillsSimilarity(
    skills1: string[],
    skills2: string[]
  ): number {
    if (skills1.length === 0 || skills2.length === 0) return 0;

    const set1 = new Set(skills1);
    const set2 = new Set(skills2);
    const intersection = new Set([...set1].filter((s) => set2.has(s)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }

  private calculateEventTypeMatch(type1: string, type2: string): number {
    const norm1 = type1.toLowerCase().trim();
    const norm2 = type2.toLowerCase().trim();

    if (norm1 === norm2) return 1.0;

    // Check for similar types
    const typeGroups = [
      ['conference', 'summit', 'convention'],
      ['workshop', 'training', 'bootcamp'],
      ['course', 'class', 'certification'],
      ['meetup', 'networking', 'social'],
    ];

    for (const group of typeGroups) {
      if (group.includes(norm1) && group.includes(norm2)) {
        return 0.7; // Similar types
      }
    }

    return 0.3; // Different types but still some value
  }
}
