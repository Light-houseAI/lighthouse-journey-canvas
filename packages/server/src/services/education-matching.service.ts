import type { Database } from '../types/database.js';
import type {
  ExtractedSkills,
  LLMSkillExtractionService,
} from './llm-skill-extraction.service.js';
import type { NodePermissionService } from './node-permission.service.js';

export interface EducationMatchContext {
  nodeId: string;
  userId: number;
  limit?: number;
}

export interface EducationMatch {
  nodeId: string;
  userId: number;
  degree: string;
  fieldOfStudy: string;
  institution: string;
  extractedSkills: ExtractedSkills;
  score: number;
  institutionMatch: number;
  fieldSimilarity: number;
  degreeLevelMatch: number;
  yearProximity: number;
}

export interface EducationMatchResult {
  matches: EducationMatch[];
  querySkills: ExtractedSkills;
  totalCandidates: number;
}

const INSTITUTION_ALIASES: Record<string, string> = {
  mit: 'Massachusetts Institute of Technology',
  stanford: 'Stanford University',
  'uc berkeley': 'University of California, Berkeley',
  cmu: 'Carnegie Mellon University',
  harvard: 'Harvard University',
  caltech: 'California Institute of Technology',
};

const DEGREE_LEVELS: Record<string, number> = {
  certificate: 1,
  diploma: 2,
  bachelor: 3,
  bachelors: 3,
  master: 4,
  masters: 4,
  phd: 5,
  doctorate: 5,
};

export class EducationMatchingService {
  constructor(
    private db: Database,
    private skillExtractor: LLMSkillExtractionService,
    private permissionService: NodePermissionService
  ) {}

  async findMatches(
    context: EducationMatchContext
  ): Promise<EducationMatchResult> {
    // 1. Get query education node
    const queryNode = await this.db.query.timelineNodes.findFirst({
      where: (nodes, { eq }) => eq(nodes.id, context.nodeId),
    });

    if (!queryNode) {
      throw new Error(`Education node ${context.nodeId} not found`);
    }

    // 2. Extract skills from query education
    const querySkills = await this.skillExtractor.extractSkills({
      nodeType: 'education',
      title: queryNode.meta.degree || '',
      fieldOfStudy: queryNode.meta.field || queryNode.meta.fieldOfStudy || '',
      degree: queryNode.meta.degree || '',
      institution: queryNode.meta.institution || '',
    });

    // 3. Get all education nodes (except query) with user-scoped filtering
    const permittedNodes = await this.db.query.timelineNodes.findMany({
      where: (nodes, { eq, ne, and }) =>
        and(
          eq(nodes.type, 'education'),
          ne(nodes.id, context.nodeId),
          eq(nodes.userId, context.userId)
        ),
      limit: 100,
    });

    // 5. Extract skills and calculate similarity
    const matches: EducationMatch[] = [];

    for (const candidate of permittedNodes) {
      const candidateSkills = await this.skillExtractor.extractSkills({
        nodeType: 'education',
        title: candidate.meta.degree || '',
        fieldOfStudy: candidate.meta.field || candidate.meta.fieldOfStudy || '',
        degree: candidate.meta.degree || '',
        institution: candidate.meta.institution || '',
      });

      // Institution match with fuzzy matching
      const institutionMatch = this.calculateInstitutionMatch(
        queryNode.meta.institution || '',
        candidate.meta.institution || ''
      );

      // Field similarity via normalized skills
      const fieldSimilarity = this.calculateFieldSimilarity(
        querySkills.normalizedSkills,
        candidateSkills.normalizedSkills
      );

      // Degree level match
      const degreeLevelMatch = this.calculateDegreeLevelMatch(
        queryNode.meta.degree || '',
        candidate.meta.degree || ''
      );

      // Year proximity (placeholder - would use actual dates)
      const yearProximity = 0.5;

      // Final score: 27.5% institution + 42.5% field + 20% degree + 10% year
      const finalScore =
        0.275 * institutionMatch +
        0.425 * fieldSimilarity +
        0.2 * degreeLevelMatch +
        0.1 * yearProximity;

      matches.push({
        nodeId: candidate.id,
        userId: candidate.userId,
        degree: candidate.meta.degree || '',
        fieldOfStudy: candidate.meta.field || candidate.meta.fieldOfStudy || '',
        institution: candidate.meta.institution || '',
        extractedSkills: candidateSkills,
        score: finalScore,
        institutionMatch,
        fieldSimilarity,
        degreeLevelMatch,
        yearProximity,
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

  private calculateInstitutionMatch(inst1: string, inst2: string): number {
    const norm1 = this.normalizeInstitution(inst1);
    const norm2 = this.normalizeInstitution(inst2);

    if (norm1 === norm2) return 1.0;

    // Simple substring match
    if (norm1.includes(norm2) || norm2.includes(norm1)) {
      return 0.7;
    }

    return 0.0;
  }

  private normalizeInstitution(name: string): string {
    const lower = name.toLowerCase().trim();
    return INSTITUTION_ALIASES[lower] || name;
  }

  private calculateFieldSimilarity(
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

  private calculateDegreeLevelMatch(degree1: string, degree2: string): number {
    const level1 = this.getDegreeLevel(degree1);
    const level2 = this.getDegreeLevel(degree2);

    if (level1 === level2) return 1.0;

    const maxDistance = 4; // Max difference between levels
    const distance = Math.abs(level1 - level2);

    return Math.max(0, 1 - distance / maxDistance);
  }

  private getDegreeLevel(degree: string): number {
    const lower = degree.toLowerCase();
    for (const [key, level] of Object.entries(DEGREE_LEVELS)) {
      if (lower.includes(key)) {
        return level;
      }
    }
    return 2; // Default to diploma level
  }
}
