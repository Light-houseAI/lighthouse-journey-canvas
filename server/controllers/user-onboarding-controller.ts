import type { Request, Response } from 'express';
import { HierarchyService, type CreateNodeDTO } from '../services/hierarchy-service';
import { MultiSourceExtractor } from '../services/multi-source-extractor';
import { storage } from '../services/storage.service';
import { 
  usernameInputSchema, 
  insertProfileSchema, 
  type User, 
  type ProfileData,
  type ProfileExperience,
  type ProfileEducation
} from '@shared/schema';

export interface OnboardingExtractRequest {
  username: string;
}

export interface OnboardingSaveRequest {
  username: string;
  rawData: ProfileData;
  filteredData: ProfileData;
}

export class UserOnboardingController {
  private hierarchyService: HierarchyService;
  private multiSourceExtractor: MultiSourceExtractor;

  constructor({ hierarchyService, multiSourceExtractor }: {
    hierarchyService: HierarchyService;
    multiSourceExtractor: MultiSourceExtractor;
  }) {
    this.hierarchyService = hierarchyService;
    this.multiSourceExtractor = multiSourceExtractor;
  }

  /**
   * Extract profile data from multiple sources
   * Endpoint: POST /api/extract-profile
   */
  async extractProfile(req: Request, res: Response): Promise<void> {
    try {
      const { username } = usernameInputSchema.parse(req.body);
      const user = (req as any).user as User;

      console.log(`[UserOnboarding] Starting profile extraction for user ${user.id}, username: ${username}`);

      // Check if user already has hierarchy nodes (indicating previous onboarding)
      const existingNodes = await this.hierarchyService.getAllNodes(user.id);
      if (existingNodes.length > 0) {
        console.log(`[UserOnboarding] User ${user.id} already has ${existingNodes.length} nodes, returning existing data`);
        
        // Transform existing nodes back to ProfileData format for consistency
        const profileData = this.transformNodesToProfileData(existingNodes);
        return res.json({
          success: true,
          profile: profileData
        });
      }

      // Extract comprehensive profile data from multiple sources
      const profileData = await this.multiSourceExtractor.extractComprehensiveProfile(username);

      console.log(`[UserOnboarding] Profile extracted for ${profileData.name}: ${profileData.experiences.length} experiences, ${profileData.education.length} education entries`);

      res.json({
        success: true,
        profile: profileData
      });
    } catch (error) {
      console.error('[UserOnboarding] Profile extraction error:', error);
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to extract profile data'
      });
    }
  }

  /**
   * Save filtered profile data as hierarchy nodes
   * Endpoint: POST /api/save-profile
   */
  async saveProfile(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user as User;
      const profileData = insertProfileSchema.parse(req.body);

      console.log(`[UserOnboarding] Starting profile save for user ${user.id}, username: ${profileData.username}`);

      // Check if user already has hierarchy nodes (prevent duplicate onboarding)
      const existingNodes = await this.hierarchyService.getAllNodes(user.id);
      if (existingNodes.length > 0) {
        console.log(`[UserOnboarding] User ${user.id} already has ${existingNodes.length} nodes, preventing duplicate onboarding`);
        return res.status(409).json({
          success: false,
          message: 'Profile already exists - user has already completed onboarding'
        });
      }

      // Transform and create hierarchy nodes
      const createdNodes = await this.createHierarchyNodesFromProfile(profileData.filteredData, user.id);

      // Complete onboarding
      await storage.completeOnboarding(user.id);

      console.log(`[UserOnboarding] Successfully created ${createdNodes.length} hierarchy nodes for user ${user.id}`);

      res.json({
        success: true,
        profile: {
          id: `user-${user.id}`,
          username: profileData.username,
          nodesCreated: createdNodes.length,
          nodes: createdNodes
        }
      });

    } catch (error) {
      console.error('[UserOnboarding] Save profile error:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to save profile data'
      });
    }
  }

  /**
   * Transform ProfileData to hierarchy nodes and create them
   */
  private async createHierarchyNodesFromProfile(profileData: ProfileData, userId: number) {
    const createdNodes = [];

    try {
      // Create job nodes from experiences (with their projects as children)
      for (const experience of profileData.experiences) {
        try {
          const jobNode = await this.createJobNode(experience, userId);
          createdNodes.push(jobNode);
          console.log(`[UserOnboarding] Created job node: ${jobNode.id} - ${jobNode.meta?.role}`);
          
          // Create project nodes under this job if experience has projects
          if (experience.projects && experience.projects.length > 0) {
            console.log(`[UserOnboarding] Creating ${experience.projects.length} project nodes under job ${jobNode.id}`);
            for (const project of experience.projects) {
              try {
                const projectNode = await this.createProjectNode(project, userId, jobNode.id);
                createdNodes.push(projectNode);
                console.log(`[UserOnboarding] Created project node: ${projectNode.id} - ${projectNode.meta?.title}`);
              } catch (error) {
                console.error('[UserOnboarding] Failed to create project node:', error);
                // Continue with other projects rather than failing completely
              }
            }
          }
        } catch (error) {
          console.error('[UserOnboarding] Failed to create job node:', error);
          // Continue with other nodes rather than failing completely
        }
      }

      // Create education nodes
      for (const education of profileData.education) {
        try {
          const eduNode = await this.createEducationNode(education, userId);
          createdNodes.push(eduNode);
          console.log(`[UserOnboarding] Created education node: ${eduNode.id} - ${eduNode.meta?.degree}`);
        } catch (error) {
          console.error('[UserOnboarding] Failed to create education node:', error);
          // Continue with other nodes rather than failing completely
        }
      }

      return createdNodes;
    } catch (error) {
      console.error('[UserOnboarding] Error creating hierarchy nodes:', error);
      throw error;
    }
  }

  /**
   * Create a job node from ProfileExperience
   */
  private async createJobNode(experience: ProfileExperience, userId: number) {
    const jobNodeData: CreateNodeDTO = {
      type: 'job',
      parentId: null, // Top-level node
      meta: {
        company: experience.company || 'Unknown Company',
        role: this.extractTitle(experience.title), // Use 'role' instead of 'title'
        location: experience.location,
        description: experience.description,
        startDate: this.formatDate(experience.start),
        endDate: this.formatDate(experience.end || (experience.current ? undefined : undefined)),
      }
    };

    return await this.hierarchyService.createNode(jobNodeData, userId);
  }

  /**
   * Create an education node from ProfileEducation
   */
  private async createEducationNode(education: ProfileEducation, userId: number) {
    const eduNodeData: CreateNodeDTO = {
      type: 'education',
      parentId: null, // Top-level node
      meta: {
        institution: education.school || 'Unknown Institution',
        degree: education.degree || 'Degree', // Required field
        field: education.field,
        location: education.location,
        description: education.description,
        startDate: this.formatDate(education.start),
        endDate: this.formatDate(education.end),
      }
    };

    return await this.hierarchyService.createNode(eduNodeData, userId);
  }

  /**
   * Extract title string from various title formats
   */
  private extractTitle(title: any): string {
    if (typeof title === 'string') {
      return title;
    }
    if (typeof title === 'object' && title?.name) {
      return title.name;
    }
    return 'Position';
  }

  /**
   * Create a project node from experience project
   */
  private async createProjectNode(project: any, userId: number, parentId: string) {
    const projectNodeData: CreateNodeDTO = {
      type: 'project',
      parentId: parentId, // Set the parent job/education node
      meta: {
        title: project.title || 'Project',
        description: project.description,
        technologies: project.technologies || [],
        projectType: 'professional', // Default to professional since it's from work experience
        startDate: this.formatDate(project.start),
        endDate: this.formatDate(project.end),
      }
    };

    return await this.hierarchyService.createNode(projectNodeData, userId);
  }

  private formatDate(dateStr: string | undefined): string | undefined {
    if (!dateStr) return undefined;
    
    // If it's already in YYYY-MM format, return as is
    if (/^\d{4}-\d{2}$/.test(dateStr)) {
      return dateStr;
    }
    
    // Try to parse common date formats and convert to YYYY-MM
    try {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
      }
    } catch (error) {
      console.warn(`Could not parse date: ${dateStr}`);
    }
    
    return undefined;
  }

  /**
   * Transform existing hierarchy nodes back to ProfileData format
   * Used when user already has nodes but we need to return ProfileData format
   */
  private transformNodesToProfileData(nodes: any[]): ProfileData {
    const experiences: ProfileExperience[] = [];
    const education: ProfileEducation[] = [];

    for (const node of nodes) {
      if (node.type === 'job') {
        experiences.push({
          title: node.meta?.title || 'Position',
          company: node.meta?.company || 'Company',
          location: node.meta?.location,
          start: node.meta?.startDate,
          end: node.meta?.endDate === 'Present' ? undefined : node.meta?.endDate,
          current: node.meta?.endDate === 'Present',
          description: node.meta?.description,
          responsibilities: node.meta?.responsibilities || [],
          type: node.meta?.employmentType
        });
      } else if (node.type === 'education') {
        education.push({
          school: node.meta?.institution || 'School',
          degree: node.meta?.degree,
          field: node.meta?.field,
          start: node.meta?.startDate,
          end: node.meta?.endDate,
          location: node.meta?.location,
          description: node.meta?.description
        });
      }
    }

    return {
      name: 'Existing User', // We don't store name in nodes, so use placeholder
      headline: undefined,
      location: undefined,
      about: undefined,
      avatarUrl: undefined,
      experiences,
      education,
      skills: [] // Skills are no longer extracted
    };
  }
}