import { Request, Response, NextFunction } from "express";
import { storage } from "./storage";

declare module "express-session" {
  interface SessionData {
    userId?: number;
    user?: any;
  }
}

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  // Dev mode bypass - use real user ID 17 from database with proper onboarding
  if (process.env.DEV_MODE === 'true') {
    console.log('🚧 DEV_MODE: Bypassing authentication with user ID 17');
    try {
      let user = await storage.getUserById(17);
      if (user) {
        // Ensure user has proper onboarding flags set for dev mode
        if (!user.interest) {
          console.log('🚧 DEV_MODE: Setting user interest to find_job');
          user = await storage.updateUserInterest(17, 'find_job');
        }
        if (!user.hasCompletedOnboarding) {
          console.log('🚧 DEV_MODE: Marking onboarding as complete');
          user = await storage.completeOnboarding(17);
        }
        
        (req as any).user = user;
        req.session.userId = 17;
        return next();
      } else {
        console.warn('⚠️ DEV_MODE: User ID 17 not found in database');
        return res.status(401).json({ error: "Dev user not found" });
      }
    } catch (error) {
      console.error('❌ DEV_MODE: Error fetching user 17:', error);
      return res.status(500).json({ error: "Dev mode error" });
    }
  }

  if (!req.session.userId && !req.headers['X-User-Id']) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const userId = req.session.userId || parseInt(req.headers['X-User-Id'] as string, 10);
    const user = await storage.getUserById(userId);
    if (!user) {
      req.session.userId = undefined;
      return res.status(401).json({ error: "Invalid session" });
    }

    (req as any).user = user;
    next();
  } catch (error) {
    console.error("Error in auth middleware:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const requireGuest = (req: Request, res: Response, next: NextFunction) => {
  if (req.session.userId) {
    return res.status(400).json({ error: "Already authenticated" });
  }
  next();
};
