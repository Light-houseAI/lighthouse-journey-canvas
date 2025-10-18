import { ENTRY_LEVEL_WEIGHTS, SIMILARITY_WEIGHTS } from './config';
import { CareerStep } from './types';

/**
 * Trajectory scoring module for computing similarity between career steps
 *
 * Uses multiple factors: role similarity, company match, duration, and type weights.
 * Avoids normalization since titles mean different things across organizations.
 */
export class TrajectoryScorer {
  /**
   * Compute similarity score between two career steps
   *
   * @param step1 - First career step
   * @param step2 - Second career step
   * @param isEntryLevel - Whether to use entry-level adjusted weights
   * @param recencyWeight - Optional recency weight multiplier
   * @returns Similarity score (higher is more similar)
   */
  computeSimilarity(
    step1: CareerStep,
    step2: CareerStep,
    isEntryLevel: boolean = false,
    recencyWeight: number = 1.0
  ): number {
    const weights = isEntryLevel ? ENTRY_LEVEL_WEIGHTS : SIMILARITY_WEIGHTS;
    let score = 0;

    // Type mismatch penalty
    if (step1.type !== step2.type) {
      // Small base similarity for different types
      return 0.3 * recencyWeight;
    }

    // Apply type-specific weights
    const typeWeight = weights.typeWeights[step1.type];

    // For jobs/projects
    if (step1.type === 'job' || step1.type === 'project') {
      // Role similarity (most important)
      const roleSimilarity = this.computeRoleSimilarity(step1.role, step2.role);
      score += weights.role * roleSimilarity;

      // Company match
      if (step1.company && step2.company) {
        const companyMatch = this.computeCompanyMatch(
          step1.company,
          step2.company
        );
        score += weights.company * companyMatch;
      }

      // Duration similarity
      if (step1.duration && step2.duration) {
        const durationSimilarity = this.computeDurationSimilarity(
          step1.duration,
          step2.duration
        );
        score += weights.duration * durationSimilarity;
      }
    }

    // For education
    if (step1.type === 'education') {
      // Degree similarity
      if (step1.degree && step2.degree) {
        const degreeSimilarity = this.computeTextSimilarity(
          step1.degree,
          step2.degree
        );
        score += 2.0 * degreeSimilarity;
      }

      // Field similarity
      if (step1.field && step2.field) {
        const fieldSimilarity = this.computeTextSimilarity(
          step1.field,
          step2.field
        );
        score += 2.0 * fieldSimilarity;
      }
    }

    // Apply type weight and recency weight
    return score * typeWeight * recencyWeight;
  }

  /**
   * Compute role similarity using semantic matching
   * Avoids normalization - uses fuzzy matching on raw titles
   */
  private computeRoleSimilarity(role1?: string, role2?: string): number {
    if (!role1 || !role2) return 0;

    const r1 = role1.toLowerCase().trim();
    const r2 = role2.toLowerCase().trim();

    // Exact match
    if (r1 === r2) return 1.0;

    // High similarity - contains same key terms
    const commonTerms = this.extractRoleTerms(r1).filter((term) =>
      this.extractRoleTerms(r2).includes(term)
    );

    if (commonTerms.length > 0) {
      // Score based on proportion of matching terms
      const r1Terms = this.extractRoleTerms(r1);
      const r2Terms = this.extractRoleTerms(r2);
      const totalTerms = Math.max(r1Terms.length, r2Terms.length);
      return commonTerms.length / totalTerms;
    }

    // Check for related role families
    const relatedScore = this.computeRelatedRoleScore(r1, r2);
    if (relatedScore > 0) return relatedScore;

    return 0.1; // Minimal base similarity
  }

  /**
   * Extract key terms from role title
   */
  private extractRoleTerms(role: string): string[] {
    // Remove common noise words
    const noise = [
      'the',
      'a',
      'an',
      'and',
      'or',
      'of',
      'at',
      'in',
      'to',
      'for',
    ];

    return role
      .toLowerCase()
      .split(/[\s\-_/]+/)
      .filter((term) => term.length > 2 && !noise.includes(term));
  }

  /**
   * Check if roles belong to related families
   */
  private computeRelatedRoleScore(role1: string, role2: string): number {
    const roleFamilies = [
      ['engineer', 'developer', 'programmer', 'coder'],
      ['scientist', 'researcher', 'analyst'],
      ['manager', 'lead', 'director', 'vp', 'head'],
      ['designer', 'ux', 'ui', 'product'],
      ['sales', 'account', 'business development'],
      ['marketing', 'growth', 'product marketing'],
    ];

    for (const family of roleFamilies) {
      const in1 = family.some((term) => role1.includes(term));
      const in2 = family.some((term) => role2.includes(term));

      if (in1 && in2) {
        return 0.5; // Same family, moderate similarity
      }
    }

    return 0;
  }

  /**
   * Compute company match (exact name only)
   * Organizations mean different things - only exact matches count
   */
  private computeCompanyMatch(company1: string, company2: string): number {
    const c1 = company1.toLowerCase().trim();
    const c2 = company2.toLowerCase().trim();

    // Exact match only
    return c1 === c2 ? 1.0 : 0;
  }

  /**
   * Compute duration similarity
   */
  private computeDurationSimilarity(
    duration1: number,
    duration2: number
  ): number {
    if (duration1 === 0 || duration2 === 0) return 0;

    const ratio =
      Math.min(duration1, duration2) / Math.max(duration1, duration2);
    return ratio;
  }

  /**
   * Generic text similarity (for degrees, fields, etc.)
   */
  private computeTextSimilarity(text1: string, text2: string): number {
    const t1 = text1.toLowerCase().trim();
    const t2 = text2.toLowerCase().trim();

    if (t1 === t2) return 1.0;
    if (t1.includes(t2) || t2.includes(t1)) return 0.7;

    // Check for common words
    const words1 = t1.split(/\s+/);
    const words2 = t2.split(/\s+/);
    const commonWords = words1.filter((w) => words2.includes(w));

    if (commonWords.length > 0) {
      return commonWords.length / Math.max(words1.length, words2.length);
    }

    return 0;
  }

  /**
   * Compute recency weight using exponential decay
   *
   * @param yearsAgo - How many years ago this step occurred
   * @param lambda - Decay parameter (default 0.15)
   * @returns Weight multiplier (1.0 for recent, decays over time)
   */
  computeRecencyWeight(yearsAgo: number, lambda: number = 0.15): number {
    return Math.exp(-lambda * yearsAgo);
  }
}
