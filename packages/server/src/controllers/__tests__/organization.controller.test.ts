/**
 * OrganizationController Test Suite - TDD Implementation
 *
 * Tests organization endpoints following Test-Driven Development:
 * - Using vitest-mock-extended for type-safe mocking
 * - Comprehensive coverage of all endpoints
 * - Error handling and edge cases
 */

import type { Request, Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';

import type { Logger } from '../../core/logger';
import type { OrganizationService } from '../../services/organization.service';
import { OrganizationController } from '../organization.controller';

// Mock request/response factory functions
const createMockRequest = (overrides: Partial<Request> = {}): Request =>
  ({
    path: '/api/v2/organizations',
    method: 'GET',
    body: {},
    query: {},
    headers: { 'x-request-id': 'test-request-123' },
    ip: '127.0.0.1',
    user: undefined,
    ...overrides,
  }) as Request;

const createMockResponse = (): Response => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
  return res as any;
};

describe('OrganizationController', () => {
  let controller: OrganizationController;
  let mockOrganizationService: MockProxy<OrganizationService>;
  let mockLogger: MockProxy<Logger>;
  let mockRequest: Request;
  let mockResponse: Response;

  const mockOrganization: any = {
    id: '1', // Changed to string
    name: 'Test Organization',
    type: 'company',
    domain: 'test.com',
    logoUrl: 'https://example.com/logo.png',
    metadata: {},
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
  };

  const mockUser = {
    id: 1,
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockOrganizationService = mock<OrganizationService>();
    mockLogger = mock<Logger>();

    controller = new OrganizationController({
      organizationService: mockOrganizationService,
      logger: mockLogger,
    });

    mockRequest = createMockRequest();
    mockResponse = createMockResponse();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getUserOrganizations', () => {
    it('should throw error when user is not authenticated', async () => {
      // RED: Test authentication requirement first
      mockRequest.user = undefined;

      // Act & Assert
      await expect(
        controller.getUserOrganizations(mockRequest, mockResponse)
      ).rejects.toThrow('User authentication required');
    });

    it('should successfully retrieve user organizations', async () => {
      // RED: Test successful retrieval
      mockRequest.user = mockUser;
      const mockOrganizations = [mockOrganization];

      mockOrganizationService.getUserOrganizations.mockResolvedValue(
        mockOrganizations
      );

      await controller.getUserOrganizations(mockRequest, mockResponse);

      expect(mockOrganizationService.getUserOrganizations).toHaveBeenCalledWith(
        mockUser.id
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            organizations: expect.any(Array),
            count: 1,
          }),
        })
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'User organizations retrieved',
        {
          userId: mockUser.id,
          organizationCount: 1,
        }
      );
    });

    it('should throw service errors', async () => {
      // RED: Test service error handling
      mockRequest.user = mockUser;
      const serviceError = new Error('Database connection failed');

      mockOrganizationService.getUserOrganizations.mockRejectedValue(
        serviceError
      );

      // Act & Assert
      await expect(
        controller.getUserOrganizations(mockRequest, mockResponse)
      ).rejects.toThrow('Database connection failed');
    });
  });

  describe('searchOrganizations', () => {
    it('should successfully search organizations with valid query', async () => {
      // RED: Test successful search
      mockRequest.user = mockUser;
      mockRequest.query = { q: 'test company' };
      const mockSearchResponse = {
        organizations: [mockOrganization],
        total: 1,
      };

      mockOrganizationService.searchOrganizations.mockResolvedValue(
        mockSearchResponse
      );

      await controller.searchOrganizations(mockRequest, mockResponse);

      expect(mockOrganizationService.searchOrganizations).toHaveBeenCalledWith(
        'test company',
        { limit: 20, page: 1 }
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            total: 1,
            organizations: expect.arrayContaining([
              expect.objectContaining({
                id: '1',
                name: 'Test Organization',
              }),
            ]),
          }),
        })
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Organization search performed',
        {
          searchQuery: 'test company',
          userId: mockUser.id,
          resultsCount: 1,
          page: 1,
          limit: 20,
        }
      );
    });

    it('should throw validation error for invalid query parameters', async () => {
      // RED: Test validation error for missing query
      mockRequest.user = mockUser;
      mockRequest.query = {}; // Missing 'q' parameter

      // Act & Assert
      await expect(
        controller.searchOrganizations(mockRequest, mockResponse)
      ).rejects.toThrow();
    });

    it('should throw authentication error', async () => {
      // RED: Test authentication error
      mockRequest.user = undefined;
      mockRequest.query = { q: 'test' };

      // Act & Assert
      await expect(
        controller.searchOrganizations(mockRequest, mockResponse)
      ).rejects.toThrow('User authentication required');
    });

    it('should throw service errors', async () => {
      // RED: Test service error handling
      mockRequest.user = mockUser;
      mockRequest.query = { q: 'test' };
      const serviceError = new Error('Search service unavailable');

      mockOrganizationService.searchOrganizations.mockRejectedValue(
        serviceError
      );

      // Act & Assert
      await expect(
        controller.searchOrganizations(mockRequest, mockResponse)
      ).rejects.toThrow('Search service unavailable');
    });
  });
});
