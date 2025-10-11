import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
      const updatedUser = { ...mockUser, interest: 'find-job' };

      mockRequest.body = interestData;
      mockUserService.updateUserInterest.mockResolvedValue(updatedUser);

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

    it('should handle validation errors for invalid interest data', async () => {
      // Arrange
      mockRequest.body = { interest: 'invalid-interest' };

      // Act
      await userOnboardingController.updateInterest(mockRequest, mockResponse);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: expect.objectContaining({
          message: expect.stringContaining('Invalid'),
        }),
      });
      expect(mockUserService.updateUserInterest).not.toHaveBeenCalled();
    });
  });
});
