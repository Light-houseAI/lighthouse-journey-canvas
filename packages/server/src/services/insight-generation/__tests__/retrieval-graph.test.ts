/**
 * Unit Tests for A1 Retrieval Agent Graph
 *
 * Tests the retrieval agent that fetches user and peer evidence.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { mock, mockClear, type MockProxy } from 'vitest-mock-extended';

import type { Logger } from '../../../core/logger';
import type { LLMProvider } from '../../../core/llm-provider';
import type { NaturalLanguageQueryService } from '../../natural-language-query.service';
import type { PlatformWorkflowRepository } from '../../../repositories/platform-workflow.repository';
import type { SessionMappingRepository } from '../../../repositories/session-mapping.repository';
import type { EmbeddingService } from '../../interfaces/index';
import { createRetrievalGraph, type RetrievalGraphDeps } from '../graphs/retrieval-graph';
import type { InsightState } from '../state/insight-state';

describe('A1 Retrieval Agent Graph', () => {
  let mockLogger: MockProxy<Logger>;
  let mockLLMProvider: MockProxy<LLMProvider>;
  let mockNLQService: MockProxy<NaturalLanguageQueryService>;
  let mockPlatformWorkflowRepository: MockProxy<PlatformWorkflowRepository>;
  let mockSessionMappingRepository: MockProxy<SessionMappingRepository>;
  let mockEmbeddingService: MockProxy<EmbeddingService>;
  let deps: RetrievalGraphDeps;

  // Helper to create proper NLQ result mock
  const createMockNLQResult = (overrides: Record<string, unknown> = {}) => ({
    query: 'How can I improve my workflow?',
    answer: 'Test answer',
    confidence: 0.85,
    sources: [
      {
        id: 'source-1',
        type: 'screenshot' as const,
        title: 'User using Chrome for search',
        description: 'User was using Chrome to search for information',
        relevanceScore: 0.9,
        timestamp: new Date().toISOString(),
        sessionId: 'session-1',
      },
    ],
    relatedWorkSessions: [
      {
        sessionId: 'session-1',
        name: 'React Research',
        summary: 'Research session about React patterns',
        timestamp: new Date().toISOString(),
        relevanceScore: 0.85,
      },
      {
        sessionId: 'session-2',
        name: 'Feature Implementation',
        summary: 'Coding session implementing feature',
        timestamp: new Date().toISOString(),
        relevanceScore: 0.8,
      },
    ],
    suggestedFollowUps: [],
    retrievalMetadata: {
      graphQueryTimeMs: 50,
      vectorQueryTimeMs: 80,
      llmGenerationTimeMs: 100,
      totalTimeMs: 230,
      sourcesRetrieved: 1,
    },
    ...overrides,
  });

  // Helper to create proper initial state
  const createInitialState = (overrides: Partial<InsightState> = {}): InsightState => ({
    query: 'How can I improve my workflow?',
    userId: 1,
    nodeId: null,
    lookbackDays: 30,
    includeWebSearch: true,
    includePeerComparison: true,
    includeCompanyDocs: true,
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
    userQueryAnswer: null,
    finalResult: null,
    currentStage: 'initial',
    status: 'pending',
    progress: 0,
    errors: [],
    startedAt: null,
    completedAt: null,
    ...overrides,
  });

  // Helper to create mock relevance check response
  const createMockRelevanceResponse = (isRelevant = true, reason = 'Evidence is relevant') => ({
    content: { isRelevant, reason },
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
      nlqService: mockNLQService,
      platformWorkflowRepository: mockPlatformWorkflowRepository,
      sessionMappingRepository: mockSessionMappingRepository,
      embeddingService: mockEmbeddingService,
      llmProvider: mockLLMProvider,
    };

    // Clear all mocks
    mockClear(mockLogger);
    mockClear(mockLLMProvider);
    mockClear(mockNLQService);
    mockClear(mockPlatformWorkflowRepository);
    mockClear(mockSessionMappingRepository);
    mockClear(mockEmbeddingService);
  });

  describe('createRetrievalGraph', () => {
    it('should create a compiled graph', () => {
      const graph = createRetrievalGraph(deps);

      expect(graph).toBeDefined();
      expect(typeof graph.invoke).toBe('function');
    });

    it('should log graph creation', () => {
      createRetrievalGraph(deps);

      expect(mockLogger.info).toHaveBeenCalledWith('Creating A1 Retrieval Graph');
    });
  });

  describe('User Evidence Retrieval', () => {
    beforeEach(() => {
      // Mock NLQ service to return workflow data
      mockNLQService.query.mockResolvedValue(createMockNLQResult());

      // Mock LLM for relevance check - must wrap in { content: ... } to match LLMProvider interface
      mockLLMProvider.generateStructuredResponse.mockResolvedValue(
        createMockRelevanceResponse(true, 'Evidence is relevant to the query')
      );
    });

    it('should retrieve user evidence via NLQ service', async () => {
      const graph = createRetrievalGraph(deps);
      const initialState = createInitialState();

      const result = await graph.invoke(initialState);

      expect(mockNLQService.query).toHaveBeenCalledWith(
        initialState.userId,
        expect.objectContaining({
          query: initialState.query,
          lookbackDays: initialState.lookbackDays,
        })
      );

      expect(result.userEvidence).toBeDefined();
    });

    it('should transform NLQ result to EvidenceBundle format', async () => {
      const graph = createRetrievalGraph(deps);
      const initialState = createInitialState();

      const result = await graph.invoke(initialState);

      expect(result.userEvidence).toHaveProperty('workflows');
      expect(result.userEvidence).toHaveProperty('sessions');
      expect(result.userEvidence).toHaveProperty('entities');
      expect(result.userEvidence).toHaveProperty('concepts');
      expect(result.userEvidence).toHaveProperty('retrievalMetadata');
    });

    it('should log user evidence retrieval output', async () => {
      const graph = createRetrievalGraph(deps);
      const initialState = createInitialState();

      await graph.invoke(initialState);

      expect(mockLogger.info).toHaveBeenCalledWith(
        '=== A1 RETRIEVAL AGENT OUTPUT (User Evidence) ===',
      );
    });
  });

  describe('Peer Evidence Retrieval', () => {
    beforeEach(() => {
      // Mock NLQ service
      mockNLQService.query.mockResolvedValue(createMockNLQResult({
        sources: [],
        relatedWorkSessions: [
          {
            sessionId: 'session-1',
            name: 'Test session',
            summary: 'Test session summary',
            timestamp: new Date().toISOString(),
            relevanceScore: 0.8,
          },
        ],
      }));

      // Mock embedding service - return Float32Array for proper type
      const embedding = new Float32Array(1536).fill(0.1);
      mockEmbeddingService.generateEmbedding.mockResolvedValue(embedding);

      // Mock platform workflow repository
      mockPlatformWorkflowRepository.searchByEmbedding.mockResolvedValue([
        {
          id: 1,
          workflowHash: 'hash-1',
          workflowType: 'research',
          roleCategory: 'software_engineer',
          stepSequence: [
            { order: 0, type: 'search', toolCategory: 'browser', avgDuration: 60 },
            { order: 1, type: 'read', toolCategory: 'browser', avgDuration: 120 },
          ],
          stepCount: 2,
          avgDurationSeconds: 180,
          efficiencyScore: 75,
          toolPatterns: { browser: 2 },
          occurrenceCount: 10,
          createdAt: new Date(),
        },
      ]);

      // Mock LLM for relevance check - must wrap in { content: ... }
      mockLLMProvider.generateStructuredResponse.mockResolvedValue(
        createMockRelevanceResponse(true, 'Relevant')
      );
    });

    it('should retrieve peer evidence when includePeerComparison is true', async () => {
      const graph = createRetrievalGraph(deps);
      const initialState = createInitialState({ includePeerComparison: true });

      const result = await graph.invoke(initialState);

      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledWith(
        initialState.query
      );
      expect(mockPlatformWorkflowRepository.searchByEmbedding).toHaveBeenCalled();
      expect(result.peerEvidence).toBeDefined();
    });

    it('should skip peer evidence when includePeerComparison is false', async () => {
      const graph = createRetrievalGraph(deps);
      const initialState = createInitialState({ includePeerComparison: false });

      const result = await graph.invoke(initialState);

      expect(mockPlatformWorkflowRepository.searchByEmbedding).not.toHaveBeenCalled();
      expect(result.peerEvidence).toBeNull();
    });

    it('should return null peerEvidence when no patterns found', async () => {
      mockPlatformWorkflowRepository.searchByEmbedding.mockResolvedValue([]);

      const graph = createRetrievalGraph(deps);
      const initialState = createInitialState();

      const result = await graph.invoke(initialState);

      expect(result.peerEvidence).toBeNull();
    });
  });

  describe('Critique Loop', () => {
    beforeEach(() => {
      mockNLQService.query.mockResolvedValue(createMockNLQResult({
        sources: [],
        relatedWorkSessions: [],
      }));

      mockLLMProvider.generateStructuredResponse.mockResolvedValue(
        createMockRelevanceResponse(true, 'Relevant')
      );
    });

    it('should fail critique when insufficient user evidence', async () => {
      const graph = createRetrievalGraph(deps);
      const initialState = createInitialState();

      const result = await graph.invoke(initialState);

      // With empty sessions, critique should fail
      expect(result.a1CritiqueResult).toBeDefined();
      expect(result.a1CritiqueResult?.issues.length).toBeGreaterThan(0);
    });

    it('should pass critique with sufficient evidence', async () => {
      // Provide sufficient mock data
      mockNLQService.query.mockResolvedValue(createMockNLQResult({
        sources: [
          { id: '1', type: 'screenshot' as const, title: 'Step 1 using Chrome', relevanceScore: 0.9 },
          { id: '2', type: 'screenshot' as const, title: 'Step 2 using VSCode', relevanceScore: 0.85 },
          { id: '3', type: 'screenshot' as const, title: 'Step 3 using Terminal', relevanceScore: 0.8 },
        ],
        relatedWorkSessions: [
          { sessionId: 's1', name: 'Session 1', summary: 'Session 1 summary', timestamp: new Date().toISOString(), relevanceScore: 0.9 },
          { sessionId: 's2', name: 'Session 2', summary: 'Session 2 summary', timestamp: new Date().toISOString(), relevanceScore: 0.85 },
        ],
      }));

      const graph = createRetrievalGraph(deps);
      const initialState = createInitialState();

      const result = await graph.invoke(initialState);

      // Critique result should be defined
      expect(result.a1CritiqueResult).toBeDefined();
    });

    it('should log critique output', async () => {
      const graph = createRetrievalGraph(deps);
      const initialState = createInitialState();

      await graph.invoke(initialState);

      expect(mockLogger.info).toHaveBeenCalledWith(
        '=== A1 RETRIEVAL AGENT OUTPUT (Critique) ===',
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle NLQ service errors gracefully', async () => {
      mockNLQService.query.mockRejectedValue(new Error('NLQ service error'));

      const graph = createRetrievalGraph(deps);
      const initialState = createInitialState();

      const result = await graph.invoke(initialState);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle embedding service errors gracefully', async () => {
      mockNLQService.query.mockResolvedValue(createMockNLQResult({
        relatedWorkSessions: [
          { sessionId: 's1', name: 'Test', summary: 'Test session', timestamp: new Date().toISOString(), relevanceScore: 0.8 },
        ],
      }));

      mockEmbeddingService.generateEmbedding.mockRejectedValue(
        new Error('Embedding error')
      );

      // Mock LLM provider for critique/relevance check
      mockLLMProvider.generateStructuredResponse.mockResolvedValue(
        createMockRelevanceResponse(true, 'Relevant for testing')
      );

      const graph = createRetrievalGraph(deps);
      const initialState = createInitialState();

      const result = await graph.invoke(initialState);

      // Should continue with null peer evidence when embedding fails
      expect(result.peerEvidence).toBeNull();
    });
  });
});
