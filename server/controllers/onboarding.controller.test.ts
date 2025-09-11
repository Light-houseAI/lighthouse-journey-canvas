/**
 * OnboardingController Test Suite
 *
 * Tests for user onboarding workflow endpoints
 */

import { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OnboardingController } from '../onboarding.controller';

// Mock dependencies
const mockUserService = {
  updateUserInterest: vi.fn(),
  completeOnboarding: vi.fn(),
};

const mockUserOnboardingController = {
  extractProfile: vi.fn(),
  saveProfile: vi.fn(),
};

const mockScope = {
  resolve: vi.fn((token: string) => {
    switch (token) {
      case 'userService':
        return mockUserService;
      case 'userOnboardingController':
        return mockUserOnboardingController;
      default:
        throw new Error(`Unknown token: ${token}`);
    }
  }),
};

// Create mock request and response
const createMockRequest = (overrides: Partial<Request> = {}): Request =>
  ({
    body: {},
    user: { id: 1, email: 'test@example.com' },
    scope: mockScope,
    ...overrides,
  }) as unknown as Request;

const createMockResponse = (): Response => {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

describe('OnboardingController', () => {
  let controller: OnboardingController;
  let mockRequest: Request;
  let mockResponse: Response;

  beforeEach(() => {
    controller = new OnboardingController();
    mockRequest = createMockRequest();
    mockResponse = createMockResponse();

    // Reset all mocks
    vi.clearAllMocks();
  });

  describe('updateInterest', () => {
    it('should successfully update user interest', async () => {
      // Arrange
      const interest = 'find-job';
      mockRequest.body = { interest };
      const updatedUser = { id: 1, email: 'test@example.com', interest };
      mockUserService.updateUserInterest.mockResolvedValue(updatedUser);

      // Act
      await controller.updateInterest(mockRequest, mockResponse);

      // Assert
      expect(mockUserService.updateUserInterest).toHaveBeenCalledWith(
        1,
        interest
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: { user: updatedUser },
      });
    });

    it('should handle validation errors', async () => {
      // Arrange
      mockRequest.body = { invalidField: 'invalid' };

      // Act
      await controller.updateInterest(mockRequest, mockResponse);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid interest data provided',
        },
      });
    });
  });

  describe('completeOnboarding', () => {
    it('should successfully complete onboarding', async () => {
      // Arrange
      const completedUser = {
        id: 1,
        email: 'test@example.com',
        onboardingCompleted: true,
      };
      mockUserService.completeOnboarding.mockResolvedValue(completedUser);

      // Act
      await controller.completeOnboarding(mockRequest, mockResponse);

      // Assert
      expect(mockUserService.completeOnboarding).toHaveBeenCalledWith(1);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: { user: completedUser },
      });
    });
  });

  describe('extractProfile', () => {
    it('should delegate to UserOnboardingController', async () => {
      // Act
      await controller.extractProfile(mockRequest, mockResponse);

      // Assert
      expect(mockScope.resolve).toHaveBeenCalledWith(
        'userOnboardingController'
      );
      expect(mockUserOnboardingController.extractProfile).toHaveBeenCalledWith(
        mockRequest,
        mockResponse
      );
    });
  });

  describe('saveProfile', () => {
    it('should delegate to UserOnboardingController', async () => {
      // Act
      await controller.saveProfile(mockRequest, mockResponse);

      // Assert
      expect(mockScope.resolve).toHaveBeenCalledWith(
        'userOnboardingController'
      );
      expect(mockUserOnboardingController.saveProfile).toHaveBeenCalledWith(
        mockRequest,
        mockResponse
      );
    });
  });
});
