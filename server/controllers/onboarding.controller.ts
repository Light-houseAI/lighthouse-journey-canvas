/**
 * OnboardingController
 *
 * Handles user onboarding workflow endpoints including:
 * - Interest updates
 * - Profile extraction and parsing
 * - Profile data saving
 * - Onboarding completion
 */

import { interestSchema } from '@shared/types';
import { Request, Response } from 'express';

import { BusinessRuleError, ValidationError } from '../core/errors';
import { BaseController } from './base-controller';

export class OnboardingController extends BaseController {
  /**
   * POST /api/onboarding/interest
   * Update user's career interest during onboarding
   */
  async updateInterest(req: Request, res: Response): Promise<void> {
    try {
      const { interest } = interestSchema.parse(req.body);
      const user = this.getAuthenticatedUser(req);

      const userService = req.scope.resolve('userService');
      const updatedUser = await userService.updateUserInterest(
        user.id,
        interest
      );

      this.handleSuccess(res, { user: updatedUser });
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        this.handleError(
          res,
          new ValidationError('Invalid interest data provided')
        );
      } else {
        this.handleError(
          res,
          error instanceof Error
            ? error
            : new Error('Failed to update interest')
        );
      }
    }
  }

  /**
   * POST /api/onboarding/extract-profile
   * Extract and parse profile data from uploaded documents
   * Delegates to UserOnboardingController for actual implementation
   */
  async extractProfile(req: Request, res: Response): Promise<void> {
    try {
      const userOnboardingController = req.scope.resolve(
        'userOnboardingController'
      );
      await userOnboardingController.extractProfile(req, res);
    } catch (error) {
      this.handleError(
        res,
        error instanceof Error ? error : new Error('Failed to extract profile')
      );
    }
  }

  /**
   * POST /api/onboarding/save-profile
   * Save selected profile data from extraction results
   * Delegates to UserOnboardingController for actual implementation
   */
  async saveProfile(req: Request, res: Response): Promise<void> {
    try {
      const userOnboardingController = req.scope.resolve(
        'userOnboardingController'
      );
      await userOnboardingController.saveProfile(req, res);
    } catch (error) {
      this.handleError(
        res,
        error instanceof Error ? error : new Error('Failed to save profile')
      );
    }
  }

  /**
   * POST /api/onboarding/complete
   * Mark user onboarding as complete and update user status
   */
  async completeOnboarding(req: Request, res: Response): Promise<void> {
    try {
      const user = this.getAuthenticatedUser(req);

      const userService = req.scope.resolve('userService');
      const updatedUser = await userService.completeOnboarding(user.id);

      if (!updatedUser) {
        throw new BusinessRuleError(
          'Failed to complete onboarding - user not found or already completed'
        );
      }

      this.handleSuccess(res, { user: updatedUser });
    } catch (error) {
      this.handleError(
        res,
        error instanceof Error
          ? error
          : new Error('Failed to complete onboarding')
      );
    }
  }
}
