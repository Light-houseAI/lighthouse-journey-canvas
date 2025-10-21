import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockDeep, mockReset } from 'vitest-mock-extended';

import type { HierarchyService } from '../../services/hierarchy-service';
import type { MultiSourceExtractor } from '../../services/multi-source-extractor';
import type { OrganizationService } from '../../services/organization.service';
import type { UserService } from '../../services/user-service';
import { UserOnboardingController } from '../user-onboarding.controller';

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
    password: 'hashedPassword',
    firstName: 'John',
    lastName: 'Doe',
    userName: 'johndoe',
    interest: null,
    hasCompletedOnboarding: false,
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
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

    // Mock getAuthenticatedUser
    vi.spyOn(
      userOnboardingController as any,
      'getAuthenticatedUser'
    ).mockReturnValue(mockUser);
  });

  describe('updateInterest', () => {
    it('should successfully update user interest', async () => {
      // Arrange
      const interestData = { interest: 'find-job' };
      const updatedUser = {
        id: mockUser.id,
        email: mockUser.email,
        firstName: mockUser.firstName,
        lastName: mockUser.lastName,
        userName: mockUser.userName,
        interest: 'find-job',
        hasCompletedOnboarding: true,
        createdAt: mockUser.createdAt,
      };

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
        data: { user: updatedUser },
      });
    });

    it('should throw validation error for invalid interest data', async () => {
      // Arrange
      mockRequest.body = { interest: 'invalid-interest' };

      // Act & Assert
      await expect(
        userOnboardingController.updateInterest(mockRequest, mockResponse)
      ).rejects.toThrow();

      expect(mockUserService.updateUserInterest).not.toHaveBeenCalled();
    });
  });
});
