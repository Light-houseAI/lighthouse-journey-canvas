/**
 * Waitlist Routes
 *
 * Public and admin endpoints for waitlist and invite code management.
 * Public endpoints don't require authentication.
 * Admin endpoints require authentication (in a future iteration, add admin role check).
 */

import { WaitlistStatus } from '@journey/schema';
import type { AwilixContainer } from 'awilix';
import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';

import { requireAuth } from '../middleware/auth.middleware.js';
import { containerMiddleware } from '../middleware/index.js';
import type { WaitlistService } from '../services/waitlist.service.js';

// Extend Express Request type
declare module 'express' {
  interface Request {
    scope: AwilixContainer;
    user?: any;
    userId?: number;
  }
}

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const addToWaitlistSchema = z.object({
  email: z.string().email('Invalid email address'),
  jobRole: z.string().optional().nullable(),
});

const generateInviteSchema = z.object({
  expiryDays: z.number().int().min(1).max(30).optional().default(7),
});

const listWaitlistSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
  status: z.enum(['pending', 'invited', 'registered']).optional(),
});

// ============================================================================
// ROUTER
// ============================================================================

const router: any = Router();

/**
 * POST /waitlist - Add to waitlist (public, no auth required)
 *
 * Request body:
 * - email: string (required)
 * - jobRole: string (optional)
 *
 * Response:
 * - success: boolean
 * - message: string
 * - alreadyExists: boolean (if true, email was already on the list)
 */
router.post(
  '/',
  containerMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = addToWaitlistSchema.parse(req.body);

      const waitlistService = (req as any).scope.resolve(
        'waitlistService'
      ) as WaitlistService;

      const result = await waitlistService.addToWaitlist(data.email, data.jobRole ?? undefined);

      res.status(result.alreadyExists ? 200 : 201).json({
        success: result.success,
        data: {
          message: result.message,
          alreadyExists: result.alreadyExists,
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.errors,
          },
          meta: {
            timestamp: new Date().toISOString(),
          },
        });
      }
      next(error);
    }
  }
);

/**
 * GET /waitlist - List waitlist entries (requires auth - admin only in future)
 *
 * Query params:
 * - limit: number (default: 50, max: 100)
 * - offset: number (default: 0)
 * - status: 'pending' | 'invited' | 'registered' (optional filter)
 *
 * Response:
 * - entries: WaitlistRecord[]
 * - total: number
 * - pagination: { limit, offset }
 */
router.get(
  '/',
  requireAuth,
  containerMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = listWaitlistSchema.parse(req.query);

      const waitlistService = (req as any).scope.resolve(
        'waitlistService'
      ) as WaitlistService;

      const result = await waitlistService.listWaitlist({
        limit: query.limit,
        offset: query.offset,
        status: query.status as WaitlistStatus | undefined,
      });

      res.json({
        success: true,
        data: {
          entries: result.entries,
          total: result.total,
          pagination: {
            limit: query.limit,
            offset: query.offset,
          },
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters',
            details: error.errors,
          },
          meta: {
            timestamp: new Date().toISOString(),
          },
        });
      }
      next(error);
    }
  }
);

/**
 * POST /waitlist/:id/invite - Generate invite code for a waitlist entry (requires auth - admin only in future)
 *
 * Path params:
 * - id: number (waitlist entry ID)
 *
 * Request body:
 * - expiryDays: number (default: 7, max: 30)
 *
 * Response:
 * - inviteCode: string
 * - email: string
 * - expiresAt: string (ISO date)
 */
router.post(
  '/:id/invite',
  requireAuth,
  containerMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const waitlistId = parseInt(req.params.id, 10);
      if (isNaN(waitlistId)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_ID',
            message: 'Invalid waitlist ID',
          },
          meta: {
            timestamp: new Date().toISOString(),
          },
        });
      }

      const body = generateInviteSchema.parse(req.body);

      const waitlistService = (req as any).scope.resolve(
        'waitlistService'
      ) as WaitlistService;

      const result = await waitlistService.generateInviteCode(
        waitlistId,
        body.expiryDays
      );

      if (!result.success) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: result.message,
          },
          meta: {
            timestamp: new Date().toISOString(),
          },
        });
      }

      res.status(201).json({
        success: true,
        data: {
          inviteCode: result.inviteCode!.code,
          email: result.inviteCode!.email,
          expiresAt: result.inviteCode!.expiresAt.toISOString(),
          inviteUrl: `https://krama-ai.com/join?code=${result.inviteCode!.code}`,
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.errors,
          },
          meta: {
            timestamp: new Date().toISOString(),
          },
        });
      }
      next(error);
    }
  }
);

/**
 * GET /waitlist/invite/:code/validate - Validate an invite code (public, no auth required)
 *
 * Path params:
 * - code: string (invite code)
 *
 * Response:
 * - valid: boolean
 * - email: string (if valid)
 * - expired: boolean (if expired)
 * - alreadyUsed: boolean (if already used)
 */
router.get(
  '/invite/:code/validate',
  containerMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const code = req.params.code;
      if (!code) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_CODE',
            message: 'Invite code is required',
          },
          meta: {
            timestamp: new Date().toISOString(),
          },
        });
      }

      const waitlistService = (req as any).scope.resolve(
        'waitlistService'
      ) as WaitlistService;

      const result = await waitlistService.validateInviteCode(code);

      res.json({
        success: true,
        data: {
          valid: result.valid,
          email: result.email,
          expired: result.expired,
          alreadyUsed: result.alreadyUsed,
          message: result.message,
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      next(error);
    }
  }
);

export default router;
