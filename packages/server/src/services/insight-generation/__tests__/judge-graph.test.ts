/**
 * Unit Tests for A2 Judge Agent Graph
 *
 * Tests the judge agent that analyzes evidence and produces diagnostics.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock, mockClear, type MockProxy } from 'vitest-mock-extended';

import type { Logger } from '../../../core/logger';
import type { LLMProvider } from '../../../core/llm-provider';
import { createJudgeGraph, type JudgeGraphDeps } from '../graphs/judge-graph';
import type { InsightState } from '../state/insight-state';
import type { EvidenceBundle, UserWorkflow, UserStep } from '../types';

describe('A2 Judge Agent Graph', () => {
  let mockLogger: MockProxy<Logger>;
  let mockLLMProvider: MockProxy<LLMProvider>;
  let deps: JudgeGraphDeps;

  const createMockStep = (overrides: Partial<UserStep> = {}): UserStep => ({
    stepId: `step-${Math.random().toString(36).substr(2, 9)}`,
    description: 'Test step description',
    tool: 'Chrome',
    toolCategory: 'browser',
    durationSeconds: 60,
    timestamp: new Date().toISOString(),
    order: 1,
    ...overrides,
  });

  const createMockWorkflow = (overrides: Partial<UserWorkflow> = {}): UserWorkflow => ({
    workflowId: `wf-${Math.random().toString(36).substr(2, 9)}`,
    name: 'Test Workflow',
    intent: 'Research and development',
    approach: 'Multi-step approach',
    steps: [
      createMockStep({ stepId: 'step-1', description: 'Search Google', durationSeconds: 30, order: 1 }),
      createMockStep({ stepId: 'step-2', description: 'Read documentation', durationSeconds: 120, order: 2 }),
      createMockStep({ stepId: 'step-3', description: 'Write code in VSCode', tool: 'VSCode', durationSeconds: 300, order: 3 }),
    ],
    totalDurationSeconds: 450,
    tools: ['Chrome', 'VSCode'],
    sessionId: 'session-1',
    startTime: new Date().toISOString(),
    endTime: new Date().toISOString(),
    ...overrides,
  });

  const createMockEvidence = (overrides: Partial<EvidenceBundle> = {}): EvidenceBundle => ({
    workflows: [createMockWorkflow()],
    sessions: [
      {
        sessionId: 'session-1',
        summary: 'Test session',
        startTime: new Date().toISOString(),
        durationSeconds: 450,
        workflowCount: 1,
      },
    ],
    entities: [],
    concepts: [],
    totalStepCount: 3,
    totalDurationSeconds: 450,
    retrievalMetadata: {
      queryTimeMs: 100,
      sourcesRetrieved: 5,
      retrievalMethod: 'hybrid',
      embeddingModel: 'text-embedding-3-small',
    },
    ...overrides,
  });

  const createInitialState = (overrides: Partial<InsightState> = {}): InsightState => ({
    query: 'How can I improve my workflow?',
    userId: 1,
    nodeId: null,
    lookbackDays: 30,
    includePeerComparison: true,
    userEvidence: createMockEvidence(),
    peerEvidence: null,
    a1CritiqueResult: { passed: true, issues: [], canRetry: false, retryCount: 0, maxRetries: 2 },
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
    currentStage: 'a1_complete',
    status: 'processing',
    progress: 30,
    errors: [],
    ...overrides,
  });

  beforeEach(() => {
    mockLogger = mock<Logger>();
    mockLLMProvider = mock<LLMProvider>();

    deps = {
      logger: mockLogger,
      llmProvider: mockLLMProvider,
    };

    // Clear all mocks
    mockClear(mockLogger);
    mockClear(mockLLMProvider);

    // Default LLM mock responses
    mockLLMProvider.generateStructuredResponse.mockImplementation(async ({ schema, prompt }) => {
      // Return appropriate mock based on prompt content
      if (prompt.includes('Analyze this workflow for inefficiencies')) {
        return {
          inefficiencies: [
            {
              type: 'context_switching',
              description: 'Frequent switching between browser and IDE',
              stepIds: ['step-1', 'step-3'],
              estimatedWastedSeconds: 60,
              confidence: 0.8,
              evidence: ['Step 1 to Step 3 shows tool switch'],
            },
          ],
        };
      }
      if (prompt.includes('Given these workflow inefficiencies')) {
        return {
          opportunities: [
            {
              type: 'automation',
              description: 'Use Claude Code to automate research',
              inefficiencyId: 'ineff-1',
              estimatedSavingsSeconds: 120,
              suggestedTool: 'Claude Code',
              claudeCodeApplicable: true,
              confidence: 0.75,
            },
          ],
        };
      }
      if (prompt.includes('generic')) {
        return {
          hasGenericAdvice: false,
          details: '',
          affectedIds: [],
        };
      }
      return {};
    });
  });

  describe('createJudgeGraph', () => {
    it('should create a compiled graph', () => {
      const graph = createJudgeGraph(deps);

      expect(graph).toBeDefined();
      expect(typeof graph.invoke).toBe('function');
    });

    it('should log graph creation', () => {
      createJudgeGraph(deps);

      expect(mockLogger.info).toHaveBeenCalledWith('Creating A2 Judge Graph');
    });
  });

  describe('User Diagnostics', () => {
    it('should produce diagnostics with inefficiencies and opportunities', async () => {
      const graph = createJudgeGraph(deps);
      const initialState = createInitialState();

      const result = await graph.invoke(initialState);

      expect(result.userDiagnostics).toBeDefined();
      expect(result.userDiagnostics?.inefficiencies).toBeDefined();
      expect(result.userDiagnostics?.opportunities).toBeDefined();
    });

    it('should calculate workflow metrics', async () => {
      const graph = createJudgeGraph(deps);
      const initialState = createInitialState();

      const result = await graph.invoke(initialState);

      expect(result.userDiagnostics?.metrics).toBeDefined();
      expect(result.userDiagnostics?.metrics.totalWorkflowTime).toBeGreaterThanOrEqual(0);
      expect(result.userDiagnostics?.metrics.contextSwitches).toBeGreaterThanOrEqual(0);
    });

    it('should calculate efficiency score', async () => {
      const graph = createJudgeGraph(deps);
      const initialState = createInitialState();

      const result = await graph.invoke(initialState);

      expect(result.userDiagnostics?.overallEfficiencyScore).toBeDefined();
      expect(result.userDiagnostics?.overallEfficiencyScore).toBeGreaterThanOrEqual(0);
      expect(result.userDiagnostics?.overallEfficiencyScore).toBeLessThanOrEqual(100);
    });

    it('should log user diagnostics output', async () => {
      const graph = createJudgeGraph(deps);
      const initialState = createInitialState();

      await graph.invoke(initialState);

      expect(mockLogger.info).toHaveBeenCalledWith(
        '=== A2 JUDGE AGENT OUTPUT (User Diagnostics) ===',
      );
    });

    it('should skip diagnostics when no user evidence', async () => {
      const graph = createJudgeGraph(deps);
      const initialState = createInitialState({ userEvidence: null });

      const result = await graph.invoke(initialState);

      expect(result.userDiagnostics).toBeNull();
    });
  });

  describe('Peer Diagnostics', () => {
    it('should analyze peer evidence when available', async () => {
      const peerEvidence = createMockEvidence({
        workflows: [
          createMockWorkflow({
            name: 'Peer Efficient Workflow',
            totalDurationSeconds: 200,
          }),
        ],
      });

      const graph = createJudgeGraph(deps);
      const initialState = createInitialState({ peerEvidence });

      const result = await graph.invoke(initialState);

      expect(result.peerDiagnostics).toBeDefined();
    });

    it('should skip peer diagnostics when no peer evidence', async () => {
      const graph = createJudgeGraph(deps);
      const initialState = createInitialState({ peerEvidence: null });

      const result = await graph.invoke(initialState);

      expect(result.peerDiagnostics).toBeNull();
    });
  });

  describe('Critique Loop', () => {
    it('should critique diagnostics for missing step references', async () => {
      // Mock LLM to return inefficiencies without step IDs
      mockLLMProvider.generateStructuredResponse.mockImplementation(async ({ prompt }) => {
        if (prompt.includes('inefficiencies')) {
          return {
            inefficiencies: [
              {
                type: 'other',
                description: 'Generic inefficiency',
                stepIds: [], // No step IDs - should fail critique
                estimatedWastedSeconds: 30,
                confidence: 0.6,
                evidence: [],
              },
            ],
          };
        }
        return { opportunities: [] };
      });

      const graph = createJudgeGraph(deps);
      const initialState = createInitialState();

      const result = await graph.invoke(initialState);

      expect(result.a2CritiqueResult).toBeDefined();
      expect(result.a2CritiqueResult?.issues.length).toBeGreaterThan(0);
    });

    it('should pass critique with valid diagnostics', async () => {
      const graph = createJudgeGraph(deps);
      const initialState = createInitialState();

      const result = await graph.invoke(initialState);

      expect(result.a2CritiqueResult).toBeDefined();
    });

    it('should log critique output', async () => {
      const graph = createJudgeGraph(deps);
      const initialState = createInitialState();

      await graph.invoke(initialState);

      expect(mockLogger.info).toHaveBeenCalledWith(
        '=== A2 JUDGE AGENT OUTPUT (Critique) ===',
      );
    });
  });

  describe('Inefficiency Types', () => {
    const inefficiencyTypes = [
      'repetitive_search',
      'context_switching',
      'rework_loop',
      'manual_automation',
      'idle_time',
      'tool_fragmentation',
      'information_gathering',
    ];

    inefficiencyTypes.forEach((type) => {
      it(`should handle ${type} inefficiency type`, async () => {
        mockLLMProvider.generateStructuredResponse.mockImplementation(async ({ prompt }) => {
          if (prompt.includes('inefficiencies')) {
            return {
              inefficiencies: [
                {
                  type,
                  description: `${type} inefficiency detected`,
                  stepIds: ['step-1', 'step-2'],
                  estimatedWastedSeconds: 60,
                  confidence: 0.8,
                  evidence: ['Evidence for ' + type],
                },
              ],
            };
          }
          return { opportunities: [] };
        });

        const graph = createJudgeGraph(deps);
        const initialState = createInitialState();

        const result = await graph.invoke(initialState);

        expect(result.userDiagnostics?.inefficiencies).toBeDefined();
      });
    });
  });

  describe('Opportunity Types', () => {
    const opportunityTypes = [
      'automation',
      'consolidation',
      'tool_switch',
      'workflow_reorder',
      'elimination',
      'claude_code_integration',
    ];

    opportunityTypes.forEach((type) => {
      it(`should handle ${type} opportunity type`, async () => {
        mockLLMProvider.generateStructuredResponse.mockImplementation(async ({ prompt }) => {
          if (prompt.includes('inefficiencies')) {
            return {
              inefficiencies: [
                {
                  type: 'context_switching',
                  description: 'Test',
                  stepIds: ['step-1'],
                  estimatedWastedSeconds: 30,
                  confidence: 0.7,
                  evidence: ['Test'],
                },
              ],
            };
          }
          if (prompt.includes('opportunities')) {
            return {
              opportunities: [
                {
                  type,
                  description: `${type} opportunity`,
                  inefficiencyId: 'ineff-1',
                  estimatedSavingsSeconds: 60,
                  suggestedTool: type === 'claude_code_integration' ? 'Claude Code' : 'Tool',
                  claudeCodeApplicable: type === 'claude_code_integration',
                  confidence: 0.75,
                },
              ],
            };
          }
          return {};
        });

        const graph = createJudgeGraph(deps);
        const initialState = createInitialState();

        const result = await graph.invoke(initialState);

        expect(result.userDiagnostics?.opportunities).toBeDefined();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle LLM errors gracefully', async () => {
      mockLLMProvider.generateStructuredResponse.mockRejectedValue(
        new Error('LLM error')
      );

      const graph = createJudgeGraph(deps);
      const initialState = createInitialState();

      const result = await graph.invoke(initialState);

      // Should have empty inefficiencies but not crash
      expect(result).toBeDefined();
    });
  });
});
