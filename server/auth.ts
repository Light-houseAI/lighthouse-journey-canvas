import { Request, Response, NextFunction } from "express";
import { storage } from "./storage";

declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  
  try {
    const user = await storage.getUserById(req.session.userId);
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
    // If already authenticated, redirect to home instead of showing error
    return res.redirect("/");
  }
  next();
};