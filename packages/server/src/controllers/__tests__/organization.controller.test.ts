/**
 * OrganizationController Test Suite - TDD Implementation
 *
 * Tests organization endpoints following Test-Driven Development:
 * - Using vitest-mock-extended for type-safe mocking
 * - Comprehensive coverage of all endpoints
 * - Error handling and edge cases
 */

import type { Organization } from '@journey/schema';
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

  const mockOrganization: Organization = {
    id: 1,
    name: 'Test Organization',
    type: 'company',
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
    it('should fail when user is not authenticated', async () => {
      // RED: Test authentication requirement first
      mockRequest.user = undefined;

      await controller.getUserOrganizations(mockRequest, mockResponse);

      // Test shows AuthenticationError with "User authentication required" message is thrown

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required',
        },
      });
    });

    it('should successfully retrieve user organizations', async () => {
      // RED: Test successful retrieval
      mockRequest.user = mockUser;
      const mockOrganizations = [mockOrganization];

      mockOrganizationService.getUserOrganizations.mockResolvedValue(
        mockOrganizations
      );

      await controller.getUserOrganizations(mockRequest, mockResponse);

      expect(
        mockOrganizationService.getUserOrganizations
      ).toHaveBeenCalledWith(mockUser.id);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          organizations: [
            {
              id: 1,
              name: 'Test Organization',
              domain: undefined,
              logoUrl: undefined,
            },
          ],
          count: 1,
        },
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        'User organizations retrieved',
        {
          userId: mockUser.id,
          organizationCount: 1,
        }
      );
    });

    it('should handle service errors', async () => {
      // RED: Test service error handling
      mockRequest.user = mockUser;
      const serviceError = new Error('Database connection failed');

      mockOrganizationService.getUserOrganizations.mockRejectedValue(
        serviceError
      );

      await controller.getUserOrganizations(mockRequest, mockResponse);

      expect(
        mockOrganizationService.getUserOrganizations
      ).toHaveBeenCalledWith(mockUser.id);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error getting user organizations',
        expect.any(Error)
      );
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve user organizations',
        },
      });
    });
  });

  describe('searchOrganizations', () => {
    it('should successfully search organizations with valid query', async () => {
      // RED: Test successful search
      mockRequest.user = mockUser;
      mockRequest.query = { q: 'test company' };
      const mockSearchResponse = {
        organizations: [mockOrganization],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          pages: 1,
        },
      };

      mockOrganizationService.searchOrganizations.mockResolvedValue(
        mockSearchResponse
      );

      await controller.searchOrganizations(mockRequest, mockResponse);

      expect(
        mockOrganizationService.searchOrganizations
      ).toHaveBeenCalledWith('test company', { limit: 10, page: 1 });
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockSearchResponse,
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Organization search performed',
        {
          searchQuery: 'test company',
          userId: mockUser.id,
          resultsCount: 1,
          page: 1,
          limit: 10,
        }
      );
    });

    it('should handle validation errors for invalid query parameters', async () => {
      // RED: Test validation error for missing query
      mockRequest.user = mockUser;
      mockRequest.query = {}; // Missing 'q' parameter

      await controller.searchOrganizations(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request parameters',
          details: [
            {
              code: 'invalid_type',
              expected: 'string',
              received: 'undefined',
              path: ['q'],
              message: 'Required',
            },
          ],
        },
      });
    });

    it('should handle authentication errors', async () => {
      // RED: Test authentication error
      mockRequest.user = undefined;
      mockRequest.query = { q: 'test' };

      await controller.searchOrganizations(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required',
        },
      });
    });

    it('should handle service errors', async () => {
      // RED: Test service error handling
      mockRequest.user = mockUser;
      mockRequest.query = { q: 'test' };
      const serviceError = new Error('Search service unavailable');

      mockOrganizationService.searchOrganizations.mockRejectedValue(
        serviceError
      );

      await controller.searchOrganizations(mockRequest, mockResponse);

      expect(
        mockOrganizationService.searchOrganizations
      ).toHaveBeenCalledWith('test', { limit: 10, page: 1 });
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error searching organizations',
        expect.any(Error)
      );
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to search organizations',
        },
      });
    });
  });

});
