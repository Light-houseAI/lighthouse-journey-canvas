/**
 * Unit Tests for ExplanationMergingService (LIG-207)
 *
 * Tests merging of GraphRAG and trajectory-based explanations.
 * Validates text concatenation and truncation logic.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { mock, mockClear, type MockProxy } from 'vitest-mock-extended';

import type { LLMProvider } from '../../core/llm-provider';
import type { Logger } from '../../core/logger';
import { ExplanationMergingService } from '../explanation-merging.service';
import type { TrajectoryMatchResult } from '../job-application-trajectory-matcher/types';

describe('ExplanationMergingService', () => {
  let service: ExplanationMergingService;
  let mockLogger: MockProxy<Logger>;
  let mockLLMProvider: MockProxy<LLMProvider>;

  beforeEach(() => {
    mockLogger = mock<Logger>();
    mockLLMProvider = mock<LLMProvider>();
    service = new ExplanationMergingService({
      logger: mockLogger,
      llmProvider: mockLLMProvider,
    });
    mockClear(mockLogger);
    mockClear(mockLLMProvider);
  });

  describe('mergeExplanations', () => {
    it('should prepend trajectory explanations with "Career path:" prefix', async () => {
      const graphRAGWhyMatched = [
        'Semantic match on skills',
        'Similar projects',
      ];
      const trajectoryMatch: TrajectoryMatchResult = {
        userId: 1,
        score: 0.8,
        subscores: {
          roleAlignment: 0.8,
          levelProgression: 0.8,
          companyMatch: 0.8,
          recency: 0.8,
        },
        explanation: ['Strong role progression', 'Similar career trajectory'],
      };

      const result = await service.mergeExplanations(
        graphRAGWhyMatched,
        trajectoryMatch
      );

      // Trajectory insights should come first with prefix
      expect(result).toHaveLength(4);
      expect(result[0]).toBe('Career path: Strong role progression');
      expect(result[1]).toBe('Career path: Similar career trajectory');
      expect(result[2]).toBe('Semantic match on skills');
      expect(result[3]).toBe('Similar projects');
    });

    it('should handle empty trajectory explanations', async () => {
      const graphRAGWhyMatched = ['Semantic match'];
      const trajectoryMatch: TrajectoryMatchResult = {
        userId: 1,
        score: 0.8,
        subscores: {
          roleAlignment: 0.8,
          levelProgression: 0.8,
          companyMatch: 0.8,
          recency: 0.8,
        },
        explanation: [],
      };

      const result = await service.mergeExplanations(
        graphRAGWhyMatched,
        trajectoryMatch
      );

      // Should only include GraphRAG explanations
      expect(result).toEqual(['Semantic match']);
    });

    it('should handle empty GraphRAG explanations', async () => {
      const graphRAGWhyMatched: string[] = [];
      const trajectoryMatch: TrajectoryMatchResult = {
        userId: 1,
        score: 0.8,
        subscores: {
          roleAlignment: 0.8,
          levelProgression: 0.8,
          companyMatch: 0.8,
          recency: 0.8,
        },
        explanation: ['Good career progression'],
      };

      const result = await service.mergeExplanations(
        graphRAGWhyMatched,
        trajectoryMatch
      );

      // Should only include trajectory explanations
      expect(result).toEqual(['Career path: Good career progression']);
    });

    it('should limit combined explanations to MAX (5)', async () => {
      const graphRAGWhyMatched = [
        'Reason 1',
        'Reason 2',
        'Reason 3',
        'Reason 4',
      ];
      const trajectoryMatch: TrajectoryMatchResult = {
        userId: 1,
        score: 0.8,
        subscores: {
          roleAlignment: 0.8,
          levelProgression: 0.8,
          companyMatch: 0.8,
          recency: 0.8,
        },
        explanation: ['Career reason 1', 'Career reason 2', 'Career reason 3'],
      };

      const result = await service.mergeExplanations(
        graphRAGWhyMatched,
        trajectoryMatch
      );

      // Total would be 7, but limited to 5
      expect(result).toHaveLength(5);
      expect(result[0]).toBe('Career path: Career reason 1');
      expect(result[1]).toBe('Career path: Career reason 2');
      expect(result[2]).toBe('Career path: Career reason 3');
      expect(result[3]).toBe('Reason 1');
      expect(result[4]).toBe('Reason 2');
    });

    it('should handle both empty arrays', async () => {
      const graphRAGWhyMatched: string[] = [];
      const trajectoryMatch: TrajectoryMatchResult = {
        userId: 1,
        score: 0.8,
        subscores: {
          roleAlignment: 0.8,
          levelProgression: 0.8,
          companyMatch: 0.8,
          recency: 0.8,
        },
        explanation: [],
      };

      const result = await service.mergeExplanations(
        graphRAGWhyMatched,
        trajectoryMatch
      );

      expect(result).toEqual([]);
    });

    it('should log merge statistics', async () => {
      const graphRAGWhyMatched = ['Semantic match'];
      const trajectoryMatch: TrajectoryMatchResult = {
        userId: 123,
        score: 0.8,
        subscores: {
          roleAlignment: 0.8,
          levelProgression: 0.8,
          companyMatch: 0.8,
          recency: 0.8,
        },
        explanation: ['Career progression'],
      };

      await service.mergeExplanations(graphRAGWhyMatched, trajectoryMatch);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Fallback merge completed',
        {
          userId: 123,
          trajectoryCount: 1,
          graphRAGCount: 1,
          totalCount: 2,
          limitedCount: 2,
        }
      );
    });

    it('should handle undefined trajectory explanation array', async () => {
      const graphRAGWhyMatched = ['Semantic match'];
      const trajectoryMatch: TrajectoryMatchResult = {
        userId: 1,
        score: 0.8,
        subscores: {
          roleAlignment: 0.8,
          levelProgression: 0.8,
          companyMatch: 0.8,
          recency: 0.8,
        },
        explanation: undefined as any,
      };

      const result = await service.mergeExplanations(
        graphRAGWhyMatched,
        trajectoryMatch
      );

      // Should gracefully handle undefined
      expect(result).toEqual(['Semantic match']);
    });

    it('should handle undefined GraphRAG whyMatched array', async () => {
      const graphRAGWhyMatched = undefined as any;
      const trajectoryMatch: TrajectoryMatchResult = {
        userId: 1,
        score: 0.8,
        subscores: {
          roleAlignment: 0.8,
          levelProgression: 0.8,
          companyMatch: 0.8,
          recency: 0.8,
        },
        explanation: ['Career progression'],
      };

      const result = await service.mergeExplanations(
        graphRAGWhyMatched,
        trajectoryMatch
      );

      // Should gracefully handle undefined
      expect(result).toEqual(['Career path: Career progression']);
    });
  });

  describe('LLM Enhancement', () => {
    const createMockTrajectoryMatch = (): TrajectoryMatchResult => ({
      userId: 123,
      score: 0.85,
      subscores: {
        roleAlignment: 0.9,
        levelProgression: 0.8,
        companyMatch: 0.7,
        recency: 0.95,
      },
      explanation: ['Progressed from Mid to Senior Engineer in 2 years'],
    });

    it('should successfully enhance explanations using LLM', async () => {
      const graphRAGWhyMatched = ['Strong React experience'];
      const trajectoryMatch = createMockTrajectoryMatch();

      // Mock successful LLM response
      mockLLMProvider.generateStructuredResponse.mockResolvedValue({
        content: {
          explanations: [
            'Similar career progression through senior engineering roles',
            'Consistent upward trajectory in software development field',
          ],
        },
      });

      const result = await service.mergeExplanations(
        graphRAGWhyMatched,
        trajectoryMatch,
        'Senior Software Engineer',
        'Google'
      );

      // Should use LLM-enhanced explanations
      expect(mockLLMProvider.generateStructuredResponse).toHaveBeenCalledTimes(
        1
      );
      expect(result).toContain(
        'Similar career progression through senior engineering roles'
      );
      expect(result).toContain(
        'Consistent upward trajectory in software development field'
      );

      // Should limit to MAX_COMBINED_EXPLANATIONS (5)
      expect(result.length).toBeLessThanOrEqual(5);
    });

    it('should call LLM with correct schema validating 40-80 char length', async () => {
      const trajectoryMatch = createMockTrajectoryMatch();

      mockLLMProvider.generateStructuredResponse.mockResolvedValue({
        content: {
          explanations: ['Test explanation with enough characters here'],
        },
      });

      await service.mergeExplanations([], trajectoryMatch, 'Senior Engineer');

      const callArgs = mockLLMProvider.generateStructuredResponse.mock.calls[0];
      const schema = callArgs[1];

      // Verify schema enforces 40-80 character range
      expect(() => schema.parse({ explanations: ['Too short'] })).toThrow();
      expect(() =>
        schema.parse({
          explanations: [
            'This is exactly forty characters long!!!',
            'Second valid explanation with proper length',
          ],
        })
      ).not.toThrow();
      expect(() =>
        schema.parse({
          explanations: [
            'x'.repeat(81),
            'Valid second explanation with enough characters',
          ],
        })
      ).toThrow();
    });

    it('should call LLM with temperature 0.1 and 250 tokens', async () => {
      const trajectoryMatch = createMockTrajectoryMatch();

      mockLLMProvider.generateStructuredResponse.mockResolvedValue({
        content: {
          explanations: ['Valid explanation with proper length here ok'],
        },
      });

      await service.mergeExplanations([], trajectoryMatch);

      expect(mockLLMProvider.generateStructuredResponse).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(Object),
        expect.objectContaining({
          temperature: 0.1,
          maxTokens: 250,
        })
      );
    });

    it('should fallback to simple merge if LLM fails', async () => {
      const graphRAGWhyMatched = ['Semantic match'];
      const trajectoryMatch = createMockTrajectoryMatch();

      // Mock LLM failure
      mockLLMProvider.generateStructuredResponse.mockRejectedValue(
        new Error('LLM API error')
      );

      const result = await service.mergeExplanations(
        graphRAGWhyMatched,
        trajectoryMatch
      );

      // Should fallback to simple prepending
      expect(result).toContain(
        'Career path: Progressed from Mid to Senior Engineer in 2 years'
      );
      expect(result).toContain('Semantic match');

      // Should log the warning
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('LLM explanation enhancement failed'),
        expect.objectContaining({
          error: 'LLM API error',
          userId: 123,
        })
      );
    });

    it('should timeout after 10 seconds and fallback', async () => {
      const trajectoryMatch = createMockTrajectoryMatch();

      // Use fake timers to speed up the test
      const { vi } = await import('vitest');
      vi.useFakeTimers();

      // Mock LLM that takes too long
      mockLLMProvider.generateStructuredResponse.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 20000))
      );

      const resultPromise = service.mergeExplanations(
        ['GraphRAG match'],
        trajectoryMatch
      );

      // Fast-forward time to trigger timeout
      await vi.advanceTimersByTimeAsync(10000);

      const result = await resultPromise;

      // Should timeout and fallback
      expect(result).toContain(
        'Career path: Progressed from Mid to Senior Engineer in 2 years'
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('failed'),
        expect.objectContaining({
          error: expect.stringContaining('timeout'),
        })
      );

      vi.useRealTimers();
    });

    it('should include target role/company context in LLM prompt', async () => {
      const trajectoryMatch = createMockTrajectoryMatch();
      const targetRole = 'Staff Engineer';
      const targetCompany = 'Meta';

      mockLLMProvider.generateStructuredResponse.mockResolvedValue({
        content: {
          explanations: ['Relevant experience for Meta Staff Engineer role'],
        },
      });

      await service.mergeExplanations(
        [],
        trajectoryMatch,
        targetRole,
        targetCompany
      );

      const callArgs = mockLLMProvider.generateStructuredResponse.mock.calls[0];
      const messages = callArgs[0];
      const userMessage = messages.find((m: any) => m.role === 'user');

      expect(userMessage.content).toContain('Staff Engineer');
      expect(userMessage.content).toContain('Meta');
    });

    it('should handle zero trajectory score gracefully (skip LLM)', async () => {
      const graphRAGWhyMatched = ['GraphRAG match'];
      const trajectoryMatch: TrajectoryMatchResult = {
        ...createMockTrajectoryMatch(),
        score: 0, // Zero score
      };

      const result = await service.mergeExplanations(
        graphRAGWhyMatched,
        trajectoryMatch
      );

      // Should skip LLM enhancement and return GraphRAG only
      expect(mockLLMProvider.generateStructuredResponse).not.toHaveBeenCalled();
      expect(result).toEqual(['GraphRAG match']);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'No trajectory context, using GraphRAG only'
      );
    });

    it('should log LLM success with enhanced count', async () => {
      const trajectoryMatch = createMockTrajectoryMatch();

      mockLLMProvider.generateStructuredResponse.mockResolvedValue({
        content: {
          explanations: [
            'Enhanced explanation one with proper character length',
            'Enhanced explanation two also meets length requirement',
          ],
        },
      });

      await service.mergeExplanations([], trajectoryMatch);

      expect(mockLogger.info).toHaveBeenCalledWith(
        '✅ Successfully generated LLM-enhanced explanations',
        expect.objectContaining({
          userId: 123,
          enhancedCount: 2,
        })
      );
    });

    it('should fallback if LLM returns empty array', async () => {
      const trajectoryMatch = createMockTrajectoryMatch();

      mockLLMProvider.generateStructuredResponse.mockResolvedValue({
        content: { explanations: [] },
      });

      const result = await service.mergeExplanations([], trajectoryMatch);

      // Should fallback to base explanations
      expect(result).toContain(
        'Career path: Progressed from Mid to Senior Engineer in 2 years'
      );
    });
  });
});
