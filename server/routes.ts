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
import OpenAI from "openai";
import multer from "multer";
import aiRoutes from "./routes/ai";
import { initializeApiV1Router } from "./routes/api/v1/index";
import { initializeApiV2Router } from "./routes/api/v2/index";

export async function registerRoutes(app: Express): Promise<Server> {
  const multiSourceExtractor = new MultiSourceExtractor();
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

  // Configure multer for file uploads
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 } // 25MB limit
  });

  // Register AI routes
  app.use(aiRoutes);

  // Register API v1 routes
  const apiV1Router = await initializeApiV1Router();
  app.use('/api/v1', apiV1Router);

  // Register API v2 routes - Hierarchical Timeline System
  const apiV2Router = await initializeApiV2Router();
  app.use('/api/v2', apiV2Router);

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
      const existingProfile = await storage.getProfileByUsername(user.id, username);
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
      const existingProfile = await storage.getProfileByUsername(user.id, profileData.username);
      if (existingProfile) {
        return res.status(409).json({
          success: false,
          message: "Profile already exists for this username"
        });
      }

      const savedProfile = await storage.createProfile(profileWithUser);

      await storage.completeOnboarding(user.id);

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

      console.log('Saving milestone for userId:', userId, 'milestone:', milestone);

      // Get user profile to update filteredData
      const userProfile = await storage.getProfileByUserId(userId);
      if (!userProfile) {
        return res.status(404).json({ error: "User profile not found" });
      }

      const filteredData = userProfile.filteredData;
      let updated = false;

      // Categorize and save to appropriate section in filteredData
      if (milestone.type === 'job' || milestone.type === 'experience' || milestone.type === 'workExperience') {
        // Save as work experience
        const newExperience = {
          title: milestone.title,
          company: milestone.organization || milestone.company || 'Unknown Company',
          start: milestone.startDate || milestone.start || milestone.date,
          end: milestone.endDate || milestone.end || (milestone.ongoing || milestone.isOngoing ? 'Present' : undefined),
          description: milestone.description,
          location: milestone.location
        };

        filteredData.experiences = filteredData.experiences || [];
        filteredData.experiences.push(newExperience);
        updated = true;
        console.log('Added to experiences');

      } else if (milestone.type === 'education') {
        // Save as education
        const newEducation = {
          school: milestone.organization || milestone.school || 'Unknown Institution',
          degree: milestone.degree || milestone.title,
          field: milestone.field || milestone.description,
          start: milestone.startDate || milestone.start || milestone.date,
          end: milestone.endDate || milestone.end || (milestone.ongoing || milestone.isOngoing ? 'Present' : undefined),
        };

        filteredData.education = filteredData.education || [];
        filteredData.education.push(newEducation);
        updated = true;
        console.log('Added to education');

      } else if (milestone.type === 'jobTransition') {
        // Save as special work experience with transition context
        const newExperience = {
          title: milestone.title,
          company: 'Career Transition',
          start: milestone.start || milestone.startDate || milestone.date,
          end: milestone.end || milestone.endDate || (milestone.ongoing || milestone.isOngoing ? 'Present' : undefined),
          description: `${milestone.description}${milestone.reason ? ` Reason: ${milestone.reason}` : ''}`,
          isTransition: true,
          status: milestone.status
        };

        filteredData.experiences = filteredData.experiences || [];
        filteredData.experiences.push(newExperience);
        updated = true;
        console.log('Added job transition to experiences');

      } else if (milestone.type === 'event') {
        // Save to new events array
        const newEvent = {
          title: milestone.title,
          description: milestone.description,
          eventType: milestone.eventType,
          location: milestone.location,
          start: milestone.start || milestone.startDate || milestone.date,
          end: milestone.end || milestone.endDate,
          organizer: milestone.organizer,
          attendees: milestone.attendees
        };

        filteredData.events = filteredData.events || [];
        filteredData.events.push(newEvent);
        updated = true;
        console.log('Added to events');

      } else if (milestone.type === 'action') {
        // Save to new actions array
        const newAction = {
          title: milestone.title,
          description: milestone.description,
          category: milestone.category,
          impact: milestone.impact,
          verification: milestone.verification,
          start: milestone.start || milestone.startDate || milestone.date,
          end: milestone.end || milestone.endDate
        };

        filteredData.actions = filteredData.actions || [];
        filteredData.actions.push(newAction);
        updated = true;
        console.log('Added to actions');

      } else if (milestone.type === 'skill') {
        // Save as skill
        const skillName = milestone.title || milestone.name || milestone.skill;
        if (skillName && !filteredData.skills.includes(skillName)) {
          filteredData.skills = filteredData.skills || [];
          filteredData.skills.push(skillName);
          updated = true;
          console.log('Added to skills');
        }

      } else {
        // Save as project/milestone (existing behavior)
        const existingProjects = await storage.getProjectMilestones(userId) || [];
        const updatedProjects = [...existingProjects, milestone];
        await storage.saveProjectMilestones(userId, updatedProjects);
        updated = true;
        console.log('Added to projects/milestones');
      }

      // Update the profile's filteredData if we made changes
      if (updated && (milestone.type === 'job' || milestone.type === 'experience' || milestone.type === 'workExperience' || milestone.type === 'education' || milestone.type === 'skill' || milestone.type === 'jobTransition' || milestone.type === 'event' || milestone.type === 'action')) {
        await storage.updateProfile(userProfile.id, { filteredData });
        console.log('Successfully updated profile filteredData');
      }

      // Store in vector database for semantic search
      try {
        console.log('Storing milestone in vector database...');
        await profileVectorManager.storeMilestone(userId.toString(), milestone);
        console.log('Successfully stored milestone in vector database');
      } catch (vectorError) {
        console.error('Failed to store milestone in vector database:', vectorError);
        // Don't fail the entire request if vector storage fails
      }

      // Create the node data for the frontend
      const nodeData = {
        id: milestone.id,
        type: milestone.type || 'milestone',
        title: milestone.title,
        description: milestone.description,
        organization: milestone.organization,
        date: milestone.date,
        startDate: milestone.startDate,
        endDate: milestone.endDate,
        skills: milestone.skills || [],
        technologies: milestone.technologies || [],
        isSubMilestone: milestone.isSubMilestone || false,
        parentId: milestone.parentId
      };

      res.json({
        success: true,
        milestone: nodeData,
        shouldCreateNode: true,
        shouldFocus: true
      });
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

  // Route to process AI chat messages
  app.post("/api/process-chat", requireAuth, async (req: Request, res: Response) => {
    try {
      const { message, conversationContext, conversationState } = req.body;

      // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a professional career development assistant helping users build STAR (Situation, Task, Action, Result) stories for their career milestones.

            Context: ${JSON.stringify(conversationContext)}
            Current state: ${conversationState}

            Be conversational, encouraging, and help users articulate their professional achievements clearly.
            Keep responses concise (under 150 words) and actionable.

            Focus on helping users:
            - Articulate their impact and achievements
            - Structure their experiences using STAR format when appropriate
            - Identify key skills and accomplishments
            - Progress their career development goals`
          },
          {
            role: "user",
            content: message
          }
        ],
        max_tokens: 200,
        temperature: 0.7
      });

      const aiResponse = completion.choices[0]?.message?.content || "I'd be happy to help you with that. Could you tell me more?";

      res.json({
        response: aiResponse,
        conversationState: conversationState
      });

    } catch (error) {
      console.error("AI chat processing error:", error);
      res.status(500).json({
        error: "Failed to process message",
        fallbackResponse: "I'm having trouble processing that right now. Could you try rephrasing?"
      });
    }
  });

  // Route to transcribe audio using OpenAI Whisper
  app.post("/api/transcribe", requireAuth, upload.single('audio'), async (req: Request, res: Response) => {
    try {
      const audioFile = req.file;
      if (!audioFile) {
        return res.status(400).json({ error: "No audio file provided" });
      }

      // Convert buffer to file-like object for OpenAI
      const audioFileForAI = new File([audioFile.buffer], audioFile.originalname || 'audio.wav', {
        type: audioFile.mimetype || 'audio/wav'
      });

      // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      const transcription = await openai.audio.transcriptions.create({
        file: audioFileForAI,
        model: "whisper-1",
      });

      res.json({ text: transcription.text });
    } catch (error) {
      console.error("Transcription error:", error);
      res.status(500).json({
        error: "Failed to transcribe audio",
        fallbackText: "Sorry, I couldn't process that audio. Could you try again or type your message?"
      });
    }
  });

  // Create milestone with AI assistance
  app.post("/api/create-milestone", requireAuth, async (req: Request, res: Response) => {
    try {
      const { userInput, parentContext } = req.body;

      // Create a structured milestone from user input
      const milestone = {
        id: `milestone-${Date.now()}`,
        title: userInput.split(' ').slice(0, 4).join(' ').replace(/[^a-zA-Z0-9\s]/g, '') || 'New Project',
        description: userInput.length > 50 ? userInput.substring(0, 100) + '...' : userInput,
        type: 'project',
        date: new Date().getFullYear().toString(),
        skills: [],
        organization: parentContext.parentOrganization
      };

      res.json({ milestone });
    } catch (error) {
      console.error('Error creating milestone:', error);
      res.status(500).json({ error: 'Failed to create milestone' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
