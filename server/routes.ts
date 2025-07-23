import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { LinkedInExtractor } from "./services/linkedin-extractor";
import { usernameInputSchema, insertProfileSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  const linkedInExtractor = new LinkedInExtractor();

  // Extract LinkedIn profile data
  app.post("/api/extract-profile", async (req, res) => {
    try {
      const { username } = usernameInputSchema.parse(req.body);
      
      // Check if profile already exists
      const existingProfile = await storage.getProfileByUsername(username);
      if (existingProfile) {
        return res.json({ 
          success: true, 
          profile: existingProfile.rawData 
        });
      }

      // Extract profile data
      const profileData = await linkedInExtractor.extractProfile(username);
      
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

  // Save selected profile data
  app.post("/api/save-profile", async (req, res) => {
    try {
      const validatedData = insertProfileSchema.parse(req.body);
      
      // Check if profile already exists
      const existingProfile = await storage.getProfileByUsername(validatedData.username);
      if (existingProfile) {
        return res.status(409).json({ 
          success: false, 
          message: "Profile already exists for this username" 
        });
      }

      const savedProfile = await storage.createProfile(validatedData);
      
      res.json({ 
        success: true, 
        profile: savedProfile 
      });
    } catch (error) {
      console.error("Profile save error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid profile data",
          errors: error.errors 
        });
      }
      res.status(500).json({ 
        success: false, 
        message: "Failed to save profile" 
      });
    }
  });

  // Get all saved profiles
  app.get("/api/profiles", async (req, res) => {
    try {
      const profiles = await storage.getAllProfiles();
      res.json({ 
        success: true, 
        profiles 
      });
    } catch (error) {
      console.error("Get profiles error:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to fetch profiles" 
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
