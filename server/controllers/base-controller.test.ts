/**
 * Base Controller Test Suite
 * 
 * Tests the base controller patterns including:
 * - Success response handling
 * - Error response handling  
 * - Profile access validation
 * - Response formatting
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Response } from 'express';
import { BaseController } from './base-controller';
import { ValidationError, BusinessRuleError, NotFoundError } from '../../core/errors';

// Create a concrete test controller to test the abstract base
class TestController extends BaseController {
  public testHandleSuccess(res: Response, data: any, status?: number) {
    return this.handleSuccess(res, data, status);
  }

  public testHandleError(res: Response, error: Error) {
    return this.handleError(res, error);
  }

  public testValidateProfileAccess(userId: number, profileId: number) {
    return this.validateProfileAccess(userId, profileId);
  }
}

describe('BaseController', () => {
  let controller: TestController;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    controller = new TestController();
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    }
  });

  describe('handleSuccess', () => {
    it('should return 200 with success response for single data', () => {
      const testData = { id: '1', title: 'Test Work Experience' };

      controller.testHandleSuccess(mockResponse as Response, testData);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: testData,
      });
    });

    it('should return custom status code when specified', () => {
      const testData = { id: '1', title: 'Test Work Experience' };

      controller.testHandleSuccess(mockResponse as Response, testData, 201);

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: testData,
      });
    });

    it('should include meta information for array data with pagination', () => {
      const testData = [
        { id: '1', title: 'Test 1' },
        { id: '2', title: 'Test 2' }
      ];
      const meta = { total: 10, page: 1, limit: 2 };

      controller.testHandleSuccess(mockResponse as Response, testData, 200, meta);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: testData,
        meta: meta,
      });
    });

    it('should handle null/undefined data gracefully', () => {
      controller.testHandleSuccess(mockResponse as Response, null);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: null,
      });
    });
  });

  describe('handleError', () => {
    it('should handle ValidationError with 400 status', () => {
      const error = new ValidationError('Invalid input data');

      controller.testHandleError(mockResponse as Response, error);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input data',
        },
      });
    });

    it('should handle BusinessRuleError with 409 status', () => {
      const error = new BusinessRuleError('Business rule violated');

      controller.testHandleError(mockResponse as Response, error);

      expect(mockResponse.status).toHaveBeenCalledWith(409);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'BUSINESS_RULE_ERROR', 
          message: 'Business rule violated',
        },
      });
    });

    it('should handle NotFoundError with 404 status', () => {
      const error = new NotFoundError('Resource not found');

      controller.testHandleError(mockResponse as Response, error);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Resource not found',
        },
      });
    });

    it('should handle generic Error with 500 status', () => {
      const error = new Error('Unexpected error');

      controller.testHandleError(mockResponse as Response, error);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Unexpected error',
        },
      });
    });

    it('should handle error with details', () => {
      const error = new ValidationError('Validation failed', {
        field: 'title',
        expectedType: 'string'
      });

      controller.testHandleError(mockResponse as Response, error);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: {
            field: 'title',
            expectedType: 'string'
          },
        },
      });
    });
  });

  describe('validateProfileAccess', () => {
    it('should pass when user owns the profile', () => {
      expect(() => {
        controller.testValidateProfileAccess(123, 123);
      }).not.toThrow();
    });

    it('should throw error when user does not own the profile', () => {
      expect(() => {
        controller.testValidateProfileAccess(123, 456);
      }).toThrow('Forbidden: You can only access your own profile data');
    });

    it('should throw error for invalid user ID', () => {
      expect(() => {
        controller.testValidateProfileAccess(0, 123);
      }).toThrow('Invalid user ID');
    });

    it('should throw error for invalid profile ID', () => {
      expect(() => {
        controller.testValidateProfileAccess(123, 0);
      }).toThrow('Invalid profile ID');
    });

    it('should throw error for negative user ID', () => {
      expect(() => {
        controller.testValidateProfileAccess(-1, 123);
      }).toThrow('Invalid user ID');
    });

    it('should throw error for negative profile ID', () => {
      expect(() => {
        controller.testValidateProfileAccess(123, -1);
      }).toThrow('Invalid profile ID');
    });
  });
});