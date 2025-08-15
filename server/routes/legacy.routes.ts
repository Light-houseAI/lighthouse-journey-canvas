import { Router, Request, Response } from "express";
import { HierarchyService, type CreateNodeDTO } from '../services/hierarchy-service';
import { requireAuth, containerMiddleware } from "../middleware";
import OpenAI from "openai";
import multer from "multer";

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB limit
});

const router = Router();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Apply auth middleware to all routes
router.use(requireAuth, containerMiddleware);

// Legacy project routes - Updated to use hierarchical timeline
router.post("/save-projects", async (req: Request, res: Response) => {
    try {
      const { projects } = req.body;
      const userId = req.session.userId!;

      // Create multiple projects using hierarchical system
      const hierarchyService = req.scope.resolve<HierarchyService>('hierarchyService');
      const createdProjects = [];
      for (const project of projects) {
        const nodeDTO: CreateNodeDTO = {
          type: 'project',
          parentId: project.parentId || null,
          meta: {
            title: project.title,
            description: project.description,
            startDate: project.startDate,
            endDate: project.endDate,
            technologies: project.technologies || [],
            projectType: project.projectType || 'professional'
          }
        };
        const createdNode = await hierarchyService.createNode(nodeDTO, userId);
        createdProjects.push(createdNode);
      }

      res.json({ success: true, projects: createdProjects });
    } catch (error) {
      console.error("Save projects error:", error);
      res.status(500).json({ error: "Failed to save projects" });
    }
  });

router.get("/projects", async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;

      // Get all nodes from hierarchical system (could filter by type if needed)
      const hierarchyService = req.scope.resolve<HierarchyService>('hierarchyService');
      const allNodes = await hierarchyService.getAllNodes(userId);

      // Transform to legacy format for backward compatibility
      const projects = allNodes.map(node => ({
        id: node.id,
        title: node.meta.title,
        description: node.meta.description,
        type: node.type,
        date: node.meta.date || node.meta.startDate,
        startDate: node.meta.startDate,
        endDate: node.meta.endDate,
        organization: node.meta.organization || node.meta.company || node.meta.institution,
        skills: node.meta.skills || node.meta.technologies || [],
        parentId: node.parentId
      }));

      res.json(projects);
    } catch (error) {
      console.error("Get projects error:", error);
      res.status(500).json({ error: "Failed to get projects" });
    }
  });

// Legacy milestone routes - Updated to use hierarchical timeline
router.post("/save-milestone", async (req: Request, res: Response) => {
    try {
      const { milestone } = req.body;
      const userId = req.session.userId!;

      console.log('Saving milestone for userId:', userId, 'milestone:', milestone);

      // Transform milestone to hierarchical node format
      const hierarchyService = req.scope.resolve<HierarchyService>('hierarchyService');
      const nodeDTO: CreateNodeDTO = {
        type: milestone.type === 'job' ? 'job' : milestone.type === 'education' ? 'education' : 'project',
        parentId: milestone.parentId || null,
        meta: {
          title: milestone.title,
          description: milestone.description,
          startDate: milestone.startDate || milestone.date,
          endDate: milestone.endDate,
          company: milestone.organization || milestone.company,
          technologies: milestone.technologies || [],
          projectType: 'professional'
        }
      };
      const createdNode = await hierarchyService.createNode(nodeDTO, userId);

      // Create the node data for the frontend (compatible with existing format)
      const nodeData = {
        id: createdNode.id,
        type: createdNode.type,
        title: createdNode.meta.title || milestone.title,
        description: createdNode.meta.description || milestone.description,
        organization: createdNode.meta.organization || milestone.organization,
        date: createdNode.meta.date || milestone.date,
        startDate: createdNode.meta.startDate || milestone.startDate,
        endDate: createdNode.meta.endDate || milestone.endDate,
        skills: createdNode.meta.skills || milestone.skills || [],
        technologies: createdNode.meta.technologies || milestone.technologies || [],
        isSubMilestone: !!createdNode.parentId,
        parentId: createdNode.parentId
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

router.put("/update-milestone", async (req: Request, res: Response) => {
    try {
      const { milestoneId, title, description } = req.body;
      const userId = req.session.userId!;

      // Update node using hierarchical timeline API
      const hierarchyService = req.scope.resolve<HierarchyService>('hierarchyService');
      await hierarchyService.updateNode(milestoneId, { meta: { title, description } }, userId);

      res.json({ success: true });
    } catch (error) {
      console.error("Update milestone error:", error);
      res.status(500).json({ error: "Failed to update milestone" });
    }
  });

router.delete("/delete-milestone", async (req: Request, res: Response) => {
    try {
      const { milestoneId } = req.body;
      const userId = req.session.userId!;

      // Delete node using hierarchical timeline API
      const hierarchyService = req.scope.resolve<HierarchyService>('hierarchyService');
      await hierarchyService.deleteNode(milestoneId, userId);

      res.json({ success: true });
    } catch (error) {
      console.error("Delete milestone error:", error);
      res.status(500).json({ error: "Failed to delete milestone" });
    }
  });

// AI and voice processing routes
router.post("/process-chat", async (req: Request, res: Response) => {
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

router.post("/transcribe", upload.single('audio'), async (req: Request, res: Response) => {
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

router.post("/create-milestone", async (req: Request, res: Response) => {
    try {
      const { userInput, parentContext } = req.body;
      const userId = req.session.userId!;

      // Create a structured milestone from user input
      const milestone = {
        id: `milestone-${Date.now()}`,
        title: userInput.split(' ').slice(0, 4).join(' ').replace(/[^a-zA-Z0-9\s]/g, '') || 'New Project',
        description: userInput.length > 50 ? userInput.substring(0, 100) + '...' : userInput,
        type: 'project',
        date: new Date().getFullYear().toString(),
        skills: [],
        organization: parentContext?.parentOrganization,
        parentId: parentContext?.parentId
      };

      // Transform and create in hierarchical system
      const hierarchyService = req.scope.resolve<HierarchyService>('hierarchyService');
      const nodeDTO: CreateNodeDTO = {
        type: 'project',
        parentId: milestone.parentId || null,
        meta: {
          title: milestone.title,
          description: milestone.description,
          startDate: milestone.date,
          technologies: milestone.skills || [],
          projectType: 'professional'
        }
      };
      const createdNode = await hierarchyService.createNode(nodeDTO, userId);

      // Return in expected format
      const responseData = {
        id: createdNode.id,
        title: createdNode.meta.title,
        description: createdNode.meta.description,
        type: createdNode.type,
        date: createdNode.meta.date,
        skills: createdNode.meta.skills || [],
        organization: createdNode.meta.organization,
        parentId: createdNode.parentId
      };

      res.json({ milestone: responseData });
    } catch (error) {
      console.error('Error creating milestone:', error);
      res.status(500).json({ error: 'Failed to create milestone' });
    }
  });

export default router;