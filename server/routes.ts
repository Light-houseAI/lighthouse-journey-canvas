import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { requireAuth, requireGuest } from "./auth";
import { 
  usernameInputSchema, 
  insertProfileSchema, 
  signUpSchema, 
  signInSchema, 
  interestSchema,
  type User 
} from "@shared/schema";
import { MultiSourceExtractor } from "./services/multi-source-extractor";

export async function registerRoutes(app: Express): Promise<Server> {
  const multiSourceExtractor = new MultiSourceExtractor();

  // Auth routes
  app.post("/api/signup", requireGuest, async (req: Request, res: Response) => {
    try {
      const signUpData = signUpSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(signUpData.email);
      if (existingUser) {
        return res.status(400).json({ error: "Email already registered" });
      }
      
      // Create user
      const user = await storage.createUser(signUpData);
      req.session.userId = user.id;
      
      res.json({ success: true, user: { id: user.id, email: user.email } });
    } catch (error) {
      console.error("Sign up error:", error);
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Failed to create account" });
      }
    }
  });

  app.post("/api/signin", requireGuest, async (req: Request, res: Response) => {
    try {
      const signInData = signInSchema.parse(req.body);
      
      // Find user
      const user = await storage.getUserByEmail(signInData.email);
      if (!user) {
        return res.status(401).json({ error: "Invalid email or password" });
      }
      
      // Validate password
      const isValidPassword = await storage.validatePassword(signInData.password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: "Invalid email or password" });
      }
      
      req.session.userId = user.id;
      res.json({ success: true, user: { id: user.id, email: user.email } });
    } catch (error) {
      console.error("Sign in error:", error);
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Failed to sign in" });
      }
    }
  });

  app.post("/api/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ error: "Failed to logout" });
      }
      res.json({ success: true });
    });
  });

  app.get("/api/me", requireAuth, async (req: Request, res: Response) => {
    const user = (req as any).user as User;
    res.json({ 
      id: user.id, 
      email: user.email, 
      interest: user.interest,
      hasCompletedOnboarding: user.hasCompletedOnboarding
    });
  });

  // Onboarding routes
  app.post("/api/onboarding/interest", requireAuth, async (req: Request, res: Response) => {
    try {
      const { interest } = interestSchema.parse(req.body);
      const user = (req as any).user as User;
      
      await storage.updateUserInterest(user.id, interest);
      res.json({ success: true });
    } catch (error) {
      console.error("Update interest error:", error);
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Failed to update interest" });
      }
    }
  });

  app.post("/api/onboarding/complete", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as User;
      console.log('Completing onboarding for user:', user.id);
      await storage.completeOnboarding(user.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Complete onboarding error:", error);
      res.status(500).json({ error: "Failed to complete onboarding" });
    }
  });

  // Profile extraction routes (protected)
  app.post("/api/extract-profile", requireAuth, async (req: Request, res: Response) => {
    try {
      const { username } = usernameInputSchema.parse(req.body);
      const user = (req as any).user as User;
      
      // Check if profile already exists for this user
      const existingProfile = await storage.getProfileByUsername(username);
      if (existingProfile) {
        return res.json({ 
          success: true, 
          profile: existingProfile.rawData 
        });
      }

      // Extract comprehensive profile data from multiple sources
      const profileData = await multiSourceExtractor.extractComprehensiveProfile(username);
      
      res.json({ 
        success: true, 
        profile: profileData 
      });
    } catch (error) {
      console.error("Profile extraction error:", error);
      res.status(400).json({ 
        success: false, 
        message: error instanceof Error ? error.message : "Failed to extract profile data" 
      });
    }
  });

  // Save selected profile data (protected)
  // Get user's saved profile
  app.get("/api/profile", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as User;
      const profile = await storage.getProfileByUserId(user.id);
      
      if (!profile) {
        return res.status(404).json({ error: "Profile not found" });
      }

      // Include user data in profile response
      const profileWithUser = {
        ...profile,
        user: user
      };

      res.json(profileWithUser);
    } catch (error) {
      console.error("Error fetching profile:", error);
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  app.post("/api/save-profile", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as User;
      const profileData = insertProfileSchema.parse(req.body);
      
      // Add user ID to the profile data
      const profileWithUser = {
        ...profileData,
        userId: user.id,
      };
      
      // Check if profile already exists
      const existingProfile = await storage.getProfileByUsername(profileData.username);
      if (existingProfile) {
        return res.status(409).json({ 
          success: false, 
          message: "Profile already exists for this username" 
        });
      }

      const savedProfile = await storage.createProfile(profileWithUser);
      res.json({ 
        success: true, 
        profile: savedProfile 
      });
    } catch (error) {
      console.error("Save profile error:", error);
      res.status(400).json({ 
        success: false, 
        message: error instanceof Error ? error.message : "Failed to save profile data" 
      });
    }
  });

  // Get all profiles for authenticated user
  app.get("/api/profiles", requireAuth, async (req: Request, res: Response) => {
    try {
      const profiles = await storage.getAllProfiles();
      res.json({ success: true, profiles });
    } catch (error) {
      console.error("Get profiles error:", error);
      res.status(500).json({ error: "Failed to fetch profiles" });
    }
  });

  // Route to save project milestones during onboarding
  app.post("/api/save-projects", requireAuth, async (req: Request, res: Response) => {
    try {
      const { projects } = req.body;
      const userId = req.session.userId!;
      
      await storage.saveProjectMilestones(userId, projects);
      res.json({ success: true });
    } catch (error) {
      console.error("Save projects error:", error);
      res.status(500).json({ error: "Failed to save projects" });
    }
  });

  // Duplicate route removed - already defined above

  // Route to get project milestones
  app.get("/api/projects", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const projects = await storage.getProjectMilestones(userId);
      res.json(projects);
    } catch (error) {
      console.error("Get projects error:", error);
      res.status(500).json({ error: "Failed to get projects" });
    }
  });

  // Route to save voice updates/milestones
  app.post("/api/save-milestone", requireAuth, async (req: Request, res: Response) => {
    try {
      const { milestone } = req.body;
      const userId = req.session.userId!;
      
      // Add the milestone to the user's saved projects/milestones
      const existingProjects = await storage.getProjectMilestones(userId) || [];
      const updatedProjects = [...existingProjects, milestone];
      
      await storage.saveProjectMilestones(userId, updatedProjects);
      res.json({ success: true });
    } catch (error) {
      console.error("Save milestone error:", error);
      res.status(500).json({ error: "Failed to save milestone" });
    }
  });

  // Route to update a milestone
  app.put("/api/update-milestone", requireAuth, async (req: Request, res: Response) => {
    try {
      const { milestoneId, title, description } = req.body;
      const userId = req.session.userId!;
      
      // Get existing projects and update the specific milestone
      const existingProjects = await storage.getProjectMilestones(userId) || [];
      const updatedProjects = existingProjects.map(project => 
        project.id === milestoneId 
          ? { ...project, title, description }
          : project
      );
      
      await storage.saveProjectMilestones(userId, updatedProjects);
      res.json({ success: true });
    } catch (error) {
      console.error("Update milestone error:", error);
      res.status(500).json({ error: "Failed to update milestone" });
    }
  });

  // Route to delete a milestone
  app.delete("/api/delete-milestone", requireAuth, async (req: Request, res: Response) => {
    try {
      const { milestoneId } = req.body;
      const userId = req.session.userId!;
      
      // Get existing projects and remove the specific milestone
      const existingProjects = await storage.getProjectMilestones(userId) || [];
      const updatedProjects = existingProjects.filter(project => project.id !== milestoneId);
      
      await storage.saveProjectMilestones(userId, updatedProjects);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete milestone error:", error);
      res.status(500).json({ error: "Failed to delete milestone" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}