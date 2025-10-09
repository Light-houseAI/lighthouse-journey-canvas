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

import type { Logger } from '../core/logger';
import { OrganizationController } from '../organization.controller';
import type { IOrganizationRepository } from '../repositories/interfaces/organization.repository.interface';

// Mock response factory function
const createMockResponse = (): Response => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
  return res as any;
};

// Mock request factory function
const createMockRequest = (overrides: Partial<Request> = {}): Request => {
  const res = createMockResponse();
  return {
    path: '/api/v2/organizations',
    method: 'GET',
    body: {},
    query: {},
    headers: { 'x-request-id': 'test-request-123' },
    ip: '127.0.0.1',
    user: undefined,
    res,
    ...overrides,
  } as Request;
};

describe('OrganizationController', () => {
  let controller: OrganizationController;
  let mockOrganizationRepository: MockProxy<IOrganizationRepository>;
  let mockOrganizationService: any;
  let mockLogger: MockProxy<Logger>;

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

    mockOrganizationRepository = mock<IOrganizationRepository>();
    mockOrganizationService = {
      searchOrganizations: vi.fn(),
    };
    mockLogger = mock<Logger>();

    controller = new OrganizationController({
      organizationRepository: mockOrganizationRepository,
      organizationService: mockOrganizationService,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getUserOrganizations', () => {
    it('should throw AuthenticationError when user is not authenticated', async () => {
      const { AuthenticationError } = await import('@journey/schema');
      const mockRequest = createMockRequest({ user: undefined });

      await expect(
        controller.getUserOrganizations(mockRequest)
      ).rejects.toThrow(AuthenticationError);
    });

    it('should successfully retrieve user organizations', async () => {
      const mockRequest = createMockRequest({ user: mockUser });
      const mockOrganizations = [mockOrganization];

      mockOrganizationRepository.getUserOrganizations.mockResolvedValue(
        mockOrganizations
      );

      await controller.getUserOrganizations(mockRequest);

      expect(
        mockOrganizationRepository.getUserOrganizations
      ).toHaveBeenCalledWith(mockUser.id);
      expect(mockRequest.res!.status).toHaveBeenCalledWith(200);
      expect(mockRequest.res!.json).toHaveBeenCalledWith({
        success: true,
        data: mockOrganizations,
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        'User organizations retrieved',
        {
          userId: mockUser.id,
          organizationCount: 1,
        }
      );
    });

    it('should throw error when service fails', async () => {
      const mockRequest = createMockRequest({ user: mockUser });
      const serviceError = new Error('Database connection failed');

      mockOrganizationRepository.getUserOrganizations.mockRejectedValue(
        serviceError
      );

      await expect(
        controller.getUserOrganizations(mockRequest)
      ).rejects.toThrow('Database connection failed');
    });
  });

  describe('searchOrganizations', () => {
    it('should successfully search organizations with valid query', async () => {
      const mockRequest = createMockRequest({
        user: mockUser,
        query: { q: 'test company', page: '1', limit: '10' }
      });
      const mockSearchResult = {
        organizations: [mockOrganization],
        total: 1,
        page: 1,
        limit: 10,
      };

      mockOrganizationService.searchOrganizations.mockResolvedValue(
        mockSearchResult
      );

      await controller.searchOrganizations(mockRequest);

      expect(mockOrganizationService.searchOrganizations).toHaveBeenCalledWith(
        'test company',
        { page: 1, limit: 10 }
      );
      expect(mockRequest.res!.status).toHaveBeenCalledWith(200);
      expect(mockRequest.res!.json).toHaveBeenCalledWith({
        success: true,
        data: mockSearchResult,
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

    it('should throw ValidationError for invalid query parameters', async () => {
      const { ValidationError } = await import('@journey/schema');
      const mockRequest = createMockRequest({
        user: mockUser,
        query: {}, // Missing 'q' parameter
      });

      await expect(
        controller.searchOrganizations(mockRequest)
      ).rejects.toThrow(ValidationError);
    });

    it('should throw AuthenticationError when user is not authenticated', async () => {
      const { AuthenticationError } = await import('@journey/schema');
      const mockRequest = createMockRequest({
        user: undefined,
        query: { q: 'test' },
      });

      await expect(
        controller.searchOrganizations(mockRequest)
      ).rejects.toThrow(AuthenticationError);
    });

    it('should throw error when service fails', async () => {
      const mockRequest = createMockRequest({
        user: mockUser,
        query: { q: 'test' },
      });
      const serviceError = new Error('Search service unavailable');

      mockOrganizationService.searchOrganizations.mockRejectedValue(
        serviceError
      );

      await expect(
        controller.searchOrganizations(mockRequest)
      ).rejects.toThrow('Search service unavailable');
    });
  });
});
