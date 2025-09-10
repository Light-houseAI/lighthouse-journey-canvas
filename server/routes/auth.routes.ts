/**
 * JWT Authentication Routes
 *
 * JWT-based authentication endpoints for user signup, signin, token refresh,
 * and profile management. Uses standardized response format via AuthController.
 */

import { Request, Response, Router } from 'express';
import { containerMiddleware } from '../middleware';
import { requireGuest, requireAuth } from '../middleware/auth.middleware';
import { AuthController } from '../controllers/auth.controller';
import { CONTAINER_TOKENS } from '../core/container-tokens';

const router = Router();

/**
 * POST /signup - Register new user with JWT tokens
 */
router.post('/signup', requireGuest, containerMiddleware, async (req: Request, res: Response) => {
  const authController = req.scope.resolve<AuthController>(CONTAINER_TOKENS.AUTH_CONTROLLER);
  await authController.signup(req, res);
});

/**
 * POST /signin - Login user with JWT tokens
 */
router.post('/signin', requireGuest, containerMiddleware, async (req: Request, res: Response) => {
  const authController = req.scope.resolve<AuthController>(CONTAINER_TOKENS.AUTH_CONTROLLER);
  await authController.signin(req, res);
});

/**
 * POST /refresh - Refresh access token using refresh token
 */
router.post('/refresh', containerMiddleware, async (req: Request, res: Response) => {
  const authController = req.scope.resolve<AuthController>(CONTAINER_TOKENS.AUTH_CONTROLLER);
  await authController.refresh(req, res);
});

/**
 * POST /logout - Logout user and revoke refresh token
 */
router.post('/logout', containerMiddleware, async (req: Request, res: Response) => {
  const authController = req.scope.resolve<AuthController>(CONTAINER_TOKENS.AUTH_CONTROLLER);
  await authController.logout(req, res);
});

/**
 * POST /revoke-all - Revoke all refresh tokens for current user
 */
router.post('/revoke-all', requireAuth, containerMiddleware, async (req: Request, res: Response) => {
  const authController = req.scope.resolve<AuthController>(CONTAINER_TOKENS.AUTH_CONTROLLER);
  await authController.revokeAll(req, res);
});

/**
 * GET /me - Get current user info
 */
router.get('/me', requireAuth, containerMiddleware, async (req: Request, res: Response) => {
  const authController = req.scope.resolve<AuthController>(CONTAINER_TOKENS.AUTH_CONTROLLER);
  await authController.getMe(req, res);
});

/**
 * PATCH /profile - Update user profile
 */
router.patch('/profile', requireAuth, containerMiddleware, async (req: Request, res: Response) => {
  const authController = req.scope.resolve<AuthController>(CONTAINER_TOKENS.AUTH_CONTROLLER);
  await authController.updateProfile(req, res);
});

/**
 * GET /debug/tokens - Debug endpoint to view user's active tokens (development only)
 */
if (process.env.NODE_ENV === 'development') {
  router.get('/debug/tokens', requireAuth, containerMiddleware, async (req: Request, res: Response) => {
    const authController = req.scope.resolve<AuthController>(CONTAINER_TOKENS.AUTH_CONTROLLER);
    await authController.debugTokens(req, res);
  });
}

export default router;
