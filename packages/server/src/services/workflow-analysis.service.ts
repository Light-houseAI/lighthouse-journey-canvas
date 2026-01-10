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
  GetTopWorkflowsRequest,
  HybridSearchQuery,
  IngestScreenshotsRequest,
  SearchResultItem,
  TopWorkflowPattern,
  TopWorkflowsResult,
  TriggerWorkflowAnalysisRequest,
  WorkflowAnalysisResult,
  WorkflowInsight,
  WorkflowScreenshot,
  WorkflowTagType,
} from '@journey/schema';
import { z } from 'zod';
import { createTracer } from '../core/langfuse.js';

import type { LLMProvider } from '../core/llm-provider.js';
import type { Logger } from '../core/logger.js';
import type { IWorkflowScreenshotRepository } from '../repositories/interfaces.js';
import type { SessionMappingRepository } from '../repositories/session-mapping.repository.js';
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
    'repetitive_workflow',
    'app_usage',
    'bottleneck',
    'efficiency_gain',
    'best_practice',
    'improvement_area',
    'time_distribution',
    'context_switch',
  ]),
  title: z.string(),
  description: z.string(),
  impact: z.enum(['high', 'medium', 'low']),
  confidence: z.number(),
  supportingScreenshotIds: z.array(z.number()),
  recommendations: z.array(z.string()),
  timeSavedMinutes: z.number(),
  occurrenceCount: z.number(),
  percentageOfTime: z.number(),
});

const WorkflowAnalysisSchema = z.object({
  executiveSummary: z.string().describe('High-level executive summary of workflow patterns and productivity'),
  insights: z.array(WorkflowInsightSchema).describe('Detailed workflow insights and patterns discovered'),
  recommendations: z.array(z.string()).describe('Actionable recommendations for workflow optimization'),
  keyMetrics: z.object({
    primaryWorkflowTag: z.string(),
    productiveHoursOfDay: z.array(z.number()),
    averageContextSwitchTime: z.number(),
    deepWorkPercentage: z.number(),
  }).describe('Key productivity metrics extracted from workflow data'),
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
   * Repair orphaned screenshots by linking them to correct nodes via session mappings
   * Returns count of screenshots repaired
   */
  repairOrphanedScreenshots(userId: number): Promise<{
    repaired: number;
    sessionsMapped: string[];
    errors: string[];
  }>;

  /**
   * Backfill workflow screenshots from existing session summaries
   * Creates synthetic workflow data for sessions that were pushed before screenshot ingest was connected
   */
  backfillFromSessionSummaries(userId: number): Promise<{
    backfilled: number;
    sessionsProcessed: string[];
    errors: string[];
  }>;

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

  /**
   * Analyze and retrieve top/frequently repeated workflows
   * Uses hybrid search (Graph RAG + semantic + BM25) to identify patterns
   */
  analyzeTopWorkflows(
    userId: number,
    request: GetTopWorkflowsRequest
  ): Promise<TopWorkflowsResult>;
}

export class WorkflowAnalysisService implements IWorkflowAnalysisService {
  private repository: IWorkflowScreenshotRepository;
  private sessionMappingRepository?: SessionMappingRepository;
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
    sessionMappingRepository,
    openAIEmbeddingService,
    llmProvider,
    logger,
    entityExtractionService,
    arangoDBGraphService,
    crossSessionRetrievalService,
    conceptEmbeddingRepository,
    entityEmbeddingRepository,
  }: {
    workflowScreenshotRepository: IWorkflowScreenshotRepository;
    sessionMappingRepository?: SessionMappingRepository;
    openAIEmbeddingService: EmbeddingService;
    llmProvider: LLMProvider;
    logger: Logger;
    entityExtractionService?: EntityExtractionService;
    arangoDBGraphService?: ArangoDBGraphService;
    crossSessionRetrievalService?: CrossSessionRetrievalService;
    conceptEmbeddingRepository?: ConceptEmbeddingRepository;
    entityEmbeddingRepository?: EntityEmbeddingRepository;
  }) {
    this.repository = workflowScreenshotRepository;
    this.sessionMappingRepository = sessionMappingRepository;
    this.embeddingService = openAIEmbeddingService;
    this.llmProvider = llmProvider;
    this.logger = logger;
    this.entityExtractionService = entityExtractionService;
    this.graphService = arangoDBGraphService;
    this.crossSessionRetrievalService = crossSessionRetrievalService;
    this.conceptRepo = conceptEmbeddingRepository;
    this.entityRepo = entityEmbeddingRepository;
    // Auto-enable Graph RAG if all required services are available
    this.enableGraphRAG = !!entityExtractionService && !!arangoDBGraphService;

    // Log DI status at startup for debugging
    this.logger.warn('[GRAPH_RAG_STARTUP] Service injection status', {
      hasEntityExtractionService: !!entityExtractionService,
      hasArangoDBGraphService: !!arangoDBGraphService,
      hasCrossSessionRetrievalService: !!crossSessionRetrievalService,
      hasConceptEmbeddingRepository: !!conceptEmbeddingRepository,
      hasEntityEmbeddingRepository: !!entityEmbeddingRepository,
      hasSessionMappingRepository: !!sessionMappingRepository,
      enableGraphRAG: this.enableGraphRAG,
    });

    if (this.enableGraphRAG) {
      this.logger.info('Graph RAG integration enabled for workflow analysis');
    } else {
      this.logger.warn('[GRAPH_RAG_STARTUP] Graph RAG is DISABLED - missing required services');
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

    // Debug: Log incoming request data to understand summary field presence
    this.logger.warn('[INGEST_DEBUG] Raw request received', {
      userId,
      sessionId,
      nodeId,
      screenshotCount: screenshots.length,
      firstScreenshot: screenshots[0] ? {
        path: screenshots[0].path,
        hasSummary: !!screenshots[0].summary,
        summaryLength: screenshots[0].summary?.length || 0,
        summaryPreview: screenshots[0].summary?.substring(0, 100) || 'NO_SUMMARY',
        hasContext: !!screenshots[0].context,
        contextKeys: screenshots[0].context ? Object.keys(screenshots[0].context) : [],
      } : 'NO_SCREENSHOTS',
    });

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

    // Log Graph RAG configuration for debugging (using warn to ensure visibility)
    this.logger.warn('[GRAPH_RAG_DEBUG] Configuration status during ingestion', {
      enableGraphRAG: this.enableGraphRAG,
      hasEntityExtractionService: !!this.entityExtractionService,
      hasGraphService: !!this.graphService,
      screenshotCount: screenshotData.length,
    });

    if (this.enableGraphRAG && this.entityExtractionService) {
      try {
        this.logger.warn('[GRAPH_RAG_DEBUG] Starting entity extraction', {
          count: screenshotData.length,
        });

        // Use textForEmbedding which includes fallback to context if summary is empty
        // This matches what we use for embedding generation
        const summaries = screenshotData.map((d) => d.textForEmbedding);
        this.logger.warn('[GRAPH_RAG_DEBUG] Summaries to extract from', {
          summaryCount: summaries.length,
          sampleSummary: summaries[0]?.substring(0, 200) || 'empty',
          nonEmptySummaries: summaries.filter(s => s.length > 10).length,
        });

        extractionResults = await this.entityExtractionService.extractBatch(summaries);

        // Log detailed extraction results
        const totalEntities = extractionResults.reduce((sum, r) => sum + r.entities.length, 0);
        const totalConcepts = extractionResults.reduce((sum, r) => sum + r.concepts.length, 0);
        const highConfidenceEntities = extractionResults.reduce(
          (sum, r) => sum + r.entities.filter(e => e.confidence >= 0.5).length, 0
        );
        const highRelevanceConcepts = extractionResults.reduce(
          (sum, r) => sum + r.concepts.filter(c => c.relevanceScore >= 0.5).length, 0
        );

        this.logger.warn('[GRAPH_RAG_DEBUG] Entity extraction completed', {
          extractedCount: extractionResults.length,
          totalEntities,
          totalConcepts,
          highConfidenceEntities,
          highRelevanceConcepts,
          sampleEntities: extractionResults[0]?.entities?.slice(0, 3) || [],
          sampleConcepts: extractionResults[0]?.concepts?.slice(0, 3) || [],
        });

        this.logger.info('Entity extraction completed', {
          extractedCount: extractionResults.length,
        });
      } catch (error) {
        this.logger.warn('[GRAPH_RAG_DEBUG] Entity extraction FAILED',
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
          this.logger.info('[GRAPH_RAG_DEBUG] Calling ingestToGraph', {
            screenshotIndex: i,
            screenshotId: screenshotRecord.id,
            entityCount: extraction.entities.length,
            conceptCount: extraction.concepts.length,
          });
          await this.ingestToGraph(
            userId,
            nodeId,
            sessionId,
            screenshotRecord.id,
            data,
            extraction
          );
        } else {
          this.logger.warn('[GRAPH_RAG_DEBUG] Skipping graph ingestion', {
            enableGraphRAG: this.enableGraphRAG,
            hasGraphService: !!this.graphService,
            screenshotIndex: i,
          });
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

    // Create Langfuse trace for the entire workflow analysis
    const tracer = createTracer();
    const trace = tracer.startTrace({
      name: 'workflow-analysis',
      userId: String(userId),
      sessionId: nodeId,
      input: {
        nodeId,
        customPrompt: customPrompt || null,
        userId,
      },
      metadata: {
        nodeId,
        hasCustomPrompt: !!customPrompt,
      },
      tags: ['workflow-analysis', 'head-analyst'],
    });

    this.logger.info('Triggering workflow analysis', { userId, nodeId });

    // Fetch all screenshots for this node
    let screenshots = await this.repository.getScreenshotsByNode(
      userId,
      nodeId
    );

    // Fallback: If no screenshots found by nodeId, try to find via session mappings
    // This handles cases where screenshots were ingested before nodeId was assigned
    if (screenshots.length === 0 && this.sessionMappingRepository) {
      this.logger.info('No screenshots found by nodeId, attempting fallback via session mappings', { userId, nodeId });

      try {
        // Get all sessions mapped to this node
        const { sessions } = await this.sessionMappingRepository.getByNodeId(nodeId, { page: 1, limit: 100 });

        if (sessions.length > 0) {
          const sessionIds = sessions.map(s => s.desktopSessionId);
          this.logger.info('Found sessions for node, looking up screenshots by sessionIds', {
            nodeId,
            sessionCount: sessionIds.length,
            sessionIds: sessionIds.slice(0, 5), // Log first 5 for debugging
          });

          // Get screenshots by session IDs
          screenshots = await this.repository.getScreenshotsBySessionIds(userId, sessionIds);

          this.logger.info('Screenshots lookup by sessionIds result', {
            nodeId,
            sessionIds: sessionIds.slice(0, 3),
            screenshotsFound: screenshots.length,
          });

          // If no screenshots found, check if ANY screenshots exist for this user
          if (screenshots.length === 0) {
            const allScreenshots = await this.repository.getAllScreenshots(userId, { limit: 5 });
            this.logger.warn('No screenshots found by sessionIds. Checking if any screenshots exist for user', {
              userId,
              totalUserScreenshots: allScreenshots.length,
              sampleScreenshotSessionIds: allScreenshots.slice(0, 3).map(s => s.sessionId),
            });
          }

          // If we found screenshots, update their nodeId for future queries (repair on-the-fly)
          if (screenshots.length > 0) {
            this.logger.info('Found screenshots via session fallback, repairing nodeId linkage', {
              nodeId,
              screenshotCount: screenshots.length,
            });

            // Update screenshots to have correct nodeId (async, don't block)
            for (const sessionId of sessionIds) {
              this.repository.updateNodeIdBySessionId(sessionId, nodeId).catch(err => {
                this.logger.warn('Failed to repair nodeId for session', { sessionId, nodeId, error: err.message });
              });
            }
          }
        }
      } catch (fallbackError) {
        this.logger.warn('Session mapping fallback failed', {
          nodeId,
          error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
        });
      }
    }

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
      const crossSessionSpan = tracer.createSpan({
        name: 'fetch-cross-session-context',
        input: { lookbackDays: 30, maxResults: 20 },
      });
      try {
        this.logger.info('Fetching cross-session context', { userId, nodeId });
        crossSessionContext = await this.crossSessionRetrievalService.retrieve({
          userId,
          nodeId,
          lookbackDays: 30,
          maxResults: 20,
          includeGraph: true,
          includeVectors: true,
        });
        crossSessionSpan?.end({
          entities: crossSessionContext.entities.length,
          concepts: crossSessionContext.concepts.length,
          relatedSessions: crossSessionContext.relatedSessions.length,
        });
        this.logger.info('Cross-session context retrieved', {
          entities: crossSessionContext.entities.length,
          concepts: crossSessionContext.concepts.length,
          relatedSessions: crossSessionContext.relatedSessions.length,
        });
      } catch (error) {
        crossSessionSpan?.end({ error: error instanceof Error ? error.message : String(error) });
        this.logger.error('Failed to fetch cross-session context',
          error instanceof Error ? error : new Error(String(error))
        );
        // Continue without cross-session context if fetch fails
      }
    }

    // Generate LLM-powered workflow analysis
    const llmAnalysisSpan = tracer.createSpan({
      name: 'generate-head-analyst-report',
      input: {
        screenshotCount: screenshotSummaries.length,
        hasCustomPrompt: !!customPrompt,
        hasCrossSessionContext: !!crossSessionContext,
      },
    });
    const llmAnalysis = await this.generateHeadAnalystReport(
      screenshotSummaries,
      workflowDistribution,
      metrics,
      customPrompt,
      crossSessionContext
    );
    llmAnalysisSpan?.end({
      insightCount: llmAnalysis.insights.length,
      recommendationCount: llmAnalysis.recommendations.length,
    });

    // Map insights to WorkflowInsight format with proper field names
    const mappedInsights = llmAnalysis.insights.map((insight) => ({
      id: crypto.randomUUID(),
      type: insight.type,
      title: insight.title,
      description: insight.description,
      impact: insight.impact,
      confidence: insight.confidence,
      supportingScreenshots: insight.supportingScreenshotIds,
      recommendations: insight.recommendations,
      metrics: {
        timeSavedMinutes: insight.timeSavedMinutes,
        occurrenceCount: insight.occurrenceCount,
        percentageOfTime: insight.percentageOfTime,
      },
    }));

    // Store analysis for each screenshot if needed
    // This can be done asynchronously
    this.storeScreenshotAnalyses(screenshots, mappedInsights).catch(
      (error) => {
        this.logger.error('Failed to store screenshot analyses',
          error instanceof Error ? error : new Error(String(error))
        );
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

    // Build final result using already-mapped insights
    const result: WorkflowAnalysisResult = {
      id: crypto.randomUUID(),
      nodeId,
      userId,
      executiveSummary: llmAnalysis.executiveSummary,
      insights: mappedInsights,
      workflowDistribution,
      metrics,
      recommendations: llmAnalysis.recommendations,
      analyzedAt: new Date().toISOString(),
      dataRangeStart: screenshots[0].timestamp,
      dataRangeEnd: screenshots[screenshots.length - 1].timestamp,
      screenshotsAnalyzed: screenshots.length,
    };

    // End Langfuse trace with results - include meaningful output for observability
    tracer.endTrace({
      executiveSummary: llmAnalysis.executiveSummary,
      insightsCount: mappedInsights.length,
      insights: mappedInsights.slice(0, 5).map(i => ({ type: i.type, title: i.title, impact: i.impact })),
      recommendationsCount: llmAnalysis.recommendations.length,
      recommendations: llmAnalysis.recommendations.slice(0, 5),
      executionTimeMs: executionTime,
      screenshotsAnalyzed: screenshots.length,
      dataRange: {
        start: screenshots[0].timestamp,
        end: screenshots[screenshots.length - 1].timestamp,
      },
    });

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
    const tracer = createTracer();
    const trace = tracer.startTrace({
      name: 'hybrid-search',
      userId: String(userId),
      input: {
        query: query.query.slice(0, 200),
        nodeId: query.nodeId,
        limit: query.limit || 20,
        lexicalWeight: query.lexicalWeight || 0.5,
        similarityThreshold: query.similarityThreshold || 0.3,
      },
      metadata: {
        query: query.query.slice(0, 100),
        nodeId: query.nodeId,
        limit: query.limit,
        lexicalWeight: query.lexicalWeight || 0.5,
      },
      tags: ['hybrid-search', 'workflow-search'],
    });

    // Generate query embedding for semantic search
    const embeddingSpan = tracer.createSpan({
      name: 'generate-query-embedding',
      input: { queryLength: query.query.length },
    });
    const queryEmbedding = await this.embeddingService.generateEmbedding(
      query.query
    );
    embeddingSpan?.end({ embeddingDimensions: queryEmbedding.length });

    // Perform hybrid search through repository
    const searchSpan = tracer.createSpan({
      name: 'execute-hybrid-search',
      input: {
        lexicalWeight: query.lexicalWeight || 0.5,
        similarityThreshold: query.similarityThreshold || 0.3,
      },
    });
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
    searchSpan?.end({ resultCount: results.length });

    const executionTime = Date.now() - startTime;

    tracer.endTrace({
      success: true,
      resultCount: results.length,
      executionTimeMs: executionTime,
    });

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
      this.logger.error('Failed to get workflow analysis',
        error instanceof Error ? error : new Error(`Failed for user ${userId}, node ${nodeId}`)
      );
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
        .slice(0, 5)
        .map((e: any) => `  - ${e.entityName} (${e.entityType}): ${e.frequency}x`)
        .join('\n');

      const topConcepts = crossSessionContext.concepts
        .slice(0, 5)
        .map((c: any) => `  - ${c.conceptName}: ${c.frequency}x`)
        .join('\n');

      crossSessionSection = `

## Cross-Session Context

**Top Tools:** ${topEntities || 'None'}

**Top Concepts:** ${topConcepts || 'None'}
`;
    }

    // Build structured summary instead of listing all screenshots
    // This provides the LLM with aggregated, actionable data
    const structuredSummary = this.buildStructuredScreenshotSummary(screenshots, workflowDistribution);

    const basePrompt = `You are a Head Analyst conducting a fine-grained workflow analysis based on captured work session screenshots.

## Workflow Data Summary (${screenshots.length} screenshots analyzed)

${structuredSummary}

**Key Metrics:**
- Total Screenshots: ${metrics.totalScreenshots}
- Total Sessions: ${metrics.totalSessions}
- Average Session Duration: ${Math.floor(metrics.averageSessionDurationSeconds / 60)} minutes
${metrics.contextSwitches ? `- Context Switches: ${metrics.contextSwitches}` : ''}
${crossSessionSection}
## Analysis Objectives

Conduct a comprehensive workflow analysis covering:

1. **Productivity Patterns**: Identify when and how the user is most productive
2. **Repetitive Applications**: Identify which apps are used most frequently and detect repetitive workflows
3. **Common Step Sequences**: Detect recurring patterns in the user's workflow steps (e.g., "Search → Read → Code" or "Email → Browser → Documentation")
4. **Bottlenecks**: Detect workflow inefficiencies, delays, or friction points that waste time
5. **Context Switches**: Analyze task-switching behavior and calculate the cost of context switching
6. **Time Distribution**: Understand how time is allocated across different workflow types and apps
7. **Optimization Opportunities**: Identify specific actions to increase productivity (automation, keyboard shortcuts, workflow reordering, etc.)
8. **Best Practices**: Recognize effective workflow habits worth maintaining
9. **Improvement Areas**: Suggest specific, actionable optimizations with measurable impact
${crossSessionContext ? '\n10. **Skill Development**: Analyze technology usage trends and learning patterns across sessions\n11. **Workflow Evolution**: Identify changes in work patterns over time' : ''}

${customPrompt ? `\n## Custom Analysis Focus\n${customPrompt}\n` : ''}

## Instructions

- **Be specific and data-driven**: Reference exact apps, times, and sequences from the data
- **DO NOT include screenshot numbers in descriptions**: Never mention specific screenshot IDs or ranges (like "screenshots 67-70") in insight descriptions. Use the supportingScreenshotIds field for internal tracking only.
- **Identify repetitive patterns**: Highlight which apps/activities are repeated most and why
- **Calculate impact**: Estimate time saved/lost for each insight (e.g., "30 minutes/day lost to context switching")
- **Provide concrete actions**: Give specific, implementable recommendations (not generic advice)
  - Example: "Use keyboard shortcut Cmd+Tab instead of clicking between apps"
  - Example: "Batch email checking to 2 fixed times per day instead of constant switching"
  - Example: "Create a browser bookmark folder for frequently visited documentation sites"
- **Sequence analysis**: Identify common workflow sequences (A → B → C) and suggest optimizations
- **Time-of-day patterns**: Note when the user is most productive and suggest schedule optimizations
- **Tool recommendations**: Suggest specific automation tools, scripts, or workflows that could help
- **Measure everything**: Quantify time distribution, context switches, and potential savings
${crossSessionContext ? '- Leverage cross-session context to provide longitudinal insights\n- Highlight technology trends and skill development areas' : ''}`;

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      {
        role: 'system',
        content:
          'You are an expert workflow analyst with deep expertise in productivity optimization, time management, and knowledge work efficiency. Provide detailed, data-driven insights based on observable patterns. Always respond with valid JSON matching the requested schema.',
      },
      {
        role: 'user',
        content: basePrompt,
      },
    ];

    // Try structured generation first, then fall back to text generation + parsing
    const MAX_RETRIES = 2;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt === 0) {
          // First attempt: use structured generation
          const response = await this.llmProvider.generateStructuredResponse(
            messages,
            WorkflowAnalysisSchema,
            {
              temperature: 0.2, // Lower temperature for more consistent output
              maxTokens: 8000, // Increased to prevent truncation
            }
          );
          return response.content;
        } else {
          // Retry attempts: use text generation with explicit JSON instructions
          this.logger.info(`Retrying workflow analysis with text generation (attempt ${attempt + 1})`);

          const jsonSchemaHint = `
Respond with a JSON object matching this exact structure:
{
  "executiveSummary": "string - high-level summary",
  "insights": [
    {
      "type": "pattern" | "repetitive_workflow" | "app_usage" | "bottleneck" | "efficiency_gain" | "best_practice" | "improvement_area" | "time_distribution" | "context_switch",
      "title": "string",
      "description": "string",
      "impact": "high" | "medium" | "low",
      "confidence": number (0-1),
      "supportingScreenshotIds": [numbers],
      "recommendations": ["strings"],
      "timeSavedMinutes": number,
      "occurrenceCount": number,
      "percentageOfTime": number
    }
  ],
  "recommendations": ["strings"],
  "keyMetrics": {
    "primaryWorkflowTag": "string",
    "productiveHoursOfDay": [numbers],
    "averageContextSwitchTime": number,
    "deepWorkPercentage": number
  }
}

Return ONLY valid JSON, no markdown, no explanation.`;

          const textResponse = await this.llmProvider.generateText(
            [
              ...messages,
              { role: 'user', content: jsonSchemaHint },
            ],
            { temperature: 0.1, maxTokens: 8000 }
          );

          // Extract JSON from response (handle potential markdown code blocks)
          let jsonText = textResponse.content.trim();
          if (jsonText.startsWith('```json')) {
            jsonText = jsonText.slice(7);
          } else if (jsonText.startsWith('```')) {
            jsonText = jsonText.slice(3);
          }
          if (jsonText.endsWith('```')) {
            jsonText = jsonText.slice(0, -3);
          }
          jsonText = jsonText.trim();

          const parsed = JSON.parse(jsonText);
          const validated = WorkflowAnalysisSchema.parse(parsed);
          return validated;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.logger.warn(`Workflow analysis attempt ${attempt + 1} failed`, {
          error: lastError.message,
          willRetry: attempt < MAX_RETRIES,
        });

        // Add small delay before retry
        if (attempt < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    }

    this.logger.error('Failed to generate head analyst report after all retries',
      lastError || new Error('Unknown error')
    );

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
            recommendations: ['Try re-running the analysis'],
            timeSavedMinutes: 0,
            occurrenceCount: 0,
            percentageOfTime: 0,
          },
        ],
        recommendations: [
          'Try re-running the analysis',
          'Ensure sufficient screenshot data is available',
        ],
        keyMetrics: {
          primaryWorkflowTag: workflowDistribution[0]?.tag || 'unknown',
          productiveHoursOfDay: [],
          averageContextSwitchTime: 0,
          deepWorkPercentage: 0,
        },
      };
  }

  /**
   * Build a structured summary of screenshots for LLM analysis
   * Instead of listing all screenshots, aggregate into meaningful patterns
   */
  private buildStructuredScreenshotSummary(
    screenshots: any[],
    workflowDistribution: Array<{ tag: string; count: number; percentage: number; totalDurationSeconds: number }>
  ): string {
    if (screenshots.length === 0) {
      return 'No screenshots available for analysis.';
    }

    // 1. App usage frequency - try multiple possible field names from meta/context
    const appUsage = new Map<string, { count: number; summaries: string[] }>();
    for (const s of screenshots) {
      // Try multiple possible field names for app identification
      let app =
        s.meta?.activeApp ||
        s.meta?.app ||
        s.meta?.appName ||
        s.meta?.application ||
        s.meta?.bundleId ||
        s.meta?.windowTitle?.split(' - ').pop()?.trim() ||  // Extract app from window title
        s.meta?.title?.split(' - ').pop()?.trim() ||
        this.extractAppFromSummary(s.summary) ||
        'Unknown';

      // Clean up app name
      if (app && app !== 'Unknown') {
        app = app.replace(/\.app$/i, '').trim();
      }

      if (!appUsage.has(app)) {
        appUsage.set(app, { count: 0, summaries: [] });
      }
      const data = appUsage.get(app)!;
      data.count++;
      if (data.summaries.length < 3 && s.summary) {
        data.summaries.push(s.summary.slice(0, 100));
      }
    }

    // 2. Detect workflow sequences (transitions between tags)
    const transitions = new Map<string, number>();
    for (let i = 1; i < screenshots.length; i++) {
      const prev = screenshots[i - 1].workflowTag;
      const curr = screenshots[i].workflowTag;
      if (prev !== curr) {
        const key = `${prev} → ${curr}`;
        transitions.set(key, (transitions.get(key) || 0) + 1);
      }
    }

    // 3. Identify time gaps (potential breaks or deep work sessions)
    const gaps: Array<{ duration: number; before: string; after: string }> = [];
    for (let i = 1; i < screenshots.length; i++) {
      const timeDiff = screenshots[i].timeSinceLastScreenshot || 0;
      if (timeDiff > 300) { // 5+ minute gap
        gaps.push({
          duration: Math.floor(timeDiff / 60),
          before: screenshots[i - 1].workflowTag,
          after: screenshots[i].workflowTag,
        });
      }
    }

    // 4. Sample representative activities (first, middle, last)
    const sampleActivities: string[] = [];
    const sampleIndices = [
      0,
      Math.floor(screenshots.length * 0.25),
      Math.floor(screenshots.length * 0.5),
      Math.floor(screenshots.length * 0.75),
      screenshots.length - 1,
    ];
    for (const idx of sampleIndices) {
      if (idx >= 0 && idx < screenshots.length) {
        const s = screenshots[idx];
        sampleActivities.push(`[${s.workflowTag}] ${s.summary?.slice(0, 80) || 'No summary'}`);
      }
    }

    // Build the structured output
    const sections: string[] = [];

    // App usage section
    const topApps = Array.from(appUsage.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10);
    sections.push('### Top Applications Used');
    for (const [app, data] of topApps) {
      const pct = ((data.count / screenshots.length) * 100).toFixed(1);
      sections.push(`- **${app}**: ${data.count} screenshots (${pct}%)`);
      if (data.summaries.length > 0) {
        sections.push(`  - Examples: ${data.summaries.slice(0, 2).join('; ')}`);
      }
    }

    // Workflow transitions
    const topTransitions = Array.from(transitions.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
    if (topTransitions.length > 0) {
      sections.push('\n### Common Workflow Transitions');
      for (const [transition, count] of topTransitions) {
        sections.push(`- ${transition}: ${count}x`);
      }
    }

    // Time gaps
    if (gaps.length > 0) {
      sections.push('\n### Notable Time Gaps');
      const topGaps = gaps.sort((a, b) => b.duration - a.duration).slice(0, 5);
      for (const gap of topGaps) {
        sections.push(`- ${gap.duration} min gap (${gap.before} → ${gap.after})`);
      }
    }

    // Sample activities
    sections.push('\n### Representative Activity Samples');
    for (const activity of sampleActivities) {
      sections.push(`- ${activity}`);
    }

    // Workflow distribution (already passed in, but format nicely)
    sections.push('\n### Time Distribution by Workflow Type');
    for (const w of workflowDistribution.slice(0, 8)) {
      const mins = Math.floor(w.totalDurationSeconds / 60);
      sections.push(`- **${w.tag}**: ${w.count} activities (${w.percentage.toFixed(1)}%), ~${mins} min`);
    }

    return sections.join('\n');
  }

  /**
   * Extract app name from screenshot summary text
   * Common patterns: "User is working in [App]", "Viewing [App]", "[App] - document"
   */
  private extractAppFromSummary(summary: string | null | undefined): string | null {
    if (!summary) return null;

    // Known apps to look for - organized by category for maintainability
    // Note: Arc browser removed as user doesn't use it
    const knownApps: Record<string, string[]> = {
      // Browsers (most common)
      browsers: ['Chrome', 'Safari', 'Firefox', 'Edge', 'Brave', 'Opera', 'Vivaldi'],

      // Code editors & IDEs
      editors: [
        'VS Code', 'VSCode', 'Visual Studio Code', 'Cursor', 'Sublime Text', 'Atom',
        'WebStorm', 'IntelliJ', 'PyCharm', 'PhpStorm', 'RubyMine', 'GoLand', 'CLion',
        'Android Studio', 'Xcode', 'Neovim', 'Vim', 'Emacs', 'Nova', 'Zed',
      ],

      // Terminal apps
      terminals: ['Terminal', 'iTerm', 'iTerm2', 'Warp', 'Hyper', 'Alacritty', 'Kitty', 'WezTerm'],

      // Communication
      communication: [
        'Slack', 'Discord', 'Teams', 'Microsoft Teams', 'Zoom', 'Meet', 'Google Meet',
        'Webex', 'Skype', 'Telegram', 'WhatsApp', 'Messages', 'Signal',
      ],

      // Productivity & Notes
      productivity: [
        'Notion', 'Obsidian', 'Evernote', 'Notes', 'Apple Notes', 'Bear', 'Craft',
        'Roam', 'Logseq', 'Reflect', 'Capacities', 'Mem', 'Coda', 'Airtable',
      ],

      // Design
      design: [
        'Figma', 'Sketch', 'Adobe XD', 'Photoshop', 'Illustrator', 'InDesign',
        'Affinity Designer', 'Canva', 'Framer', 'Principle', 'ProtoPie',
      ],

      // Office & Documents
      office: [
        'Excel', 'Word', 'PowerPoint', 'Google Sheets', 'Google Docs', 'Google Slides',
        'Numbers', 'Pages', 'Keynote', 'LibreOffice',
      ],

      // File management
      fileManagers: ['Finder', 'Explorer', 'Files', 'Path Finder', 'Forklift'],

      // Email
      email: ['Mail', 'Gmail', 'Outlook', 'Spark', 'Superhuman', 'Mailspring', 'Thunderbird'],

      // Dev tools
      devTools: [
        'GitHub', 'GitLab', 'Bitbucket', 'GitHub Desktop', 'GitKraken', 'Sourcetree', 'Tower',
        'Postman', 'Insomnia', 'HTTPie', 'Paw', 'Bruno',
        'Docker', 'Docker Desktop', 'Podman',
        'TablePlus', 'DBeaver', 'DataGrip', 'Sequel Pro', 'Postico',
        'Redis', 'MongoDB Compass',
      ],

      // Project management
      projectManagement: ['Linear', 'Jira', 'Asana', 'Trello', 'ClickUp', 'Monday', 'Basecamp', 'Height'],

      // Media
      media: ['Spotify', 'Music', 'Apple Music', 'YouTube', 'VLC', 'IINA'],

      // API & Cloud
      cloud: ['AWS Console', 'Vercel', 'Netlify', 'Railway', 'Render', 'Fly.io', 'Supabase', 'Firebase'],

      // AI Tools
      ai: ['ChatGPT', 'Claude', 'Copilot', 'Cody', 'Tabnine'],
    };

    const lowerSummary = summary.toLowerCase();

    // Flatten and search through all known apps
    for (const category of Object.values(knownApps)) {
      for (const app of category) {
        if (lowerSummary.includes(app.toLowerCase())) {
          return app;
        }
      }
    }

    // Try to extract from common patterns in summaries
    const patterns = [
      // "User is working in VS Code" or "working on Chrome"
      /(?:working\s+(?:in|on|with)|using|opened?|viewing|browsing\s+(?:in)?)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z]?[a-zA-Z]+)?)/i,
      // "VS Code window" or "Chrome browser"
      /([A-Z][a-zA-Z]+(?:\s+[A-Z]?[a-zA-Z]+)?)\s+(?:window|app|application|browser|editor|ide)/i,
      // "[App] - Some Title" pattern (common in window titles)
      /^([A-Z][a-zA-Z]+(?:\s+[A-Z]?[a-zA-Z]+)?)\s*[-–—]\s*/i,
      // "Some Title - [App]" pattern (also common)
      /\s*[-–—]\s*([A-Z][a-zA-Z]+(?:\s+[A-Z]?[a-zA-Z]+)?)$/i,
    ];

    for (const pattern of patterns) {
      const match = summary.match(pattern);
      if (match && match[1]) {
        const extracted = match[1].trim();
        // Validate it's not a common word
        const commonWords = ['user', 'the', 'and', 'with', 'for', 'new', 'file', 'open', 'save', 'edit', 'view', 'help'];
        if (extracted.length > 2 && !commonWords.includes(extracted.toLowerCase())) {
          return extracted;
        }
      }
    }

    return null;
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
   * Enhanced heuristic classifier with broader pattern matching
   */
  private classifyWorkflowTag(
    summary?: string,
    context?: Record<string, any>
  ): WorkflowTagType {
    const text = (summary || '').toLowerCase();
    const contextStr = JSON.stringify(context || {}).toLowerCase();
    const combined = `${text} ${contextStr}`;

    // Priority order matters - more specific patterns first

    // 1. Debugging - check first as it's a specific coding activity
    if (
      combined.match(/\b(debug|debugger|breakpoint|stack\s*trace|exception|error\s*log|fix\s*bug|bug\s*fix|troubleshoot|inspect\s*element|devtools|console\s*error)\b/i)
    ) {
      return 'debugging';
    }

    // 2. Code Review - check before general coding
    if (
      combined.match(/\b(code\s*review|pull\s*request|pr\s*review|merge\s*request|reviewing\s*code|review\s*changes|diff\s*view|approve|request\s*changes)\b/i)
    ) {
      return 'code_review';
    }

    // 3. Testing
    if (
      combined.match(/\b(test|testing|unit\s*test|integration\s*test|e2e|end-to-end|jest|mocha|pytest|spec\s*file|test\s*case|qa|quality\s*assurance|cypress|playwright|vitest)\b/i)
    ) {
      return 'testing';
    }

    // 4. Deployment
    if (
      combined.match(/\b(deploy|deployment|deploying|release|releasing|ci\/cd|cicd|pipeline|production|staging|vercel|netlify|heroku|aws|docker|kubernetes|k8s|container|build\s*process)\b/i)
    ) {
      return 'deployment';
    }

    // 5. Coding - broad patterns for development work
    if (
      combined.match(/\b(code|coding|programming|developer|vs\s*code|vscode|cursor|sublime|intellij|webstorm|pycharm|neovim|vim|emacs|ide|editor|function|variable|class|component|module|import|export|syntax|compile|typescript|javascript|python|react|vue|angular|node|npm|yarn|pnpm|git\s*commit|git\s*push|git\s*pull|branch|merge|repository)\b/i) ||
      combined.match(/\.(ts|tsx|js|jsx|py|java|go|rs|cpp|c|rb|php|swift|kt)$/i)
    ) {
      return 'coding';
    }

    // 6. Design
    if (
      combined.match(/\b(design|designing|figma|sketch|adobe\s*xd|photoshop|illustrator|canva|ui\/ux|user\s*interface|mockup|wireframe|prototype|layout|visual|graphic|color\s*palette|typography)\b/i)
    ) {
      return 'design';
    }

    // 7. Meeting/Communication
    if (
      combined.match(/\b(meeting|zoom|google\s*meet|teams|webex|slack\s*call|huddle|video\s*call|conference|standup|stand-up|sync|1:1|one-on-one|discussion|presenting|presentation)\b/i)
    ) {
      return 'meeting';
    }

    // 8. Communication (async)
    if (
      combined.match(/\b(email|gmail|outlook|inbox|compose|reply|slack\s*message|discord|messaging|chat|dm|direct\s*message|thread|mention|notification)\b/i)
    ) {
      return 'communication';
    }

    // 9. Documentation/Writing
    if (
      combined.match(/\b(documentation|documenting|readme|wiki|confluence|notion\s*doc|writing\s*doc|api\s*doc|jsdoc|docstring|markdown|md\s*file|technical\s*writing)\b/i)
    ) {
      return 'documentation';
    }

    // 10. Writing (general)
    if (
      combined.match(/\b(writing|composing|drafting|editing\s*text|blog|article|post|content\s*creation|copywriting|notes|note-taking)\b/i)
    ) {
      return 'writing';
    }

    // 11. Research/Learning
    if (
      combined.match(/\b(research|researching|google|searching|search\s*results|stackoverflow|stack\s*overflow|reading|article|blog\s*post|tutorial|docs|documentation|api\s*reference|mdn|w3schools|devdocs|exploring|investigating)\b/i)
    ) {
      return 'research';
    }

    // 12. Learning (explicit)
    if (
      combined.match(/\b(learning|studying|course|tutorial|lesson|udemy|coursera|pluralsight|egghead|frontendmasters|youtube\s*tutorial|educational|training)\b/i)
    ) {
      return 'learning';
    }

    // 13. Planning
    if (
      combined.match(/\b(planning|plan|roadmap|strategy|brainstorm|whiteboard|miro|figjam|mind\s*map|outline|architecture|system\s*design|sprint|backlog|jira|linear|asana|trello|project\s*management|task\s*management|todo|to-do)\b/i)
    ) {
      return 'planning';
    }

    // 14. Market Analysis
    if (
      combined.match(/\b(market|competitor|analysis|analytics|metrics|dashboard|data\s*analysis|insights|trends|statistics|charts|graphs|tableau|looker|mixpanel|amplitude|google\s*analytics)\b/i)
    ) {
      return 'market_analysis';
    }

    // 15. Analysis (general)
    if (
      combined.match(/\b(analyzing|analysis|examine|evaluate|review\s*data|inspect|audit|performance|profiling|benchmark)\b/i)
    ) {
      return 'analysis';
    }

    // 16. Browser activity fallback - try to classify based on common website patterns
    if (combined.match(/\b(github|gitlab|bitbucket)\b/i)) {
      // Could be coding, code review, or research - check more context
      if (combined.match(/\b(pull|pr|merge|review)\b/i)) return 'code_review';
      if (combined.match(/\b(issue|bug|feature)\b/i)) return 'planning';
      return 'coding';
    }

    if (combined.match(/\b(stackoverflow|stack\s*overflow|reddit\s*programming|dev\.to|medium\s*tech|hacker\s*news)\b/i)) {
      return 'research';
    }

    if (combined.match(/\b(youtube|vimeo|video)\b/i)) {
      if (combined.match(/\b(tutorial|learn|course|how\s*to)\b/i)) return 'learning';
      return 'research';
    }

    if (combined.match(/\b(twitter|x\.com|linkedin|facebook|instagram|social\s*media)\b/i)) {
      return 'communication';
    }

    // 17. File/folder browsing patterns
    if (combined.match(/\b(finder|explorer|files|folder|directory|browsing\s*files|file\s*manager)\b/i)) {
      return 'planning'; // Usually organizing or looking for something
    }

    // 18. Terminal/CLI activity
    if (combined.match(/\b(terminal|command\s*line|cli|bash|zsh|shell|iterm|warp|powershell)\b/i)) {
      // Terminal could be many things - try to detect what
      if (combined.match(/\b(npm\s*run|yarn|pnpm|make|build)\b/i)) return 'deployment';
      if (combined.match(/\b(git|commit|push|pull|branch)\b/i)) return 'coding';
      if (combined.match(/\b(test|jest|pytest|mocha)\b/i)) return 'testing';
      return 'coding'; // Default terminal to coding
    }

    // Default - if we really can't classify, return 'other'
    // But try to reduce this by being more inclusive above
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
    if (!this.graphService) {
      this.logger.warn('[GRAPH_RAG_DEBUG] ingestToGraph called but graphService is null');
      return;
    }

    this.logger.info('[GRAPH_RAG_DEBUG] Starting graph ingestion for screenshot', {
      userId,
      nodeId,
      sessionId,
      screenshotId,
      entityCount: extraction.entities.length,
      conceptCount: extraction.concepts.length,
      highConfidenceEntities: extraction.entities.filter(e => e.confidence >= 0.5).length,
      highRelevanceConcepts: extraction.concepts.filter(c => c.relevanceScore >= 0.5).length,
    });

    try {
      // Ensure user exists in graph
      const userKey = await this.graphService.upsertUser(userId, {});
      this.logger.info('[GRAPH_RAG_DEBUG] Upserted user', { userId, userKey });

      // Ensure timeline node exists in graph
      const timelineNodeKey = await this.graphService.upsertTimelineNode(nodeId, userId, {
        type: 'workflow_node',
        title: `Node ${nodeId}`,
      });
      this.logger.info('[GRAPH_RAG_DEBUG] Upserted timeline node', { nodeId, timelineNodeKey });

      // Upsert session in graph
      const sessionKey = await this.graphService.upsertSession({
        externalId: sessionId,
        userId,
        nodeId,
        startTime: new Date(data.screenshot.timestamp),
        workflowClassification: {
          primary: data.workflowTag,
          confidence: 0.8,
        },
      });
      this.logger.info('[GRAPH_RAG_DEBUG] Upserted session', { sessionId, sessionKey });

      // Create activity node for this screenshot
      // IMPORTANT: Use sessionKey (the ArangoDB _key like "session_abc123") not sessionId (raw "abc123")
      // This ensures getCrossSessionContext query can match activity.session_key == session._key
      const activityKey = await this.graphService.upsertActivity({
        sessionKey: sessionKey,
        screenshotExternalId: screenshotId,
        timestamp: new Date(data.screenshot.timestamp),
        workflowTag: data.workflowTag,
        summary: data.screenshot.summary || '',
        confidence: 0.8,
        metadata: data.screenshot.context || {},
      });
      this.logger.info('[GRAPH_RAG_DEBUG] Upserted activity', { screenshotId, activityKey });

      // Create entity relationships
      let entitiesStored = 0;
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
          entitiesStored++;
        }
      }
      if (entitiesStored > 0) {
        this.logger.info('[GRAPH_RAG_DEBUG] Created entity relationships', {
          screenshotId,
          entitiesStored,
          totalEntities: extraction.entities.length,
        });
      }

      // Create concept relationships
      let conceptsStored = 0;
      for (const concept of extraction.concepts) {
        if (concept.relevanceScore >= 0.5) {
          // Only store relevant concepts
          await this.graphService.createConceptRelationship({
            activityKey,
            conceptName: concept.name,
            category: concept.category,
            relevanceScore: concept.relevanceScore,
          });
          conceptsStored++;
        }
      }
      if (conceptsStored > 0) {
        this.logger.info('[GRAPH_RAG_DEBUG] Created concept relationships', {
          screenshotId,
          conceptsStored,
          totalConcepts: extraction.concepts.length,
        });
      }

      const storedEntities = extraction.entities.filter(e => e.confidence >= 0.5).length;
      const storedConcepts = extraction.concepts.filter(c => c.relevanceScore >= 0.5).length;

      this.logger.info('Ingested screenshot to graph', {
        screenshotId,
        totalEntities: extraction.entities.length,
        storedEntities,
        totalConcepts: extraction.concepts.length,
        storedConcepts,
        skippedLowConfidenceEntities: extraction.entities.length - storedEntities,
        skippedLowRelevanceConcepts: extraction.concepts.length - storedConcepts,
      });
    } catch (error) {
      this.logger.error('Failed to ingest screenshot to graph',
        error instanceof Error ? error : new Error(String(error))
      );
      // Don't fail the whole ingestion if graph write fails
    }
  }

  /**
   * Analyze and retrieve top/frequently repeated workflows
   * Uses hybrid search combining Graph RAG, semantic similarity, and BM25
   */
  async analyzeTopWorkflows(
    userId: number,
    request: GetTopWorkflowsRequest
  ): Promise<TopWorkflowsResult> {
    const startTime = Date.now();
    const {
      nodeId,
      limit = 5,
      minOccurrences = 2,
      lookbackDays = 30,
      includeGraphRAG = true,
    } = request;

    const tracer = createTracer();
    const trace = tracer.startTrace({
      name: 'analyze-top-workflows',
      userId: String(userId),
      input: {
        nodeId,
        limit,
        minOccurrences,
        lookbackDays,
        includeGraphRAG,
      },
      metadata: {
        nodeId,
        limit,
        minOccurrences,
        lookbackDays,
        includeGraphRAG,
      },
      tags: ['top-workflows', 'pattern-detection'],
    });

    this.logger.info('Analyzing top workflows', {
      userId,
      nodeId,
      limit,
      minOccurrences,
      lookbackDays,
      includeGraphRAG,
    });

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - lookbackDays);

    // Get workflow sequences from repository
    const sequences = await this.repository.getWorkflowSequences(userId, {
      nodeId,
      minOccurrences,
      lookbackDays,
      limit: limit * 2, // Get more to allow for filtering
    });

    // Get all screenshots for additional context
    const screenshots = await this.repository.getAllScreenshots(userId, {
      nodeId,
      startDate,
      endDate,
      limit: 1000, // Reasonable limit for analysis
    });

    // Sort screenshots by timestamp for proper sequence analysis
    screenshots.sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Enrich sequences with Graph RAG data if enabled
    let graphRAGUsed = false;
    let crossSessionContext: any = null;

    // Only retrieve cross-session context if we have a nodeId (required by the service)
    if (includeGraphRAG && this.enableGraphRAG && this.crossSessionRetrievalService && nodeId) {
      try {
        crossSessionContext = await this.crossSessionRetrievalService.retrieve({
          userId,
          nodeId,
          lookbackDays,
          maxResults: 20,
          includeGraph: true,
          includeVectors: true,
        });
        graphRAGUsed = true;
        this.logger.info('Retrieved Graph RAG context for top workflows', {
          entities: crossSessionContext.entities?.length || 0,
          concepts: crossSessionContext.concepts?.length || 0,
        });
      } catch (error) {
        this.logger.warn('Failed to retrieve Graph RAG context', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Generate LLM-powered workflow pattern analysis
    const patterns = await this.generateTopWorkflowPatterns(
      sequences,
      screenshots,
      crossSessionContext,
      limit
    );

    const executionTime = Date.now() - startTime;

    this.logger.info('Top workflow analysis complete', {
      userId,
      nodeId,
      patternsFound: patterns.length,
      executionTimeMs: executionTime,
    });

    tracer.endTrace({
      success: true,
      patternsFound: patterns.length,
      sequencesFound: sequences.length,
      screenshotsAnalyzed: screenshots.length,
      graphRAGUsed,
      executionTimeMs: executionTime,
    });

    return {
      id: crypto.randomUUID(),
      userId,
      nodeId,
      patterns,
      totalScreenshotsAnalyzed: screenshots.length,
      uniqueSequencesFound: sequences.length,
      analyzedAt: new Date().toISOString(),
      dataRangeStart: startDate.toISOString(),
      dataRangeEnd: endDate.toISOString(),
      searchStrategy: {
        graphRAGUsed,
        semanticSearchUsed: true,
        bm25SearchUsed: true,
        hybridWeight: 0.5,
      },
    };
  }

  /**
   * Generate top workflow patterns using LLM analysis
   */
  private async generateTopWorkflowPatterns(
    sequences: Array<{
      sequence: WorkflowTagType[];
      occurrenceCount: number;
      avgDurationSeconds: number;
      sampleScreenshotIds: number[];
      sessions: string[];
    }>,
    screenshots: WorkflowScreenshot[],
    crossSessionContext: any,
    limit: number
  ): Promise<TopWorkflowPattern[]> {
    if (sequences.length === 0) {
      return [];
    }

    // Build context for LLM
    const sequenceDescriptions = sequences.slice(0, limit).map((seq, idx) => {
      const stepDescriptions = seq.sequence.map((tag, stepIdx) => {
        // Find sample screenshots for this tag
        const sampleScreenshots = screenshots
          .filter(s => s.workflowTag === tag)
          .slice(0, 2);
        const summaries = sampleScreenshots
          .map(s => s.summary?.slice(0, 50))
          .filter(Boolean)
          .join('; ');
        return `Step ${stepIdx + 1}: ${tag}${summaries ? ` (e.g., ${summaries})` : ''}`;
      });

      return `
Pattern ${idx + 1}: ${seq.sequence.join(' → ')}
- Occurrences: ${seq.occurrenceCount}
- Avg Duration: ${Math.round(seq.avgDurationSeconds / 60)} minutes
- Steps:
${stepDescriptions.map(d => `  ${d}`).join('\n')}`;
    });

    // Build cross-session context if available
    let contextSection = '';
    if (crossSessionContext) {
      const topEntities = (crossSessionContext.entities || [])
        .slice(0, 5)
        .map((e: any) => `${e.entityName} (${e.entityType})`)
        .join(', ');
      const topConcepts = (crossSessionContext.concepts || [])
        .slice(0, 5)
        .map((c: any) => c.conceptName)
        .join(', ');

      if (topEntities || topConcepts) {
        contextSection = `
## Cross-Session Context
- Top Tools/Technologies: ${topEntities || 'None detected'}
- Top Concepts: ${topConcepts || 'None detected'}
`;
      }
    }

    const prompt = `You are a workflow analyst. Analyze these frequently repeated workflow patterns and provide insights for each.

## Detected Workflow Patterns
${sequenceDescriptions.join('\n')}
${contextSection}

For each pattern, provide:
1. A clear, descriptive title (e.g., "Research-to-Code Development Flow")
2. A detailed description of what this workflow represents
3. Specific insights about why this pattern is common
4. Optimization suggestions to improve efficiency

Respond in JSON format with an array of patterns:
{
  "patterns": [
    {
      "title": "string",
      "description": "string",
      "insights": ["string"],
      "optimizationSuggestions": ["string"]
    }
  ]
}`;

    try {
      const response = await this.llmProvider.generateText(
        [
          {
            role: 'system',
            content: 'You are an expert workflow analyst. Provide actionable insights in valid JSON format.',
          },
          { role: 'user', content: prompt },
        ],
        { temperature: 0.3, maxTokens: 4000 }
      );

      // Parse LLM response
      let jsonText = response.content.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.slice(7);
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.slice(3);
      }
      if (jsonText.endsWith('```')) {
        jsonText = jsonText.slice(0, -3);
      }
      jsonText = jsonText.trim();

      const parsed = JSON.parse(jsonText);
      const llmPatterns = parsed.patterns || [];

      // Combine sequence data with LLM insights
      return sequences.slice(0, limit).map((seq, idx) => {
        const llmPattern = llmPatterns[idx] || {};

        // Build steps with proper structure
        const steps = seq.sequence.map((tag, stepIdx) => {
          const tagScreenshots = screenshots.filter(s => s.workflowTag === tag);
          const apps = new Set<string>();
          const activities = new Set<string>();
          const summaryKeywords = new Set<string>();

          // Collect apps and extract meaningful activity descriptions
          for (const s of tagScreenshots.slice(0, 15)) {
            const app = this.extractAppFromSummary(s.summary) ||
                       s.meta?.activeApp ||
                       s.meta?.app;
            if (app) apps.add(app);

            // Extract key activity from summary
            if (s.summary) {
              const activity = this.extractActivityFromSummary(s.summary, tag);
              if (activity) activities.add(activity);

              // Extract additional context keywords from summary
              const keywords = this.extractKeywordsFromSummary(s.summary);
              keywords.forEach((k: string) => summaryKeywords.add(k));
            }
          }

          // Re-classify the tag based on actual content if it's "other"
          let effectiveTag = tag;
          if (tag === 'other') {
            // Try to derive a better classification from the screenshots
            const sampleSummaries = tagScreenshots.slice(0, 5).map(s => s.summary).filter(Boolean).join(' ');
            const derivedTag = this.classifyWorkflowTag(sampleSummaries, {});
            if (derivedTag !== 'other') {
              effectiveTag = derivedTag;
            }
          }

          // Generate a more meaningful title based on actual activity
          const appsList = Array.from(apps).slice(0, 3);
          const activityList = Array.from(activities).slice(0, 2);
          const keywordsList = Array.from(summaryKeywords).slice(0, 3);

          // Use enhanced title generation that considers keywords
          const title = this.generateGranularStepTitle(effectiveTag, appsList, activityList, keywordsList);
          const description = this.generateStepDescription(effectiveTag, appsList, activityList);

          return {
            id: `step-${idx}-${stepIdx}`,
            order: stepIdx,
            title,
            description,
            workflowTag: effectiveTag, // Use the re-classified tag
            averageDurationSeconds: seq.avgDurationSeconds / seq.sequence.length,
            occurrenceCount: seq.occurrenceCount,
            confidence: 0.8,
            apps: Array.from(apps).slice(0, 5),
            relatedScreenshotIds: seq.sampleScreenshotIds,
          };
        });

        // Build connections between steps
        const connections = [];
        for (let i = 0; i < steps.length - 1; i++) {
          connections.push({
            from: steps[i].id,
            to: steps[i + 1].id,
            frequency: seq.occurrenceCount,
            type: 'solid' as const,
          });
        }

        return {
          id: crypto.randomUUID(),
          title: llmPattern.title || `${seq.sequence.join(' → ')} Flow`,
          description: llmPattern.description ||
            `A common workflow pattern occurring ${seq.occurrenceCount} times`,
          frequency: seq.occurrenceCount,
          totalOccurrences: seq.occurrenceCount,
          averageDurationSeconds: seq.avgDurationSeconds,
          confidence: Math.min(0.5 + (seq.occurrenceCount * 0.1), 0.95),
          steps,
          connections,
          relatedTags: seq.sequence,
          insights: llmPattern.insights || [],
          optimizationSuggestions: llmPattern.optimizationSuggestions || [],
        };
      });
    } catch (error) {
      this.logger.error('Failed to generate LLM workflow patterns',
        error instanceof Error ? error : new Error(String(error))
      );

      // Fallback: return patterns without LLM enrichment
      return sequences.slice(0, limit).map((seq, idx) => {
        const steps = seq.sequence.map((tag, stepIdx) => ({
          id: `step-${idx}-${stepIdx}`,
          order: stepIdx,
          title: this.formatWorkflowTagTitle(tag),
          description: `${tag.replace(/_/g, ' ')} activities`,
          workflowTag: tag,
          averageDurationSeconds: seq.avgDurationSeconds / seq.sequence.length,
          occurrenceCount: seq.occurrenceCount,
          confidence: 0.7,
          apps: [],
          relatedScreenshotIds: seq.sampleScreenshotIds,
        }));

        const connections = [];
        for (let i = 0; i < steps.length - 1; i++) {
          connections.push({
            from: steps[i].id,
            to: steps[i + 1].id,
            frequency: seq.occurrenceCount,
            type: 'solid' as const,
          });
        }

        return {
          id: crypto.randomUUID(),
          title: `${seq.sequence.join(' → ')} Flow`,
          description: `A workflow pattern occurring ${seq.occurrenceCount} times`,
          frequency: seq.occurrenceCount,
          totalOccurrences: seq.occurrenceCount,
          averageDurationSeconds: seq.avgDurationSeconds,
          confidence: Math.min(0.5 + (seq.occurrenceCount * 0.1), 0.9),
          steps,
          connections,
          relatedTags: seq.sequence,
          insights: [],
          optimizationSuggestions: [],
        };
      });
    }
  }

  /**
   * Format workflow tag into a readable title
   */
  private formatWorkflowTagTitle(tag: WorkflowTagType): string {
    const titleMap: Record<string, string> = {
      research: 'Research',
      coding: 'Coding',
      market_analysis: 'Market Analysis',
      documentation: 'Documentation',
      design: 'Design',
      testing: 'Testing',
      debugging: 'Debugging',
      meeting: 'Meeting',
      planning: 'Planning',
      learning: 'Learning',
      code_review: 'Code Review',
      deployment: 'Deployment',
      analysis: 'Analysis',
      writing: 'Writing',
      communication: 'Communication',
      other: 'Other',
    };
    return titleMap[tag] || tag.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  /**
   * Extract a meaningful activity description from a summary
   */
  private extractActivityFromSummary(summary: string, tag: WorkflowTagType): string | null {
    if (!summary) return null;

    // Activity patterns based on workflow tag
    const activityPatterns: Record<string, RegExp[]> = {
      coding: [
        /(?:writing|editing|modifying|creating|implementing|building|developing)\s+([a-z]+(?:\s+[a-z]+)?)/i,
        /(?:working on|updating)\s+(?:the\s+)?([a-z]+(?:\s+[a-z]+)?)/i,
        /([a-z]+)\s+(?:component|function|class|module|file)/i,
      ],
      research: [
        /(?:searching|looking|browsing|reading)\s+(?:for\s+)?(?:about\s+)?([a-z]+(?:\s+[a-z]+)?)/i,
        /(?:documentation|docs|article|tutorial)\s+(?:on|about|for)\s+([a-z]+(?:\s+[a-z]+)?)/i,
      ],
      debugging: [
        /(?:fixing|debugging|troubleshooting|investigating)\s+([a-z]+(?:\s+[a-z]+)?)/i,
        /(?:error|bug|issue)\s+(?:in|with)\s+([a-z]+(?:\s+[a-z]+)?)/i,
      ],
      testing: [
        /(?:testing|running tests|writing tests)\s+(?:for\s+)?([a-z]+(?:\s+[a-z]+)?)/i,
        /([a-z]+)\s+(?:tests?|specs?)/i,
      ],
      design: [
        /(?:designing|creating|working on)\s+([a-z]+(?:\s+[a-z]+)?)/i,
        /([a-z]+)\s+(?:design|mockup|wireframe|prototype)/i,
      ],
      planning: [
        /(?:planning|organizing|creating)\s+([a-z]+(?:\s+[a-z]+)?)/i,
        /([a-z]+)\s+(?:task|issue|ticket|backlog)/i,
      ],
      communication: [
        /(?:messaging|chatting|discussing|replying)\s+(?:about\s+)?([a-z]+(?:\s+[a-z]+)?)/i,
        /(?:email|message|chat)\s+(?:about|regarding)\s+([a-z]+(?:\s+[a-z]+)?)/i,
      ],
      meeting: [
        /(?:meeting|call|discussion)\s+(?:about|on|regarding)\s+([a-z]+(?:\s+[a-z]+)?)/i,
      ],
      documentation: [
        /(?:writing|updating|creating)\s+(?:documentation|docs)\s+(?:for\s+)?([a-z]+(?:\s+[a-z]+)?)/i,
      ],
    };

    // Try tag-specific patterns first
    const tagPatterns = activityPatterns[tag] || [];
    for (const pattern of tagPatterns) {
      const match = summary.match(pattern);
      if (match && match[1] && match[1].length > 2) {
        return match[1].trim();
      }
    }

    // General activity extraction
    const generalPatterns = [
      /(?:working on|editing|viewing|using)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)/i,
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:file|project|app)/i,
    ];

    for (const pattern of generalPatterns) {
      const match = summary.match(pattern);
      if (match && match[1] && match[1].length > 2) {
        const result = match[1].trim();
        // Filter out common non-meaningful words
        const skipWords = ['the', 'a', 'an', 'this', 'that', 'some', 'user', 'screen'];
        if (!skipWords.includes(result.toLowerCase())) {
          return result;
        }
      }
    }

    return null;
  }

  /**
   * Generate a meaningful step description based on tag, apps, and activities
   */
  private generateStepDescription(
    tag: WorkflowTagType,
    apps: string[],
    activities: string[]
  ): string {
    const descriptions: Record<WorkflowTagType, string> = {
      research: 'Searching and reading documentation or articles',
      coding: 'Writing and editing code',
      market_analysis: 'Analyzing market data and trends',
      documentation: 'Writing technical documentation',
      design: 'Creating visual designs and mockups',
      testing: 'Running and writing tests',
      debugging: 'Finding and fixing bugs',
      meeting: 'Video calls and discussions',
      planning: 'Organizing tasks and planning work',
      learning: 'Learning new skills and technologies',
      code_review: 'Reviewing code changes',
      deployment: 'Deploying and releasing code',
      analysis: 'Analyzing data and systems',
      writing: 'Writing content and documents',
      communication: 'Messaging and email communication',
      other: 'General activities',
    };

    let description = descriptions[tag] || 'General activities';

    // Enrich with app context
    if (apps.length > 0) {
      description += ` using ${apps.slice(0, 2).join(', ')}`;
    }

    // Add activity context
    if (activities.length > 0) {
      description += ` - ${activities.slice(0, 2).join(', ')}`;
    }

    return description;
  }

  /**
   * Extract meaningful keywords from a screenshot summary
   * Used to provide additional context for step titles
   */
  private extractKeywordsFromSummary(summary: string): string[] {
    if (!summary) return [];

    const keywords: string[] = [];

    // Technology/framework keywords
    const techPatterns = [
      /\b(react|vue|angular|svelte|next\.?js|nuxt|remix|gatsby)\b/gi,
      /\b(node\.?js|express|fastify|nest\.?js|django|flask|rails|spring)\b/gi,
      /\b(typescript|javascript|python|java|go|rust|ruby|php|swift|kotlin)\b/gi,
      /\b(graphql|rest\s*api|websocket|grpc)\b/gi,
      /\b(postgres|mysql|mongodb|redis|elasticsearch)\b/gi,
      /\b(docker|kubernetes|aws|gcp|azure|vercel|netlify)\b/gi,
      /\b(git|github|gitlab|bitbucket)\b/gi,
      /\b(css|scss|sass|tailwind|styled-components)\b/gi,
    ];

    for (const pattern of techPatterns) {
      const matches = summary.match(pattern);
      if (matches) {
        matches.forEach(m => {
          if (!keywords.includes(m)) keywords.push(m);
        });
      }
    }

    // Action keywords - using exec loop instead of matchAll for compatibility
    const actionPattern = /\b(implementing|building|creating|developing|writing|editing|debugging|testing|deploying|reviewing|refactoring)\s+(\w+(?:\s+\w+)?)/gi;
    let actionMatch;
    while ((actionMatch = actionPattern.exec(summary)) !== null) {
      if (actionMatch[2] && actionMatch[2].length > 2) {
        const keyword = actionMatch[2].trim();
        if (!keywords.includes(keyword) && keyword.length < 30) {
          keywords.push(keyword);
        }
      }
    }

    // File type keywords - using exec loop instead of matchAll for compatibility
    const filePattern = /\b(\w+)\.(tsx?|jsx?|py|java|go|rs|rb|php|css|scss|html|json|yaml|yml|md)\b/gi;
    let fileMatch;
    while ((fileMatch = filePattern.exec(summary)) !== null) {
      const filename = `${fileMatch[1]}.${fileMatch[2]}`;
      if (!keywords.includes(filename)) {
        keywords.push(filename);
      }
    }

    return keywords.slice(0, 5); // Limit to 5 keywords
  }

  /**
   * Generate a granular step title using all available context
   * This method tries to create the most descriptive title possible
   */
  private generateGranularStepTitle(
    tag: WorkflowTagType,
    apps: string[],
    activities: string[],
    keywords: string[]
  ): string {
    // If we still have "other" tag but have keywords, use them to create a title
    if (tag === 'other') {
      if (keywords.length > 0) {
        // Try to create a meaningful title from keywords
        const keyword = keywords[0];
        if (apps.length > 0) {
          return `Working on ${keyword} in ${apps[0]}`;
        }
        return `Working on ${keyword}`;
      }
      if (apps.length > 0) {
        return `Using ${apps[0]}`;
      }
      if (activities.length > 0) {
        return activities[0];
      }
      return 'General Activity';
    }

    const baseTitle = this.formatWorkflowTagTitle(tag);

    // If we have apps, make the title more specific
    if (apps.length > 0) {
      const primaryApp = apps[0];

      // Add keyword context if available
      const keywordContext = keywords.length > 0 ? ` (${keywords[0]})` : '';

      // Create context-aware titles
      switch (tag) {
        case 'coding':
          if (keywords.length > 0) {
            return `Coding ${keywords[0]} in ${primaryApp}`;
          }
          return `Coding in ${primaryApp}`;
        case 'research':
          if (primaryApp.match(/chrome|safari|firefox|brave|edge/i)) {
            if (keywords.length > 0) {
              return `Researching ${keywords[0]}`;
            }
            return 'Web Research';
          }
          return `Research in ${primaryApp}${keywordContext}`;
        case 'debugging':
          if (keywords.length > 0) {
            return `Debugging ${keywords[0]}`;
          }
          return `Debugging in ${primaryApp}`;
        case 'testing':
          if (keywords.length > 0) {
            return `Testing ${keywords[0]}`;
          }
          return `Testing in ${primaryApp}`;
        case 'design':
          return `Design in ${primaryApp}${keywordContext}`;
        case 'communication':
          return `${primaryApp} Communication`;
        case 'meeting':
          return `${primaryApp} Meeting`;
        case 'planning':
          if (primaryApp.match(/linear|jira|asana|trello/i)) {
            return `${primaryApp} Planning${keywordContext}`;
          }
          return `Planning in ${primaryApp}${keywordContext}`;
        case 'documentation':
          if (keywords.length > 0) {
            return `Documenting ${keywords[0]}`;
          }
          return `Writing Docs in ${primaryApp}`;
        case 'learning':
          if (keywords.length > 0) {
            return `Learning ${keywords[0]}`;
          }
          return `Learning in ${primaryApp}`;
        case 'code_review':
          if (keywords.length > 0) {
            return `Reviewing ${keywords[0]}`;
          }
          return `Code Review in ${primaryApp}`;
        case 'deployment':
          if (keywords.length > 0) {
            return `Deploying ${keywords[0]}`;
          }
          return `Deployment via ${primaryApp}`;
        default:
          return `${baseTitle} (${primaryApp})${keywordContext}`;
      }
    }

    // If we have keywords but no apps
    if (keywords.length > 0) {
      switch (tag) {
        case 'coding':
          return `Coding ${keywords[0]}`;
        case 'research':
          return `Researching ${keywords[0]}`;
        case 'debugging':
          return `Debugging ${keywords[0]}`;
        case 'testing':
          return `Testing ${keywords[0]}`;
        case 'documentation':
          return `Documenting ${keywords[0]}`;
        default:
          return `${baseTitle}: ${keywords[0]}`;
      }
    }

    // If we have activities but no apps or keywords
    if (activities.length > 0) {
      return `${baseTitle}: ${activities[0]}`;
    }

    return baseTitle;
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

  /**
   * Repair orphaned screenshots by linking them to correct nodes via session mappings
   * This is a one-time repair method that can be called to fix screenshots that were
   * ingested before the nodeId assignment fix was deployed.
   */
  async repairOrphanedScreenshots(userId: number): Promise<{
    repaired: number;
    sessionsMapped: string[];
    errors: string[];
  }> {
    if (!this.sessionMappingRepository) {
      throw new Error('Session mapping repository not available for repair operation');
    }

    this.logger.info('Starting orphaned screenshot repair', { userId });

    const errors: string[] = [];
    const sessionsMapped: string[] = [];
    let repaired = 0;

    try {
      // Get all orphaned screenshots (those with null/empty nodeId)
      const orphanedScreenshots = await this.repository.getOrphanedScreenshots(userId, { limit: 5000 });

      this.logger.info('Found orphaned screenshots', {
        userId,
        orphanedCount: orphanedScreenshots.length,
      });

      if (orphanedScreenshots.length === 0) {
        return { repaired: 0, sessionsMapped: [], errors: [] };
      }

      // Group screenshots by sessionId
      const screenshotsBySession = new Map<string, typeof orphanedScreenshots>();
      for (const screenshot of orphanedScreenshots) {
        if (!screenshot.sessionId) continue;
        if (!screenshotsBySession.has(screenshot.sessionId)) {
          screenshotsBySession.set(screenshot.sessionId, []);
        }
        screenshotsBySession.get(screenshot.sessionId)!.push(screenshot);
      }

      this.logger.info('Grouped orphaned screenshots by session', {
        userId,
        sessionCount: screenshotsBySession.size,
      });

      // For each session, look up the nodeId from session mappings
      for (const [sessionId, screenshots] of screenshotsBySession) {
        try {
          // Look up session mapping to find the nodeId
          const sessionMapping = await this.sessionMappingRepository.getByDesktopSessionId(userId, sessionId);

          if (sessionMapping && sessionMapping.nodeId) {
            // Update all screenshots for this session with the correct nodeId
            const updateCount = await this.repository.updateNodeIdBySessionId(sessionId, sessionMapping.nodeId);

            if (updateCount > 0) {
              repaired += updateCount;
              sessionsMapped.push(sessionId);
              this.logger.info('Repaired screenshots for session', {
                sessionId,
                nodeId: sessionMapping.nodeId,
                screenshotsUpdated: updateCount,
              });
            }
          } else {
            this.logger.warn('No session mapping found for orphaned session', { sessionId });
          }
        } catch (sessionError) {
          const errorMsg = `Failed to repair session ${sessionId}: ${sessionError instanceof Error ? sessionError.message : String(sessionError)}`;
          errors.push(errorMsg);
          this.logger.warn(errorMsg);
        }
      }

      this.logger.info('Completed orphaned screenshot repair', {
        userId,
        repaired,
        sessionsMapped: sessionsMapped.length,
        errors: errors.length,
      });

      return { repaired, sessionsMapped, errors };
    } catch (error) {
      this.logger.error('Failed to repair orphaned screenshots', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Backfill workflow screenshots from existing session summaries
   * This creates synthetic workflow data from the highLevelSummary stored in session_mappings
   * for sessions that were pushed before the screenshot ingest was properly connected.
   */
  async backfillFromSessionSummaries(userId: number): Promise<{
    backfilled: number;
    sessionsProcessed: string[];
    errors: string[];
  }> {
    if (!this.sessionMappingRepository) {
      throw new Error('Session mapping repository not available for backfill operation');
    }

    this.logger.info('Starting workflow backfill from session summaries', { userId });

    const errors: string[] = [];
    const sessionsProcessed: string[] = [];
    let backfilled = 0;

    try {
      // Get all sessions for this user that have a nodeId
      const { sessions } = await this.sessionMappingRepository.findAll({
        userId,
      }, { page: 1, limit: 500 });

      this.logger.info('Found sessions to potentially backfill', {
        userId,
        sessionCount: sessions.length,
      });

      for (const session of sessions) {
        // Skip sessions without nodeId or highLevelSummary
        if (!session.nodeId || !session.highLevelSummary) {
          continue;
        }

        // Check if screenshots already exist for this session
        const existingScreenshots = await this.repository.getScreenshotsBySession(userId, session.desktopSessionId);
        if (existingScreenshots.length > 0) {
          this.logger.debug('Session already has screenshots, skipping', {
            sessionId: session.desktopSessionId,
            screenshotCount: existingScreenshots.length,
          });
          continue;
        }

        try {
          // Generate embedding for the summary
          const embedding = await this.embeddingService.generateEmbedding(session.highLevelSummary);

          // Determine workflow tag from the summary content
          const workflowTag = this.classifyWorkflowTag(session.highLevelSummary, {});

          // Create a synthetic workflow screenshot from the session summary
          const screenshot = await this.repository.createScreenshot({
            userId,
            nodeId: session.nodeId,
            sessionId: session.desktopSessionId,
            screenshotPath: 'backfill://session-summary', // Synthetic path indicating this is from backfill
            cloudUrl: null,
            timestamp: session.startedAt || session.createdAt,
            workflowTag,
            summary: session.highLevelSummary,
            analysis: session.generatedTitle || session.workflowName || 'Work Session',
            embedding: new Float32Array(embedding),
            meta: {
              source: 'session_summary_backfill',
              originalSessionId: session.desktopSessionId,
              workflowName: session.workflowName,
              durationSeconds: session.durationSeconds,
            },
          });

          backfilled++;
          sessionsProcessed.push(session.desktopSessionId);

          this.logger.info('Backfilled workflow screenshot from session summary', {
            sessionId: session.desktopSessionId,
            nodeId: session.nodeId,
            screenshotId: screenshot.id,
            workflowTag,
          });
        } catch (sessionError) {
          const errorMsg = `Failed to backfill session ${session.desktopSessionId}: ${sessionError instanceof Error ? sessionError.message : String(sessionError)}`;
          errors.push(errorMsg);
          this.logger.warn(errorMsg);
        }
      }

      this.logger.info('Completed workflow backfill from session summaries', {
        userId,
        backfilled,
        sessionsProcessed: sessionsProcessed.length,
        errors: errors.length,
      });

      return { backfilled, sessionsProcessed, errors };
    } catch (error) {
      this.logger.error('Failed to backfill workflow screenshots', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
