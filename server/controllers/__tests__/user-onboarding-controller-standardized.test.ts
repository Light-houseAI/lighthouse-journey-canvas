/**
 * Tests for Standardized UserOnboardingController
 * 
 * Test suite for the updated UserOnboardingController with BaseController inheritance
 * Validates API response format consistency and error handling
 */

import { Request, Response } from 'express';
import { UserOnboardingController } from '../user-onboarding-controller';
import { HierarchyService } from '../../services/hierarchy-service';
import { MultiSourceExtractor } from '../../services/multi-source-extractor';
import { OrganizationService } from '../../services/organization.service';
import { UserService } from '../../services/user-service';
import { ValidationError, BusinessRuleError } from '../../core/errors';

// Mock dependencies
const mockHierarchyService = {
  getAllNodes: jest.fn(),
  createNode: jest.fn(),
} as jest.Mocked<Partial<HierarchyService>>;

const mockMultiSourceExtractor = {
  extractComprehensiveProfile: jest.fn(),
} as jest.Mocked<MultiSourceExtractor>;

const mockOrganizationService = {
  findOrCreateByName: jest.fn(),
  getOrganizationNameFromNode: jest.fn(),
} as jest.Mocked<Partial<OrganizationService>>;

const mockUserService = {
  getUserById: jest.fn(),
  updateUser: jest.fn(),
  completeOnboarding: jest.fn(),
} as jest.Mocked<Partial<UserService>>;

describe('Standardized UserOnboardingController', () => {
  let controller: UserOnboardingController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    controller = new UserOnboardingController({
      hierarchyService: mockHierarchyService as HierarchyService,
      multiSourceExtractor: mockMultiSourceExtractor,
      organizationService: mockOrganizationService as OrganizationService,
      userService: mockUserService as UserService,
    });

    mockRequest = {
      body: {},
      params: {},
      query: {},
      user: { id: 1 },
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('extractProfile', () => {
    it('should extract profile and return standardized success response', async () => {
      const mockProfileData = {
        name: 'John Doe',
        experiences: [
          {
            title: 'Software Engineer',
            company: 'Tech Corp',
            start: '2020-01',
            end: '2023-12',
          },
        ],
        education: [
          {
            school: 'University',
            degree: 'BS Computer Science',
            start: '2016-08',
            end: '2020-05',
          },
        ],
        skills: [],
      };

      mockRequest.body = { username: 'johndoe' };
      mockHierarchyService.getAllNodes.mockResolvedValue([]);
      mockMultiSourceExtractor.extractComprehensiveProfile.mockResolvedValue(mockProfileData);

      await controller.extractProfile(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: { profile: mockProfileData },
      });
    });

    it('should return existing data if user already has nodes', async () => {
      const existingNodes = [
        {
          id: 'node-1',
          type: 'job',
          meta: { role: 'Engineer', orgId: 1 },
        },
      ];

      const mockProfileData = {
        name: 'Existing User',
        experiences: [],
        education: [],
        skills: [],
      };

      mockRequest.body = { username: 'existinguser' };
      mockHierarchyService.getAllNodes.mockResolvedValue(existingNodes);
      mockOrganizationService.getOrganizationNameFromNode.mockResolvedValue('Tech Corp');

      await controller.extractProfile(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: { profile: expect.any(Object) },
      });
    });

    it('should handle validation errors with standardized error response', async () => {
      mockRequest.body = { username: '' }; // Invalid empty username

      await controller.extractProfile(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
            message: expect.any(String),
          }),
        })
      );
    });

    it('should handle extraction service errors', async () => {
      mockRequest.body = { username: 'johndoe' };
      mockHierarchyService.getAllNodes.mockResolvedValue([]);
      mockMultiSourceExtractor.extractComprehensiveProfile.mockRejectedValue(
        new Error('Extraction failed')
      );

      await controller.extractProfile(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
            message: 'Extraction failed',
          }),
        })
      );
    });

    it('should handle missing authentication', async () => {
      mockRequest.user = undefined;
      mockRequest.body = { username: 'johndoe' };

      await controller.extractProfile(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
            message: 'Authentication required',
          }),
        })
      );
    });
  });

  describe('saveProfile', () => {
    it('should save profile and return standardized success response', async () => {
      const mockProfileData = {
        username: 'johndoe',
        filteredData: {
          name: 'John Doe',
          experiences: [
            {
              title: 'Software Engineer',
              company: 'Tech Corp',
              start: '2020-01',
              end: '2023-12',
            },
          ],
          education: [],
          skills: [],
        },
      };

      const mockUser = {
        id: 1,
        firstName: 'John',
        lastName: 'Doe',
        userName: 'johndoe',
      };

      const mockCreatedNode = {
        id: 'node-1',
        type: 'job',
        meta: { role: 'Software Engineer', orgId: 1 },
      };

      const mockOrganization = { id: 1, name: 'Tech Corp' };

      mockRequest.body = mockProfileData;
      mockHierarchyService.getAllNodes.mockResolvedValue([]);
      mockUserService.getUserById.mockResolvedValue(mockUser);
      mockUserService.updateUser.mockResolvedValue(undefined);
      mockOrganizationService.findOrCreateByName.mockResolvedValue(mockOrganization);
      mockHierarchyService.createNode.mockResolvedValue(mockCreatedNode);
      mockUserService.completeOnboarding.mockResolvedValue(undefined);

      await controller.saveProfile(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          profile: expect.objectContaining({
            id: 'user-1',
            username: 'johndoe',
            nodesCreated: 1,
            nodes: [mockCreatedNode],
          }),
        },
      });
    });

    it('should handle duplicate onboarding with business rule error', async () => {
      const existingNodes = [{ id: 'existing-node' }];

      mockRequest.body = {
        username: 'johndoe',
        filteredData: { name: 'John Doe', experiences: [], education: [], skills: [] },
      };
      mockHierarchyService.getAllNodes.mockResolvedValue(existingNodes);

      await controller.saveProfile(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(409);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'BUSINESS_RULE_ERROR',
            message: 'Profile already exists - user has already completed onboarding',
          }),
        })
      );
    });

    it('should handle validation errors with standardized error response', async () => {
      mockRequest.body = { invalidData: 'test' }; // Invalid request body

      await controller.saveProfile(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
            message: expect.any(String),
          }),
        })
      );
    });

    it('should handle service errors during profile save', async () => {
      const mockProfileData = {
        username: 'johndoe',
        filteredData: {
          name: 'John Doe',
          experiences: [],
          education: [],
          skills: [],
        },
      };

      mockRequest.body = mockProfileData;
      mockHierarchyService.getAllNodes.mockResolvedValue([]);
      mockUserService.getUserById.mockRejectedValue(new Error('User service error'));

      await controller.saveProfile(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'User service error',
          }),
        })
      );
    });
  });
});