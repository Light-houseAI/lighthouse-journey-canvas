/**
 * PersonaService
 * Derives user personas from timeline nodes and track details.
 * Personas are computed on-demand (not stored separately) from existing data.
 *
 * Data sources:
 * - Work persona: 'work' type nodes with meta.company, meta.jobTitle, meta.dateStarted
 * - Personal Project persona: 'personal_project' type nodes with meta.projectName, meta.projectType
 * - Job Search persona: 'job_search' type nodes with meta.targetRole, meta.jobSearchType
 * - Learning persona: 'learning' type nodes with learningType-specific fields
 */

import {
  PersonaType,
  LearningType,
  TimelineNodeType,
  NODE_TYPE_TO_PERSONA_TYPE,
  type DerivedPersona,
  type WorkPersonaContext,
  type PersonalProjectPersonaContext,
  type JobSearchPersonaContext,
  type LearningPersonaContext,
  type PersonaContext,
} from '@journey/schema';

import type { Logger } from '../core/logger.js';
import type { HierarchyRepository } from '../repositories/hierarchy-repository.js';
import type { SessionMappingRepository } from '../repositories/session-mapping.repository.js';

// ============================================================================
// TYPES
// ============================================================================

type TimelineNode = {
  id: string;
  type: string;
  meta: Record<string, any> | null;
  userId: number;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export interface PersonaServiceDeps {
  hierarchyRepository: HierarchyRepository;
  sessionMappingRepository: SessionMappingRepository;
  logger: Logger;
}

// ============================================================================
// SERVICE
// ============================================================================

export class PersonaService {
  private readonly hierarchyRepository: HierarchyRepository;
  private readonly sessionMappingRepository: SessionMappingRepository;
  private readonly logger: Logger;

  /** Number of days without activity before a persona is considered inactive */
  private readonly ACTIVITY_THRESHOLD_DAYS = 30;

  constructor(deps: PersonaServiceDeps) {
    this.hierarchyRepository = deps.hierarchyRepository;
    this.sessionMappingRepository = deps.sessionMappingRepository;
    this.logger = deps.logger;
  }

  // --------------------------------------------------------------------------
  // PUBLIC METHODS
  // --------------------------------------------------------------------------

  /**
   * Get all active personas for a user
   * Derives personas from timeline nodes and recent activity
   */
  async getActivePersonas(userId: number): Promise<DerivedPersona[]> {
    this.logger.info('Getting active personas for user', { userId });

    try {
      // 1. Fetch all track-type nodes for the user
      const trackNodeTypes = [
        TimelineNodeType.Work,
        TimelineNodeType.Job,
        TimelineNodeType.PersonalProject,
        TimelineNodeType.Project,
        TimelineNodeType.JobSearch,
        TimelineNodeType.CareerTransition,
        TimelineNodeType.Learning,
        TimelineNodeType.Education,
      ];

      const allNodes: TimelineNode[] = [];
      for (const nodeType of trackNodeTypes) {
        const nodes = await this.hierarchyRepository.getNodesByType(userId, nodeType);
        allNodes.push(...nodes);
      }

      if (allNodes.length === 0) {
        this.logger.info('No track nodes found for user', { userId });
        return [];
      }

      // 2. Get last activity timestamps for all nodes
      const nodeIds = allNodes.map((n) => n.id);
      const activityMap = await this.sessionMappingRepository.getLastActivityByNodes(
        userId,
        nodeIds
      );

      // 3. Transform nodes to personas and filter for active ones
      const personas: DerivedPersona[] = [];

      for (const node of allNodes) {
        const lastActivity = activityMap.get(node.id) || null;
        const persona = this.nodeToPersona(node, lastActivity);

        if (persona && persona.isActive) {
          personas.push(persona);
        }
      }

      // 4. Sort by last activity (most recent first)
      personas.sort((a, b) => {
        const aTime = a.lastActivityAt?.getTime() ?? 0;
        const bTime = b.lastActivityAt?.getTime() ?? 0;
        return bTime - aTime;
      });

      this.logger.info('Found active personas', {
        userId,
        totalNodes: allNodes.length,
        activePersonas: personas.length,
      });

      return personas;
    } catch (error) {
      this.logger.error('Failed to get active personas', {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });
      throw error;
    }
  }

  /**
   * Get all personas for a user (including inactive ones)
   */
  async getAllPersonas(userId: number): Promise<DerivedPersona[]> {
    this.logger.info('Getting all personas for user', { userId });

    try {
      const trackNodeTypes = [
        TimelineNodeType.Work,
        TimelineNodeType.Job,
        TimelineNodeType.PersonalProject,
        TimelineNodeType.Project,
        TimelineNodeType.JobSearch,
        TimelineNodeType.CareerTransition,
        TimelineNodeType.Learning,
        TimelineNodeType.Education,
      ];

      const allNodes: TimelineNode[] = [];
      for (const nodeType of trackNodeTypes) {
        const nodes = await this.hierarchyRepository.getNodesByType(userId, nodeType);
        allNodes.push(...nodes);
      }

      const nodeIds = allNodes.map((n) => n.id);
      const activityMap = await this.sessionMappingRepository.getLastActivityByNodes(
        userId,
        nodeIds
      );

      const personas: DerivedPersona[] = [];
      for (const node of allNodes) {
        const lastActivity = activityMap.get(node.id) || null;
        const persona = this.nodeToPersona(node, lastActivity);
        if (persona) {
          personas.push(persona);
        }
      }

      // Sort by last activity
      personas.sort((a, b) => {
        const aTime = a.lastActivityAt?.getTime() ?? 0;
        const bTime = b.lastActivityAt?.getTime() ?? 0;
        return bTime - aTime;
      });

      return personas;
    } catch (error) {
      this.logger.error('Failed to get all personas', {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });
      throw error;
    }
  }

  /**
   * Get a specific persona by node ID
   */
  async getPersonaByNodeId(
    userId: number,
    nodeId: string
  ): Promise<DerivedPersona | null> {
    try {
      const node = await this.hierarchyRepository.getById(nodeId, userId);
      if (!node) {
        return null;
      }

      const activityMap = await this.sessionMappingRepository.getLastActivityByNodes(
        userId,
        [nodeId]
      );
      const lastActivity = activityMap.get(nodeId) || null;

      return this.nodeToPersona(node as TimelineNode, lastActivity);
    } catch (error) {
      this.logger.error('Failed to get persona by node ID', {
        error: error instanceof Error ? error.message : String(error),
        userId,
        nodeId,
      });
      throw error;
    }
  }

  /**
   * Format personas for LLM context injection
   * Returns a formatted string suitable for system prompts
   */
  formatPersonasForLLM(personas: DerivedPersona[]): string {
    if (personas.length === 0) {
      return '';
    }

    const sections = personas.map((p) => this.formatSinglePersona(p)).join('\n\n');

    return `
## Active User Personas

The user has the following active focus areas. Use these to provide contextual, relevant insights:

${sections}

When generating insights:
- Reference the user's specific context (company names, project names, roles)
- Provide relevant examples from their work context
- Connect insights across different personas when appropriate
`.trim();
  }

  // --------------------------------------------------------------------------
  // PRIVATE METHODS
  // --------------------------------------------------------------------------

  /**
   * Convert a timeline node to a persona
   */
  private nodeToPersona(
    node: TimelineNode,
    lastActivity: Date | null
  ): DerivedPersona | null {
    const personaType = NODE_TYPE_TO_PERSONA_TYPE[node.type as TimelineNodeType];
    if (!personaType) {
      return null;
    }

    const meta = node.meta || {};
    const isActive = this.isNodeActive(node, lastActivity);

    switch (personaType) {
      case PersonaType.Work:
        return {
          type: PersonaType.Work,
          nodeId: node.id,
          displayName: this.formatWorkDisplayName(meta),
          isActive,
          lastActivityAt: lastActivity,
          context: this.extractWorkContext(meta),
        };

      case PersonaType.PersonalProject:
        return {
          type: PersonaType.PersonalProject,
          nodeId: node.id,
          displayName: meta.projectName || meta.name || meta.title || 'Personal Project',
          isActive,
          lastActivityAt: lastActivity,
          context: this.extractPersonalProjectContext(meta),
        };

      case PersonaType.JobSearch:
        return {
          type: PersonaType.JobSearch,
          nodeId: node.id,
          displayName: `Job Search: ${meta.targetRole || 'New Role'}`,
          isActive,
          lastActivityAt: lastActivity,
          context: this.extractJobSearchContext(meta),
        };

      case PersonaType.Learning:
        return {
          type: PersonaType.Learning,
          nodeId: node.id,
          displayName: this.formatLearningDisplayName(meta),
          isActive,
          lastActivityAt: lastActivity,
          context: this.extractLearningContext(meta),
        };

      default:
        return null;
    }
  }

  /**
   * Check if a node/persona is currently active
   */
  private isNodeActive(node: TimelineNode, lastActivity: Date | null): boolean {
    const meta = node.meta || {};

    // Check if node has an end date in the past
    if (meta.endDate) {
      const endDate = new Date(meta.endDate);
      if (endDate < new Date()) {
        return false;
      }
    }

    // Check for recent activity (within threshold days)
    if (lastActivity) {
      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() - this.ACTIVITY_THRESHOLD_DAYS);
      return lastActivity > thresholdDate;
    }

    // Default to active if no end date and we can't determine activity
    return true;
  }

  /**
   * Format work persona display name
   */
  private formatWorkDisplayName(meta: Record<string, any>): string {
    if (meta.jobTitle && meta.company) {
      return `${meta.jobTitle} at ${meta.company}`;
    }
    if (meta.company) {
      return meta.company;
    }
    if (meta.jobTitle) {
      return meta.jobTitle;
    }
    return meta.name || meta.title || 'Work';
  }

  /**
   * Format learning persona display name
   */
  private formatLearningDisplayName(meta: Record<string, any>): string {
    const learningType = meta.learningType as LearningType | undefined;

    switch (learningType) {
      case LearningType.University:
        if (meta.areaOfStudy && meta.school) {
          return `${meta.areaOfStudy} at ${meta.school}`;
        }
        return meta.school || meta.areaOfStudy || 'University';

      case LearningType.Certification:
        return meta.courseName || meta.provider || 'Certification';

      case LearningType.SelfStudy:
        return meta.learningFocus || 'Self Study';

      default:
        return meta.name || meta.title || 'Learning';
    }
  }

  /**
   * Extract work persona context from node meta
   */
  private extractWorkContext(meta: Record<string, any>): WorkPersonaContext {
    return {
      company: meta.company || '',
      jobTitle: meta.jobTitle,
      dateStarted: meta.dateStarted,
      primaryTools: meta.selectedApps || meta.tools,
      currentProjects: meta.currentProjects,
    };
  }

  /**
   * Extract personal project context from node meta
   */
  private extractPersonalProjectContext(
    meta: Record<string, any>
  ): PersonalProjectPersonaContext {
    return {
      projectName: meta.projectName || meta.name || meta.title || '',
      projectType: meta.projectType,
      topics: meta.topics,
      goals: meta.goals,
      technologies: meta.technologies,
      status: meta.status,
      progress: meta.progress,
    };
  }

  /**
   * Extract job search context from node meta
   */
  private extractJobSearchContext(meta: Record<string, any>): JobSearchPersonaContext {
    return {
      targetRole: meta.targetRole || '',
      jobSearchType: meta.jobSearchType,
      targetCompanies: meta.targetCompanies,
      applications: meta.applications,
      interviewStages: meta.interviewStages,
      preferredLocations: meta.preferredLocations,
    };
  }

  /**
   * Extract learning context from node meta
   */
  private extractLearningContext(meta: Record<string, any>): LearningPersonaContext {
    const base: LearningPersonaContext = {
      learningType: (meta.learningType as LearningType) || LearningType.SelfStudy,
      dateStarted: meta.dateStarted,
      skillsBeingDeveloped: meta.skillsBeingDeveloped || meta.skills,
      currentProgress: meta.currentProgress || meta.progress,
    };

    // Add type-specific fields
    switch (meta.learningType) {
      case 'university':
        return {
          ...base,
          school: meta.school,
          areaOfStudy: meta.areaOfStudy,
        };
      case 'certification':
        return {
          ...base,
          provider: meta.provider,
          courseName: meta.courseName,
        };
      case 'self-study':
        return {
          ...base,
          learningFocus: meta.learningFocus,
          resources: meta.resources,
        };
      default:
        return base;
    }
  }

  /**
   * Format a single persona for LLM context
   */
  private formatSinglePersona(persona: DerivedPersona): string {
    const ctx = persona.context;

    switch (persona.type) {
      case PersonaType.Work: {
        const workCtx = ctx as WorkPersonaContext;
        return `### 💼 Work: ${persona.displayName}
- Company: ${workCtx.company}
- Role: ${workCtx.jobTitle || 'Not specified'}
- Started: ${workCtx.dateStarted || 'Not specified'}`;
      }

      case PersonaType.PersonalProject: {
        const projCtx = ctx as PersonalProjectPersonaContext;
        return `### 🚀 Personal Project: ${persona.displayName}
- Project Type: ${projCtx.projectType || 'General'}
- Status: ${projCtx.status || 'Active'}`;
      }

      case PersonaType.JobSearch: {
        const jobCtx = ctx as JobSearchPersonaContext;
        return `### 🎯 Job Search
- Target Role: ${jobCtx.targetRole}
- Search Type: ${jobCtx.jobSearchType || 'General'}`;
      }

      case PersonaType.Learning: {
        const learnCtx = ctx as LearningPersonaContext;
        return this.formatLearningPersonaForLLM(persona.displayName, learnCtx);
      }

      default:
        return `### ${persona.displayName}`;
    }
  }

  /**
   * Format learning persona for LLM based on learning type
   */
  private formatLearningPersonaForLLM(
    displayName: string,
    ctx: LearningPersonaContext
  ): string {
    switch (ctx.learningType) {
      case LearningType.University:
        return `### 📚 Learning: ${displayName}
- Type: University/College
- School: ${ctx.school || 'Not specified'}
- Area of Study: ${ctx.areaOfStudy || 'Not specified'}`;

      case LearningType.Certification:
        return `### 📚 Learning: ${displayName}
- Type: Certification/Course
- Provider: ${ctx.provider || 'Not specified'}
- Course: ${ctx.courseName || 'Not specified'}`;

      case LearningType.SelfStudy:
        return `### 📚 Learning: ${displayName}
- Type: Self-Study
- Focus: ${ctx.learningFocus || 'Not specified'}
- Resources: ${ctx.resources || 'Not specified'}`;

      default:
        return `### 📚 Learning: ${displayName}`;
    }
  }
}
