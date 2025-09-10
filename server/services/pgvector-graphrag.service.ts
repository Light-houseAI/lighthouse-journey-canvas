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
import type { LLMProvider } from '../core/llm-provider';
import { z } from 'zod';

export class PgVectorGraphRAGService implements IPgVectorGraphRAGService {
  private repository: IPgVectorGraphRAGRepository;
  private embeddingService: EmbeddingService;
  private llmProvider: LLMProvider;
  private userRepository: any;
  private logger?: any;

  constructor({
    pgVectorGraphRAGRepository,
    openAIEmbeddingService,
    llmProvider,
    userRepository,
    logger
  }: {
    pgVectorGraphRAGRepository: IPgVectorGraphRAGRepository;
    openAIEmbeddingService: EmbeddingService;
    llmProvider: LLMProvider;
    userRepository: any;
    logger?: any;
  }) {
    this.repository = pgVectorGraphRAGRepository;
    this.embeddingService = openAIEmbeddingService;
    this.llmProvider = llmProvider;
    this.userRepository = userRepository;
    this.logger = logger;
  }

  /**
   * Create timeout wrapper for async operations
   */
  private createTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`${operation} timeout after ${timeoutMs}ms`)), timeoutMs)
      )
    ]);
  }

  /**
   * Main search method - orchestrates the GraphRAG search pipeline
   */
  async searchProfiles(request: GraphRAGSearchRequest): Promise<GraphRAGSearchResponse> {
    const startTime = Date.now();
    const { query, limit = 20, tenantId, excludeUserId, similarityThreshold = 0.3 } = request;

    try {
      // Step 1: Generate query embedding with expanded terms for better semantic matching
      const queryWords = query.toLowerCase().split(/\s+/);
      const expandedQuery = this.expandQuery(query);

      this.logger?.info('GraphRAG search initiated', {
        originalQuery: query,
        expandedQuery: expandedQuery !== query ? expandedQuery : 'no expansion',
        queryWords,
        excludeUserId
      });

      const queryEmbedding = await this.createTimeout(
        this.embeddingService.generateEmbedding(expandedQuery),
        25000, // 25 second timeout for embedding generation
        'Query embedding generation'
      );

      // Step 2: Vector search for initial candidates
      const vectorResults = await this.createTimeout(
        this.repository.vectorSearch(queryEmbedding, {
          limit: limit * 3, // Get more results for better filtering
          tenantId,
          excludeUserId
        }),
        15000, // 15 second timeout for vector search
        'Vector database search'
      );

      if (vectorResults.length === 0) {
        return {
          query,
          totalResults: 0,
          profiles: [],
          timestamp: new Date().toISOString()
        };
      }

      // Step 3: Filter by similarity threshold for better relevance

      // Log similarity scores for debugging
      const similarities = vectorResults.map(c => c.similarity || 0);
      this.logger?.info(`Vector search similarity scores`, {
        query,
        candidatesCount: vectorResults.length,
        similarities: similarities.slice(0, 10), // Show top 10
        maxSimilarity: Math.max(...similarities),
        minSimilarity: Math.min(...similarities),
        avgSimilarity: similarities.reduce((a, b) => a + b, 0) / similarities.length,
        threshold: similarityThreshold
      });

      const relevantChunks = vectorResults.filter(chunk =>
        (chunk.similarity || 0) >= similarityThreshold
      );

      if (relevantChunks.length === 0) {
        this.logger?.info(`No results above similarity threshold ${similarityThreshold}`, {
          query,
          candidatesEvaluated: vectorResults.length,
          bestSimilarity: Math.max(...similarities),
          threshold: similarityThreshold
        });

        return {
          query,
          totalResults: 0,
          profiles: [],
          timestamp: new Date().toISOString()
        };
      }

      // Step 4: Add final_score based on similarity
      const scoredChunks = relevantChunks.map(chunk => ({
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

        // Convert chunks to matched nodes and deduplicate by node_id (keep highest score)
        const nodeMap = new Map<string, GraphRAGChunk>();
        
        for (const chunk of chunks) {
          const nodeId = chunk.node_id || chunk.id;
          const existing = nodeMap.get(nodeId);
          
          // Keep the chunk with the highest score for each unique node
          if (!existing || (chunk.final_score || 0) > (existing.final_score || 0)) {
            nodeMap.set(nodeId, chunk);
          }
        }
        
        const matchedNodes = Array.from(nodeMap.values()).map(chunk => this.chunkToMatchedNode(chunk));

        // Calculate overall match score
        const avgScore = chunks.reduce((sum, c) => sum + (c.final_score || 0), 0) / chunks.length;
        const matchScore = Math.round(avgScore * 100);

        // Generate why matched reasons
        const whyMatched = await this.createTimeout(
          this.generateWhyMatched(matchedNodes, query),
          10000, // 10 second timeout for why matched generation
          'Why matched generation'
        ).catch(error => {
          this.logger?.warn('Why matched generation failed, continuing without', { error: error.message });
          return []; // Continue without why matched if it fails
        });

        // Extract skills (excluding skills extraction per user request)
        const skills: string[] = [];

        const profile = await this.createTimeout(
          this.formatProfileResult(
            userId,
            matchedNodes,
            matchScore,
            whyMatched,
            skills,
            query
          ),
          10000, // 10 second timeout for profile formatting
          'Profile formatting'
        ).catch(error => {
          this.logger?.warn('Profile formatting failed, using fallback', { error: error.message, userId });
          // Return a basic profile if formatting fails
          return {
            id: userId.toString(),
            name: 'User Profile',
            email: '',
            matchScore: matchScore.toString(),
            whyMatched,
            skills,
            matchedNodes,
            insightsSummary: []
          };
        });

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
    skills: string[],
    query: string
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
      insightsSummary: await this.createTimeout(
        this.generateInsightsSummary(matchedNodes, query),
        8000, // 8 second timeout for insights summary
        'Insights summary generation'
      ).catch(error => {
        this.logger?.warn('Insights summary generation failed, using empty array', { error: error.message });
        return []; // Return empty array if insights generation fails
      })
    };
  }

  /**
   * Sanitize node data for LLM processing - removes all personal identifiers
   * Only includes professional experience data
   */
  private sanitizeNodesForLLM(nodes: MatchedNode[]): any[] {
    return nodes.map(node => {
      const sanitized: any = {
        type: node.type,
        score: node.score
      };

      // Only include professional metadata, no personal identifiers
      if (node.meta) {
        const meta: any = {};

        // Job-related data (remove company names to protect privacy)
        if (node.type === TimelineNodeType.Job) {
          if (node.meta.role) meta.role = node.meta.role;
          if (node.meta.title) meta.title = node.meta.title;
          if (node.meta.skills) meta.skills = node.meta.skills;
          if (node.meta.technologies) meta.technologies = node.meta.technologies;
          if (node.meta.description) meta.description = node.meta.description;
          if (node.meta.achievements) meta.achievements = node.meta.achievements;
          // Duration info (no specific dates)
          if (node.meta.startDate && node.meta.endDate) {
            const start = new Date(node.meta.startDate + '-01');
            const end = new Date(node.meta.endDate + '-01');
            const months = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
            meta.durationMonths = Math.round(months);
          }
        }

        // Education data (remove specific institution names)
        if (node.type === TimelineNodeType.Education) {
          if (node.meta.degree) meta.degree = node.meta.degree;
          if (node.meta.field) meta.field = node.meta.field;
          if (node.meta.major) meta.major = node.meta.major;
          if (node.meta.gpa) meta.gpa = node.meta.gpa;
          if (node.meta.skills) meta.skills = node.meta.skills;
          if (node.meta.coursework) meta.coursework = node.meta.coursework;
        }

        // Project data
        if (node.type === TimelineNodeType.Project) {
          if (node.meta.title) meta.title = node.meta.title;
          if (node.meta.description) meta.description = node.meta.description;
          if (node.meta.technologies) meta.technologies = node.meta.technologies;
          if (node.meta.skills) meta.skills = node.meta.skills;
          if (node.meta.achievements) meta.achievements = node.meta.achievements;
          if (node.meta.scope) meta.scope = node.meta.scope;
        }

        sanitized.meta = meta;
      }

      return sanitized;
    });
  }

  /**
   * Generate why matched reasons based on query and matched nodes using LLM
   */
  async generateWhyMatched(matchedNodes: MatchedNode[], query: string): Promise<string[]> {
    try {
      // Sanitize data for LLM (remove personal identifiers)
      const sanitizedNodes = this.sanitizeNodesForLLM(matchedNodes.slice(0, 3));

      const prompt = `You are analyzing why a professional profile matches a search query.

Search Query: "${query}"

Professional Experience Data (anonymized):
${JSON.stringify(sanitizedNodes, null, 2)}

Generate 2-3 specific, factual reasons why this profile matches the search query "${query}". Focus on:
- Relevant skills and technologies
- Experience level and duration
- Project types and achievements
- Educational background relevance

Each reason should be:
- Specific and factual (not generic)
- Under 80 characters
- Based only on the provided data
- Professional and concise

Return as a JSON object with a "reasons" array containing 1-3 strings.
Example: {"reasons": ["5+ years React development experience", "Led cloud migration projects", "Strong backend systems expertise"]}`;

      const schema = z.object({
        reasons: z.array(z.string().max(80)).min(1).max(3)
      });

      const response = await this.llmProvider.generateStructuredResponse(
        [
          { role: 'system', content: 'You are a professional recruiter analyzing profile matches. Always return a valid JSON object with a "reasons" array containing 1-3 strings.' },
          { role: 'user', content: prompt }
        ],
        schema,
        {
          temperature: 0.1,
          maxTokens: 200,
          experimental_repairText: async ({ text, error }) => {
            this.logger?.warn('LLM whyMatched response needs repair', {
              originalText: text.substring(0, 200),
              error: error?.message || error
            });

            let repairedText = text.trim();

            try {
              // Try to extract JSON if it's wrapped in markdown or other text
              const jsonMatch = repairedText.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                repairedText = jsonMatch[0];
              }

              // Ensure proper JSON structure
              if (!repairedText.startsWith('{')) {
                repairedText = '{' + repairedText;
              }
              if (!repairedText.endsWith('}')) {
                repairedText = repairedText + '}';
              }

              // Parse and validate basic structure
              let parsed;
              try {
                parsed = JSON.parse(repairedText);
              } catch (parseError) {
                // If still can't parse, provide fallback
                repairedText = '{"reasons":["Experience relevant to search query"]}';
                parsed = JSON.parse(repairedText);
              }

              // Ensure reasons field exists and is array
              if (!parsed.reasons || !Array.isArray(parsed.reasons)) {
                parsed.reasons = ["Experience relevant to search query"];
              }

              // Ensure reasons are strings with max length
              parsed.reasons = parsed.reasons
                .filter(reason => typeof reason === 'string')
                .map(reason => reason.substring(0, 80))
                .slice(0, 3);

              // Ensure at least one reason
              if (parsed.reasons.length === 0) {
                parsed.reasons = ["Experience relevant to search query"];
              }

              const finalText = JSON.stringify(parsed);
              this.logger?.info('LLM whyMatched response repaired successfully', {
                originalLength: text.length,
                repairedLength: finalText.length,
                reasonsCount: parsed.reasons.length
              });

              return finalText;

            } catch (repairError) {
              this.logger?.error('Failed to repair LLM whyMatched response', {
                repairError: repairError?.message || repairError,
                originalText: text.substring(0, 100)
              });

              // Ultimate fallback
              return '{"reasons":["Experience relevant to search query"]}';
            }
          }
        }
      );

      return response.content.reasons;

    } catch (error) {
      this.logger?.error('LLM-based why matched generation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        query,
        stack: error instanceof Error ? error.stack : undefined
      });

      // Return empty array if LLM fails
      return [];
    }
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
   * Generate insights summary from matched nodes using LLM
   */
  private async generateInsightsSummary(matchedNodes: MatchedNode[], query: string): Promise<string[]> {
    try {
      // Extract insights and resources from matched nodes that have insights
      const nodeInsights = matchedNodes
        .filter(node => node.insights && node.insights.length > 0)
        .flatMap(node => node.insights.map(insight => ({
          nodeType: node.type,
          nodeScore: node.score,
          text: insight.text,
          category: insight.category,
          resources: insight.resources || []
        })));

      // If we have existing insights from matched nodes, use them with resources
      if (nodeInsights.length > 0) {
        this.logger?.info('Found existing insights in matched nodes', {
          insightCount: nodeInsights.length,
          resourceCount: nodeInsights.reduce((sum, insight) => sum + insight.resources.length, 0)
        });

        // Process insights to include resources and context
        const processedInsights = nodeInsights
          .slice(0, 3)
          .map(insight => {
            let text = insight.text.substring(0, 120);

            // Append resources if they match the query
            if (insight.resources.length > 0) {
              const relevantResources = insight.resources
                .filter(resource =>
                  query.toLowerCase().split(' ').some(term =>
                    resource.toLowerCase().includes(term.toLowerCase())
                  )
                )
                .slice(0, 2);

              if (relevantResources.length > 0) {
                text += ` [Resources: ${relevantResources.join(', ')}]`;
              }
            }

            return text;
          })
          .filter(insight => insight && insight.trim().length > 0);

        if (processedInsights.length > 0) {
          return processedInsights;
        }
      }

      // Only generate LLM insights if the matched nodes actually have insights
      // Don't hallucinate insights from job descriptions without actual insights
      const hasActualInsights = matchedNodes.some(node => 
        node.insights && node.insights.length > 0
      );
      
      this.logger?.info('Checking if should generate LLM insights', {
        matchedNodesCount: matchedNodes.length,
        hasActualInsights,
        nodeInsights: matchedNodes.map(node => ({
          nodeId: node.id,
          insightsCount: node.insights ? node.insights.length : 0
        }))
      });
      
      if (matchedNodes.length === 0 || !hasActualInsights) {
        this.logger?.info('Skipping LLM insights generation - no actual insights in matched nodes');
        return [];
      }

      const sanitizedNodes = this.sanitizeNodesForLLM(matchedNodes);

      const prompt = `Analyze this professional profile and generate exactly 2 career learning insights that OTHER professionals can learn from and apply to their own careers.

Professional Experience Data (anonymized):
${JSON.stringify(sanitizedNodes, null, 2)}

Generate exactly 2 actionable learning insights in the format of advice/lessons that others can benefit from:

Examples:
- "Key lesson: Building expertise in multiple domains early opens doors to senior leadership roles"
- "Success strategy: Focus on user-facing features to demonstrate business impact"
- "Career tip: Transitioning between startups and established companies broadens technical perspective"
- "Learning: Leading 10k+ user features teaches scalability and performance optimization skills"

Requirements:
- Each insight should be practical advice others can apply (60-120 characters)
- Start with phrases like "Key lesson:", "Success strategy:", "Career tip:", or "Learning:"
- Focus on actionable takeaways from their career path
- Make it valuable learning for other professionals

Return as a JSON object with an "insights" array containing exactly 2 strings.`;

      const schema = z.object({
        insights: z.array(z.string().min(20).max(150)).min(1).max(2)
      });

      const response = await this.llmProvider.generateStructuredResponse(
        [
          { role: 'system', content: 'You are a senior career mentor providing actionable learning insights for other professionals. Always respond with valid JSON containing an "insights" array with 1-2 career advice strings.' },
          { role: 'user', content: prompt }
        ],
        schema,
        {
          temperature: 0.1,
          maxTokens: 150,
          experimental_repairText: async ({ text, error }) => {
            this.logger?.warn('LLM insights response needs repair', {
              originalText: text.substring(0, 200),
              error: error?.message || error
            });

            let repairedText = text.trim();

            try {
              // Try to extract JSON if it's wrapped in markdown or other text
              const jsonMatch = repairedText.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                repairedText = jsonMatch[0];
              }

              // Ensure proper JSON structure
              if (!repairedText.startsWith('{')) {
                repairedText = '{' + repairedText;
              }
              if (!repairedText.endsWith('}')) {
                repairedText = repairedText + '}';
              }

              // Parse and validate basic structure
              let parsed;
              try {
                parsed = JSON.parse(repairedText);
              } catch (parseError) {
                // If still can't parse, provide fallback
                repairedText = '{"insights":[]}';
                parsed = JSON.parse(repairedText);
              }

              // Ensure insights field exists and is array - but keep empty if no insights
              if (!parsed.insights || !Array.isArray(parsed.insights)) {
                parsed.insights = [];
              }

              // Ensure insights are strings with max length
              parsed.insights = parsed.insights
                .filter(insight => typeof insight === 'string')
                .map(insight => insight.substring(0, 100))
                .slice(0, 2);

              // Keep empty array if no insights - don't add fallback

              const finalText = JSON.stringify(parsed);
              this.logger?.info('LLM insights response repaired successfully', {
                originalLength: text.length,
                repairedLength: finalText.length,
                insightsCount: parsed.insights.length
              });

              return finalText;

            } catch (repairError) {
              this.logger?.error('Failed to repair LLM insights response', {
                repairError: repairError?.message || repairError,
                originalText: text.substring(0, 100)
              });

              // No fallback - return empty array if repair fails
              return '{"insights":[]}';
            }
          }
        }
      );

      // Return the insights directly from the structured response
      return response.content.insights || [];

    } catch (error) {
      this.logger?.error('LLM-based insights generation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });

      // Return empty array if LLM fails
      return [];
    }
  }

  /**
   * Expand query with semantic variations for better matching
   * Based on advanced RAG techniques for query expansion
   */
  private expandQuery(originalQuery: string): string {
    const query = originalQuery.toLowerCase().trim();
    
    // Professional role expansions - handles "X engineer" <-> "X engineering" patterns
    const roleExpansions = new Map([
      // Engineering variations
      ['mechanical engineer', 'mechanical engineer mechanical engineering'],
      ['mechanical engineering', 'mechanical engineering mechanical engineer'],
      ['software engineer', 'software engineer software engineering software developer software development'],
      ['software engineering', 'software engineering software engineer software developer software development'],
      ['electrical engineer', 'electrical engineer electrical engineering electronics'],
      ['electrical engineering', 'electrical engineering electrical engineer electronics'],
      ['civil engineer', 'civil engineer civil engineering construction'],
      ['civil engineering', 'civil engineering civil engineer construction'],
      ['chemical engineer', 'chemical engineer chemical engineering'],
      ['chemical engineering', 'chemical engineering chemical engineer'],
      ['biomedical engineer', 'biomedical engineer biomedical engineering medical devices'],
      ['biomedical engineering', 'biomedical engineering biomedical engineer medical devices'],
      ['aerospace engineer', 'aerospace engineer aerospace engineering aviation'],
      ['aerospace engineering', 'aerospace engineering aerospace engineer aviation'],
      ['industrial engineer', 'industrial engineer industrial engineering manufacturing'],
      ['industrial engineering', 'industrial engineering industrial engineer manufacturing'],
      
      // Development/Programming variations
      ['frontend developer', 'frontend developer frontend development front-end developer ui developer'],
      ['frontend development', 'frontend development frontend developer front-end development ui development'],
      ['backend developer', 'backend developer backend development server-side developer'],
      ['backend development', 'backend development backend developer server-side development'],
      ['fullstack developer', 'fullstack developer full-stack developer fullstack development'],
      ['fullstack development', 'fullstack development fullstack developer full-stack development'],
      ['web developer', 'web developer web development frontend backend'],
      ['web development', 'web development web developer frontend backend'],
      ['mobile developer', 'mobile developer mobile development ios android'],
      ['mobile development', 'mobile development mobile developer ios android'],
      ['devops engineer', 'devops engineer devops engineering infrastructure automation'],
      ['devops engineering', 'devops engineering devops engineer infrastructure automation'],
      
      // Data science variations
      ['data scientist', 'data scientist data science machine learning analytics'],
      ['data science', 'data science data scientist machine learning analytics'],
      ['data engineer', 'data engineer data engineering ETL pipelines'],
      ['data engineering', 'data engineering data engineer ETL pipelines'],
      ['machine learning engineer', 'machine learning engineer ML engineer data scientist AI'],
      ['machine learning', 'machine learning ML artificial intelligence data science'],
      
      // Product/Management variations
      ['product manager', 'product manager product management PM'],
      ['product management', 'product management product manager PM'],
      ['project manager', 'project manager project management scrum agile'],
      ['project management', 'project management project manager scrum agile'],
      
      // Design variations
      ['ux designer', 'ux designer user experience design ui designer'],
      ['ui designer', 'ui designer user interface design ux designer'],
      ['graphic designer', 'graphic designer graphic design visual design'],
      
      // Marketing variations
      ['digital marketing', 'digital marketing marketing online marketing'],
      ['content marketing', 'content marketing content creation marketing'],
      
      // Sales variations
      ['sales engineer', 'sales engineer technical sales pre-sales'],
      ['account manager', 'account manager sales customer success'],
      
      // General skill expansions
      ['javascript', 'javascript js node.js react vue angular'],
      ['python', 'python django flask pandas numpy'],
      ['java', 'java spring hibernate'],
      ['react', 'react reactjs javascript frontend'],
      ['angular', 'angular angularjs typescript frontend'],
      ['vue', 'vue vuejs javascript frontend'],
      ['node', 'node nodejs javascript backend'],
      ['docker', 'docker containerization kubernetes'],
      ['kubernetes', 'kubernetes k8s docker containerization'],
      ['aws', 'aws amazon web services cloud'],
      ['azure', 'azure microsoft cloud'],
      ['gcp', 'gcp google cloud platform'],
    ]);
    
    // Technology and framework synonyms
    const techSynonyms = new Map([
      ['js', 'javascript'],
      ['ts', 'typescript'],
      ['k8s', 'kubernetes'],
      ['ml', 'machine learning'],
      ['ai', 'artificial intelligence'],
      ['ui', 'user interface'],
      ['ux', 'user experience'],
      ['api', 'application programming interface'],
      ['db', 'database'],
      ['sql', 'structured query language'],
      ['nosql', 'non-relational database'],
      ['ci/cd', 'continuous integration continuous deployment'],
      ['devops', 'development operations'],
    ]);
    
    let expandedQuery = originalQuery;
    
    // Apply role expansions - exact match first
    for (const [pattern, expansion] of roleExpansions) {
      if (query === pattern) {
        expandedQuery = expansion;
        this.logger?.info('Applied exact role expansion', { 
          original: originalQuery, 
          pattern, 
          expanded: expansion 
        });
        break;
      }
    }
    
    // If no exact match, try partial matches for multi-word terms
    if (expandedQuery === originalQuery) {
      for (const [pattern, expansion] of roleExpansions) {
        if (pattern.includes(' ') && query.includes(pattern)) {
          expandedQuery = query.replace(pattern, expansion);
          this.logger?.info('Applied partial role expansion', { 
            original: originalQuery, 
            pattern, 
            expanded: expandedQuery 
          });
          break;
        }
      }
    }
    
    // Apply technology synonyms
    const words = expandedQuery.split(/\s+/);
    const expandedWords = words.map(word => {
      const lowerWord = word.toLowerCase().replace(/[^\w]/g, '');
      if (techSynonyms.has(lowerWord)) {
        const synonym = techSynonyms.get(lowerWord)!;
        this.logger?.info('Applied tech synonym', { original: word, synonym });
        return `${word} ${synonym}`;
      }
      return word;
    });
    
    // Apply common professional suffixes expansion
    const finalExpanded = expandedWords.join(' ');
    
    // Add experience level variations for better matching
    let experienceExpanded = finalExpanded;
    
    // Add experience qualifiers if they seem relevant
    const experiencePatterns = [
      { pattern: /senior|lead|principal/, additions: ['experienced', 'expert', 'advanced'] },
      { pattern: /junior|entry.level|graduate/, additions: ['beginner', 'new', 'trainee'] },
      { pattern: /manager|director/, additions: ['leadership', 'management', 'team lead'] }
    ];
    
    for (const { pattern, additions } of experiencePatterns) {
      if (pattern.test(finalExpanded.toLowerCase())) {
        experienceExpanded += ' ' + additions.join(' ');
        break;
      }
    }
    
    // Log the final expansion result
    if (experienceExpanded !== originalQuery) {
      this.logger?.info('Query expansion completed', {
        original: originalQuery,
        expanded: experienceExpanded,
        expansionRatio: experienceExpanded.length / originalQuery.length
      });
    }
    
    return experienceExpanded;
  }
}
