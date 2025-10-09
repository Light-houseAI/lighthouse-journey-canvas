import {
  AuthenticationError,
  BusinessRuleError,
  NotFoundError,
  ServiceUnavailableError
} from '@journey/schema';
import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it } from 'vitest';
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

    // Setup standard response mocks
    mockResponse.status.mockReturnValue(mockResponse);
    mockResponse.json.mockReturnValue(mockResponse);

    experienceMatchesController = new ExperienceMatchesController({
      logger: mockLogger,
      experienceMatchesService: mockExperienceMatchesService,
    });

    // Mock authenticated user on request
    (mockRequest as any).user = mockUser;
    (mockRequest as any).res = mockResponse;
  });

  describe('getMatches', () => {
    const nodeId = '123e4567-e89b-12d3-a456-426614174000';
    const mockMatches = {
      nodeId,
      userId: mockUser.id,
      matchCount: 2,
      matches: [
        { id: 1, title: 'Similar Experience 1', score: 0.9 },
        { id: 2, title: 'Similar Experience 2', score: 0.8 },
      ],
      searchQuery: 'test query',
      similarityThreshold: 0.7,
      lastUpdated: '2024-01-15T10:30:00Z',
      cacheTTL: 3600,
    };

    it('should successfully get matches for valid nodeId', async () => {
      // Arrange
      mockRequest.params = { nodeId };
      mockRequest.query = {};
      mockExperienceMatchesService.getExperienceMatches.mockResolvedValue(mockMatches);

      // Act
      await experienceMatchesController.getMatches(mockRequest as any, mockResponse as any);

      // Assert
      expect(mockExperienceMatchesService.getExperienceMatches).toHaveBeenCalledWith(
        nodeId,
        mockUser.id,
        false
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockMatches,
      });
    });

    it('should get matches with forceRefresh=true when query param is set', async () => {
      // Arrange
      mockRequest.params = { nodeId };
      mockRequest.query = { forceRefresh: 'true' };
      mockExperienceMatchesService.getExperienceMatches.mockResolvedValue(mockMatches);

      // Act
      await experienceMatchesController.getMatches(mockRequest as any, mockResponse as any);

      // Assert
      expect(mockExperienceMatchesService.getExperienceMatches).toHaveBeenCalledWith(
        nodeId,
        mockUser.id,
        true
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });

    it('should throw AuthenticationError when user not authenticated', async () => {
      // Arrange
      mockRequest.params = { nodeId };
      mockRequest.query = {};
      (mockRequest as any).user = undefined;

      // Act & Assert
      await expect(
        experienceMatchesController.getMatches(mockRequest as any, mockResponse as any)
      ).rejects.toThrow(AuthenticationError);
      expect(mockExperienceMatchesService.getExperienceMatches).not.toHaveBeenCalled();
    });

    it('should throw NotFoundError when node not found', async () => {
      // Arrange
      mockRequest.params = { nodeId };
      mockRequest.query = {};
      mockExperienceMatchesService.getExperienceMatches.mockResolvedValue(null);
      mockExperienceMatchesService.shouldShowMatches.mockResolvedValue(false);

      // Act & Assert
      await expect(
        experienceMatchesController.getMatches(mockRequest as any, mockResponse as any)
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw BusinessRuleError when node is not an experience node', async () => {
      // Arrange
      mockRequest.params = { nodeId };
      mockRequest.query = {};
      mockExperienceMatchesService.getExperienceMatches.mockResolvedValue(null);
      mockExperienceMatchesService.shouldShowMatches.mockResolvedValue(true);

      // Act & Assert
      await expect(
        experienceMatchesController.getMatches(mockRequest as any, mockResponse as any)
      ).rejects.toThrow(BusinessRuleError);
    });

    it('should throw ServiceUnavailableError when GraphRAG service returns error', async () => {
      // Arrange
      mockRequest.params = { nodeId };
      mockRequest.query = {};
      const errorResponse = { code: 'GRAPHRAG_ERROR', message: 'Service error' };
      mockExperienceMatchesService.getExperienceMatches.mockResolvedValue(errorResponse as any);

      // Act & Assert
      await expect(
        experienceMatchesController.getMatches(mockRequest as any, mockResponse as any)
      ).rejects.toThrow(ServiceUnavailableError);
    });

    it('should handle empty matches successfully', async () => {
      // Arrange
      mockRequest.params = { nodeId };
      mockRequest.query = {};
      const emptyMatches = {
        ...mockMatches,
        matchCount: 0,
        matches: [],
      };
      mockExperienceMatchesService.getExperienceMatches.mockResolvedValue(emptyMatches);

      // Act
      await experienceMatchesController.getMatches(mockRequest as any, mockResponse as any);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: emptyMatches,
      });
    });
  });
});
