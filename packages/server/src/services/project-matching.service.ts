import type { Database } from '../types/database.js';
import type {
  ExtractedSkills,
  LLMSkillExtractionService,
} from './llm-skill-extraction.service.js';
import type { NodePermissionService } from './node-permission.service.js';

export interface ProjectMatchContext {
  nodeId: string;
  userId: number;
  limit?: number;
}

export interface ProjectMatch {
  nodeId: string;
  userId: number;
  title: string;
  description: string;
  technologies: string[];
  extractedSkills: ExtractedSkills;
  score: number;
  skillsSimilarity: number;
  projectTypeMatch: number;
  metadataBonus: number;
  topContributingSkills: Array<{
    skill: string;
    overlap: number;
  }>;
}

export interface ProjectMatchResult {
  matches: ProjectMatch[];
  querySkills: ExtractedSkills;
  totalCandidates: number;
}

export class ProjectMatchingService {
  constructor(
    private db: Database,
    private skillExtractor: LLMSkillExtractionService,
    private permissionService: NodePermissionService
  ) {}

  async findMatches(context: ProjectMatchContext): Promise<ProjectMatchResult> {
    // 1. Get query project node
    const queryNode = await this.db.query.timelineNodes.findFirst({
      where: (nodes, { eq }) => eq(nodes.id, context.nodeId),
    });

    if (!queryNode) {
      throw new Error(`Project node ${context.nodeId} not found`);
    }

    // 2. Extract skills from query project
    const querySkills = await this.skillExtractor.extractSkills({
      nodeType: 'project',
      title: queryNode.meta.title || '',
      description: queryNode.meta.description || '',
      technologies: queryNode.meta.technologies || [],
    });

    // 3. Get all project nodes (except query) with user-scoped filtering
    const permittedNodes = await this.db.query.timelineNodes.findMany({
      where: (nodes, { eq, ne, and }) =>
        and(
          eq(nodes.type, 'project'),
          ne(nodes.id, context.nodeId),
          eq(nodes.userId, context.userId)
        ),
      limit: 100,
    });

    // 5. Extract skills and calculate similarity for each permitted candidate
    const matches: ProjectMatch[] = [];

    for (const candidate of permittedNodes) {
      const candidateSkills = await this.skillExtractor.extractSkills({
        nodeType: 'project',
        title: candidate.meta.title || '',
        description: candidate.meta.description || '',
        technologies: candidate.meta.technologies || [],
      });

      // Calculate hybrid skills similarity
      const { similarity, topSkills } = this.calculateSkillsSimilarity(
        querySkills.normalizedSkills,
        candidateSkills.normalizedSkills
      );

      // Project type match (placeholder - would check meta.projectType if exists)
      const projectTypeMatch = 0.5; // Neutral score

      // Metadata bonus (placeholder - would check scale, complexity, etc.)
      const metadataBonus = 0.5; // Neutral score

      // Final score: 65% skills + 20% type + 15% metadata
      const finalScore =
        0.65 * similarity + 0.2 * projectTypeMatch + 0.15 * metadataBonus;

      matches.push({
        nodeId: candidate.id,
        userId: candidate.userId,
        title: candidate.meta.title || 'Untitled Project',
        description: candidate.meta.description || '',
        technologies: candidate.meta.technologies || [],
        extractedSkills: candidateSkills,
        score: finalScore,
        skillsSimilarity: similarity,
        projectTypeMatch,
        metadataBonus,
        topContributingSkills: topSkills,
      });
    }

    // 6. Sort by score and limit
    matches.sort((a, b) => b.score - a.score);
    const limitedMatches = matches.slice(0, context.limit || 10);

    return {
      matches: limitedMatches,
      querySkills,
      totalCandidates: permittedNodes.length,
    };
  }

  private calculateSkillsSimilarity(
    querySkills: string[],
    candidateSkills: string[]
  ): {
    similarity: number;
    topSkills: Array<{ skill: string; overlap: number }>;
  } {
    if (querySkills.length === 0 || candidateSkills.length === 0) {
      return { similarity: 0, topSkills: [] };
    }

    // Jaccard similarity for now (can be enhanced with embeddings later)
    const querySet = new Set(querySkills);
    const candidateSet = new Set(candidateSkills);

    const intersection = new Set(
      [...querySet].filter((skill) => candidateSet.has(skill))
    );

    const union = new Set([...querySet, ...candidateSet]);

    const similarity = intersection.size / union.size;

    // Top contributing skills
    const topSkills = Array.from(intersection)
      .map((skill) => ({
        skill,
        overlap: 1.0, // Exact match in this simple implementation
      }))
      .slice(0, 5);

    return { similarity, topSkills };
  }
}
