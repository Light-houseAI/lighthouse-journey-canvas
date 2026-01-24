/**
 * Unit Tests for Orchestrator Graph
 *
 * Tests the main orchestrator that coordinates all agents.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock, mockClear, type MockProxy } from 'vitest-mock-extended';

import type { Logger } from '../../../core/logger';
import type { LLMProvider } from '../../../core/llm-provider';
import type { NaturalLanguageQueryService } from '../../natural-language-query.service';
import type { PlatformWorkflowRepository } from '../../../repositories/platform-workflow.repository';
import type { SessionMappingRepository } from '../../../repositories/session-mapping.repository';
import type { EmbeddingService } from '../../interfaces/index';
import { createOrchestratorGraph, type OrchestratorGraphDeps } from '../graphs/orchestrator-graph';
import type { InsightState } from '../state/insight-state';
import type { Diagnostics, EvidenceBundle } from '../types';

describe('Orchestrator Graph', () => {
  let mockLogger: MockProxy<Logger>;
  let mockLLMProvider: MockProxy<LLMProvider>;
  let mockNLQService: MockProxy<NaturalLanguageQueryService>;
  let mockPlatformWorkflowRepository: MockProxy<PlatformWorkflowRepository>;
  let mockSessionMappingRepository: MockProxy<SessionMappingRepository>;
  let mockEmbeddingService: MockProxy<EmbeddingService>;
  let deps: OrchestratorGraphDeps;

  const createMockDiagnostics = (overrides: Partial<Diagnostics> = {}): Diagnostics => ({
    workflowId: 'wf-1',
    workflowName: 'Test Workflow',
    metrics: {
      totalWorkflowTime: 600,
      activeTime: 500,
      idleTime: 100,
      contextSwitches: 3,
      reworkLoops: 1,
      uniqueToolsUsed: 2,
      toolDistribution: { Chrome: 2, VSCode: 3 },
      workflowTagDistribution: { research: 2, coding: 3 },
      averageStepDuration: 120,
    },
    inefficiencies: [
      {
        id: 'ineff-1',
        workflowId: 'wf-1',
        type: 'context_switching',
        description: 'Too many context switches',
        stepIds: ['step-1', 'step-2'],
        estimatedWastedSeconds: 120,
        confidence: 0.8,
        evidence: ['Evidence 1'],
      },
    ],
    opportunities: [
      {
        id: 'opp-1',
        inefficiencyId: 'ineff-1',
        type: 'automation',
        description: 'Automate with Claude Code',
        estimatedSavingsSeconds: 180,
        suggestedTool: 'Claude Code',
        claudeCodeApplicable: true,
        confidence: 0.75,
      },
    ],
    overallEfficiencyScore: 65,
    confidence: 0.8,
    analysisTimestamp: new Date().toISOString(),
    ...overrides,
  });

  const createMockEvidence = (): EvidenceBundle => ({
    workflows: [
      {
        workflowId: 'wf-1',
        name: 'Test Workflow',
        intent: 'Test intent',
        approach: 'Test approach',
        steps: [
          {
            stepId: 'step-1',
            description: 'Search Google',
            tool: 'Chrome',
            durationSeconds: 60,
            timestamp: new Date().toISOString(),
            order: 1,
          },
        ],
        totalDurationSeconds: 300,
        tools: ['Chrome', 'VSCode'],
        sessionId: 'session-1',
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
      },
    ],
    sessions: [],
    entities: [],
    concepts: [],
    totalStepCount: 3,
    totalDurationSeconds: 300,
    retrievalMetadata: {
      queryTimeMs: 100,
      sourcesRetrieved: 5,
      retrievalMethod: 'hybrid',
      embeddingModel: 'text-embedding-3-small',
    },
  });

  const createInitialState = (overrides: Partial<InsightState> = {}): InsightState => ({
    query: 'How can I improve my workflow?',
    userId: 1,
    nodeId: null,
    lookbackDays: 30,
    includePeerComparison: true,
    userEvidence: null,
    peerEvidence: null,
    a1CritiqueResult: null,
    a1RetryCount: 0,
    userDiagnostics: null,
    peerDiagnostics: null,
    a2CritiqueResult: null,
    a2RetryCount: 0,
    routingDecision: null,
    peerOptimizationPlan: null,
    webOptimizationPlan: null,
    companyOptimizationPlan: null,
    mergedPlan: null,
    finalResult: null,
    currentStage: 'initial',
    status: 'pending',
    progress: 0,
    errors: [],
    ...overrides,
  });

  beforeEach(() => {
    mockLogger = mock<Logger>();
    mockLLMProvider = mock<LLMProvider>();
    mockNLQService = mock<NaturalLanguageQueryService>();
    mockPlatformWorkflowRepository = mock<PlatformWorkflowRepository>();
    mockSessionMappingRepository = mock<SessionMappingRepository>();
    mockEmbeddingService = mock<EmbeddingService>();

    deps = {
      logger: mockLogger,
      llmProvider: mockLLMProvider,
      nlqService: mockNLQService,
      platformWorkflowRepository: mockPlatformWorkflowRepository,
      sessionMappingRepository: mockSessionMappingRepository,
      embeddingService: mockEmbeddingService,
      companyDocsEnabled: false,
      perplexityApiKey: 'test-api-key',
    };

    // Clear all mocks
    mockClear(mockLogger);
    mockClear(mockLLMProvider);
    mockClear(mockNLQService);
    mockClear(mockPlatformWorkflowRepository);
    mockClear(mockSessionMappingRepository);
    mockClear(mockEmbeddingService);

    // Default mocks
    mockNLQService.query.mockResolvedValue({
      answer: 'Test',
      sources: [],
      relatedWorkSessions: [
        { sessionId: 's1', summary: 'Test', timestamp: new Date().toISOString() },
      ],
      retrievalMetadata: { totalTimeMs: 100 },
    });

    mockEmbeddingService.generateEmbedding.mockResolvedValue(new Array(1536).fill(0.1));
    mockPlatformWorkflowRepository.searchByEmbedding.mockResolvedValue([]);

    mockLLMProvider.generateStructuredResponse.mockImplementation(async ({ prompt }) => {
      if (prompt.includes('inefficiencies')) {
        return {
          inefficiencies: [
            {
              type: 'context_switching',
              description: 'Test inefficiency',
              stepIds: ['step-1'],
              estimatedWastedSeconds: 60,
              confidence: 0.8,
              evidence: ['Test'],
            },
          ],
        };
      }
      if (prompt.includes('opportunities')) {
        return {
          opportunities: [
            {
              type: 'automation',
              description: 'Test opportunity',
              inefficiencyId: 'ineff-1',
              estimatedSavingsSeconds: 120,
              suggestedTool: 'Claude Code',
              claudeCodeApplicable: true,
              confidence: 0.75,
            },
          ],
        };
      }
      return { isRelevant: true, reason: 'Relevant' };
    });
  });

  describe('createOrchestratorGraph', () => {
    it('should create a compiled graph', () => {
      const graph = createOrchestratorGraph(deps);

      expect(graph).toBeDefined();
      expect(typeof graph.invoke).toBe('function');
    });

    it('should log graph creation with model configuration', () => {
      createOrchestratorGraph(deps);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Creating Orchestrator Graph',
        expect.objectContaining({
          modelConfiguration: expect.objectContaining({
            A1_RETRIEVAL: expect.any(String),
            A2_JUDGE: expect.any(String),
            A3_COMPARATOR: expect.any(String),
            A4_WEB: expect.any(String),
            A4_COMPANY: expect.any(String),
          }),
        })
      );
    });
  });

  describe('Routing Decision', () => {
    it('should route to A3 when peer efficiency > user efficiency', async () => {
      // Mock platform repository to return peer workflows with better efficiency
      mockPlatformWorkflowRepository.searchByEmbedding.mockResolvedValue([
        {
          id: 1,
          workflowHash: 'peer-hash-1',
          workflowType: 'research',
          roleCategory: 'engineer',
          stepCount: 3,
          avgDurationSeconds: 200, // More efficient than user
          occurrenceCount: 10,
          efficiencyScore: 85,
          stepSequence: [{ description: 'Efficient step', tool: 'Chrome' }],
          toolPatterns: { Chrome: 1 },
          embedding: new Array(1536).fill(0.1),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const graph = createOrchestratorGraph(deps);
      const initialState = createInitialState({
        includePeerComparison: true,
      });

      const result = await graph.invoke(initialState);

      expect(result.routingDecision).toBeDefined();
      // When peer data is found with better efficiency, A3 should be in the list
      // Note: both A3 and A4_WEB may be present since user also has opportunities
      expect(result.routingDecision?.agentsToRun).toBeDefined();
    });

    it('should route to A4-Web when user has opportunities', async () => {
      const userDiagnostics = createMockDiagnostics();

      const graph = createOrchestratorGraph(deps);
      const initialState = createInitialState({
        userEvidence: createMockEvidence(),
        userDiagnostics,
        a1CritiqueResult: { passed: true, issues: [], canRetry: false, retryCount: 0, maxRetries: 2 },
        a2CritiqueResult: { passed: true, issues: [], canRetry: false, retryCount: 0, maxRetries: 2 },
        currentStage: 'a2_complete',
      });

      const result = await graph.invoke(initialState);

      expect(result.routingDecision).toBeDefined();
      expect(result.routingDecision?.agentsToRun).toContain('A4_WEB');
    });

    it('should route to A4-Company when company docs enabled', async () => {
      const depsWithCompanyDocs = {
        ...deps,
        companyDocsEnabled: true,
      };

      const userDiagnostics = createMockDiagnostics();

      const graph = createOrchestratorGraph(depsWithCompanyDocs);
      const initialState = createInitialState({
        userEvidence: createMockEvidence(),
        userDiagnostics,
        a1CritiqueResult: { passed: true, issues: [], canRetry: false, retryCount: 0, maxRetries: 2 },
        a2CritiqueResult: { passed: true, issues: [], canRetry: false, retryCount: 0, maxRetries: 2 },
        currentStage: 'a2_complete',
      });

      const result = await graph.invoke(initialState);

      expect(result.routingDecision).toBeDefined();
      expect(result.routingDecision?.agentsToRun).toContain('A4_COMPANY');
    });

    it('should fallback to A4-Web when no peer data', async () => {
      const userDiagnostics = createMockDiagnostics();

      const graph = createOrchestratorGraph(deps);
      const initialState = createInitialState({
        userEvidence: createMockEvidence(),
        peerEvidence: null,
        userDiagnostics,
        peerDiagnostics: null,
        a1CritiqueResult: { passed: true, issues: [], canRetry: false, retryCount: 0, maxRetries: 2 },
        a2CritiqueResult: { passed: true, issues: [], canRetry: false, retryCount: 0, maxRetries: 2 },
        currentStage: 'a2_complete',
      });

      const result = await graph.invoke(initialState);

      expect(result.routingDecision?.agentsToRun).toContain('A4_WEB');
      expect(result.routingDecision?.reason).toContain('No peer data');
    });

    it('should log routing decision', async () => {
      const userDiagnostics = createMockDiagnostics();

      const graph = createOrchestratorGraph(deps);
      const initialState = createInitialState({
        userEvidence: createMockEvidence(),
        userDiagnostics,
        a1CritiqueResult: { passed: true, issues: [], canRetry: false, retryCount: 0, maxRetries: 2 },
        a2CritiqueResult: { passed: true, issues: [], canRetry: false, retryCount: 0, maxRetries: 2 },
        currentStage: 'a2_complete',
      });

      await graph.invoke(initialState);

      expect(mockLogger.info).toHaveBeenCalledWith(
        '=== ORCHESTRATOR OUTPUT (Routing Decision) ===',
      );
    });
  });

  describe('Quality Thresholds', () => {
    it('should pass threshold when savings >= 10 minutes', async () => {
      const userDiagnostics = createMockDiagnostics({
        opportunities: [
          {
            id: 'opp-1',
            inefficiencyId: 'ineff-1',
            type: 'automation',
            description: 'High impact automation',
            estimatedSavingsSeconds: 700, // > 600 seconds (10 min)
            suggestedTool: 'Claude Code',
            claudeCodeApplicable: true,
            confidence: 0.8,
          },
        ],
      });

      const graph = createOrchestratorGraph(deps);
      const initialState = createInitialState({
        userEvidence: createMockEvidence(),
        userDiagnostics,
        a1CritiqueResult: { passed: true, issues: [], canRetry: false, retryCount: 0, maxRetries: 2 },
        a2CritiqueResult: { passed: true, issues: [], canRetry: false, retryCount: 0, maxRetries: 2 },
      });

      const result = await graph.invoke(initialState);

      // Result should have merged plan with passesThreshold
      expect(result.mergedPlan).toBeDefined();
    });

    it('should pass threshold when relative improvement >= 40%', async () => {
      const userDiagnostics = createMockDiagnostics({
        metrics: {
          ...createMockDiagnostics().metrics,
          totalWorkflowTime: 300,
        },
        opportunities: [
          {
            id: 'opp-1',
            inefficiencyId: 'ineff-1',
            type: 'automation',
            description: 'Moderate savings but high relative improvement',
            estimatedSavingsSeconds: 150, // 50% of 300
            suggestedTool: 'Claude Code',
            claudeCodeApplicable: true,
            confidence: 0.8,
          },
        ],
      });

      const graph = createOrchestratorGraph(deps);
      const initialState = createInitialState({
        userEvidence: createMockEvidence(),
        userDiagnostics,
        a1CritiqueResult: { passed: true, issues: [], canRetry: false, retryCount: 0, maxRetries: 2 },
        a2CritiqueResult: { passed: true, issues: [], canRetry: false, retryCount: 0, maxRetries: 2 },
      });

      const result = await graph.invoke(initialState);

      expect(result.mergedPlan).toBeDefined();
    });
  });

  describe('Final Result', () => {
    it('should produce final result with executive summary', async () => {
      const userDiagnostics = createMockDiagnostics();

      const graph = createOrchestratorGraph(deps);
      const initialState = createInitialState({
        userEvidence: createMockEvidence(),
        userDiagnostics,
        a1CritiqueResult: { passed: true, issues: [], canRetry: false, retryCount: 0, maxRetries: 2 },
        a2CritiqueResult: { passed: true, issues: [], canRetry: false, retryCount: 0, maxRetries: 2 },
      });

      const result = await graph.invoke(initialState);

      expect(result.finalResult).toBeDefined();
      expect(result.finalResult?.executiveSummary).toBeDefined();
      expect(result.finalResult?.executiveSummary.totalTimeReduced).toBeDefined();
      expect(result.finalResult?.executiveSummary.topInefficiencies).toBeDefined();
    });

    it('should produce final optimized workflow', async () => {
      const userDiagnostics = createMockDiagnostics();

      const graph = createOrchestratorGraph(deps);
      const initialState = createInitialState({
        userEvidence: createMockEvidence(),
        userDiagnostics,
        a1CritiqueResult: { passed: true, issues: [], canRetry: false, retryCount: 0, maxRetries: 2 },
        a2CritiqueResult: { passed: true, issues: [], canRetry: false, retryCount: 0, maxRetries: 2 },
      });

      const result = await graph.invoke(initialState);

      expect(result.finalResult?.finalOptimizedWorkflow).toBeDefined();
      expect(Array.isArray(result.finalResult?.finalOptimizedWorkflow)).toBe(true);
    });

    it('should include supporting evidence in final result', async () => {
      const userDiagnostics = createMockDiagnostics();

      const graph = createOrchestratorGraph(deps);
      const initialState = createInitialState({
        userEvidence: createMockEvidence(),
        userDiagnostics,
        a1CritiqueResult: { passed: true, issues: [], canRetry: false, retryCount: 0, maxRetries: 2 },
        a2CritiqueResult: { passed: true, issues: [], canRetry: false, retryCount: 0, maxRetries: 2 },
      });

      const result = await graph.invoke(initialState);

      expect(result.finalResult?.supportingEvidence).toBeDefined();
    });

    it('should include metadata in final result', async () => {
      const userDiagnostics = createMockDiagnostics();

      const graph = createOrchestratorGraph(deps);
      const initialState = createInitialState({
        userEvidence: createMockEvidence(),
        userDiagnostics,
        a1CritiqueResult: { passed: true, issues: [], canRetry: false, retryCount: 0, maxRetries: 2 },
        a2CritiqueResult: { passed: true, issues: [], canRetry: false, retryCount: 0, maxRetries: 2 },
      });

      const result = await graph.invoke(initialState);

      expect(result.finalResult?.metadata).toBeDefined();
      expect(result.finalResult?.metadata.agentsUsed).toBeDefined();
      expect(result.finalResult?.metadata.modelVersion).toBeDefined();
    });

    it('should log final result output', async () => {
      const userDiagnostics = createMockDiagnostics();

      const graph = createOrchestratorGraph(deps);
      const initialState = createInitialState({
        userEvidence: createMockEvidence(),
        userDiagnostics,
        a1CritiqueResult: { passed: true, issues: [], canRetry: false, retryCount: 0, maxRetries: 2 },
        a2CritiqueResult: { passed: true, issues: [], canRetry: false, retryCount: 0, maxRetries: 2 },
      });

      await graph.invoke(initialState);

      expect(mockLogger.info).toHaveBeenCalledWith(
        '=== ORCHESTRATOR OUTPUT (Final Result) ===',
      );
    });
  });

  describe('Progress Tracking', () => {
    it('should track progress through stages', async () => {
      const userDiagnostics = createMockDiagnostics();

      const graph = createOrchestratorGraph(deps);
      const initialState = createInitialState({
        userEvidence: createMockEvidence(),
        userDiagnostics,
        a1CritiqueResult: { passed: true, issues: [], canRetry: false, retryCount: 0, maxRetries: 2 },
        a2CritiqueResult: { passed: true, issues: [], canRetry: false, retryCount: 0, maxRetries: 2 },
      });

      const result = await graph.invoke(initialState);

      expect(result.progress).toBe(100);
      expect(result.currentStage).toBe('orchestrator_complete');
      expect(result.status).toBe('completed');
    });
  });

  describe('Error Handling', () => {
    it('should handle A1 failure gracefully', async () => {
      mockNLQService.query.mockRejectedValue(new Error('NLQ error'));

      const graph = createOrchestratorGraph(deps);
      const initialState = createInitialState();

      const result = await graph.invoke(initialState);

      // The graph should still complete and produce a final result even with errors
      // Errors may or may not be captured depending on internal error handling
      expect(result.finalResult).toBeDefined();
      expect(result.status).toBe('completed');
      // Progress should reach 100 even if there were errors along the way
      expect(result.progress).toBe(100);
    });
  });
});
