import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { createContractValidator, loadOpenAPISchema } from '../contract-validator';
import { isExcluded } from '../../config/contract-exclusions';

// Mock the contract exclusions
vi.mock('../../config/contract-exclusions', () => ({
  isExcluded: vi.fn(),
}));

// Mock fs for schema loading
vi.mock('node:fs/promises', () => ({
  default: {
    readFile: vi.fn(),
  },
}));

describe('Contract Validator', () => {
  describe('loadOpenAPISchema', () => {
    it('should load and parse OpenAPI schema from file', async () => {
      // Arrange
      const mockSchema = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/api/users/{id}': {
            get: {
              responses: {
                200: {
                  description: 'Success',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        required: ['success', 'data'],
                        properties: {
                          success: { type: 'boolean' },
                          data: {
                            type: 'object',
                            required: ['id', 'email'],
                            properties: {
                              id: { type: 'string' },
                              email: { type: 'string', format: 'email' },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      };

      const fs = await import('node:fs/promises');
      (fs.default.readFile as any).mockResolvedValue(
        JSON.stringify(mockSchema)
      );

      // Act
      const schema = await loadOpenAPISchema();

      // Assert
      expect(schema).toEqual(mockSchema);
      expect(fs.default.readFile).toHaveBeenCalledWith(
        expect.stringContaining('openapi-schema'),
        'utf-8'
      );
    });

    it('should handle YAML schema files', async () => {
      // Arrange
      const yamlContent = `
openapi: '3.0.0'
info:
  title: Test API
  version: '1.0.0'
paths:
  /api/users/{id}:
    get:
      responses:
        200:
          description: Success
`;

      const fs = await import('node:fs/promises');
      (fs.default.readFile as any).mockResolvedValue(yamlContent);

      // Act
      const schema = await loadOpenAPISchema();

      // Assert
      expect(schema.openapi).toBe('3.0.0');
      expect(schema.info.title).toBe('Test API');
    });

    it('should throw error if schema file not found', async () => {
      // Arrange
      const fs = await import('node:fs/promises');
      (fs.default.readFile as any).mockRejectedValue(
        new Error('ENOENT: no such file or directory')
      );

      // Act & Assert
      await expect(loadOpenAPISchema()).rejects.toThrow(
        'OpenAPI schema not found'
      );
    });
  });

  describe('createContractValidator', () => {
    let mockSchema: any;
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
      vi.clearAllMocks();

      // Setup mock schema
      mockSchema = {
        openapi: '3.0.0',
        paths: {
          '/api/users/{id}': {
            get: {
              parameters: [
                {
                  name: 'id',
                  in: 'path',
                  required: true,
                  schema: { type: 'string', format: 'uuid' },
                },
              ],
              responses: {
                200: {
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        required: ['success', 'data'],
                        properties: {
                          success: { type: 'boolean' },
                          data: {
                            type: 'object',
                            required: ['id', 'email'],
                            properties: {
                              id: { type: 'string' },
                              email: { type: 'string', format: 'email' },
                              name: { type: 'string' },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            post: {
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['email', 'password'],
                      properties: {
                        email: { type: 'string', format: 'email' },
                        password: { type: 'string', minLength: 8 },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      };

      // Setup mock request/response
      mockRequest = {
        method: 'GET',
        path: '/api/users/123',
        params: { id: '123' },
        body: {},
        headers: { 'content-type': 'application/json' },
      };

      mockResponse = {
        status: 200,
        statusCode: 200,
        json: vi.fn(),
        send: vi.fn(),
        getHeader: vi.fn().mockReturnValue('application/json'),
      };

      mockNext = vi.fn();
    });

    describe('Response Validation', () => {
      it('should detect missing required field in response', async () => {
        // Arrange
        const validator = await createContractValidator(mockSchema);

        // Mock response that's missing 'email' field
        const invalidResponse = {
          success: true,
          data: {
            id: '123',
            // email is missing (required field)
          },
        };

        // Act - Call validateResponse directly
        const errors = validator.validateResponse(
          mockRequest as Request,
          mockResponse as Response,
          invalidResponse
        );

        // Assert
        expect(errors.length).toBeGreaterThan(0);
        expect(errors.some(e => e.includes('email') && e.includes('required'))).toBe(true);
      });

      it('should pass validation for correct response schema', async () => {
        // Arrange
        const validator = await createContractValidator(mockSchema);

        // Valid response with all required fields
        const validResponse = {
          success: true,
          data: {
            id: '123',
            email: 'test@example.com',
            name: 'Test User', // optional field
          },
        };

        // Act & Assert (should not throw)
        const errors = validator.validateResponse(
          mockRequest as Request,
          mockResponse as Response,
          validResponse
        );

        expect(errors).toEqual([]);
      });

      it('should detect incorrect field types', async () => {
        // Arrange
        const validator = await createContractValidator(mockSchema);

        // Response with wrong type for 'success' field
        const invalidResponse = {
          success: 'true', // Should be boolean, not string
          data: {
            id: '123',
            email: 'test@example.com',
          },
        };

        // Act
        const errors = validator.validateResponse(
          mockRequest as Request,
          mockResponse as Response,
          invalidResponse
        );

        // Assert
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0]).toContain('success');
      });
    });

    describe('Request Validation', () => {
      it('should validate request body against schema', async () => {
        // Arrange
        const validator = await createContractValidator(mockSchema);
        mockRequest.method = 'POST';
        mockRequest.path = '/api/users/123';

        // Invalid request body (missing password)
        mockRequest.body = {
          email: 'test@example.com',
          // password is missing
        };

        // Act
        const errors = validator.validateRequest(mockRequest as Request);

        // Assert
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0]).toContain('password');
      });

      it('should validate request parameters', async () => {
        // Arrange
        const validator = await createContractValidator(mockSchema);
        mockRequest.params = {
          id: 'not-a-uuid', // Should be UUID format
        };

        // Act
        const errors = validator.validateRequest(mockRequest as Request);

        // Assert
        expect(errors.length).toBeGreaterThan(0);
      });

      it('should pass valid request', async () => {
        // Arrange
        const validator = await createContractValidator(mockSchema);
        mockRequest.method = 'POST';
        mockRequest.body = {
          email: 'valid@example.com',
          password: 'validPassword123',
        };

        // Act
        const errors = validator.validateRequest(mockRequest as Request);

        // Assert
        expect(errors).toEqual([]);
      });
    });

    describe('Exclusion Handling', () => {
      it('should skip validation for excluded endpoints', async () => {
        // Arrange
        (isExcluded as any).mockReturnValue(true);

        const validator = await createContractValidator(mockSchema);

        // Act - Test request validation
        const requestErrors = validator.validateRequest(mockRequest as Request);

        // Assert - Should return no errors for excluded endpoint
        expect(isExcluded).toHaveBeenCalledWith('GET', '/api/users/123');
        expect(requestErrors).toEqual([]);

        // Act - Test response validation
        const responseErrors = validator.validateResponse(
          mockRequest as Request,
          mockResponse as Response,
          { invalid: 'response' }
        );

        // Assert - Should return no errors for excluded endpoint
        expect(responseErrors).toEqual([]);
      });

      it('should validate non-excluded endpoints', async () => {
        // Arrange
        (isExcluded as any).mockReturnValue(false);

        const validator = await createContractValidator(mockSchema);

        // Act - Valid request should pass
        mockRequest.method = 'POST';
        mockRequest.body = {
          email: 'test@example.com',
          password: 'validPassword123',
        };

        const requestErrors = validator.validateRequest(mockRequest as Request);

        // Assert
        expect(isExcluded).toHaveBeenCalledWith('POST', '/api/users/123');
        expect(requestErrors).toEqual([]);
      });
    });

    describe('Error Messages', () => {
      it('should provide clear error message for missing field', async () => {
        // Arrange
        const validator = await createContractValidator(mockSchema);
        const invalidResponse = {
          success: true,
          data: {
            id: '123',
            // email missing
          },
        };

        // Act
        const errors = validator.validateResponse(
          mockRequest as Request,
          mockResponse as Response,
          invalidResponse
        );

        // Assert
        expect(errors[0]).toContain('email');
        expect(errors[0]).toContain('required');
      });

      it('should provide path information in error', async () => {
        // Arrange
        const validator = await createContractValidator(mockSchema);
        const invalidResponse = {
          success: true,
          data: {
            id: '123',
            email: 'not-an-email', // Invalid email format
          },
        };

        // Act
        const errors = validator.validateResponse(
          mockRequest as Request,
          mockResponse as Response,
          invalidResponse
        );

        // Assert
        expect(errors[0]).toContain('data.email');
      });
    });

    describe('Performance', () => {
      it('should validate response quickly (<100ms)', async () => {
        // Arrange
        const validator = await createContractValidator(mockSchema);
        const validResponse = {
          success: true,
          data: {
            id: '123',
            email: 'test@example.com',
          },
        };

        // Act
        const startTime = Date.now();
        validator.validateResponse(
          mockRequest as Request,
          mockResponse as Response,
          validResponse
        );
        const endTime = Date.now();

        // Assert
        expect(endTime - startTime).toBeLessThan(100);
      });
    });
  });
});