import { AuthenticationError, BusinessRuleError,ValidationError } from '@journey/schema';
import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it } from 'vitest';
import { mockDeep, mockReset } from 'vitest-mock-extended';

import type { HierarchyService } from '../../services/hierarchy-service';
import type { MultiSourceExtractor } from '../../services/multi-source-extractor';
import type { OrganizationService } from '../../services/organization.service';
import type { UserService } from '../../services/user-service';
import { UserOnboardingController } from '../user-onboarding-controller';

describe('UserOnboardingController', () => {
  const mockHierarchyService = mockDeep<HierarchyService>();
  const mockMultiSourceExtractor = mockDeep<MultiSourceExtractor>();
  const mockOrganizationService = mockDeep<OrganizationService>();
  const mockUserService = mockDeep<UserService>();

  const mockRequest = mockDeep<Request>();
  const mockResponse = mockDeep<Response>();

  let userOnboardingController: UserOnboardingController;
  const mockUser = {
    id: 1,
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    userName: 'johndoe',
    interest: null,
    hasCompletedOnboarding: false,
    createdAt: new Date('2024-01-01T00:00:00Z'),
  };

  beforeEach(() => {
    mockReset(mockHierarchyService);
    mockReset(mockMultiSourceExtractor);
    mockReset(mockOrganizationService);
    mockReset(mockUserService);
    mockReset(mockRequest);
    mockReset(mockResponse);

    // Setup standard response mocks
    mockResponse.status.mockReturnValue(mockResponse);
    mockResponse.json.mockReturnValue(mockResponse);

    userOnboardingController = new UserOnboardingController({
      hierarchyService: mockHierarchyService,
      multiSourceExtractor: mockMultiSourceExtractor,
      organizationService: mockOrganizationService,
      userService: mockUserService,
    });

    // Mock authenticated user on request
    (mockRequest as any).user = mockUser;
  });

  describe('updateInterest', () => {
    it('should successfully update user interest', async () => {
      // Arrange
      const interestData = { interest: 'find-job' };
      const updatedUser = { ...mockUser, interest: 'find-job' };

      mockRequest.body = interestData;
      mockUserService.updateUserInterest.mockResolvedValue(updatedUser as any);

      // Act
      await userOnboardingController.updateInterest(mockRequest, mockResponse);

      // Assert
      expect(mockUserService.updateUserInterest).toHaveBeenCalledWith(
        mockUser.id,
        'find-job'
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          user: {
            id: mockUser.id,
            email: mockUser.email,
            firstName: mockUser.firstName,
            lastName: mockUser.lastName,
            userName: mockUser.userName,
            interest: 'find-job',
            hasCompletedOnboarding: false,
            createdAt: mockUser.createdAt.toISOString(),
          }
        },
      });
    });

    it('should throw ValidationError for invalid interest data', async () => {
      // Arrange
      mockRequest.body = { interest: '' };

      // Act & Assert
      await expect(
        userOnboardingController.updateInterest(mockRequest, mockResponse)
      ).rejects.toThrow(ValidationError);
      expect(mockUserService.updateUserInterest).not.toHaveBeenCalled();
    });

    it('should throw AuthenticationError for unauthenticated request', async () => {
      // Arrange
      mockRequest.body = { interest: 'find-job' };
      (mockRequest as any).user = undefined;

      // Act & Assert
      await expect(
        userOnboardingController.updateInterest(mockRequest, mockResponse)
      ).rejects.toThrow(AuthenticationError);
    });
  });

  describe('completeOnboarding', () => {
    it('should successfully complete onboarding', async () => {
      // Arrange
      const updatedUser = { ...mockUser, hasCompletedOnboarding: true };
      mockUserService.completeOnboarding.mockResolvedValue(updatedUser as any);

      // Act
      await userOnboardingController.completeOnboarding(mockRequest, mockResponse);

      // Assert
      expect(mockUserService.completeOnboarding).toHaveBeenCalledWith(mockUser.id);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          user: {
            id: mockUser.id,
            email: mockUser.email,
            firstName: mockUser.firstName,
            lastName: mockUser.lastName,
            userName: mockUser.userName,
            interest: null,
            hasCompletedOnboarding: true,
            createdAt: mockUser.createdAt.toISOString(),
          }
        },
      });
    });

    it('should throw BusinessRuleError when user not found', async () => {
      // Arrange
      mockUserService.completeOnboarding.mockResolvedValue(null);

      // Act & Assert
      await expect(
        userOnboardingController.completeOnboarding(mockRequest, mockResponse)
      ).rejects.toThrow(BusinessRuleError);
    });

    it('should throw AuthenticationError for unauthenticated request', async () => {
      // Arrange
      (mockRequest as any).user = undefined;

      // Act & Assert
      await expect(
        userOnboardingController.completeOnboarding(mockRequest, mockResponse)
      ).rejects.toThrow(AuthenticationError);
    });
  });

  describe('extractProfile', () => {
    it('should successfully extract profile for new user', async () => {
      // Arrange
      const mockProfileData = {
        name: 'John Doe',
        experiences: [],
        education: [],
      };
      mockRequest.body = { username: 'johndoe' };
      mockHierarchyService.getAllNodes.mockResolvedValue([]);
      mockMultiSourceExtractor.extractComprehensiveProfile.mockResolvedValue(
        mockProfileData as any
      );

      // Act
      await userOnboardingController.extractProfile(mockRequest, mockResponse);

      // Assert
      expect(mockHierarchyService.getAllNodes).toHaveBeenCalledWith(mockUser.id);
      expect(mockMultiSourceExtractor.extractComprehensiveProfile).toHaveBeenCalledWith('johndoe');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: { profile: mockProfileData },
      });
    });

    it('should throw ValidationError for missing username', async () => {
      // Arrange
      mockRequest.body = {};

      // Act & Assert
      await expect(
        userOnboardingController.extractProfile(mockRequest, mockResponse)
      ).rejects.toThrow(ValidationError);
    });

    it('should throw AuthenticationError for unauthenticated request', async () => {
      // Arrange
      mockRequest.body = { username: 'johndoe' };
      (mockRequest as any).user = undefined;

      // Act & Assert
      await expect(
        userOnboardingController.extractProfile(mockRequest, mockResponse)
      ).rejects.toThrow(AuthenticationError);
    });
  });

  describe('saveProfile', () => {
    it('should successfully save profile', async () => {
      // Arrange
      const profileData = {
        username: 'johndoe',
        filteredData: {
          name: 'John Doe',
          experiences: [],
          education: [],
        },
      };
      mockRequest.body = profileData;
      mockHierarchyService.getAllNodes.mockResolvedValue([]);
      mockUserService.getUserById.mockResolvedValue(mockUser as any);
      mockUserService.updateUser.mockResolvedValue(undefined);
      mockUserService.completeOnboarding.mockResolvedValue(undefined);

      // Act
      await userOnboardingController.saveProfile(mockRequest, mockResponse);

      // Assert
      expect(mockHierarchyService.getAllNodes).toHaveBeenCalledWith(mockUser.id);
      expect(mockUserService.completeOnboarding).toHaveBeenCalledWith(mockUser.id);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          profile: expect.objectContaining({
            username: 'johndoe',
          }),
        }),
      });
    });

    it('should throw BusinessRuleError for duplicate onboarding', async () => {
      // Arrange
      const profileData = {
        username: 'johndoe',
        filteredData: {
          name: 'John Doe',
          experiences: [],
          education: [],
        },
      };
      mockRequest.body = profileData;
      mockHierarchyService.getAllNodes.mockResolvedValue([{ id: 'node1' }] as any);

      // Act & Assert
      await expect(
        userOnboardingController.saveProfile(mockRequest, mockResponse)
      ).rejects.toThrow(BusinessRuleError);
    });

    it('should throw ValidationError for invalid profile data', async () => {
      // Arrange
      mockRequest.body = { invalid: 'data' };

      // Act & Assert
      await expect(
        userOnboardingController.saveProfile(mockRequest, mockResponse)
      ).rejects.toThrow(ValidationError);
    });

    it('should throw AuthenticationError for unauthenticated request', async () => {
      // Arrange
      mockRequest.body = {
        username: 'johndoe',
        filteredData: {
          name: 'John Doe',
          experiences: [],
          education: [],
        },
      };
      (mockRequest as any).user = undefined;

      // Act & Assert
      await expect(
        userOnboardingController.saveProfile(mockRequest, mockResponse)
      ).rejects.toThrow(AuthenticationError);
    });
  });
});
