/**
 * A4-Company Docs Agent Graph
 *
 * LangGraph implementation of the Company Docs Agent (A4-Company) that:
 * 1. Retrieves relevant internal company documentation
 * 2. Uses Hybrid RAG (ArangoDB + pgvector) for document search
 * 3. Extracts guidance with proper citations (document, page number)
 * 4. Maps recommendations to user's workflow with Claude Code prompts
 *
 * Document retrieval uses existing RAG infrastructure.
 * PDF parsing would use PyMUPDF in production (via Python microservice).
 */

import { StateGraph, END } from '@langchain/langgraph';
import { v4 as uuidv4 } from 'uuid';
import type { Logger } from '../../../core/logger.js';
import type { LLMProvider } from '../../../core/llm-provider.js';
import type { NaturalLanguageQueryService } from '../../natural-language-query.service.js';
import { InsightStateAnnotation, type InsightState } from '../state/insight-state.js';
import type {
  StepOptimizationPlan,
  OptimizationBlock,
  StepTransformation,
  CurrentStep,
  OptimizedStep,
  Citation,
  Inefficiency,
} from '../types.js';
import { z } from 'zod';

// ============================================================================
// TYPES
// ============================================================================

export interface CompanyDocsGraphDeps {
  logger: Logger;
  llmProvider: LLMProvider;
  nlqService?: NaturalLanguageQueryService; // For document retrieval
  companyDocsPath?: string; // Path to company docs storage
}

interface CompanyDocument {
  id: string;
  title: string;
  content: string;
  excerpt: string;
  pageNumber?: number;
  sourceUrl?: string;
  relevanceScore: number;
}

interface DocumentGuidance {
  documentId: string;
  title: string;
  guidanceText: string;
  applicableInefficiencyIds: string[];
  estimatedTimeSavingsSeconds: number;
  toolSuggestion: string;
  claudeCodeApplicable: boolean;
  claudeCodePrompt?: string;
  confidence: number;
  citation: Citation;
}

// LLM schemas
const documentQuerySchema = z.object({
  queries: z.array(
    z.object({
      query: z.string(),
      targetInefficiency: z.string(),
      documentType: z.enum(['process', 'tool_guide', 'best_practice', 'standard', 'general']),
    })
  ),
});

const guidanceExtractionSchema = z.object({
  guidance: z.array(
    z.object({
      documentId: z.string(),
      guidanceText: z.string(),
      applicableInefficiencyIds: z.array(z.string()),
      estimatedTimeSavingsSeconds: z.number(),
      toolSuggestion: z.string(),
      claudeCodeApplicable: z.boolean(),
      claudeCodePrompt: z.string().optional(),
      confidence: z.number().min(0).max(1),
    })
  ),
});

// ============================================================================
// GRAPH NODES
// ============================================================================

/**
 * Node: Generate document queries from user's inefficiencies
 */
async function generateDocumentQueries(
  state: InsightState,
  deps: CompanyDocsGraphDeps
): Promise<Partial<InsightState>> {
  const { logger, llmProvider } = deps;

  logger.info('A4-Company: Generating document queries');

  if (!state.userDiagnostics || state.userDiagnostics.inefficiencies.length === 0) {
    logger.warn('A4-Company: No inefficiencies to search for');
    return {
      currentStage: 'a4_company_queries_skipped',
      progress: 65,
    };
  }

  const inefficiencies = state.userDiagnostics.inefficiencies;

  try {
    const response = await llmProvider.generateStructuredResponse(
      [
        {
          role: 'user',
          content: `Generate queries to search internal company documentation for these workflow inefficiencies:

${inefficiencies.map((i) => `- [${i.id}] ${i.type}: ${i.description}`).join('\n')}

User's query context: "${state.query}"

Generate 2-3 targeted queries that would find relevant internal documentation.
Focus on:
1. Internal process documentation
2. Tool guides and standards
3. Best practices and coding standards
4. Team-specific workflows

Each query should target a specific inefficiency.`,
        },
      ],
      documentQuerySchema
    );

    logger.info('A4-Company: Generated document queries', {
      queryCount: response.content.queries.length,
    });

    // Log detailed output for debugging
    logger.info('=== A4-COMPANY AGENT OUTPUT (Document Queries) ===');
    logger.info(JSON.stringify({
      agent: 'A4_COMPANY',
      outputType: 'documentQueries',
      queries: response.content.queries.map(q => ({
        query: q.query,
        targetInefficiency: q.targetInefficiency,
        documentType: q.documentType,
      })),
    }, null, 2));
    logger.info('=== END A4-COMPANY DOCUMENT QUERIES OUTPUT ===');

    return {
      currentStage: 'a4_company_queries_generated',
      progress: 68,
    };
  } catch (error) {
    logger.error('A4-Company: Query generation failed', { error });
    return {
      errors: [`A4-Company query generation failed: ${error}`],
      currentStage: 'a4_company_queries_failed',
    };
  }
}

/**
 * Node: Retrieve relevant company documents
 */
async function retrieveCompanyDocs(
  state: InsightState,
  deps: CompanyDocsGraphDeps
): Promise<Partial<InsightState>> {
  const { logger, nlqService } = deps;

  logger.info('A4-Company: Retrieving company documents');

  const inefficiencies = state.userDiagnostics?.inefficiencies || [];
  if (inefficiencies.length === 0) {
    return {
      currentStage: 'a4_company_retrieval_no_inefficiencies',
      progress: 72,
    };
  }

  // Generate document queries
  const queries = generateDocumentQueriesForInefficiencies(inefficiencies, state.query);
  const retrievedDocs: CompanyDocument[] = [];

  // Try to use NLQ service if available
  if (nlqService) {
    for (const queryInfo of queries.slice(0, 3)) {
      try {
        const result = await nlqService.query(state.userId, {
          query: queryInfo.query,
          maxResults: 5,
          includeGraph: true,
          includeVectors: true,
        });

        // Extract document-like sources from results
        const docs = extractDocumentsFromNLQResult(result, queryInfo.query);
        retrievedDocs.push(...docs);
      } catch (error) {
        logger.warn('A4-Company: Document query failed', {
          query: queryInfo.query,
          error,
        });
      }
    }
  } else {
    // Use mock documents for demo purposes
    retrievedDocs.push(...getMockCompanyDocuments(inefficiencies));
  }

  logger.info('A4-Company: Document retrieval complete', {
    documentCount: retrievedDocs.length,
  });

  // Log detailed output for debugging
  logger.info('=== A4-COMPANY AGENT OUTPUT (Retrieved Documents) ===');
  logger.info(JSON.stringify({
    agent: 'A4_COMPANY',
    outputType: 'retrievedDocuments',
    documents: {
      totalCount: retrievedDocs.length,
      documents: retrievedDocs.map(d => ({
        id: d.id,
        title: d.title,
        excerptPreview: d.excerpt.slice(0, 150) + '...',
        pageNumber: d.pageNumber,
        relevanceScore: d.relevanceScore,
      })),
    },
  }, null, 2));
  logger.info('=== END A4-COMPANY DOCUMENTS OUTPUT ===');

  return {
    currentStage: 'a4_company_retrieval_complete',
    progress: 72,
  };
}

/**
 * Node: Extract guidance from company documents
 */
async function extractGuidance(
  state: InsightState,
  deps: CompanyDocsGraphDeps
): Promise<Partial<InsightState>> {
  const { logger, llmProvider, nlqService } = deps;

  logger.info('A4-Company: Extracting guidance from documents');

  const inefficiencies = state.userDiagnostics?.inefficiencies || [];
  if (inefficiencies.length === 0) {
    return {
      companyOptimizationPlan: null,
      currentStage: 'a4_company_extraction_skipped',
      progress: 75,
    };
  }

  // Retrieve documents (either from NLQ or mock)
  const documents = nlqService
    ? await retrieveDocsViaNLQ(state, nlqService, logger)
    : getMockCompanyDocuments(inefficiencies);

  if (documents.length === 0) {
    logger.info('A4-Company: No relevant documents found');
    return {
      companyOptimizationPlan: null,
      currentStage: 'a4_company_no_docs',
      progress: 75,
    };
  }

  try {
    // Prepare document context for LLM
    const docContext = documents
      .slice(0, 5)
      .map(
        (d) =>
          `[${d.id}] ${d.title}\nExcerpt: ${d.excerpt}\nRelevance: ${d.relevanceScore.toFixed(2)}`
      )
      .join('\n\n');

    const response = await llmProvider.generateStructuredResponse(
      [
        {
          role: 'user',
          content: `Extract actionable guidance from these company documents for the identified inefficiencies:

Inefficiencies:
${inefficiencies.map((i) => `- [${i.id}] ${i.type}: ${i.description} (~${i.estimatedWastedSeconds}s wasted)`).join('\n')}

Company Documents:
${docContext}

User's Context: "${state.query}"

For each piece of guidance:
1. Reference the document ID it comes from
2. Map it to specific inefficiency IDs it addresses
3. Estimate time savings in seconds
4. Suggest specific tools (prioritize Claude Code for coding tasks)
5. Generate Claude Code prompts where applicable
6. Rate confidence based on document quality and relevance`,
        },
      ],
      guidanceExtractionSchema
    );

    const optimizationPlan = createOptimizationPlanFromGuidance(
      response.content.guidance,
      documents,
      state.userDiagnostics!,
      state.userEvidence?.workflows[0]
    );

    logger.info('A4-Company: Guidance extracted', {
      guidanceCount: response.content.guidance.length,
      blocksCreated: optimizationPlan.blocks.length,
    });

    // Log detailed output for debugging
    logger.info('=== A4-COMPANY AGENT OUTPUT (Extracted Guidance) ===');
    logger.info(JSON.stringify({
      agent: 'A4_COMPANY',
      outputType: 'extractedGuidance',
      guidance: response.content.guidance.map(g => ({
        documentId: g.documentId,
        guidanceText: g.guidanceText,
        applicableInefficiencyIds: g.applicableInefficiencyIds,
        estimatedTimeSavingsSeconds: g.estimatedTimeSavingsSeconds,
        toolSuggestion: g.toolSuggestion,
        claudeCodeApplicable: g.claudeCodeApplicable,
        claudeCodePrompt: g.claudeCodePrompt,
        confidence: g.confidence,
      })),
    }, null, 2));
    logger.info('=== END A4-COMPANY GUIDANCE OUTPUT ===');

    // Log optimization plan
    logger.info('=== A4-COMPANY AGENT OUTPUT (Optimization Plan) ===');
    logger.info(JSON.stringify({
      agent: 'A4_COMPANY',
      outputType: 'companyOptimizationPlan',
      plan: {
        totalBlocks: optimizationPlan.blocks.length,
        totalTimeSaved: optimizationPlan.totalTimeSaved,
        totalRelativeImprovement: optimizationPlan.totalRelativeImprovement,
        passesThreshold: optimizationPlan.passesThreshold,
        blocks: optimizationPlan.blocks.map(b => ({
          blockId: b.blockId,
          workflowName: b.workflowName,
          currentTimeTotal: b.currentTimeTotal,
          optimizedTimeTotal: b.optimizedTimeTotal,
          timeSaved: b.timeSaved,
          relativeImprovement: b.relativeImprovement,
          confidence: b.confidence,
          whyThisMatters: b.whyThisMatters,
          source: b.source,
          citations: b.citations?.map(c => ({
            title: c.title,
            documentId: c.documentId,
            pageNumber: c.pageNumber,
            excerptPreview: c.excerpt?.slice(0, 100) + '...',
          })),
          transformations: b.stepTransformations.map(t => ({
            timeSavedSeconds: t.timeSavedSeconds,
            confidence: t.confidence,
            rationale: t.rationale,
            optimizedTools: t.optimizedSteps.map(s => s.tool),
            hasClaudeCodePrompt: t.optimizedSteps.some(s => !!s.claudeCodePrompt),
          })),
        })),
      },
    }, null, 2));
    logger.info('=== END A4-COMPANY OPTIMIZATION PLAN OUTPUT ===');

    return {
      companyOptimizationPlan: optimizationPlan,
      currentStage: 'a4_company_extraction_complete',
      progress: 75,
    };
  } catch (error) {
    logger.error('A4-Company: Guidance extraction failed', { error });
    return {
      errors: [`A4-Company guidance extraction failed: ${error}`],
      companyOptimizationPlan: null,
      currentStage: 'a4_company_extraction_failed',
    };
  }
}

// ============================================================================
// GRAPH BUILDER
// ============================================================================

/**
 * Create the A4-Company Docs Agent graph
 */
export function createCompanyDocsGraph(deps: CompanyDocsGraphDeps) {
  const { logger } = deps;

  logger.info('Creating A4-Company Docs Graph');

  const graph = new StateGraph(InsightStateAnnotation)
    // Add nodes
    .addNode('generate_queries', (state) => generateDocumentQueries(state, deps))
    .addNode('retrieve_docs', (state) => retrieveCompanyDocs(state, deps))
    .addNode('extract_guidance', (state) => extractGuidance(state, deps))

    // Define edges
    .addEdge('__start__', 'generate_queries')
    .addEdge('generate_queries', 'retrieve_docs')
    .addEdge('retrieve_docs', 'extract_guidance')
    .addEdge('extract_guidance', END);

  return graph.compile();
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate document queries for inefficiencies
 */
function generateDocumentQueriesForInefficiencies(
  inefficiencies: Inefficiency[],
  userQuery: string
): Array<{ query: string; targetInefficiency: string; documentType: string }> {
  const queries: Array<{ query: string; targetInefficiency: string; documentType: string }> = [];

  for (const ineff of inefficiencies.slice(0, 3)) {
    let query = '';
    let documentType = 'general';

    switch (ineff.type) {
      case 'repetitive_search':
        query = 'internal search tools documentation knowledge base best practices';
        documentType = 'tool_guide';
        break;
      case 'context_switching':
        query = 'minimize context switching workflow process documentation';
        documentType = 'process';
        break;
      case 'rework_loop':
        query = 'code review process debugging standards quality guidelines';
        documentType = 'standard';
        break;
      case 'manual_automation':
        query = 'automation scripts internal tools CI/CD documentation';
        documentType = 'tool_guide';
        break;
      case 'idle_time':
        query = 'productivity guidelines workflow optimization internal';
        documentType = 'best_practice';
        break;
      case 'tool_fragmentation':
        query = 'approved tools list standard toolchain documentation';
        documentType = 'standard';
        break;
      case 'information_gathering':
        query = 'information sources internal documentation knowledge base';
        documentType = 'process';
        break;
      default:
        query = 'workflow best practices process documentation';
        documentType = 'general';
    }

    queries.push({
      query,
      targetInefficiency: ineff.id,
      documentType,
    });
  }

  // Add general query based on user's question
  if (userQuery) {
    queries.push({
      query: `${userQuery} internal documentation process`,
      targetInefficiency: 'general',
      documentType: 'general',
    });
  }

  return queries;
}

/**
 * Extract document-like results from NLQ service response
 */
function extractDocumentsFromNLQResult(
  nlqResult: any,
  query: string
): CompanyDocument[] {
  const documents: CompanyDocument[] = [];

  // Extract from sources
  if (nlqResult.sources) {
    for (const source of nlqResult.sources) {
      documents.push({
        id: source.id || uuidv4(),
        title: source.title || source.name || 'Internal Document',
        content: source.content || '',
        excerpt: (source.content || '').slice(0, 500),
        relevanceScore: source.relevance || source.score || 0.5,
      });
    }
  }

  // Extract from related work sessions (as documentation context)
  if (nlqResult.relatedWorkSessions) {
    for (const session of nlqResult.relatedWorkSessions) {
      documents.push({
        id: `session-${session.sessionId}`,
        title: session.summary || session.name || 'Work Session',
        content: session.summary || '',
        excerpt: (session.summary || '').slice(0, 300),
        relevanceScore: 0.6,
      });
    }
  }

  return documents;
}

/**
 * Get mock company documents for demo/testing
 */
function getMockCompanyDocuments(inefficiencies: Inefficiency[]): CompanyDocument[] {
  const mockDocs: CompanyDocument[] = [];

  for (const ineff of inefficiencies.slice(0, 3)) {
    switch (ineff.type) {
      case 'manual_automation':
        mockDocs.push({
          id: 'doc-automation-guide',
          title: 'Internal Automation Standards',
          content:
            'Use Claude Code for repetitive coding tasks. Standard automation scripts are available in /shared/scripts. All manual processes >5 minutes should be automated.',
          excerpt:
            'Use Claude Code for repetitive coding tasks. Standard automation scripts are available in /shared/scripts.',
          pageNumber: 12,
          relevanceScore: 0.85,
        });
        break;
      case 'context_switching':
        mockDocs.push({
          id: 'doc-workflow-guide',
          title: 'Developer Workflow Guidelines',
          content:
            'Batch similar tasks together. Use focused work blocks of 25 minutes. Keep related browser tabs in groups. Use IDE workspaces for project context.',
          excerpt:
            'Batch similar tasks together. Use focused work blocks of 25 minutes.',
          pageNumber: 8,
          relevanceScore: 0.8,
        });
        break;
      case 'repetitive_search':
        mockDocs.push({
          id: 'doc-knowledge-base',
          title: 'Knowledge Base Usage Guide',
          content:
            'Use the internal wiki first. Bookmark frequently accessed docs. Use Claude Code for code-specific questions to avoid repeated searches.',
          excerpt:
            'Use the internal wiki first. Use Claude Code for code-specific questions.',
          pageNumber: 3,
          relevanceScore: 0.75,
        });
        break;
      default:
        mockDocs.push({
          id: `doc-general-${ineff.type}`,
          title: 'General Best Practices',
          content:
            'Follow team coding standards. Use available automation tools. Ask Claude Code for help with complex tasks.',
          excerpt: 'Follow team coding standards. Use available automation tools.',
          relevanceScore: 0.6,
        });
    }
  }

  return mockDocs;
}

/**
 * Retrieve documents via NLQ service
 */
async function retrieveDocsViaNLQ(
  state: InsightState,
  nlqService: NaturalLanguageQueryService,
  logger: Logger
): Promise<CompanyDocument[]> {
  const inefficiencies = state.userDiagnostics?.inefficiencies || [];
  const queries = generateDocumentQueriesForInefficiencies(inefficiencies, state.query);
  const allDocs: CompanyDocument[] = [];

  for (const queryInfo of queries.slice(0, 2)) {
    try {
      const result = await nlqService.query(state.userId, {
        query: queryInfo.query,
        maxResults: 3,
        includeGraph: true,
        includeVectors: true,
      });
      const docs = extractDocumentsFromNLQResult(result, queryInfo.query);
      allDocs.push(...docs);
    } catch (error) {
      logger.warn('NLQ document query failed', { error });
    }
  }

  return allDocs;
}

/**
 * Create optimization plan from extracted guidance
 */
function createOptimizationPlanFromGuidance(
  guidance: any[],
  documents: CompanyDocument[],
  userDiagnostics: any,
  userWorkflow?: any
): StepOptimizationPlan {
  const blocks: OptimizationBlock[] = [];
  let totalTimeSaved = 0;

  for (const guide of guidance) {
    // Find related document
    const doc = documents.find((d) => d.id === guide.documentId);

    // Find related inefficiencies
    const relatedInefficiencies = userDiagnostics.inefficiencies.filter(
      (i: Inefficiency) => guide.applicableInefficiencyIds.includes(i.id)
    );

    if (relatedInefficiencies.length === 0) continue;

    // Get affected steps
    const affectedStepIds = relatedInefficiencies.flatMap(
      (i: Inefficiency) => i.stepIds
    );

    // Calculate times
    const currentTimeTotal = affectedStepIds.reduce((sum: number, stepId: string) => {
      const step = userWorkflow?.steps?.find((s: any) => s.stepId === stepId);
      return sum + (step?.durationSeconds || 60);
    }, 0);

    const timeSaved = guide.estimatedTimeSavingsSeconds;
    const optimizedTimeTotal = Math.max(currentTimeTotal - timeSaved, 0);

    totalTimeSaved += timeSaved;

    // Create citation
    const citation: Citation = {
      documentId: doc?.id,
      title: doc?.title || 'Internal Document',
      excerpt: doc?.excerpt || guide.guidanceText,
      pageNumber: doc?.pageNumber,
    };

    // Create step transformation
    const transformation: StepTransformation = {
      transformationId: uuidv4(),
      currentSteps: affectedStepIds.map((stepId: string) => {
        const step = userWorkflow?.steps?.find((s: any) => s.stepId === stepId);
        return {
          stepId,
          tool: step?.app || step?.tool || 'unknown',
          durationSeconds: step?.durationSeconds || 60,
          description: step?.description || '',
        } as CurrentStep;
      }),
      optimizedSteps: [
        {
          stepId: `opt-${uuidv4().slice(0, 8)}`,
          tool: guide.toolSuggestion,
          estimatedDurationSeconds: optimizedTimeTotal,
          description: guide.guidanceText,
          claudeCodePrompt: guide.claudeCodeApplicable ? guide.claudeCodePrompt : undefined,
          isNew: true,
          replacesSteps: affectedStepIds,
        } as OptimizedStep,
      ],
      timeSavedSeconds: timeSaved,
      confidence: guide.confidence,
      rationale: `Based on: ${doc?.title || 'Internal documentation'}`,
    };

    blocks.push({
      blockId: uuidv4(),
      workflowName: userWorkflow?.name || userWorkflow?.title || 'Workflow',
      workflowId: userWorkflow?.workflowId || 'unknown',
      currentTimeTotal,
      optimizedTimeTotal,
      timeSaved,
      relativeImprovement: currentTimeTotal > 0 ? (timeSaved / currentTimeTotal) * 100 : 0,
      confidence: guide.confidence,
      whyThisMatters: guide.guidanceText,
      metricDeltas: {},
      stepTransformations: [transformation],
      source: 'company_docs',
      citations: [citation],
    });
  }

  const totalCurrentTime = blocks.reduce((sum, b) => sum + b.currentTimeTotal, 0);

  return {
    blocks,
    totalTimeSaved,
    totalRelativeImprovement:
      totalCurrentTime > 0 ? (totalTimeSaved / totalCurrentTime) * 100 : 0,
    passesThreshold: false, // Set by orchestrator
  };
}
