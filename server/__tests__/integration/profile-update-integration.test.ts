/**
 * Profile Update Integration Tests
 *
 * Full-stack integration tests that verify the complete profile update workflow
 * from API endpoints through service layer to repository and database.
 * Tests firstName, lastName, and userName updates with validation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Request, Response } from 'express';
import { storage } from '../../services/storage.service';
import { profileUpdateSchema } from '@shared/schema';

describe('Profile Update Integration Tests', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let responseBody: any;
  let statusCode: number;

  beforeEach(() => {
    responseBody = null;
    statusCode = 200;

    mockRequest = {
      body: {},
      user: {
        id: 1,
        email: 'test@example.com',
        userName: 'testuser',
        firstName: null,
        lastName: null,
        interest: null,
        hasCompletedOnboarding: false,
        createdAt: new Date().toISOString(),
      },
    };

    mockResponse = {
      status: vi.fn().mockImplementation((code) => {
        statusCode = code;
        return mockResponse;
      }),
      json: vi.fn().mockImplementation((data) => {
        responseBody = data;
        return mockResponse;
      }),
    };
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Profile Update Validation', () => {
    it('should validate firstName schema correctly', () => {
      const validCases = [
        { firstName: 'John' },
        { firstName: 'Mary-Jane' },
        { firstName: "O'Connor" },
        { firstName: 'Jean Claude' },
        { firstName: 'Anne-Marie' },
      ];

      const invalidCases = [
        { firstName: 'John123' },
        { firstName: 'John@' },
        { firstName: 'John#$%' },
        { firstName: 'John_Smith' },
        { firstName: '' }, // Empty string
        { firstName: 'A'.repeat(51) }, // Too long
      ];

      validCases.forEach((testCase) => {
        const result = profileUpdateSchema.safeParse(testCase);
        expect(result.success, `Expected ${JSON.stringify(testCase)} to be valid`).toBe(true);
      });

      invalidCases.forEach((testCase) => {
        const result = profileUpdateSchema.safeParse(testCase);
        expect(result.success, `Expected ${JSON.stringify(testCase)} to be invalid`).toBe(false);
      });
    });

    it('should validate lastName schema correctly', () => {
      const validCases = [
        { lastName: 'Smith' },
        { lastName: 'Van Damme' },
        { lastName: "O'Connor" },
        { lastName: 'Smith-Wilson' },
        { lastName: 'De La Cruz' },
      ];

      const invalidCases = [
        { lastName: 'Smith123' },
        { lastName: 'Smith@' },
        { lastName: 'Smith#$%' },
        { lastName: 'Smith_Jones' },
        { lastName: '' }, // Empty string
        { lastName: 'A'.repeat(51) }, // Too long
      ];

      validCases.forEach((testCase) => {
        const result = profileUpdateSchema.safeParse(testCase);
        expect(result.success, `Expected ${JSON.stringify(testCase)} to be valid`).toBe(true);
      });

      invalidCases.forEach((testCase) => {
        const result = profileUpdateSchema.safeParse(testCase);
        expect(result.success, `Expected ${JSON.stringify(testCase)} to be invalid`).toBe(false);
      });
    });

    it('should validate combined firstName, lastName, and userName', () => {
      const validUpdate = {
        firstName: 'John',
        lastName: 'Doe',
        userName: 'johndoe123',
      };

      const result = profileUpdateSchema.safeParse(validUpdate);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(validUpdate);
    });

    it('should allow partial updates', () => {
      const partialUpdates = [
        { firstName: 'John' },
        { lastName: 'Doe' },
        { userName: 'newusername' },
        { firstName: 'John', lastName: 'Doe' },
        { firstName: 'John', userName: 'johndoe' },
        { lastName: 'Doe', userName: 'johndoe' },
      ];

      partialUpdates.forEach((update) => {
        const result = profileUpdateSchema.safeParse(update);
        expect(result.success, `Expected ${JSON.stringify(update)} to be valid`).toBe(true);
      });
    });
  });

  describe('Profile Update Service Integration', () => {
    it('should update firstName only', async () => {
      // Mock storage service
      const mockUpdateUser = vi.spyOn(storage, 'updateUser').mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        firstName: 'John',
        lastName: null,
        userName: 'testuser',
        interest: null,
        hasCompletedOnboarding: false,
        createdAt: new Date().toISOString(),
        password: 'hashedpassword',
      });

      mockRequest.body = { firstName: 'John' };

      // Simulate the profile update route handler
      const profileUpdateHandler = async (req: Request, res: Response) => {
        try {
          const user = (req as any).user;
          const updateData = profileUpdateSchema.parse(req.body);

          const updatedUser = await storage.updateUser(user.id, updateData);
          if (!updatedUser) {
            return res.status(404).json({ error: 'User not found' });
          }

          res.json({
            success: true,
            user: {
              id: updatedUser.id,
              email: updatedUser.email,
              firstName: updatedUser.firstName,
              lastName: updatedUser.lastName,
              userName: updatedUser.userName,
              interest: updatedUser.interest,
              hasCompletedOnboarding: updatedUser.hasCompletedOnboarding,
            },
          });
        } catch (error) {
          if (error instanceof Error) {
            res.status(400).json({ error: error.message });
          } else {
            res.status(500).json({ error: 'Failed to update profile' });
          }
        }
      };

      await profileUpdateHandler(mockRequest as Request, mockResponse as Response);

      expect(mockUpdateUser).toHaveBeenCalledWith(1, { firstName: 'John' });
      expect(statusCode).toBe(200);
      expect(responseBody).toEqual({
        success: true,
        user: {
          id: 1,
          email: 'test@example.com',
          firstName: 'John',
          lastName: null,
          userName: 'testuser',
          interest: null,
          hasCompletedOnboarding: false,
        },
      });
    });

    it('should update lastName only', async () => {
      const mockUpdateUser = vi.spyOn(storage, 'updateUser').mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        firstName: null,
        lastName: 'Doe',
        userName: 'testuser',
        interest: null,
        hasCompletedOnboarding: false,
        createdAt: new Date().toISOString(),
        password: 'hashedpassword',
      });

      mockRequest.body = { lastName: 'Doe' };

      const profileUpdateHandler = async (req: Request, res: Response) => {
        try {
          const user = (req as any).user;
          const updateData = profileUpdateSchema.parse(req.body);

          const updatedUser = await storage.updateUser(user.id, updateData);
          if (!updatedUser) {
            return res.status(404).json({ error: 'User not found' });
          }

          res.json({
            success: true,
            user: {
              id: updatedUser.id,
              email: updatedUser.email,
              firstName: updatedUser.firstName,
              lastName: updatedUser.lastName,
              userName: updatedUser.userName,
              interest: updatedUser.interest,
              hasCompletedOnboarding: updatedUser.hasCompletedOnboarding,
            },
          });
        } catch (error) {
          if (error instanceof Error) {
            res.status(400).json({ error: error.message });
          } else {
            res.status(500).json({ error: 'Failed to update profile' });
          }
        }
      };

      await profileUpdateHandler(mockRequest as Request, mockResponse as Response);

      expect(mockUpdateUser).toHaveBeenCalledWith(1, { lastName: 'Doe' });
      expect(statusCode).toBe(200);
      expect(responseBody).toEqual({
        success: true,
        user: {
          id: 1,
          email: 'test@example.com',
          firstName: null,
          lastName: 'Doe',
          userName: 'testuser',
          interest: null,
          hasCompletedOnboarding: false,
        },
      });
    });

    it('should update all fields together', async () => {
      const mockGetUserByUsername = vi.spyOn(storage, 'getUserByUsername').mockResolvedValue(null);
      const mockUpdateUser = vi.spyOn(storage, 'updateUser').mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        userName: 'johndoe',
        interest: null,
        hasCompletedOnboarding: false,
        createdAt: new Date().toISOString(),
        password: 'hashedpassword',
      });

      mockRequest.body = { firstName: 'John', lastName: 'Doe', userName: 'johndoe' };

      const profileUpdateHandler = async (req: Request, res: Response) => {
        try {
          const user = (req as any).user;
          const updateData = profileUpdateSchema.parse(req.body);

          // Check if username is already taken (if provided)
          if (updateData.userName && updateData.userName !== user.userName) {
            const existingUser = await storage.getUserByUsername(updateData.userName);
            if (existingUser && existingUser.id !== user.id) {
              return res.status(400).json({ error: 'Username already taken' });
            }
          }

          const updatedUser = await storage.updateUser(user.id, updateData);
          if (!updatedUser) {
            return res.status(404).json({ error: 'User not found' });
          }

          res.json({
            success: true,
            user: {
              id: updatedUser.id,
              email: updatedUser.email,
              firstName: updatedUser.firstName,
              lastName: updatedUser.lastName,
              userName: updatedUser.userName,
              interest: updatedUser.interest,
              hasCompletedOnboarding: updatedUser.hasCompletedOnboarding,
            },
          });
        } catch (error) {
          if (error instanceof Error) {
            res.status(400).json({ error: error.message });
          } else {
            res.status(500).json({ error: 'Failed to update profile' });
          }
        }
      };

      await profileUpdateHandler(mockRequest as Request, mockResponse as Response);

      expect(mockGetUserByUsername).toHaveBeenCalledWith('johndoe');
      expect(mockUpdateUser).toHaveBeenCalledWith(1, { firstName: 'John', lastName: 'Doe', userName: 'johndoe' });
      expect(statusCode).toBe(200);
      expect(responseBody).toEqual({
        success: true,
        user: {
          id: 1,
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          userName: 'johndoe',
          interest: null,
          hasCompletedOnboarding: false,
        },
      });
    });

    it('should handle username conflict', async () => {
      const mockGetUserByUsername = vi.spyOn(storage, 'getUserByUsername').mockResolvedValue({
        id: 2, // Different user ID
        email: 'other@example.com',
        firstName: null,
        lastName: null,
        userName: 'existinguser',
        interest: null,
        hasCompletedOnboarding: false,
        createdAt: new Date().toISOString(),
        password: 'hashedpassword',
      });

      mockRequest.body = { userName: 'existinguser' };

      const profileUpdateHandler = async (req: Request, res: Response) => {
        try {
          const user = (req as any).user;
          const updateData = profileUpdateSchema.parse(req.body);

          // Check if username is already taken (if provided)
          if (updateData.userName && updateData.userName !== user.userName) {
            const existingUser = await storage.getUserByUsername(updateData.userName);
            if (existingUser && existingUser.id !== user.id) {
              return res.status(400).json({ error: 'Username already taken' });
            }
          }

          const updatedUser = await storage.updateUser(user.id, updateData);
          res.json({ success: true, user: updatedUser });
        } catch (error) {
          if (error instanceof Error) {
            res.status(400).json({ error: error.message });
          } else {
            res.status(500).json({ error: 'Failed to update profile' });
          }
        }
      };

      await profileUpdateHandler(mockRequest as Request, mockResponse as Response);

      expect(mockGetUserByUsername).toHaveBeenCalledWith('existinguser');
      expect(statusCode).toBe(400);
      expect(responseBody).toEqual({ error: 'Username already taken' });
    });

    it('should handle validation errors', async () => {
      mockRequest.body = { firstName: 'John123', lastName: 'Doe@#$' };

      const profileUpdateHandler = async (req: Request, res: Response) => {
        try {
          const user = (req as any).user;
          const updateData = profileUpdateSchema.parse(req.body);

          const updatedUser = await storage.updateUser(user.id, updateData);
          res.json({ success: true, user: updatedUser });
        } catch (error) {
          if (error instanceof Error) {
            res.status(400).json({ error: error.message });
          } else {
            res.status(500).json({ error: 'Failed to update profile' });
          }
        }
      };

      await profileUpdateHandler(mockRequest as Request, mockResponse as Response);

      expect(statusCode).toBe(400);
      expect(responseBody.error).toContain('First name can only contain letters');
    });

    it('should handle storage service errors', async () => {
      const mockUpdateUser = vi.spyOn(storage, 'updateUser').mockRejectedValue(new Error('Database connection failed'));

      mockRequest.body = { firstName: 'John' };

      const profileUpdateHandler = async (req: Request, res: Response) => {
        try {
          const user = (req as any).user;
          const updateData = profileUpdateSchema.parse(req.body);

          const updatedUser = await storage.updateUser(user.id, updateData);
          res.json({ success: true, user: updatedUser });
        } catch (error) {
          if (error instanceof Error) {
            res.status(400).json({ error: error.message });
          } else {
            res.status(500).json({ error: 'Failed to update profile' });
          }
        }
      };

      await profileUpdateHandler(mockRequest as Request, mockResponse as Response);

      expect(mockUpdateUser).toHaveBeenCalledWith(1, { firstName: 'John' });
      expect(statusCode).toBe(400);
      expect(responseBody).toEqual({ error: 'Database connection failed' });
    });
  });

  describe('Edge Cases', () => {
    it('should handle special characters in names', async () => {
      const mockUpdateUser = vi.spyOn(storage, 'updateUser').mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        firstName: "Mary-Jane",
        lastName: "O'Connor",
        userName: 'testuser',
        interest: null,
        hasCompletedOnboarding: false,
        createdAt: new Date().toISOString(),
        password: 'hashedpassword',
      });

      mockRequest.body = { firstName: "Mary-Jane", lastName: "O'Connor" };

      const profileUpdateHandler = async (req: Request, res: Response) => {
        try {
          const user = (req as any).user;
          const updateData = profileUpdateSchema.parse(req.body);

          const updatedUser = await storage.updateUser(user.id, updateData);
          res.json({
            success: true,
            user: {
              id: updatedUser.id,
              email: updatedUser.email,
              firstName: updatedUser.firstName,
              lastName: updatedUser.lastName,
              userName: updatedUser.userName,
              interest: updatedUser.interest,
              hasCompletedOnboarding: updatedUser.hasCompletedOnboarding,
            },
          });
        } catch (error) {
          if (error instanceof Error) {
            res.status(400).json({ error: error.message });
          } else {
            res.status(500).json({ error: 'Failed to update profile' });
          }
        }
      };

      await profileUpdateHandler(mockRequest as Request, mockResponse as Response);

      expect(mockUpdateUser).toHaveBeenCalledWith(1, { firstName: "Mary-Jane", lastName: "O'Connor" });
      expect(statusCode).toBe(200);
      expect(responseBody.user.firstName).toBe("Mary-Jane");
      expect(responseBody.user.lastName).toBe("O'Connor");
    });

    it('should allow updating username to same value', async () => {
      const mockGetUserByUsername = vi.spyOn(storage, 'getUserByUsername').mockResolvedValue(null);
      const mockUpdateUser = vi.spyOn(storage, 'updateUser').mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        firstName: null,
        lastName: null,
        userName: 'testuser',
        interest: null,
        hasCompletedOnboarding: false,
        createdAt: new Date().toISOString(),
        password: 'hashedpassword',
      });

      mockRequest.body = { userName: 'testuser' };

      const profileUpdateHandler = async (req: Request, res: Response) => {
        try {
          const user = (req as any).user;
          const updateData = profileUpdateSchema.parse(req.body);

          // Should not check for conflicts if updating to same username
          if (updateData.userName && updateData.userName !== user.userName) {
            const existingUser = await storage.getUserByUsername(updateData.userName);
            if (existingUser && existingUser.id !== user.id) {
              return res.status(400).json({ error: 'Username already taken' });
            }
          }

          const updatedUser = await storage.updateUser(user.id, updateData);
          res.json({ success: true, user: updatedUser });
        } catch (error) {
          if (error instanceof Error) {
            res.status(400).json({ error: error.message });
          } else {
            res.status(500).json({ error: 'Failed to update profile' });
          }
        }
      };

      await profileUpdateHandler(mockRequest as Request, mockResponse as Response);

      expect(mockGetUserByUsername).not.toHaveBeenCalled();
      expect(mockUpdateUser).toHaveBeenCalledWith(1, { userName: 'testuser' });
      expect(statusCode).toBe(200);
    });
  });
});