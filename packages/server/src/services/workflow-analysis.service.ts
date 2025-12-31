/**
 * Workflow Analysis Service
 *
 * AI-powered "Head Analyst" service that provides fine-grained workflow analysis
 * using hybrid search (BM25 + similarity) on captured screenshots from vector DB.
 *
 * Key Features:
 * - Ingest screenshots from Desktop-companion sessions
 * - Classify screenshots with workflow tags
 * - Hybrid search combining lexical (BM25) and semantic (vector) search
 * - Generate comprehensive workflow insights using LLM
 */

import type {
  HybridSearchQuery,
  IngestScreenshotsRequest,
  SearchResultItem,
  TriggerWorkflowAnalysisRequest,
  WorkflowAnalysisResult,
  WorkflowInsight,
  WorkflowScreenshot,
  WorkflowTagType,
} from '@journey/schema';
import { z } from 'zod';

import type { LLMProvider } from '../core/llm-provider.js';
import type { Logger } from '../core/logger.js';
import type { IWorkflowScreenshotRepository } from '../repositories/interfaces.js';
import type { EmbeddingService } from './interfaces/embedding.service.interface.js';
import type { EntityExtractionService } from './entity-extraction.service.js';
import type { ArangoDBGraphService } from './arangodb-graph.service.js';
import type { CrossSessionRetrievalService } from './cross-session-retrieval.service.js';
import type { ConceptEmbeddingRepository } from '../repositories/concept-embedding.repository.js';
import type { EntityEmbeddingRepository } from '../repositories/entity-embedding.repository.js';

/**
 * Head Analyst Prompt Schema
 * Defines the structured output for workflow analysis
 */
const WorkflowInsightSchema = z.object({
  type: z.enum([
    'pattern',
    'bottleneck',
    'efficiency_gain',
    'best_practice',
    'improvement_area',
    'time_distribution',
    'context_switch',
  ]),
  title: z.string().max(100),
  description: z.string().max(500),
  impact: z.enum(['high', 'medium', 'low']),
  confidence: z.number().min(0).max(1),
  supportingScreenshotIds: z.array(z.number()),
  recommendations: z.array(z.string().max(200)).optional(),
  metrics: z.record(z.any()).optional(),
});

const WorkflowAnalysisSchema = z.object({
  executiveSummary: z
    .string()
    .min(100)
    .max(1000)
    .describe('High-level executive summary of workflow patterns and productivity'),
  insights: z
    .array(WorkflowInsightSchema)
    .min(3)
    .max(10)
    .describe('Detailed workflow insights and patterns discovered'),
  recommendations: z
    .array(z.string().max(300))
    .min(3)
    .max(7)
    .describe('Actionable recommendations for workflow optimization'),
  keyMetrics: z
    .object({
      primaryWorkflowTag: z.string(),
      productiveHoursOfDay: z.array(z.number()).optional(),
      averageContextSwitchTime: z.number().optional(),
      deepWorkPercentage: z.number().optional(),
    })
    .describe('Key productivity metrics extracted from workflow data'),
});

export interface IWorkflowAnalysisService {
  /**
   * Ingest screenshots from a desktop session
   */
  ingestScreenshots(
    userId: number,
    request: IngestScreenshotsRequest
  ): Promise<{
    ingested: number;
    failed: number;
    screenshotIds: number[];
  }>;

  /**
   * Trigger workflow analysis for a node
   */
  triggerWorkflowAnalysis(
    userId: number,
    request: TriggerWorkflowAnalysisRequest
  ): Promise<WorkflowAnalysisResult>;

  /**
   * Hybrid search across workflow screenshots
   */
  hybridSearch(
    userId: number,
    query: HybridSearchQuery
  ): Promise<{
    results: SearchResultItem[];
    totalResults: number;
    executionTimeMs: number;
  }>;

  /**
   * Get workflow analysis for a node
   */
  getWorkflowAnalysis(
    userId: number,
    nodeId: string
  ): Promise<WorkflowAnalysisResult | null>;
}

export class WorkflowAnalysisService implements IWorkflowAnalysisService {
  private repository: IWorkflowScreenshotRepository;
  private embeddingService: EmbeddingService;
  private llmProvider: LLMProvider;
  private logger: Logger;

  // Graph RAG services (optional - graceful degradation if not available)
  private entityExtractionService?: EntityExtractionService;
  private graphService?: ArangoDBGraphService;
  private crossSessionRetrievalService?: CrossSessionRetrievalService;
  private conceptRepo?: ConceptEmbeddingRepository;
  private entityRepo?: EntityEmbeddingRepository;
  private enableGraphRAG: boolean;

  constructor({
    workflowScreenshotRepository,
    openAIEmbeddingService,
    llmProvider,
    logger,
    entityExtractionService,
    graphService,
    crossSessionRetrievalService,
    conceptRepo,
    entityRepo,
    enableGraphRAG = false,
  }: {
    workflowScreenshotRepository: IWorkflowScreenshotRepository;
    openAIEmbeddingService: EmbeddingService;
    llmProvider: LLMProvider;
    logger: Logger;
    entityExtractionService?: EntityExtractionService;
    graphService?: ArangoDBGraphService;
    crossSessionRetrievalService?: CrossSessionRetrievalService;
    conceptRepo?: ConceptEmbeddingRepository;
    entityRepo?: EntityEmbeddingRepository;
    enableGraphRAG?: boolean;
  }) {
    this.repository = workflowScreenshotRepository;
    this.embeddingService = openAIEmbeddingService;
    this.llmProvider = llmProvider;
    this.logger = logger;
    this.entityExtractionService = entityExtractionService;
    this.graphService = graphService;
    this.crossSessionRetrievalService = crossSessionRetrievalService;
    this.conceptRepo = conceptRepo;
    this.entityRepo = entityRepo;
    this.enableGraphRAG = enableGraphRAG && !!entityExtractionService && !!graphService;

    if (this.enableGraphRAG) {
      this.logger.info('Graph RAG integration enabled for workflow analysis');
    }
  }

  /**
   * Ingest screenshots from Desktop-companion session
   * Generates embeddings and workflow tags using Gemini Vision
   */
  async ingestScreenshots(
    userId: number,
    request: IngestScreenshotsRequest
  ): Promise<{
    ingested: number;
    failed: number;
    screenshotIds: number[];
  }> {
    const { sessionId, nodeId, screenshots } = request;
    const screenshotIds: number[] = [];
    let ingested = 0;
    let failed = 0;

    this.logger.info('Ingesting screenshots for workflow analysis', {
      userId,
      sessionId,
      nodeId,
      screenshotCount: screenshots.length,
    });

    // Batch process: prepare all texts for embedding first
    const screenshotData = screenshots.map((screenshot) => {
      const textForEmbedding =
        screenshot.summary ||
        JSON.stringify(screenshot.context || {}) ||
        'Screenshot capture';

      const workflowTag = this.classifyWorkflowTag(
        screenshot.summary,
        screenshot.context
      );

      return {
        screenshot,
        textForEmbedding,
        workflowTag,
      };
    });

    // Generate embeddings in batch (much more efficient than one-by-one)
    let embeddings: Float32Array[];
    try {
      const texts = screenshotData.map((d) => d.textForEmbedding);
      this.logger.info('Generating batch embeddings', {
        count: texts.length,
      });
      embeddings = await this.embeddingService.generateEmbeddings(texts);
      this.logger.info('Batch embeddings generated successfully', {
        count: embeddings.length,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error('Failed to generate batch embeddings',
        new Error(errorMessage + (errorStack ? `\n${errorStack}` : ''))
      );
      // If batch embedding fails completely, mark all as failed
      return {
        ingested: 0,
        failed: screenshots.length,
        screenshotIds: [],
      };
    }

    // Extract entities and concepts if Graph RAG is enabled
    let extractionResults: Array<{
      entities: Array<{ name: string; type: string; confidence: number; context?: string }>;
      concepts: Array<{ name: string; category: string; relevanceScore: number }>;
    }> = [];

    if (this.enableGraphRAG && this.entityExtractionService) {
      try {
        this.logger.info('Extracting entities and concepts from screenshots', {
          count: screenshotData.length,
        });

        const summaries = screenshotData.map((d) => d.screenshot.summary || '');
        extractionResults = await this.entityExtractionService.extractBatch(summaries);

        this.logger.info('Entity extraction completed', {
          extractedCount: extractionResults.length,
        });
      } catch (error) {
        this.logger.error('Failed to extract entities and concepts',
          error instanceof Error ? error : new Error(String(error))
        );
        // Continue without Graph RAG if extraction fails
      }
    }

    // Now insert screenshots with their embeddings
    for (let i = 0; i < screenshotData.length; i++) {
      const data = screenshotData[i];
      const embedding = embeddings[i];
      const extraction = extractionResults[i] || { entities: [], concepts: [] };

      try {
        // Create screenshot record
        const screenshotRecord = await this.repository.createScreenshot({
          userId,
          nodeId,
          sessionId,
          screenshotPath: data.screenshot.path,
          cloudUrl: data.screenshot.cloudUrl || null,
          timestamp: new Date(data.screenshot.timestamp),
          workflowTag: data.workflowTag,
          summary: data.screenshot.summary || null,
          analysis: null, // Will be populated during workflow analysis
          embedding,
          meta: data.screenshot.context || {},
        });

        screenshotIds.push(screenshotRecord.id);
        ingested++;

        // Store in ArangoDB graph if Graph RAG is enabled
        if (this.enableGraphRAG && this.graphService) {
          await this.ingestToGraph(
            userId,
            nodeId,
            sessionId,
            screenshotRecord.id,
            data,
            extraction
          );
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error('Failed to insert screenshot into database',
          new Error(`${errorMessage} (screenshot: ${data.screenshot.path})`)
        );
        failed++;
      }
    }

    // Store entity and concept embeddings if Graph RAG is enabled
    if (this.enableGraphRAG && extractionResults.length > 0) {
      await this.storeEntityConceptEmbeddings(extractionResults);
    }

    this.logger.info('Screenshot ingestion complete', {
      ingested,
      failed,
      total: screenshots.length,
    });

    return { ingested, failed, screenshotIds };
  }

  /**
   * Trigger comprehensive workflow analysis using Head Analyst AI
   */
  async triggerWorkflowAnalysis(
    userId: number,
    request: TriggerWorkflowAnalysisRequest
  ): Promise<WorkflowAnalysisResult> {
    const { nodeId, customPrompt } = request;
    const startTime = Date.now();

    this.logger.info('Triggering workflow analysis', { userId, nodeId });

    // Fetch all screenshots for this node
    const screenshots = await this.repository.getScreenshotsByNode(
      userId,
      nodeId
    );

    if (screenshots.length === 0) {
      throw new Error(
        'No screenshots found for this node. Please ensure work sessions have been pushed from the desktop app.'
      );
    }

    // Calculate workflow distribution
    const workflowDistribution = this.calculateWorkflowDistribution(screenshots);

    // Calculate metrics
    const metrics = this.calculateMetrics(screenshots);

    // Prepare data for LLM analysis
    const screenshotSummaries = screenshots.map((s) => ({
      id: s.id,
      timestamp: s.timestamp,
      workflowTag: s.workflowTag,
      summary: s.summary || 'No summary available',
      timeSinceLastScreenshot: 0, // Calculate in next step
    }));

    // Calculate time deltas for context switches
    for (let i = 1; i < screenshotSummaries.length; i++) {
      const prev = new Date(screenshots[i - 1].timestamp).getTime();
      const curr = new Date(screenshots[i].timestamp).getTime();
      screenshotSummaries[i].timeSinceLastScreenshot = (curr - prev) / 1000; // seconds
    }

    // Fetch cross-session context if Graph RAG is enabled
    let crossSessionContext = null;
    if (this.enableGraphRAG && this.crossSessionRetrievalService) {
      try {
        this.logger.info('Fetching cross-session context', { userId, nodeId });
        crossSessionContext = await this.crossSessionRetrievalService.retrieve({
          userId,
          nodeId: Number(nodeId),
          lookbackDays: 30,
          maxResults: 20,
          includeGraph: true,
          includeVectors: true,
        });
        this.logger.info('Cross-session context retrieved', {
          entities: crossSessionContext.entities.length,
          concepts: crossSessionContext.concepts.length,
          relatedSessions: crossSessionContext.relatedSessions.length,
        });
      } catch (error) {
        this.logger.error('Failed to fetch cross-session context',
          error instanceof Error ? error : new Error(String(error))
        );
        // Continue without cross-session context if fetch fails
      }
    }

    // Generate LLM-powered workflow analysis
    const llmAnalysis = await this.generateHeadAnalystReport(
      screenshotSummaries,
      workflowDistribution,
      metrics,
      customPrompt,
      crossSessionContext
    );

    // Store analysis for each screenshot if needed
    // This can be done asynchronously
    this.storeScreenshotAnalyses(screenshots, llmAnalysis.insights).catch(
      (error) => {
        this.logger.error('Failed to store screenshot analyses', { error });
      }
    );

    const executionTime = Date.now() - startTime;

    this.logger.info('Workflow analysis complete', {
      userId,
      nodeId,
      screenshotsAnalyzed: screenshots.length,
      insightsGenerated: llmAnalysis.insights.length,
      executionTimeMs: executionTime,
    });

    // Build final result
    const result: WorkflowAnalysisResult = {
      id: crypto.randomUUID(),
      nodeId,
      userId,
      executiveSummary: llmAnalysis.executiveSummary,
      insights: llmAnalysis.insights.map((insight) => ({
        id: crypto.randomUUID(),
        type: insight.type,
        title: insight.title,
        description: insight.description,
        impact: insight.impact,
        confidence: insight.confidence,
        supportingScreenshots: insight.supportingScreenshotIds, // Map field name
        recommendations: insight.recommendations,
        metrics: insight.metrics,
      })),
      workflowDistribution,
      metrics,
      recommendations: llmAnalysis.recommendations,
      analyzedAt: new Date().toISOString(),
      dataRangeStart: screenshots[0].timestamp,
      dataRangeEnd: screenshots[screenshots.length - 1].timestamp,
      screenshotsAnalyzed: screenshots.length,
    };

    return result;
  }

  /**
   * Hybrid search combining BM25 lexical search and vector similarity
   */
  async hybridSearch(
    userId: number,
    query: HybridSearchQuery
  ): Promise<{
    results: SearchResultItem[];
    totalResults: number;
    executionTimeMs: number;
  }> {
    const startTime = Date.now();

    // Generate query embedding for semantic search
    const queryEmbedding = await this.embeddingService.generateEmbedding(
      query.query
    );

    // Perform hybrid search through repository
    const results = await this.repository.hybridSearch({
      userId,
      queryText: query.query,
      queryEmbedding: new Float32Array(queryEmbedding),
      nodeId: query.nodeId,
      workflowTags: query.workflowTags,
      limit: query.limit,
      lexicalWeight: query.lexicalWeight || 0.5,
      similarityThreshold: query.similarityThreshold || 0.3,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
    });

    const executionTime = Date.now() - startTime;

    return {
      results: results.map((r) => ({
        screenshot: r.screenshot,
        score: r.score,
        lexicalScore: r.lexicalScore,
        semanticScore: r.semanticScore,
        highlightedText: r.highlightedText,
      })),
      totalResults: results.length,
      executionTimeMs: executionTime,
    };
  }

  /**
   * Get cached workflow analysis for a node
   */
  async getWorkflowAnalysis(
    userId: number,
    nodeId: string
  ): Promise<WorkflowAnalysisResult | null> {
    // For MVP, we'll regenerate on demand
    // In production, cache results in a separate table
    try {
      return await this.triggerWorkflowAnalysis(userId, {
        nodeId,
        forceReanalysis: false,
      });
    } catch (error) {
      this.logger.error('Failed to get workflow analysis', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        nodeId,
      });
      return null;
    }
  }

  /**
   * Generate Head Analyst report using LLM
   */
  private async generateHeadAnalystReport(
    screenshots: any[],
    workflowDistribution: any[],
    metrics: any,
    customPrompt?: string,
    crossSessionContext?: any
  ): Promise<z.infer<typeof WorkflowAnalysisSchema>> {
    // Build cross-session context section if available
    let crossSessionSection = '';
    if (crossSessionContext) {
      const topEntities = crossSessionContext.entities
        .slice(0, 10)
        .map((e: any) => `  - ${e.entityName} (${e.entityType}): used ${e.frequency} times${e.similarity ? `, similarity: ${e.similarity.toFixed(2)}` : ''}`)
        .join('\n');

      const topConcepts = crossSessionContext.concepts
        .slice(0, 10)
        .map((c: any) => `  - ${c.conceptName} (${c.category}): frequency ${c.frequency}${c.similarity ? `, similarity: ${c.similarity.toFixed(2)}` : ''}`)
        .join('\n');

      const recentSessions = crossSessionContext.relatedSessions
        .slice(0, 5)
        .map((s: any) => `  - ${s.workflowClassification} session: ${s.activityCount} activities`)
        .join('\n');

      const patterns = crossSessionContext.workflowPatterns
        .slice(0, 5)
        .map((p: any) => `  - ${p.transition}: ${p.frequency} times`)
        .join('\n');

      crossSessionSection = `

## Cross-Session Context (Last 30 days)

**Top Technologies & Tools:**
${topEntities || '  (None detected)'}

**Key Concepts & Activities:**
${topConcepts || '  (None detected)'}

**Recent Related Sessions:**
${recentSessions || '  (None found)'}

**Workflow Transition Patterns:**
${patterns || '  (None detected)'}

**Performance Metrics:**
- Graph query time: ${crossSessionContext.retrievalMetadata.graphQueryTimeMs}ms
- Vector query time: ${crossSessionContext.retrievalMetadata.vectorQueryTimeMs}ms
- Total results fused: ${crossSessionContext.retrievalMetadata.fusedResultCount}
`;
    }

    const basePrompt = `You are a Head Analyst conducting a fine-grained workflow analysis based on captured work session screenshots.

## Workflow Data

**Screenshot Timeline (${screenshots.length} screenshots):**
${screenshots
  .slice(0, 50)
  .map(
    (s, idx) =>
      `${idx + 1}. [${s.timestamp}] ${s.workflowTag} - ${s.summary} ${s.timeSinceLastScreenshot > 300 ? `(${Math.floor(s.timeSinceLastScreenshot / 60)}min gap)` : ''}`
  )
  .join('\n')}

**Workflow Distribution:**
${workflowDistribution.map((w) => `- ${w.tag}: ${w.count} screenshots (${w.percentage.toFixed(1)}%), ${Math.floor(w.totalDurationSeconds / 60)} minutes`).join('\n')}

**Key Metrics:**
- Total Screenshots: ${metrics.totalScreenshots}
- Total Sessions: ${metrics.totalSessions}
- Average Session Duration: ${Math.floor(metrics.averageSessionDurationSeconds / 60)} minutes
${metrics.contextSwitches ? `- Context Switches: ${metrics.contextSwitches}` : ''}
${crossSessionSection}
## Analysis Objectives

Conduct a comprehensive workflow analysis covering:

1. **Productivity Patterns**: Identify when and how the user is most productive
2. **Bottlenecks**: Detect workflow inefficiencies, delays, or friction points
3. **Context Switches**: Analyze task-switching behavior and impact
4. **Time Distribution**: Understand how time is allocated across different workflow types
5. **Best Practices**: Recognize effective workflow habits
6. **Improvement Areas**: Suggest specific, actionable optimizations
${crossSessionContext ? '\n7. **Skill Development**: Analyze technology usage trends and learning patterns across sessions\n8. **Workflow Evolution**: Identify changes in work patterns over time' : ''}

${customPrompt ? `\n## Custom Analysis Focus\n${customPrompt}\n` : ''}

## Instructions

- Be specific and data-driven in your insights
- Reference actual screenshot data and patterns
- Provide actionable recommendations
- Focus on fine-grained details, not generic advice
- Consider temporal patterns (time of day, sequence of activities)
- Identify both strengths and areas for improvement
${crossSessionContext ? '- Leverage cross-session context to provide longitudinal insights\n- Highlight technology trends and skill development areas' : ''}`;

    try {
      const response = await this.llmProvider.generateStructuredResponse(
        [
          {
            role: 'system',
            content:
              'You are an expert workflow analyst with deep expertise in productivity optimization, time management, and knowledge work efficiency. Provide detailed, data-driven insights based on observable patterns.',
          },
          {
            role: 'user',
            content: basePrompt,
          },
        ],
        WorkflowAnalysisSchema,
        {
          temperature: 0.3, // Lower temperature for more focused analysis
          maxTokens: 2000,
        }
      );

      return response.content;
    } catch (error) {
      this.logger.error('Failed to generate head analyst report', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Fallback response
      return {
        executiveSummary:
          'Workflow analysis encountered an error during LLM processing. Please try again or contact support.',
        insights: [
          {
            type: 'pattern',
            title: 'Analysis Error',
            description:
              'Unable to generate detailed insights due to processing error.',
            impact: 'low',
            confidence: 0,
            supportingScreenshotIds: [],
          },
        ],
        recommendations: [
          'Try re-running the analysis',
          'Ensure sufficient screenshot data is available',
        ],
        keyMetrics: {
          primaryWorkflowTag: workflowDistribution[0]?.tag || 'unknown',
        },
      };
    }
  }

  /**
   * Calculate workflow distribution by tag
   */
  private calculateWorkflowDistribution(
    screenshots: WorkflowScreenshot[]
  ): Array<{
    tag: WorkflowTagType;
    count: number;
    totalDurationSeconds: number;
    percentage: number;
  }> {
    const tagMap = new Map<
      string,
      { count: number; totalDurationSeconds: number }
    >();

    // Group by tag
    for (let i = 0; i < screenshots.length; i++) {
      const screenshot = screenshots[i];
      const tag = screenshot.workflowTag;

      if (!tagMap.has(tag)) {
        tagMap.set(tag, { count: 0, totalDurationSeconds: 0 });
      }

      const data = tagMap.get(tag)!;
      data.count++;

      // Estimate duration as time to next screenshot (5-second intervals from Desktop-companion)
      if (i < screenshots.length - 1) {
        const current = new Date(screenshot.timestamp).getTime();
        const next = new Date(screenshots[i + 1].timestamp).getTime();
        const durationSeconds = Math.min((next - current) / 1000, 600); // Cap at 10 minutes
        data.totalDurationSeconds += durationSeconds;
      }
    }

    const total = screenshots.length;
    const distribution = Array.from(tagMap.entries()).map(([tag, data]) => ({
      tag: tag as WorkflowTagType,
      count: data.count,
      totalDurationSeconds: data.totalDurationSeconds,
      percentage: (data.count / total) * 100,
    }));

    // Sort by count descending
    return distribution.sort((a, b) => b.count - a.count);
  }

  /**
   * Calculate workflow metrics
   */
  private calculateMetrics(screenshots: WorkflowScreenshot[]): {
    totalScreenshots: number;
    totalSessions: number;
    totalDurationSeconds: number;
    averageSessionDurationSeconds: number;
    mostProductiveHours?: number[];
    contextSwitches?: number;
  } {
    // Group screenshots by session ID
    const sessionMap = new Map<string, WorkflowScreenshot[]>();
    screenshots.forEach((s) => {
      if (!sessionMap.has(s.sessionId)) {
        sessionMap.set(s.sessionId, []);
      }
      sessionMap.get(s.sessionId)!.push(s);
    });

    // Calculate total duration by summing individual session durations
    let totalDuration = 0;
    for (const sessionScreenshots of sessionMap.values()) {
      if (sessionScreenshots.length === 0) continue;

      // Sort screenshots within this session by timestamp
      sessionScreenshots.sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      // Calculate session duration as: last screenshot - first screenshot
      const start = new Date(sessionScreenshots[0].timestamp).getTime();
      const end = new Date(
        sessionScreenshots[sessionScreenshots.length - 1].timestamp
      ).getTime();
      const sessionDurationSeconds = (end - start) / 1000;

      totalDuration += sessionDurationSeconds;
    }

    const totalSessions = sessionMap.size;
    const averageSessionDuration =
      totalSessions > 0 ? totalDuration / totalSessions : 0;

    // Calculate context switches (workflow tag changes)
    // Note: This needs to be calculated per session to be accurate
    let contextSwitches = 0;
    for (const sessionScreenshots of sessionMap.values()) {
      // Sort by timestamp
      const sorted = sessionScreenshots.sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].workflowTag !== sorted[i - 1].workflowTag) {
          contextSwitches++;
        }
      }
    }

    // Find most productive hours (based on screenshot frequency)
    const hourCounts = new Array(24).fill(0);
    screenshots.forEach((s) => {
      const hour = new Date(s.timestamp).getHours();
      hourCounts[hour]++;
    });

    const maxCount = Math.max(...hourCounts);
    const mostProductiveHours = hourCounts
      .map((count, hour) => (count === maxCount ? hour : -1))
      .filter((h) => h !== -1);

    return {
      totalScreenshots: screenshots.length,
      totalSessions,
      totalDurationSeconds: totalDuration,
      averageSessionDurationSeconds: averageSessionDuration,
      mostProductiveHours,
      contextSwitches,
    };
  }

  /**
   * Classify workflow tag based on summary and context
   * This is a simple heuristic classifier - can be enhanced with ML model
   */
  private classifyWorkflowTag(
    summary?: string,
    context?: Record<string, any>
  ): WorkflowTagType {
    const text = (summary || '').toLowerCase();
    const contextStr = JSON.stringify(context || {}).toLowerCase();

    // Check for coding patterns
    if (
      text.match(
        /\b(code|coding|programming|debug|git|github|vs code|cursor|ide)\b/i
      ) ||
      contextStr.includes('code')
    ) {
      if (text.match(/\b(debug|error|fix|bug)\b/i)) {
        return 'debugging';
      }
      if (text.match(/\b(review|pull request|pr)\b/i)) {
        return 'code_review';
      }
      return 'coding';
    }

    // Check for research patterns
    if (
      text.match(
        /\b(research|reading|article|paper|documentation|learning|study)\b/i
      )
    ) {
      return text.match(/\b(market|competitor|analysis)\b/i)
        ? 'market_analysis'
        : 'research';
    }

    // Check for documentation
    if (text.match(/\b(documentation|docs|writing|readme|wiki)\b/i)) {
      return 'documentation';
    }

    // Check for meetings
    if (
      text.match(/\b(meeting|zoom|teams|calendar|call|discussion)\b/i) ||
      contextStr.includes('zoom')
    ) {
      return 'meeting';
    }

    // Check for planning
    if (
      text.match(/\b(planning|plan|roadmap|strategy|brainstorm|design)\b/i)
    ) {
      return text.match(/\b(design|figma|sketch)\b/i) ? 'design' : 'planning';
    }

    // Check for testing
    if (text.match(/\b(test|testing|qa|quality assurance)\b/i)) {
      return 'testing';
    }

    // Check for deployment
    if (text.match(/\b(deploy|deployment|release|ci\/cd|production)\b/i)) {
      return 'deployment';
    }

    // Default to other
    return 'other';
  }

  /**
   * Store individual screenshot analyses
   */
  private async storeScreenshotAnalyses(
    screenshots: WorkflowScreenshot[],
    insights: WorkflowInsight[]
  ): Promise<void> {
    // For each insight, store analysis on relevant screenshots
    for (const insight of insights) {
      for (const screenshotId of insight.supportingScreenshots || []) {
        const screenshot = screenshots.find((s) => s.id === screenshotId);
        if (screenshot) {
          try {
            await this.repository.updateScreenshot(screenshotId, {
              analysis: `${insight.title}: ${insight.description}`,
            });
          } catch (error) {
            this.logger.warn('Failed to update screenshot analysis', {
              screenshotId,
              error,
            });
          }
        }
      }
    }
  }

  /**
   * Ingest screenshot data to ArangoDB graph
   */
  private async ingestToGraph(
    userId: number,
    nodeId: string,
    sessionId: string,
    screenshotId: number,
    data: any,
    extraction: {
      entities: Array<{ name: string; type: string; confidence: number; context?: string }>;
      concepts: Array<{ name: string; category: string; relevanceScore: number }>;
    }
  ): Promise<void> {
    if (!this.graphService) return;

    try {
      // Ensure user exists in graph
      await this.graphService.upsertUser(userId, {});

      // Ensure timeline node exists in graph
      await this.graphService.upsertTimelineNode(Number(nodeId), userId, {
        type: 'workflow_node',
        title: `Node ${nodeId}`,
      });

      // Upsert session in graph
      await this.graphService.upsertSession({
        externalId: sessionId,
        userId,
        nodeId: Number(nodeId),
        startTime: new Date(data.screenshot.timestamp),
        workflowClassification: {
          primary: data.workflowTag,
          confidence: 0.8,
        },
      });

      // Create activity node for this screenshot
      const activityKey = await this.graphService.upsertActivity({
        sessionKey: sessionId,
        screenshotExternalId: screenshotId,
        timestamp: new Date(data.screenshot.timestamp),
        workflowTag: data.workflowTag,
        summary: data.screenshot.summary || '',
        confidence: 0.8,
        metadata: data.screenshot.context || {},
      });

      // Create entity relationships
      for (const entity of extraction.entities) {
        if (entity.confidence >= 0.5) {
          // Only store high-confidence entities
          await this.graphService.createEntityRelationship({
            activityKey,
            entityName: entity.name,
            entityType: entity.type,
            confidence: entity.confidence,
            context: entity.context,
          });
        }
      }

      // Create concept relationships
      for (const concept of extraction.concepts) {
        if (concept.relevanceScore >= 0.5) {
          // Only store relevant concepts
          await this.graphService.createConceptRelationship({
            activityKey,
            conceptName: concept.name,
            category: concept.category,
            relevanceScore: concept.relevanceScore,
          });
        }
      }

      this.logger.debug('Ingested screenshot to graph', {
        screenshotId,
        entities: extraction.entities.length,
        concepts: extraction.concepts.length,
      });
    } catch (error) {
      this.logger.error('Failed to ingest screenshot to graph',
        error instanceof Error ? error : new Error(String(error))
      );
      // Don't fail the whole ingestion if graph write fails
    }
  }

  /**
   * Store entity and concept embeddings in PostgreSQL
   */
  private async storeEntityConceptEmbeddings(
    extractionResults: Array<{
      entities: Array<{ name: string; type: string; confidence: number; context?: string }>;
      concepts: Array<{ name: string; category: string; relevanceScore: number }>;
    }>
  ): Promise<void> {
    if (!this.entityRepo || !this.conceptRepo || !this.entityExtractionService) {
      return;
    }

    try {
      // Collect all unique entities
      const allEntities = new Map<string, { name: string; type: string }>();
      for (const result of extractionResults) {
        for (const entity of result.entities) {
          if (entity.confidence >= 0.5) {
            const key = `${entity.name}:${entity.type}`.toLowerCase();
            if (!allEntities.has(key)) {
              allEntities.set(key, { name: entity.name, type: entity.type });
            }
          }
        }
      }

      // Collect all unique concepts
      const allConcepts = new Map<string, { name: string; category: string }>();
      for (const result of extractionResults) {
        for (const concept of result.concepts) {
          if (concept.relevanceScore >= 0.5) {
            const key = concept.name.toLowerCase();
            if (!allConcepts.has(key)) {
              allConcepts.set(key, { name: concept.name, category: concept.category });
            }
          }
        }
      }

      // Generate embeddings for entities
      if (allEntities.size > 0) {
        const entityNames = Array.from(allEntities.values()).map((e) => e.name);
        const entityEmbeddings = await this.entityExtractionService.generateEmbeddings(
          entityNames
        );

        // Store entity embeddings
        const entityData = Array.from(allEntities.values()).map((entity, idx) => ({
          entityName: entity.name,
          entityType: entity.type,
          embedding: entityEmbeddings[idx],
        }));

        await this.entityRepo.upsertBatch(entityData);
        this.logger.info('Stored entity embeddings', { count: entityData.length });
      }

      // Generate embeddings for concepts
      if (allConcepts.size > 0) {
        const conceptNames = Array.from(allConcepts.values()).map((c) => c.name);
        const conceptEmbeddings = await this.entityExtractionService.generateEmbeddings(
          conceptNames
        );

        // Store concept embeddings
        const conceptData = Array.from(allConcepts.values()).map((concept, idx) => ({
          conceptName: concept.name,
          category: concept.category,
          embedding: conceptEmbeddings[idx],
          sourceType: 'extracted' as const,
        }));

        await this.conceptRepo.upsertBatch(conceptData);
        this.logger.info('Stored concept embeddings', { count: conceptData.length });
      }
    } catch (error) {
      this.logger.error('Failed to store entity/concept embeddings',
        error instanceof Error ? error : new Error(String(error))
      );
      // Don't fail the whole ingestion if embedding storage fails
    }
  }
}
