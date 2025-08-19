import { Router, Request, Response } from 'express';
import { storage } from '../services/storage.service';
import { requireAuth, requireGuest } from '../middleware';
import { signUpSchema, signInSchema, type User } from '@shared/schema';

const router = Router();

// Auth routes
router.post('/signup', requireGuest, async (req: Request, res: Response) => {
  try {
    const signUpData = signUpSchema.parse(req.body);

    // Check if user already exists
    const existingUser = await storage.getUserByEmail(signUpData.email);
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Create user
    const user = await storage.createUser(signUpData);
    req.session.userId = user.id;

    res.json({
      success: true,
      user: { id: user.id, email: user.email, userName: user.userName },
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

router.post('/signin', requireGuest, async (req: Request, res: Response) => {
  try {
    const signInData = signInSchema.parse(req.body);

    // Find user
    const user = await storage.getUserByEmail(signInData.email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Validate password
    const isValidPassword = await storage.validatePassword(
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
    userName: user.userName,
    interest: user.interest,
    hasCompletedOnboarding: user.hasCompletedOnboarding,
  });
});

export default router;
