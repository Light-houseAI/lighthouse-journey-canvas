/**
 * PgVector GraphRAG Service Implementation
 *
 * Business logic layer for pgvector-based GraphRAG search
 * Orchestrates repository calls and formats results
 */

import type {
  IPgVectorGraphRAGService,
  IPgVectorGraphRAGRepository,
  GraphRAGSearchRequest,
  GraphRAGSearchResponse,
  ProfileResult,
  MatchedNode,
  GraphRAGChunk,
  EmbeddingService
} from '../types/graphrag.types';
import { TimelineNodeType } from '../../shared/enums';

export class PgVectorGraphRAGService implements IPgVectorGraphRAGService {
  private repository: IPgVectorGraphRAGRepository;
  private embeddingService: EmbeddingService;
  private userRepository: any;
  private logger?: any;

  constructor({
    pgVectorGraphRAGRepository,
    openAIEmbeddingService,
    userRepository,
    logger
  }: {
    pgVectorGraphRAGRepository: IPgVectorGraphRAGRepository;
    openAIEmbeddingService: EmbeddingService;
    userRepository: any;
    logger?: any;
  }) {
    this.repository = pgVectorGraphRAGRepository;
    this.embeddingService = openAIEmbeddingService;
    this.userRepository = userRepository;
    this.logger = logger;
  }

  /**
   * Main search method - orchestrates the GraphRAG search pipeline
   */
  async searchProfiles(request: GraphRAGSearchRequest): Promise<GraphRAGSearchResponse> {
    const startTime = Date.now();
    const { query, limit = 20, tenantId } = request;

    try {
      // Step 1: Generate query embedding
      const queryEmbedding = await this.embeddingService.generateEmbedding(query);

      // Step 2: Vector search for initial candidates
      const vectorResults = await this.repository.vectorSearch(queryEmbedding, {
        limit: limit * 2, // Get enough results for filtering
        tenantId
      });

      if (vectorResults.length === 0) {
        return {
          query,
          totalResults: 0,
          profiles: [],
          timestamp: new Date().toISOString()
        };
      }

      // Step 3: Skip graph expansion for now - use vector results only
      // Add final_score based on similarity
      const scoredChunks = vectorResults.map(chunk => ({
        ...chunk,
        final_score: chunk.similarity || 0
      }));

      // Step 5: Group by user and format results
      const profilesMap = new Map<number, GraphRAGChunk[]>();

      for (const chunk of scoredChunks.slice(0, limit * 2)) {
        const userId = chunk.user_id;
        if (!profilesMap.has(userId)) {
          profilesMap.set(userId, []);
        }
        profilesMap.get(userId)!.push(chunk);
      }

      // Step 6: Format profiles with matched nodes
      const profiles: ProfileResult[] = [];

      for (const [userId, chunks] of profilesMap.entries()) {
        if (profiles.length >= limit) break;

        // Convert chunks to matched nodes
        const matchedNodes = chunks.map(chunk => this.chunkToMatchedNode(chunk));

        // Calculate overall match score
        const avgScore = chunks.reduce((sum, c) => sum + (c.final_score || 0), 0) / chunks.length;
        const matchScore = Math.round(avgScore * 100);

        // Generate why matched reasons
        const whyMatched = this.generateWhyMatched(matchedNodes, query);

        // Extract skills (excluding skills extraction per user request)
        const skills: string[] = [];

        const profile = await this.formatProfileResult(
          userId,
          matchedNodes,
          matchScore,
          whyMatched,
          skills
        );

        profiles.push(profile);
      }

      const responseTime = Date.now() - startTime;
      this.logger?.info(`GraphRAG search completed in ${responseTime}ms`, {
        query,
        resultsCount: profiles.length,
        candidatesEvaluated: scoredChunks.length
      });

      return {
        query,
        totalResults: profiles.length,
        profiles,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.logger?.error('GraphRAG search failed', { error, query });
      throw error;
    }
  }

  /**
   * Format a profile result with user data
   */
  async formatProfileResult(
    userId: number,
    matchedNodes: MatchedNode[],
    matchScore: number,
    whyMatched: string[],
    skills: string[]
  ): Promise<ProfileResult> {
    // Fetch user data
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    // Extract current role and company from matched nodes
    let currentRole: string | undefined;
    let company: string | undefined;

    const jobNodes = matchedNodes.filter(n => n.type === TimelineNodeType.Job);
    if (jobNodes.length > 0) {
      // Sort by date to find most recent
      const recentJob = jobNodes.sort((a, b) => {
        const dateA = a.meta.endDate || a.meta.startDate || '0';
        const dateB = b.meta.endDate || b.meta.startDate || '0';
        return dateB.localeCompare(dateA);
      })[0];

      currentRole = recentJob.meta.role || recentJob.meta.title;
      company = recentJob.meta.company || recentJob.meta.organization;
    }

    return {
      id: userId.toString(),
      name: user.name || `${user.firstName} ${user.lastName}`.trim() || 'Unknown',
      email: user.email,
      currentRole,
      company,
      matchScore: matchScore.toFixed(1),
      whyMatched,
      skills,
      matchedNodes,
      insightsSummary: this.generateInsightsSummary(matchedNodes)
    };
  }

  /**
   * Generate why matched reasons based on query and matched nodes
   */
  generateWhyMatched(matchedNodes: MatchedNode[], query: string): string[] {
    const reasons: string[] = [];
    const queryLower = query.toLowerCase();
    const queryTerms = queryLower.split(/\s+/);

    // Check for direct keyword matches
    for (const node of matchedNodes.slice(0, 5)) {
      const nodeText = JSON.stringify(node.meta).toLowerCase();

      for (const term of queryTerms) {
        if (nodeText.includes(term) && reasons.length < 3) {
          if (node.type === TimelineNodeType.Job) {
            reasons.push(`Experience as ${node.meta.role || 'professional'} at ${node.meta.company || 'company'}`);
          } else if (node.type === TimelineNodeType.Project) {
            reasons.push(`Worked on ${node.meta.title || 'project'} involving ${term}`);
          } else if (node.type === TimelineNodeType.Education) {
            reasons.push(`${node.meta.degree || 'Education'} from ${node.meta.institution || 'institution'}`);
          }
          break;
        }
      }
    }

    // Add semantic match reasons if needed
    if (reasons.length < 2) {
      const highScoreNodes = matchedNodes.filter(n => n.score > 0.7);
      if (highScoreNodes.length > 0) {
        reasons.push(`Strong semantic match with "${query}" based on experience`);
      }
    }

    // Ensure we have at least one reason
    if (reasons.length === 0) {
      reasons.push(`Profile contains relevant experience for "${query}"`);
    }

    return reasons.slice(0, 3); // Return max 3 reasons
  }

  /**
   * Create a new chunk in the vector database
   */
  async createChunk(data: {
    userId: number;
    nodeId: string;
    chunkText: string;
    embedding: number[];
    nodeType: string;
    meta?: any;
    tenantId?: string;
  }): Promise<GraphRAGChunk> {
    return await this.repository.createChunk({
      userId: data.userId,
      nodeId: data.nodeId,
      chunkText: data.chunkText,
      embedding: data.embedding,
      nodeType: data.nodeType,
      meta: data.meta,
      tenantId: data.tenantId || 'default'
    });
  }

  /**
   * Extract skills from matched nodes (simplified version)
   */
  extractSkillsFromNodes(nodes: MatchedNode[]): string[] {
    const skills = new Set<string>();

    // This is a simplified implementation
    // In production, this would use NLP or a skills taxonomy
    for (const node of nodes) {
      // Extract from meta fields
      if (node.meta.skills && Array.isArray(node.meta.skills)) {
        node.meta.skills.forEach((skill: string) => skills.add(skill));
      }

      // Extract from technologies field
      if (node.meta.technologies && Array.isArray(node.meta.technologies)) {
        node.meta.technologies.forEach((tech: string) => skills.add(tech));
      }
    }

    return Array.from(skills).slice(0, 20); // Limit to 20 skills
  }

  /**
   * Convert a chunk to a matched node
   */
  private chunkToMatchedNode(chunk: GraphRAGChunk): MatchedNode {
    // Parse node type from chunk
    const nodeType = (chunk.node_type as TimelineNodeType) || TimelineNodeType.Job;

    // Generate insights (simplified)
    const insights = chunk.meta?.insights || [];

    return {
      id: chunk.node_id || chunk.id,
      type: nodeType,
      meta: chunk.meta || {},
      score: chunk.final_score || chunk.similarity || 0,
      insights: Array.isArray(insights) ? insights : []
    };
  }

  /**
   * Generate insights summary from matched nodes
   */
  private generateInsightsSummary(nodes: MatchedNode[]): string[] {
    const summary: string[] = [];

    // Aggregate insights from all nodes
    const allInsights = nodes.flatMap(n => n.insights || []);

    // Group by category and select top insights
    const insightsByCategory = new Map<string, any[]>();

    for (const insight of allInsights) {
      const category = insight.category || 'general';
      if (!insightsByCategory.has(category)) {
        insightsByCategory.set(category, []);
      }
      insightsByCategory.get(category)!.push(insight);
    }

    // Select top insight from each category
    for (const [category, insights] of insightsByCategory.entries()) {
      if (summary.length >= 3) break;
      if (insights.length > 0) {
        summary.push(insights[0].text);
      }
    }

    return summary;
  }
}
