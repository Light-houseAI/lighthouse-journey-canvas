import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockDeep, mockReset } from 'vitest-mock-extended';

import { InsightRepository } from '../insight-repository';

describe('InsightRepository', () => {
  const mockDatabase = mockDeep<any>();
  let insightRepository: InsightRepository;

  beforeEach(() => {
    mockReset(mockDatabase);

    // Setup query chain mocks
    mockDatabase.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    insightRepository = new InsightRepository({ database: mockDatabase });
  });

  describe('findByNodeId', () => {
    it('should return insights for a given nodeId', async () => {
      // Arrange
      const nodeId = '123e4567-e89b-12d3-a456-426614174000';
      const mockInsights = [
        { id: '1', nodeId, content: 'Insight 1', createdAt: new Date() },
        { id: '2', nodeId, content: 'Insight 2', createdAt: new Date() },
      ];

      mockDatabase
        .select()
        .from()
        .where()
        .orderBy.mockResolvedValue(mockInsights);

      // Act
      const result = await insightRepository.findByNodeId(nodeId);

      // Assert
      expect(result).toEqual(mockInsights);
      expect(mockDatabase.select).toHaveBeenCalled();
    });
  });
});
