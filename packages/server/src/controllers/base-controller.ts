/**
 * Base Controller
 *
 * Provides common authentication helper for all API controllers
 */

import { UnauthorizedError } from '@journey/schema';
import { Request } from 'express';

/**
 * Base controller providing authentication functionality for all API controllers
 */
export abstract class BaseController {
  /**
   * Extract user from authenticated request
   *
   * @param req Express request object
   * @returns User object with ID
   * @throws UnauthorizedError if user is not authenticated
   */
  protected getAuthenticatedUser(req: Request): { id: number } {
    const user = (req as any).user;
    if (!user || !user.id) {
      throw new UnauthorizedError('User authentication required');
    }

    return { id: user.id };
  }
}
