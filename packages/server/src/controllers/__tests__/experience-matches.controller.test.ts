import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockDeep, mockReset } from 'vitest-mock-extended';

import type { Logger } from '../../core/logger';
import type { IExperienceMatchesService } from '../../services/interfaces';
import { ExperienceMatchesController } from '../experience-matches.controller';

describe('ExperienceMatchesController', () => {
  const mockLogger = mockDeep<Logger>();
  const mockExperienceMatchesService = mockDeep<IExperienceMatchesService>();
  const mockRequest = mockDeep<Request>();
  const mockResponse = mockDeep<Response>();

  let experienceMatchesController: ExperienceMatchesController;
  const mockUser = { id: 1, email: 'test@example.com' };

  beforeEach(() => {
    mockReset(mockLogger);
    mockReset(mockExperienceMatchesService);
    mockReset(mockRequest);
    mockReset(mockResponse);

    mockResponse.status.mockReturnValue(mockResponse);
    mockResponse.json.mockReturnValue(mockResponse);

    experienceMatchesController = new ExperienceMatchesController({
      logger: mockLogger,
      experienceMatchesService: mockExperienceMatchesService,
    });

    vi.spyOn(
      experienceMatchesController as any,
      'getAuthenticatedUser'
    ).mockReturnValue(mockUser);
  });

  describe('getMatches', () => {
    it('should successfully get matches for valid nodeId', async () => {
      // Arrange
      const nodeId = '123e4567-e89b-12d3-a456-426614174000';
      const mockSearchResponse = {
        profiles: [
          {
            id: '1',
            name: 'Test User',
            email: 'test@example.com',
            username: 'testuser',
            currentRole: 'Engineer',
            company: 'Test Company',
            location: 'San Francisco',
            matchScore: '0.9',
            whyMatched: ['Has relevant experience'],
            skills: ['JavaScript', 'React'],
            matchedNodes: [],
          },
        ],
        totalResults: 1,
        query: 'test query',
      };

      mockRequest.params = { nodeId };
      mockRequest.query = {};
      mockExperienceMatchesService.getExperienceMatches.mockResolvedValue(
        mockSearchResponse as any
      );

      // Act
      await experienceMatchesController.getMatches(mockRequest, mockResponse);

      // Assert
      expect(
        mockExperienceMatchesService.getExperienceMatches
      ).toHaveBeenCalledWith(nodeId, mockUser.id, false);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          results: expect.any(Array),
          totalResults: expect.any(Number),
        }),
      });
    });
  });
});
