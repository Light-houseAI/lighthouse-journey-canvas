/**
 * Legacy Controller
 *
 * Handles legacy API endpoints that provide backward compatibility.
 * These endpoints bridge the gap between the old system and the new hierarchical timeline system.
 *
 * Endpoints:
 * - Project management (save, get projects)
 * - Milestone management (save, update, delete, create)
 * - AI chat processing
 * - Audio transcription
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { HierarchyService, type CreateNodeDTO } from '../services/hierarchy-service';
import { BaseController } from './base-controller.js';
import { ValidationError, NotFoundError } from '../core/errors';
import OpenAI from 'openai';

// Request validation schemas
const saveProjectsSchema = z.object({
  projects: z.array(z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    technologies: z.array(z.string()).optional(),
    projectType: z.string().optional().default('professional'),
    parentId: z.string().uuid().optional(),
  })),
});

const saveMilestoneSchema = z.object({
  milestone: z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    type: z.enum(['job', 'education', 'project']).optional().default('project'),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    date: z.string().optional(),
    organization: z.string().optional(),
    company: z.string().optional(),
    technologies: z.array(z.string()).optional(),
    skills: z.array(z.string()).optional(),
    parentId: z.string().uuid().optional(),
  }),
});

const updateMilestoneSchema = z.object({
  milestoneId: z.string().uuid(),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
});

const deleteMilestoneSchema = z.object({
  milestoneId: z.string().uuid(),
});

const processChatSchema = z.object({
  message: z.string().min(1).max(1000),
  conversationContext: z.object({}).optional(),
  conversationState: z.string().optional(),
});

const createMilestoneSchema = z.object({
  userInput: z.string().min(1).max(500),
  parentContext: z.object({
    parentOrganization: z.string().optional(),
    parentId: z.string().uuid().optional(),
  }).optional(),
});

export class LegacyController extends BaseController {
  private hierarchyService: HierarchyService;
  private openai: OpenAI;

  constructor({
    hierarchyService,
  }: {
    hierarchyService: HierarchyService;
  }) {
    super();
    this.hierarchyService = hierarchyService;
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  /**
   * POST /save-projects - Save multiple projects using hierarchical system
   */
  async saveProjects(req: Request, res: Response): Promise<void> {
    try {
      const user = this.getAuthenticatedUser(req);
      const validatedData = saveProjectsSchema.parse(req.body);
      const { projects } = validatedData;

      // Create multiple projects using hierarchical system
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
        const createdNode = await this.hierarchyService.createNode(nodeDTO, user.id);
        createdProjects.push(createdNode);
      }

      this.success(res, { projects: createdProjects }, req);
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.error(res, new ValidationError('Invalid project data', error.errors), req);
      } else {
        this.error(res, error instanceof Error ? error : new Error('Failed to save projects'), req);
      }
    }
  }

  /**
   * GET /projects - Get all projects (transformed from hierarchical nodes)
   */
  async getProjects(req: Request, res: Response): Promise<void> {
    try {
      const user = this.getAuthenticatedUser(req);

      // Get all nodes from hierarchical system
      const allNodes = await this.hierarchyService.getAllNodes(user.id);

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

      this.success(res, projects, req);
    } catch (error) {
      this.error(res, error instanceof Error ? error : new Error('Failed to get projects'), req);
    }
  }

  /**
   * POST /save-milestone - Save milestone as hierarchical node
   */
  async saveMilestone(req: Request, res: Response): Promise<void> {
    try {
      const user = this.getAuthenticatedUser(req);
      const validatedData = saveMilestoneSchema.parse(req.body);
      const { milestone } = validatedData;

      console.log('Saving milestone for userId:', user.id, 'milestone:', milestone);

      // Transform milestone to hierarchical node format
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
      const createdNode = await this.hierarchyService.createNode(nodeDTO, user.id);

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

      this.success(res, {
        milestone: nodeData,
        shouldCreateNode: true,
        shouldFocus: true
      }, req);
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.error(res, new ValidationError('Invalid milestone data', error.errors), req);
      } else {
        this.error(res, error instanceof Error ? error : new Error('Failed to save milestone'), req);
      }
    }
  }

  /**
   * PUT /update-milestone - Update milestone using hierarchical API
   */
  async updateMilestone(req: Request, res: Response): Promise<void> {
    try {
      const user = this.getAuthenticatedUser(req);
      const validatedData = updateMilestoneSchema.parse(req.body);
      const { milestoneId, title, description } = validatedData;

      // Update node using hierarchical timeline API
      const updatedNode = await this.hierarchyService.updateNode(
        milestoneId,
        { meta: { title, description } },
        user.id
      );

      if (!updatedNode) {
        throw new NotFoundError('Milestone not found');
      }

      this.success(res, { success: true }, req);
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.error(res, new ValidationError('Invalid update data', error.errors), req);
      } else {
        this.error(res, error instanceof Error ? error : new Error('Failed to update milestone'), req);
      }
    }
  }

  /**
   * DELETE /delete-milestone - Delete milestone using hierarchical API
   */
  async deleteMilestone(req: Request, res: Response): Promise<void> {
    try {
      const user = this.getAuthenticatedUser(req);
      const validatedData = deleteMilestoneSchema.parse(req.body);
      const { milestoneId } = validatedData;

      // Delete node using hierarchical timeline API
      const deleted = await this.hierarchyService.deleteNode(milestoneId, user.id);

      if (!deleted) {
        throw new NotFoundError('Milestone not found');
      }

      this.success(res, { success: true }, req);
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.error(res, new ValidationError('Invalid delete request', error.errors), req);
      } else {
        this.error(res, error instanceof Error ? error : new Error('Failed to delete milestone'), req);
      }
    }
  }

  /**
   * POST /process-chat - AI chat processing for career development
   */
  async processChat(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = processChatSchema.parse(req.body);
      const { message, conversationContext, conversationState } = validatedData;

      // Use GPT-4o-mini for chat processing
      const completion = await this.openai.chat.completions.create({
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

      this.success(res, {
        response: aiResponse,
        conversationState: conversationState
      }, req);
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.error(res, new ValidationError('Invalid chat request', error.errors), req);
      } else {
        console.error("AI chat processing error:", error);
        this.success(res, {
          error: "Failed to process message",
          fallbackResponse: "I'm having trouble processing that right now. Could you try rephrasing?"
        }, req);
      }
    }
  }

  /**
   * POST /transcribe - Audio transcription using OpenAI Whisper
   */
  async transcribeAudio(req: Request, res: Response): Promise<void> {
    try {
      const audioFile = (req as any).file;
      if (!audioFile) {
        throw new ValidationError('No audio file provided');
      }

      // Convert buffer to file-like object for OpenAI
      const audioFileForAI = new File([audioFile.buffer], audioFile.originalname || 'audio.wav', {
        type: audioFile.mimetype || 'audio/wav'
      });

      // Use Whisper-1 for transcription
      const transcription = await this.openai.audio.transcriptions.create({
        file: audioFileForAI,
        model: "whisper-1",
      });

      this.success(res, { text: transcription.text }, req);
    } catch (error) {
      console.error("Transcription error:", error);
      if (error instanceof ValidationError) {
        this.error(res, error, req);
      } else {
        this.success(res, {
          error: "Failed to transcribe audio",
          fallbackText: "Sorry, I couldn't process that audio. Could you try again or type your message?"
        }, req);
      }
    }
  }

  /**
   * POST /create-milestone - Create structured milestone from user input
   */
  async createMilestone(req: Request, res: Response): Promise<void> {
    try {
      const user = this.getAuthenticatedUser(req);
      const validatedData = createMilestoneSchema.parse(req.body);
      const { userInput, parentContext } = validatedData;

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
      const createdNode = await this.hierarchyService.createNode(nodeDTO, user.id);

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

      this.success(res, { milestone: responseData }, req);
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.error(res, new ValidationError('Invalid milestone creation request', error.errors), req);
      } else {
        this.error(res, error instanceof Error ? error : new Error('Failed to create milestone'), req);
      }
    }
  }
}
