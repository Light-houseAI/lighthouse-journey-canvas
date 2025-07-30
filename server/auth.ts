import { Request, Response, NextFunction } from "express";
import { storage } from "./storage";

declare module "express-session" {
  interface SessionData {
    userId?: number;
    user?: any;
  }
}

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
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
