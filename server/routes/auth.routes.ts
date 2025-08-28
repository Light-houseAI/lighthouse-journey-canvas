import { profileUpdateSchema, signInSchema, signUpSchema, type User } from '@shared/types';
import { Request, Response, Router } from 'express';

import { containerMiddleware, requireAuth, requireGuest } from '../middleware';
import type { UserService } from '../services/user-service';

const router = Router();

// Auth routes
router.post('/signup', requireGuest, containerMiddleware, async (req: Request, res: Response) => {
  try {
    const signUpData = signUpSchema.parse(req.body);
    const userService = req.scope.resolve<UserService>('userService');

    // Check if user already exists
    const existingUser = await userService.getUserByEmail(signUpData.email);
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Create user
    const user = await userService.createUser(signUpData);
    req.session.userId = user.id;

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        userName: user.userName
      },
    });
  } catch (error) {
    console.error('Sign up error:', error);
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to create account' });
    }
  }
});

router.post('/signin', requireGuest, containerMiddleware, async (req: Request, res: Response) => {
  try {
    const signInData = signInSchema.parse(req.body);
    const userService = req.scope.resolve<UserService>('userService');

    // Find user
    const user = await userService.getUserByEmail(signInData.email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Validate password
    const isValidPassword = await userService.validatePassword(
      signInData.password,
      user.password
    );
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    req.session.userId = user.id;
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        userName: user.userName,
        interest: user.interest,
        hasCompletedOnboarding: user.hasCompletedOnboarding,
      },
    });
  } catch (error) {
    console.error('Sign in error:', error);
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to sign in' });
    }
  }
});

router.post('/logout', (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ error: 'Failed to logout' });
    }
    res.json({ success: true });
  });
});

router.get('/me', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user as User;
  res.json({
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    userName: user.userName,
    interest: user.interest,
    hasCompletedOnboarding: user.hasCompletedOnboarding,
  });
});

router.patch('/profile', requireAuth, containerMiddleware, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as User;
    const updateData = profileUpdateSchema.parse(req.body);
    const userService = req.scope.resolve<UserService>('userService');

    // Check if username is already taken (if provided)
    if (updateData.userName && updateData.userName !== user.userName) {
      const existingUser = await userService.getUserByUsername(updateData.userName);
      if (existingUser && existingUser.id !== user.id) {
        return res.status(400).json({ error: 'Username already taken' });
      }
    }

    // Update user profile
    const updatedUser = await userService.updateUser(user.id, updateData);
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
    console.error('Profile update error:', error);
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to update profile' });
    }
  }
});

export default router;
