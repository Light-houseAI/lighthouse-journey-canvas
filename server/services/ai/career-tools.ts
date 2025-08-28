import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getDatabaseInstance } from '../../config/database.config.js';

// Lazy database access - only resolved when needed
function getDb() {
  return getDatabaseInstance();
}
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { Milestone, milestoneSchema, ProfileData, profileExperienceSchema, profileEducationSchema, ProjectUpdate, projectUpdateSchema, ExperienceProject, experienceProjectSchema } from "@shared/types";
import { profileVectorManager } from './profile-vector-manager';


// Schema for node updates
const UpdateNodeSchema = z.object({
  nodeId: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  organization: z.string().optional(),
  date: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  skills: z.array(z.string()).optional(),
  technologies: z.array(z.string()).optional(),
  impact: z.string().optional(),
  objectives: z.string().optional(),
  challenges: z.string().optional(),
  outcomes: z.array(z.string()).optional(),
});

// Schema for finding nodes
const FindNodesSchema = z.object({
  type: z.enum(['education', 'job', 'transition', 'skill', 'event', 'project', 'update']).optional(),
  organization: z.string().optional(),
  query: z.string().optional(),
  parentId: z.string().optional(),
});

// Schema for project updates with WDRL framework
const AddProjectUpdateSchema = z.object({
  projectNodeId: z.string(),
  title: z.string(),
  description: z.string(), // Work - What piece of work has taken most attention (required)
  date: z.string().optional(),
  skills: z.array(z.string()).default([]),
  impact: z.string().optional(),
  challenges: z.string().optional(),
  // WDRL Framework fields
  decisions: z.string().optional(), // Decision - Key decisions/actions to move work forward
  results: z.string().optional(), // Result - Measurable result/evidence of impact
  learnings: z.string().optional(), // Learning - Feedback/personal takeaways from experience
});

// Schemas for filtered data management
const AddExperienceSchema = z.object({
  title: z.string().min(1, "Job title is required"),
  company: z.string().min(1, "Company name is required"),
  start: z.string().min(1, "Start date is required"),
  end: z.string().optional(),
  description: z.string().optional(),
});

const AddEducationSchema = z.object({
  school: z.string().min(1, "School name is required"),
  degree: z.string().optional(),
  field: z.string().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
});

const UpdateEducationSchema = z.object({
  educationIndex: z.number().optional(), // Index in the education array
  school: z.string().optional(), // If no index, find by school name
  degree: z.string().optional(),
  field: z.string().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  newSchool: z.string().optional(), // New school name if updating
  newDegree: z.string().optional(),
  newField: z.string().optional(),
  newStart: z.string().optional(),
  newEnd: z.string().optional(),
}).refine(data => data.educationIndex !== undefined || data.school, {
  message: "Must provide either educationIndex or school name to identify the education entry to update",
});

const GetEducationSchema = z.object({
  educationIndex: z.number().optional(),
  school: z.string().optional(),
  degree: z.string().optional(),
}).refine(data => data.educationIndex !== undefined || data.school || data.degree, {
  message: "Must provide either educationIndex, school name, or degree to identify the education entry",
});

const AddProjectToExperienceSchema = z.object({
  experienceId: z.string().optional(),
  experienceTitle: z.string().optional(), // If no ID, find by title
  projectTitle: z.string().min(1, "Project title is required"),
  projectDescription: z.string().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  technologies: z.array(z.string()).default([]),
  role: z.string().optional(),
  teamSize: z.number().optional(),
}).refine(data => data.experienceId || data.experienceTitle, {
  message: "Either experienceId or experienceTitle must be provided to associate the project",
});

const AddProjectWorkSchema = z.object({
  experienceId: z.string().optional(),
  experienceTitle: z.string().optional(),
  projectId: z.string().optional(),
  projectTitle: z.string().optional(),
  updateTitle: z.string(),
  workDescription: z.string(),
  skills: z.array(z.string()).default([]),
  achievements: z.string().optional(),
  challenges: z.string().optional(),
  impact: z.string().optional(),
  date: z.string().optional(),
}).refine(data => (data.experienceId || data.experienceTitle) && (data.projectId || data.projectTitle), {
  message: "Must provide either experienceId or experienceTitle, and either projectId or projectTitle",
});

const UpdateExperienceSchema = z.object({
  experienceId: z.string().optional(),
  experienceTitle: z.string().optional(), // If no ID, find by title
  experienceCompany: z.string().optional(), // If no ID, find by company
  title: z.string().optional(),
  company: z.string().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  description: z.string().optional(),
}).refine(data => data.experienceId || data.experienceTitle || data.experienceCompany, {
  message: "Must provide either experienceId, experienceTitle, or experienceCompany to identify the experience to update",
});

const GetProjectSchema = z.object({
  projectId: z.string().optional(),
  projectTitle: z.string().optional(),
  experienceId: z.string().optional(),
  experienceCompany: z.string().optional(),
}).refine(data => data.projectId || data.projectTitle, {
  message: "Must provide either projectId or projectTitle to identify the project",
});

const AddProjectSchema = z.object({
  experienceId: z.string().optional(),
  experienceTitle: z.string().optional(),
  experienceCompany: z.string().optional(),
  projectTitle: z.string(),
  projectDescription: z.string().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  technologies: z.array(z.string()).default([]),
  role: z.string().optional(),
  teamSize: z.number().optional(),
});

const ConfirmAddProjectSchema = z.object({
  experienceId: z.string(),
  projectTitle: z.string(),
  projectDescription: z.string().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  technologies: z.array(z.string()).default([]),
  role: z.string().optional(),
  teamSize: z.number().optional(),
  confirmed: z.boolean(),
});

const UpdateProjectSchema = z.object({
  projectId: z.string().optional(),
  projectTitle: z.string().optional(),
  experienceId: z.string().optional(),
  experienceCompany: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  technologies: z.array(z.string()).optional(),
  role: z.string().optional(),
  teamSize: z.number().optional(),
}).refine(data => data.projectId || data.projectTitle, {
  message: "Must provide either projectId or projectTitle to identify the project to update",
});

const AddUpdateToProjectSchema = z.object({
  projectId: z.string().optional(),
  projectTitle: z.string().optional(),
  experienceId: z.string().optional(),
  experienceCompany: z.string().optional(),
  updateTitle: z.string(),
  description: z.string(), // Work - What piece of work has taken most attention
  date: z.string().optional(),
  skills: z.array(z.string()).default([]),
  achievements: z.string().optional(),
  challenges: z.string().optional(),
  impact: z.string().optional(),
  // WDRL Framework fields
  decisions: z.string().optional(), // Decision - Key decisions/actions to move work forward
  results: z.string().optional(), // Result - Measurable result/evidence of impact
  learnings: z.string().optional(), // Learning - Feedback/personal takeaways from experience
}).refine(data => data.projectId || data.projectTitle, {
  message: "Must provide either projectId or projectTitle to identify the project for the update",
});

const GetProjectUpdateSchema = z.object({
  updateId: z.string().optional(),
  updateTitle: z.string().optional(),
  projectId: z.string().optional(),
  projectTitle: z.string().optional(),
  experienceCompany: z.string().optional(),
}).refine(data => data.updateId || data.updateTitle || data.projectId || data.projectTitle, {
  message: "Must provide identifier to find the project update",
});

const UpdateProjectUpdateSchema = z.object({
  updateId: z.string().optional(),
  updateTitle: z.string().optional(),
  projectId: z.string().optional(),
  projectTitle: z.string().optional(),
  experienceCompany: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(), // Work - What piece of work has taken most attention
  date: z.string().optional(),
  skills: z.array(z.string()).optional(),
  achievements: z.string().optional(),
  challenges: z.string().optional(),
  impact: z.string().optional(),
  // WDRL Framework fields
  decisions: z.string().optional(), // Decision - Key decisions/actions to move work forward
  results: z.string().optional(), // Result - Measurable result/evidence of impact
  learnings: z.string().optional(), // Learning - Feedback/personal takeaways from experience
}).refine(data => data.updateId || data.updateTitle, {
  message: "Must provide either updateId or updateTitle to identify the project update to modify",
});

// Legacy profile system functions - TODO: Replace with timeline nodes system
async function getUserMilestones(userId: string): Promise<Milestone[]> {
  // TODO: Replace with timeline nodes query
  console.log('getUserMilestones: Legacy profile system - returning empty array');
  return [];
}

async function updateUserMilestones(userId: string, milestones: Milestone[]): Promise<void> {
  // TODO: Replace with timeline nodes updates
  console.log('updateUserMilestones: Legacy profile system - operation skipped');
}

async function getUserFilteredData(userId: string): Promise<ProfileData | null> {
  // TODO: Replace with timeline nodes query
  console.log('getUserFilteredData: Legacy profile system - returning null');
  return null;
}

async function updateUserFilteredData(userId: string, filteredData: ProfileData): Promise<void> {
  // TODO: Replace with timeline nodes updates
  console.log('updateUserFilteredData: Legacy profile system - operation skipped');
}

// Helper function to initialize filtered data if it doesn't exist
async function initializeFilteredData(userId: string): Promise<ProfileData> {
  console.log('initializeFilteredData: Starting with userId:', userId);
  const existingData = await getUserFilteredData(userId);
  console.log('initializeFilteredData: Existing data found:', !!existingData);

  if (existingData) {
    console.log('initializeFilteredData: Existing data with', existingData.experiences.length, 'experiences');

    // Fix experiences that may be missing IDs or have incorrect structure
    let needsUpdate = false;
    const fixedExperiences = existingData.experiences.map(exp => {
      let fixedExp = { ...exp };

      // Ensure ID exists
      if (!fixedExp.id) {
        fixedExp.id = randomUUID();
        needsUpdate = true;
        console.log('initializeFilteredData: Added missing ID to experience:', fixedExp.company);
      }

      // Fix title structure if needed (handle complex title objects)
      if (typeof fixedExp.title === 'object' && fixedExp.title && 'name' in fixedExp.title) {
        fixedExp.title = (fixedExp.title as any).name;
        needsUpdate = true;
        console.log('initializeFilteredData: Fixed title structure for experience:', fixedExp.company);
      }

      // Ensure projects array exists
      if (!fixedExp.projects) {
        fixedExp.projects = [];
        needsUpdate = true;
      }

      return fixedExp;
    });

    if (needsUpdate) {
      const updatedData = { ...existingData, experiences: fixedExperiences };
      await updateUserFilteredData(userId, updatedData);
      console.log('initializeFilteredData: Updated existing data with fixes');
      return updatedData;
    }

    console.log('initializeFilteredData: Returning existing data without changes');
    return existingData;
  }

  console.log('initializeFilteredData: No existing data, creating default structure');
  // Create default structure
  const defaultData: ProfileData = {
    name: '',
    headline: '',
    location: '',
    about: '',
    avatarUrl: '',
    experiences: [],
    education: [],
    skills: [],
  };

  await updateUserFilteredData(userId, defaultData);
  console.log('initializeFilteredData: Created and saved default data');
  return defaultData;
}

// Helper function to send SSE events for real-time UI updates
function sendProfileUpdateEvent(runtimeContext: any, eventType: string, data: any) {
  try {
    const sseResponse = runtimeContext?.get('sseResponse');
    if (sseResponse && !sseResponse.destroyed) {
      sseResponse.write(`data: ${JSON.stringify({
        type: 'profile_update',
        eventType,
        data,
        timestamp: new Date().toISOString(),
      })}\n\n`);
    }
  } catch (error) {
    console.log('Failed to send SSE profile update event:', error instanceof Error ? error.message : error);
  }
}


// Tool: Update an existing career node
export const updateNode = createTool({
  id: 'update-node',
  description: 'Update an existing career milestone node',
  inputSchema: UpdateNodeSchema,
  execute: async ({ context: { nodeId, ...updates }, runtimeContext }) => {
    const userId = runtimeContext?.get('userId');
    if (!userId) {
      throw new Error('User ID not found in context');
    }
    try {
      const milestones = await getUserMilestones(userId);
      const nodeIndex = milestones.findIndex(m => m.id === nodeId);

      if (nodeIndex === -1) {
        return {
          success: false,
          error: `Node with ID ${nodeId} not found`,
        };
      }

      // Update the node with provided fields
      const updatedNode = {
        ...milestones[nodeIndex],
        ...Object.fromEntries(
          Object.entries(updates).filter(([_, value]) => value !== undefined)
        ),
      };

      milestones[nodeIndex] = updatedNode;
      await updateUserMilestones(userId, milestones);

      // Update in vector database
      try {
        await profileVectorManager.storeMilestone(userId, updatedNode);
      } catch (error) {
        console.log('Vector storage failed, continuing without it:', error instanceof Error ? error.message : error);
      }

      return {
        success: true,
        node: updatedNode,
        message: `Updated node: ${updatedNode.title}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update node',
      };
    }
  },
});

// Tool: Delete a career node
export const deleteNode = createTool({
  id: 'delete-node',
  description: 'Delete a career milestone node',
  inputSchema: z.object({
    nodeId: z.string(),
  }),
  execute: async ({ context: { nodeId }, runtimeContext }) => {
    const userId = runtimeContext?.get('userId');
    if (!userId) {
      throw new Error('User ID not found in context');
    }
    try {
      const milestones = await getUserMilestones(userId);
      const nodeIndex = milestones.findIndex(m => m.id === nodeId);

      if (nodeIndex === -1) {
        return {
          success: false,
          error: `Node with ID ${nodeId} not found`,
        };
      }

      const deletedNode = milestones[nodeIndex];

      // Also delete any sub-milestones (children)
      const updatedMilestones = milestones.filter(m =>
        m.id !== nodeId && m.parentId !== nodeId
      );

      await updateUserMilestones(userId, updatedMilestones);

      return {
        success: true,
        deletedNode,
        message: `Deleted node: ${deletedNode.title}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete node',
      };
    }
  },
});

// Tool: Find career nodes
export const findNodes = createTool({
  id: 'find-nodes',
  description: 'Find career nodes by type, organization, or search query',
  inputSchema: FindNodesSchema,
  execute: async ({ context: { type, organization, query, parentId }, runtimeContext }) => {
    const userId = runtimeContext?.get('userId');
    if (!userId) {
      throw new Error('User ID not found in context');
    }
    try {
      let milestones = await getUserMilestones(userId);

      // Filter by type
      if (type) {
        milestones = milestones.filter(m => m.type === type);
      }

      // Filter by organization
      if (organization) {
        milestones = milestones.filter(m =>
          m.organization?.toLowerCase().includes(organization.toLowerCase())
        );
      }

      // Filter by parent ID
      if (parentId) {
        milestones = milestones.filter(m => m.parentId === parentId);
      }

      // Search by query (title, description, skills)
      if (query) {
        const searchQuery = query.toLowerCase();
        milestones = milestones.filter(m =>
          m.title.toLowerCase().includes(searchQuery) ||
          m.description.toLowerCase().includes(searchQuery) ||
          m.skills.some(skill => skill.toLowerCase().includes(searchQuery)) ||
          m.technologies?.some(tech => tech.toLowerCase().includes(searchQuery))
        );
      }

      return {
        success: true,
        nodes: milestones,
        count: milestones.length,
        message: `Found ${milestones.length} matching nodes`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to find nodes',
      };
    }
  },
});

// Tool: Add project update to existing project node using WDRL framework
export const addProjectUpdate = createTool({
  id: 'add-project-update',
  description: 'Add an update/progress entry to an existing project node using WDRL framework (Work, Decision, Result, Learning). REQUIRED: title, description (work done). OPTIONAL: skills, impact, challenges, date, decisions, results, learnings.',
  inputSchema: AddProjectUpdateSchema,
  execute: async ({ context: { projectNodeId, title, description, date, skills, impact, challenges, decisions, results, learnings }, runtimeContext }) => {
    const userId = runtimeContext?.get('userId');
    if (!userId) {
      throw new Error('User ID not found in context');
    }
    try {
      const milestones = await getUserMilestones(userId);
      const projectIndex = milestones.findIndex(m => m.id === projectNodeId);

      if (projectIndex === -1) {
        return {
          success: false,
          error: `Project node with ID ${projectNodeId} not found`,
        };
      }

      const projectNode = milestones[projectIndex];

      if (projectNode.type !== 'project') {
        return {
          success: false,
          error: `Node ${projectNodeId} is not a project node`,
        };
      }

      // Create update as a sub-milestone with WDRL framework
      const updateNode: Milestone = {
        id: randomUUID(),
        title,
        type: 'update',
        description, // Work - required field
        date: date || new Date().toISOString().split('T')[0],
        skills,
        impact,
        challenges,
        organization: projectNode.organization,
        technologies: [],
        outcomes: [],
        isSubMilestone: true,
        parentId: projectNodeId,
        // WDRL Framework fields
        decisions, // Decision - key decisions made
        results, // Result - measurable outcomes
        learnings, // Learning - feedback and takeaways
      };

      milestones.push(updateNode);
      await updateUserMilestones(userId, milestones);

      // Store in vector database with WDRL fields
      try {
        await profileVectorManager.storeMilestone(userId, updateNode);
      } catch (error) {
        console.log('Vector storage failed, continuing without it:', error instanceof Error ? error.message : error);
      }

      return {
        success: true,
        update: updateNode,
        projectNode,
        message: `Added update "${title}" to project "${projectNode.title}"`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add project update',
      };
    }
  },
});

// Tool: Get node details
export const getNodeDetails = createTool({
  id: 'get-node-details',
  description: 'Get detailed information about a specific career node',
  inputSchema: z.object({
    nodeId: z.string(),
  }),
  execute: async ({ context: { nodeId }, runtimeContext }) => {
    const userId = runtimeContext?.get('userId');
    if (!userId) {
      throw new Error('User ID not found in context');
    }
    try {
      const milestones = await getUserMilestones(userId);
      const node = milestones.find(m => m.id === nodeId);

      if (!node) {
        return {
          success: false,
          error: `Node with ID ${nodeId} not found`,
        };
      }

      // Get child nodes if this is a parent
      const childNodes = milestones.filter(m => m.parentId === nodeId);

      return {
        success: true,
        node,
        childNodes,
        hasChildren: childNodes.length > 0,
        message: `Retrieved details for node: ${node.title}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get node details',
      };
    }
  },
});

// Tool: Search nodes with vector similarity
export const semanticSearch = createTool({
  id: 'search-nodes-semantic',
  description: 'Search for career nodes using semantic similarity. USE THIS TOOL when user mentions projects, updates, or work to find the right experience/project to associate it with. Essential for determining context before adding projects or project updates.',
  inputSchema: z.object({
    query: z.string(),
    limit: z.number().default(5),
    entityTypes: z.array(z.string()).optional().default(['education', 'project', 'experience', 'project_update']),
  }),
  execute: async ({ context: { query, limit, entityTypes }, runtimeContext }) => {
    const userId = runtimeContext?.get('userId');
    if (!userId) {
      throw new Error('User ID not found in context');
    }
    try {
      // Use vector search to find semantically similar entities
      const results = await profileVectorManager.searchProfileHistory(userId, query, {
        entityTypes: entityTypes,
        limit,
      });

      // Debug semantic search results
      console.log(`🔍 Semantic search for "${query}" found ${results.length} results:`);
      results.forEach((result, index) => {
        console.log(`  ${index}: ID=${result.metadata?.id}, Type=${result.metadata?.entityType}, Desc="${result.description?.substring(0, 50)}..."`);
      });

      return {
        success: true,
        results,
        count: results.length,
        message: `Found ${results.length} semantically similar nodes`,
      };
    } catch (error) {
      console.log('Vector search failed, falling back to regular search:', error instanceof Error ? error.message : error);

      // Fallback to searching actual user data
      try {
        const filteredData = await getUserFilteredData(userId);
        if (!filteredData) {
          return {
            success: true,
            results: [],
            count: 0,
            message: 'No profile data found',
          };
        }

        const queryLower = query.toLowerCase();
        const fallbackResults = [];

        // Search experiences if requested
        if (entityTypes.includes('experience')) {
          filteredData.experiences.forEach(exp => {
            if (exp.company.toLowerCase().includes(queryLower) ||
                exp.title.toLowerCase().includes(queryLower) ||
                (exp.description && exp.description.toLowerCase().includes(queryLower))) {
              fallbackResults.push({
                id: exp.id || randomUUID(),
                title: `${exp.title} at ${exp.company}`,
                company: exp.company,
                score: 0.8,
                metadata: {
                  id: exp.id || randomUUID(),
                  type: 'experience',
                  title: exp.title,
                  company: exp.company,
                  start: exp.start,
                  end: exp.end,
                  description: exp.description
                }
              });
            }
          });
        }

        // Search education if requested
        if (entityTypes.includes('education')) {
          filteredData.education.forEach((edu, index) => {
            if (edu.school.toLowerCase().includes(queryLower) ||
                (edu.degree && edu.degree.toLowerCase().includes(queryLower)) ||
                (edu.field && edu.field.toLowerCase().includes(queryLower))) {
              fallbackResults.push({
                id: `education_${index}`,
                title: `${edu.degree || 'Education'} at ${edu.school}`,
                school: edu.school,
                score: 0.7,
                metadata: {
                  id: `education_${index}`,
                  type: 'education',
                  school: edu.school,
                  degree: edu.degree,
                  field: edu.field
                }
              });
            }
          });
        }

        return {
          success: true,
          results: fallbackResults.slice(0, limit),
          count: fallbackResults.length,
          message: `Found ${fallbackResults.length} matching nodes (using text search fallback)`,
        };
      } catch (fallbackError) {
        console.log('Fallback search also failed:', fallbackError instanceof Error ? fallbackError.message : fallbackError);
        return {
          success: true,
          results: [],
          count: 0,
          message: 'Search failed',
        };
      }
    }
  },
});

// Tool: Add experience to filtered profile data
export const addExperience = createTool({
  id: 'add-experience',
  description: 'Add a work experience entry to the user\'s filtered profile data. REQUIRED: title (job title), company (company name), start (start date). OPTIONAL: end (end date), description (role description - only ask if user wants to provide it).',
  inputSchema: AddExperienceSchema,
  execute: async ({ context: { title, company, start, end, description }, runtimeContext }) => {
    console.log('addExperience tool: Received parameters:', { title, company, start, end, description });

    const userId = runtimeContext?.get('userId');
    if (!userId) {
      throw new Error('User ID not found in context');
    }

    try {
      console.log('addExperience tool: Starting with userId:', userId, 'type:', typeof userId);
      console.log('addExperience tool: Received parameters:', { title, company, start, end, description });

      // Validate required parameters
      if (!title || !company || !start) {
        console.error('addExperience tool: Missing required parameters', { title, company, start });
        return {
          success: false,
          error: `Missing required information. Need: ${!title ? 'job title' : ''} ${!company ? 'company name' : ''} ${!start ? 'start date' : ''}`.trim(),
        };
      }

      const filteredData = await initializeFilteredData(userId);
      console.log('addExperience tool: Retrieved filteredData, current experiences count:', filteredData.experiences.length);

      const newExperience = {
        id: randomUUID(),
        title,
        company,
        start,
        end,
        description,
        projects: [],
      };

      filteredData.experiences.push(newExperience);
      console.log('addExperience tool: Added new experience, total count now:', filteredData.experiences.length);

      await updateUserFilteredData(userId, filteredData);
      console.log('addExperience tool: Successfully updated database');

      // Send real-time UI update event
      sendProfileUpdateEvent(runtimeContext, 'experience_added', {
        experience: newExperience,
        action: 'added'
      });

      // Store in vector database for future searches
      try {
        await profileVectorManager.storeExperience(userId, {
          id: newExperience.id,  // ✅ Include the generated ID
          title,
          company,
          start,
          end,
          description: description || '',
        });
      } catch (error) {
        console.log('Vector storage failed, continuing without it:', error instanceof Error ? error.message : error);
      }

      return {
        success: true,
        experience: newExperience,
        message: `Added experience: ${title} at ${company}`,
        nextSteps: {
          addProjects: true,
          experienceId: newExperience.id,
          suggestion: "Now you can add projects you worked on during this role using the add-project-to-experience tool."
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add experience',
      };
    }
  },
});

// Tool: Add education to filtered profile data
export const addEducation = createTool({
  id: 'add-education',
  description: 'Add an education entry to the user\'s filtered profile data. REQUIRED: school (school/university name). OPTIONAL: degree, field, start/end dates (only ask if user wants to provide them).',
  inputSchema: AddEducationSchema,
  execute: async ({ context: { school, degree, field, start, end }, runtimeContext }) => {
    const userId = runtimeContext?.get('userId');
    if (!userId) {
      throw new Error('User ID not found in context');
    }
    try {
      const filteredData = await initializeFilteredData(userId);

      const newEducation = {
        school,
        degree,
        field,
        start,
        end,
      };

      filteredData.education.push(newEducation);
      await updateUserFilteredData(userId, filteredData);

      // Send real-time UI update event
      sendProfileUpdateEvent(runtimeContext, 'education_added', {
        education: newEducation,
        action: 'added'
      });

      // Store in vector database for future searches
      try {
        await profileVectorManager.storeEducation(userId, {
          school,
          degree,
          field,
          start,
          end,
        });
      } catch (error) {
        console.log('Vector storage failed, continuing without it:', error instanceof Error ? error.message : error);
      }

      return {
        success: true,
        education: newEducation,
        message: `Added education: ${degree ? degree + ' in ' : ''}${field || ''} at ${school}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add education',
      };
    }
  },
});

// Tool: Get all experiences from filtered profile data
export const getExperiences = createTool({
  id: 'get-experiences',
  description: 'Retrieve all work experiences from the user\'s filtered profile data',
  inputSchema: z.object({
    includeProjects: z.boolean().default(false),
  }),
  execute: async ({ context: { includeProjects }, runtimeContext }) => {
    const userId = runtimeContext?.get('userId');
    if (!userId) {
      throw new Error('User ID not found in context');
    }
    try {
      const filteredData = await initializeFilteredData(userId);

      const experiences = filteredData.experiences.map(exp => ({
        id: exp.id,
        title: exp.title,
        company: exp.company,
        start: exp.start,
        end: exp.end,
        description: exp.description,
        projectCount: exp.projects?.length || 0,
        ...(includeProjects && { projects: exp.projects || [] }),
      }));

      return {
        success: true,
        experiences,
        experienceCount: experiences.length,
        message: `Retrieved ${experiences.length} work experience(s)`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get experiences',
      };
    }
  },
});

// Tool: Update existing experience in filtered profile data
export const updateExperience = createTool({
  id: 'update-experience',
  description: 'Update an existing work experience entry in the user\'s filtered profile data. Can find experience by ID, title, or company name.',
  inputSchema: UpdateExperienceSchema,
  execute: async ({ context: { experienceId, experienceTitle, experienceCompany, title, company, start, end, description }, runtimeContext }) => {
    const userId = runtimeContext?.get('userId');
    if (!userId) {
      throw new Error('User ID not found in context');
    }

    try {
      const filteredData = await initializeFilteredData(userId);

      // Find the experience to update
      let experienceIndex = -1;
      if (experienceId) {
        experienceIndex = filteredData.experiences.findIndex(exp => exp.id === experienceId);
      } else if (experienceTitle) {
        experienceIndex = filteredData.experiences.findIndex(exp =>
          exp.title.toLowerCase().includes(experienceTitle.toLowerCase())
        );
      } else if (experienceCompany) {
        experienceIndex = filteredData.experiences.findIndex(exp =>
          exp.company.toLowerCase().includes(experienceCompany.toLowerCase())
        );
      }

      if (experienceIndex === -1) {
        return {
          success: false,
          error: `Experience ${experienceId ? `with ID "${experienceId}"` : experienceTitle ? `with title "${experienceTitle}"` : `at company "${experienceCompany}"`} not found in profile.`,
        };
      }

      const experience = filteredData.experiences[experienceIndex];
      const originalExperience = { ...experience };

      // Update only the fields that were provided
      if (title !== undefined) experience.title = title;
      if (company !== undefined) experience.company = company;
      if (start !== undefined) experience.start = start;
      if (end !== undefined) experience.end = end;
      if (description !== undefined) experience.description = description;

      await updateUserFilteredData(userId, filteredData);

      // Send real-time UI update event
      sendProfileUpdateEvent(runtimeContext, 'experience_updated', {
        experience,
        originalExperience,
        action: 'updated'
      });

      // Update in vector database for future searches
      try {
        await profileVectorManager.storeExperience(userId, {
          id: experience.id,
          title: experience.title,
          company: experience.company,
          start: experience.start,
          end: experience.end,
          description: experience.description || '',
        });
      } catch (error) {
        console.log('Vector storage failed, continuing without it:', error instanceof Error ? error.message : error);
      }

      return {
        success: true,
        experience,
        originalExperience,
        message: `Updated experience: ${experience.title} at ${experience.company}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update experience',
      };
    }
  },
});

// Tool: Add project to existing experience
export const addProjectToExperience = createTool({
  id: 'add-project-to-experience',
  description: 'Add a project to an existing work experience in the user\'s filtered profile data. REQUIRED: projectTitle (project name). OPTIONAL: projectDescription, start/end dates, technologies, role, teamSize (only ask if user wants to provide them).',
  inputSchema: AddProjectToExperienceSchema,
  execute: async ({ context: { experienceId, experienceTitle, projectTitle, projectDescription, start, end, technologies, role, teamSize }, runtimeContext }) => {
    const userId = runtimeContext?.get('userId');
    if (!userId) {
      throw new Error('User ID not found in context');
    }
    try {
      const filteredData = await initializeFilteredData(userId);

      // Find the experience - rely only on IDs from semantic search
      let experienceIndex = -1;

      if (experienceId) {
        experienceIndex = filteredData.experiences.findIndex(exp => exp.id === experienceId);

        if (experienceIndex === -1) {
          console.log(`❌ Experience ID "${experienceId}" not found in current profile`);
          console.log(`📋 Available experiences:`, filteredData.experiences.map(exp => ({id: exp.id, title: exp.title, company: exp.company})));
        }
      } else if (experienceTitle) {
        experienceIndex = filteredData.experiences.findIndex(exp =>
          exp.title.toLowerCase().includes(experienceTitle.toLowerCase()) ||
          exp.company.toLowerCase().includes(experienceTitle.toLowerCase())
        );
      }

      if (experienceIndex === -1) {
        // If we're searching by ID from semantic search and it's not found,
        // this likely means the vector database is out of sync
        if (experienceId && process.env.NODE_ENV !== 'test') {
          console.log(`🔄 Experience ID "${experienceId}" not found - attempting vector database sync...`);
          try {
            const { profileVectorManager } = await import('./profile-vector-manager.js');
            const syncStatus = await profileVectorManager.checkVectorProfileSync(userId, filteredData);

            if (!syncStatus.inSync) {
              console.log(`🚀 Vector database out of sync detected - syncing automatically...`);
              await profileVectorManager.syncVectorWithProfile(userId, filteredData);
              console.log(`✅ Vector database sync completed - please retry your request`);

              return {
                success: false,
                error: `Experience with ID "${experienceId}" not found in profile. Vector database has been automatically synced - please try your request again.`,
                autoSyncPerformed: true,
                debug: {
                  syncStatus: 'completed',
                  reason: 'Experience ID from semantic search not found in current profile data'
                }
              };
            }
          } catch (syncError) {
            console.log(`⚠️ Vector database sync failed:`, syncError instanceof Error ? syncError.message : syncError);
          }
        }

        return {
          success: false,
          error: `Experience ${experienceId ? `with ID "${experienceId}"` : `"${experienceTitle}"`} not found in profile. This indicates vector database is out of sync with current profile data.`,
          debug: {
            searchedBy: experienceId ? 'id' : 'title',
            searchValue: experienceId || experienceTitle,
            availableExperiences: filteredData.experiences.map(exp => ({id: exp.id, title: exp.title, company: exp.company}))
          }
        };
      }

      const experience = filteredData.experiences[experienceIndex];

      // Create new project
      const newProject: ExperienceProject = {
        id: randomUUID(),
        title: projectTitle,
        description: projectDescription,
        start,
        end,
        technologies,
        role,
        teamSize,
        updates: [],
      };

      // Add project to experience
      if (!experience.projects) {
        experience.projects = [];
      }
      experience.projects.push(newProject);

      await updateUserFilteredData(userId, filteredData);

      // Send real-time UI update event
      sendProfileUpdateEvent(runtimeContext, 'project_added', {
        experience: {
          id: experience.id,
          title: experience.title,
          company: experience.company
        },
        project: newProject,
        action: 'added'
      });

      // Store in vector database for future searches
      try {
        await profileVectorManager.storeProject(userId, {
          title: projectTitle,
          description: projectDescription,
          technologies,
          role,
          start,
          end,
          experience: {
            id: experience.id,
            title: experience.title,
            company: experience.company,
          },
        });
      } catch (error) {
        console.log('Vector storage failed, continuing without it:', error instanceof Error ? error.message : error);
      }

      return {
        success: true,
        experience,
        project: newProject,
        message: `Added project "${projectTitle}" to experience at ${experience.company}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add project to experience',
      };
    }
  },
});

// Tool: Add project work update to existing project within experience
export const addProjectWork = createTool({
  id: 'add-project-work',
  description: 'Add a work update to an existing project within a work experience',
  inputSchema: AddProjectWorkSchema,
  execute: async ({ context: { experienceId, experienceTitle, projectId, projectTitle, updateTitle, workDescription, skills, achievements, challenges, impact, date }, runtimeContext }) => {
    const userId = runtimeContext?.get('userId');
    if (!userId) {
      throw new Error('User ID not found in context');
    }
    try {
      const filteredData = await initializeFilteredData(userId);

      // Find the experience
      let experienceIndex = -1;
      if (experienceId) {
        experienceIndex = filteredData.experiences.findIndex(exp => exp.id === experienceId);
      } else if (experienceTitle) {
        experienceIndex = filteredData.experiences.findIndex(exp =>
          exp.title.toLowerCase().includes(experienceTitle.toLowerCase()) ||
          exp.company.toLowerCase().includes(experienceTitle.toLowerCase())
        );
      }

      if (experienceIndex === -1) {
        return {
          success: false,
          error: `Experience ${experienceId ? `with ID "${experienceId}"` : `"${experienceTitle}"`} not found in profile.`,
        };
      }

      const experience = filteredData.experiences[experienceIndex];

      // Find the project within the experience
      let project = null;
      let projectIndex = -1;
      if (experience.projects) {
        if (projectId) {
          projectIndex = experience.projects.findIndex(proj => proj.id === projectId);
        } else if (projectTitle) {
          projectIndex = experience.projects.findIndex(proj =>
            proj.title.toLowerCase().includes(projectTitle.toLowerCase())
          );
        }

        if (projectIndex !== -1) {
          project = experience.projects[projectIndex];
        }
      }

      if (!project) {
        return {
          success: false,
          error: `Project ${projectId ? `with ID "${projectId}"` : `"${projectTitle}"`} not found in experience "${experience.title}".`,
        };
      }

      // Create structured project update
      const newUpdate: ProjectUpdate = {
        id: randomUUID(),
        date: date || new Date().toISOString().split('T')[0],
        title: updateTitle,
        description: workDescription,
        skills,
        achievements,
        challenges,
        impact,
      };

      // Add update to project
      if (!project.updates) {
        project.updates = [];
      }
      project.updates.push(newUpdate);

      // Add skills to the main skills array
      skills.forEach(skill => {
        if (!filteredData.skills.includes(skill)) {
          filteredData.skills.push(skill);
        }
      });

      await updateUserFilteredData(userId, filteredData);

      // Send real-time UI update event
      sendProfileUpdateEvent(runtimeContext, 'project_update_added', {
        experience: {
          id: experience.id,
          title: experience.title,
          company: experience.company
        },
        project: {
          id: project.id,
          title: project.title
        },
        update: newUpdate,
        addedSkills: skills,
        action: 'added'
      });

      // Store in vector database for future searches
      try {
        // For project updates, we can use storeEntity with project_update type
        await profileVectorManager.storeEntity(userId, {
          id: newUpdate.id,
          title: updateTitle,
          description: workDescription,
          skills,
          achievements,
          challenges,
          impact,
          date: newUpdate.date,
          project: {
            id: project.id,
            title: project.title,
          },
          experience: {
            id: experience.id,
            title: experience.title,
            company: experience.company,
          },
        }, 'project_update');
      } catch (error) {
        console.log('Vector storage failed, continuing without it:', error instanceof Error ? error.message : error);
      }

      return {
        success: true,
        experience,
        project,
        update: newUpdate,
        addedSkills: skills,
        message: `Added update "${updateTitle}" to project "${project.title}" at ${experience.company}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add project work update',
      };
    }
  },
});

// Tool: Get project updates for a specific project within an experience
export const getProjectUpdates = createTool({
  id: 'get-project-updates',
  description: 'Retrieve all updates for a specific project within a work experience',
  inputSchema: z.object({
    experienceId: z.string().optional(),
    experienceTitle: z.string().optional(),
    projectId: z.string().optional(),
    projectTitle: z.string().optional(),
  }).refine(data => (data.experienceId || data.experienceTitle) && (data.projectId || data.projectTitle), {
    message: "Must provide either experienceId or experienceTitle, and either projectId or projectTitle",
  }),
  execute: async ({ context: { experienceId, experienceTitle, projectId, projectTitle }, runtimeContext }) => {
    const userId = runtimeContext?.get('userId');
    if (!userId) {
      throw new Error('User ID not found in context');
    }
    try {
      const filteredData = await initializeFilteredData(userId);

      // Find the experience
      let experience = null;
      if (experienceId) {
        experience = filteredData.experiences.find(exp => exp.id === experienceId);
      } else if (experienceTitle) {
        experience = filteredData.experiences.find(exp =>
          exp.title.toLowerCase().includes(experienceTitle.toLowerCase()) ||
          exp.company.toLowerCase().includes(experienceTitle.toLowerCase())
        );
      }

      if (!experience) {
        return {
          success: false,
          error: `Experience ${experienceId ? `with ID "${experienceId}"` : `"${experienceTitle}"`} not found in profile.`,
        };
      }

      // Find the project within the experience
      let project = null;
      if (experience.projects) {
        if (projectId) {
          project = experience.projects.find(proj => proj.id === projectId);
        } else if (projectTitle) {
          project = experience.projects.find(proj =>
            proj.title.toLowerCase().includes(projectTitle.toLowerCase())
          );
        }
      }

      if (!project) {
        return {
          success: false,
          error: `Project ${projectId ? `with ID "${projectId}"` : `"${projectTitle}"`} not found in experience "${experience.title}".`,
        };
      }

      const updates = project.updates || [];

      return {
        success: true,
        experience: {
          id: experience.id,
          title: experience.title,
          company: experience.company,
        },
        project: {
          id: project.id,
          title: project.title,
          description: project.description,
          start: project.start,
          end: project.end,
          technologies: project.technologies,
          role: project.role,
        },
        updates,
        updateCount: updates.length,
        message: `Retrieved ${updates.length} updates for project "${project.title}" at ${experience.company}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get project updates',
      };
    }
  },
});

// Tool: Get all projects from all experiences
export const getProjects = createTool({
  id: 'get-projects',
  description: 'Retrieve all projects from all work experiences in the user\'s filtered profile data',
  inputSchema: z.object({
    includeUpdates: z.boolean().default(false),
    experienceId: z.string().optional(), // Optional: filter by specific experience
  }),
  execute: async ({ context: { includeUpdates, experienceId }, runtimeContext }) => {
    const userId = runtimeContext?.get('userId');
    if (!userId) {
      throw new Error('User ID not found in context');
    }
    try {
      const filteredData = await initializeFilteredData(userId);

      let experiencesToSearch = filteredData.experiences;

      // Filter by specific experience if provided
      if (experienceId) {
        experiencesToSearch = filteredData.experiences.filter(exp => exp.id === experienceId);
        if (experiencesToSearch.length === 0) {
          return {
            success: false,
            error: `Experience with ID "${experienceId}" not found in profile.`,
          };
        }
      }

      // Collect all projects from all experiences
      const allProjects: any[] = [];

      experiencesToSearch.forEach(experience => {
        if (experience.projects && experience.projects.length > 0) {
          experience.projects.forEach(project => {
            allProjects.push({
              experienceId: experience.id,
              experienceTitle: experience.title,
              company: experience.company,
              id: project.id,
              title: project.title,
              description: project.description,
              start: project.start,
              end: project.end,
              technologies: project.technologies,
              role: project.role,
              teamSize: project.teamSize,
              updateCount: project.updates?.length || 0,
              ...(includeUpdates && { updates: project.updates || [] }),
            });
          });
        }
      });

      return {
        success: true,
        projects: allProjects,
        projectCount: allProjects.length,
        experienceCount: experiencesToSearch.length,
        message: `Retrieved ${allProjects.length} projects from ${experiencesToSearch.length} experience(s)`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get projects',
      };
    }
  },
});

// Tool: Get a specific project
export const getProject = createTool({
  id: 'get-project',
  description: 'Get details of a specific project by ID or title. Can optionally filter by experience.',
  inputSchema: GetProjectSchema,
  execute: async ({ context: { projectId, projectTitle, experienceId, experienceCompany }, runtimeContext }) => {
    const userId = runtimeContext?.get('userId');
    if (!userId) {
      throw new Error('User ID not found in context');
    }
    try {
      const filteredData = await initializeFilteredData(userId);

      let foundProject = null;
      let foundExperience = null;

      // Search through all experiences and their projects
      for (const experience of filteredData.experiences) {
        if (experience.projects) {
          for (const project of experience.projects) {
            let matches = false;

            if (projectId && project.id === projectId) {
              matches = true;
            } else if (projectTitle && project.title.toLowerCase().includes(projectTitle.toLowerCase())) {
              matches = true;
            }

            // If experience filter is provided, check it too
            if (matches && (experienceId || experienceCompany)) {
              if (experienceId && experience.id !== experienceId) {
                matches = false;
              } else if (experienceCompany && !experience.company.toLowerCase().includes(experienceCompany.toLowerCase())) {
                matches = false;
              }
            }

            if (matches) {
              foundProject = project;
              foundExperience = experience;
              break;
            }
          }
          if (foundProject) break;
        }
      }

      if (!foundProject) {
        return {
          success: false,
          error: `Project ${projectId || projectTitle} not found${experienceCompany ? ` in experience at ${experienceCompany}` : ''}`,
        };
      }

      return {
        success: true,
        project: {
          ...foundProject,
          updateCount: foundProject.updates?.length || 0,
        },
        experience: {
          id: foundExperience.id,
          title: foundExperience.title,
          company: foundExperience.company,
        },
        message: `Found project: ${foundProject.title} at ${foundExperience.company}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get project',
      };
    }
  },
});

// Tool: Add project (streamlined version)
export const addProject = createTool({
  id: 'add-project',
  description: 'Add a new project to a work experience. Projects MUST be associated with a work experience. If no experience is specified, defaults to current/most recent experience. User must have at least one experience in their profile.',
  inputSchema: AddProjectSchema,
  execute: async ({ context: { experienceId, experienceTitle, experienceCompany, projectTitle, projectDescription, start, end, technologies, role, teamSize }, runtimeContext }) => {
    const userId = runtimeContext?.get('userId');
    if (!userId) {
      throw new Error('User ID not found in context');
    }
    try {
      const filteredData = await initializeFilteredData(userId);

      // Find the experience
      let experienceIndex = -1;
      let isCurrentExperience = false;

      if (experienceId) {
        experienceIndex = filteredData.experiences.findIndex(exp => exp.id === experienceId);
      } else if (experienceTitle) {
        experienceIndex = filteredData.experiences.findIndex(exp =>
          exp.title.toLowerCase().includes(experienceTitle.toLowerCase())
        );
      } else if (experienceCompany) {
        experienceIndex = filteredData.experiences.findIndex(exp =>
          exp.company.toLowerCase().includes(experienceCompany.toLowerCase())
        );
      } else {
        // No experience specified - find current/most recent experience
        if (filteredData.experiences.length === 0) {
          return {
            success: false,
            error: `Cannot add project without a work experience. Projects must be associated with a job/role. Please add a work experience first using the add-experience tool, then add the project to that experience.`,
            needsExperience: true,
            suggestedAction: "Use the add-experience tool first with: job title, company name, and start date.",
          };
        }

        // Find current experience (no end date) or most recent one
        const currentExperience = filteredData.experiences.find(exp => !exp.end);
        let assumedExperience;

        if (currentExperience) {
          assumedExperience = currentExperience;
          isCurrentExperience = true;
        } else {
          // Find most recent experience by start date
          const sortedExperiences = [...filteredData.experiences].sort((a, b) => {
            const dateA = new Date(a.start || '1900-01-01');
            const dateB = new Date(b.start || '1900-01-01');
            return dateB.getTime() - dateA.getTime();
          });
          assumedExperience = sortedExperiences[0];
          isCurrentExperience = false;
        }

        // Return confirmation request instead of proceeding directly
        return {
          success: false,
          needsConfirmation: true,
          assumedExperience: {
            id: assumedExperience.id,
            title: assumedExperience.title,
            company: assumedExperience.company,
            isCurrent: isCurrentExperience,
          },
          projectTitle,
          projectDescription,
          confirmationMessage: `I want to add the project "${projectTitle}" to your ${isCurrentExperience ? 'current' : 'most recent'} work experience: ${assumedExperience.title} at ${assumedExperience.company}. Is this correct?`,
          instructions: "Please confirm by saying 'yes' or specify a different experience by company name or job title.",
        };
      }

      if (experienceIndex === -1) {
        const searchCriteria = experienceId ? `ID "${experienceId}"` :
                             experienceTitle ? `title "${experienceTitle}"` :
                             `company "${experienceCompany}"`;
        return {
          success: false,
          error: `Experience not found. Searched by: ${searchCriteria}`,
        };
      }

      const experience = filteredData.experiences[experienceIndex];

      // Create new project
      const newProject: ExperienceProject = {
        id: randomUUID(),
        title: projectTitle,
        description: projectDescription,
        start,
        end,
        technologies,
        role,
        teamSize,
        updates: [],
      };

      // Add project to experience
      if (!experience.projects) {
        experience.projects = [];
      }
      experience.projects.push(newProject);

      await updateUserFilteredData(userId, filteredData);

      // Send real-time UI update event
      sendProfileUpdateEvent(runtimeContext, 'project_added', {
        experience: {
          id: experience.id,
          title: experience.title,
          company: experience.company
        },
        project: newProject,
        action: 'added'
      });

      // Store in vector database for future searches
      try {
        await profileVectorManager.storeProject(userId, {
          title: projectTitle,
          description: projectDescription,
          technologies,
          role,
          start,
          end,
          experience: {
            id: experience.id,
            title: experience.title,
            company: experience.company,
          },
        });
      } catch (error) {
        console.log('Vector storage failed, continuing without it:', error instanceof Error ? error.message : error);
      }

      const baseMessage = `Successfully added project "${projectTitle}" to work experience: ${experience.title} at ${experience.company}`;
      const confirmationMessage = isCurrentExperience ?
        ` (automatically linked to current role)` :
        (experienceId || experienceTitle || experienceCompany) ? '' : ` (automatically linked to most recent role)`;

      return {
        success: true,
        project: newProject,
        experience: {
          id: experience.id,
          title: experience.title,
          company: experience.company,
        },
        message: baseMessage + confirmationMessage,
        assumedExperience: isCurrentExperience ? 'current' : 'recent',
        reminder: "All projects are associated with work experiences to maintain professional context.",
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add project',
      };
    }
  },
});

// Tool: Confirm and add project to experience
export const confirmAddProject = createTool({
  id: 'confirm-add-project',
  description: 'Confirm and add a project to a specified work experience after user confirmation.',
  inputSchema: ConfirmAddProjectSchema,
  execute: async ({ context: { experienceId, projectTitle, projectDescription, start, end, technologies, role, teamSize, confirmed }, runtimeContext }) => {
    const userId = runtimeContext?.get('userId');
    if (!userId) {
      throw new Error('User ID not found in context');
    }

    if (!confirmed) {
      return {
        success: false,
        error: "Project addition was not confirmed. Please specify a different experience or confirm to proceed.",
      };
    }

    try {
      const filteredData = await initializeFilteredData(userId);

      // Find the specific experience by ID
      const experienceIndex = filteredData.experiences.findIndex(exp => exp.id === experienceId);

      if (experienceIndex === -1) {
        return {
          success: false,
          error: `Experience with ID "${experienceId}" not found.`,
        };
      }

      const experience = filteredData.experiences[experienceIndex];

      // Create new project
      const newProject: ExperienceProject = {
        id: randomUUID(),
        title: projectTitle,
        description: projectDescription,
        start,
        end,
        technologies,
        role,
        teamSize,
        updates: [],
      };

      // Add project to experience
      if (!experience.projects) {
        experience.projects = [];
      }
      experience.projects.push(newProject);

      await updateUserFilteredData(userId, filteredData);

      // Send real-time UI update event
      sendProfileUpdateEvent(runtimeContext, 'project_added', {
        experience: {
          id: experience.id,
          title: experience.title,
          company: experience.company
        },
        project: newProject,
        action: 'added'
      });

      // Store in vector database for future searches
      try {
        await profileVectorManager.storeProject(userId, {
          title: projectTitle,
          description: projectDescription,
          technologies,
          role,
          start,
          end,
          experience: {
            id: experience.id,
            title: experience.title,
            company: experience.company,
          },
        });
      } catch (error) {
        console.log('Vector storage failed, continuing without it:', error instanceof Error ? error.message : error);
      }

      return {
        success: true,
        project: newProject,
        experience: {
          id: experience.id,
          title: experience.title,
          company: experience.company,
        },
        message: `Successfully added project "${projectTitle}" to ${experience.title} at ${experience.company}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add project',
      };
    }
  },
});

// Tool: Update existing project
export const updateProject = createTool({
  id: 'update-project',
  description: 'Update an existing project. Can find project by ID or title, optionally filtered by experience.',
  inputSchema: UpdateProjectSchema,
  execute: async ({ context: { projectId, projectTitle, experienceId, experienceCompany, title, description, start, end, technologies, role, teamSize }, runtimeContext }) => {
    const userId = runtimeContext?.get('userId');
    if (!userId) {
      throw new Error('User ID not found in context');
    }
    try {
      const filteredData = await initializeFilteredData(userId);

      let foundProject = null;
      let foundExperience = null;
      let experienceIndex = -1;
      let projectIndex = -1;

      // Search through all experiences and their projects
      for (let expIdx = 0; expIdx < filteredData.experiences.length; expIdx++) {
        const experience = filteredData.experiences[expIdx];
        if (experience.projects) {
          for (let projIdx = 0; projIdx < experience.projects.length; projIdx++) {
            const project = experience.projects[projIdx];
            let matches = false;

            if (projectId && project.id === projectId) {
              matches = true;
            } else if (projectTitle && project.title.toLowerCase().includes(projectTitle.toLowerCase())) {
              matches = true;
            }

            // If experience filter is provided, check it too
            if (matches && (experienceId || experienceCompany)) {
              if (experienceId && experience.id !== experienceId) {
                matches = false;
              } else if (experienceCompany && !experience.company.toLowerCase().includes(experienceCompany.toLowerCase())) {
                matches = false;
              }
            }

            if (matches) {
              foundProject = project;
              foundExperience = experience;
              experienceIndex = expIdx;
              projectIndex = projIdx;
              break;
            }
          }
          if (foundProject) break;
        }
      }

      if (!foundProject) {
        return {
          success: false,
          error: `Project ${projectId || projectTitle} not found${experienceCompany ? ` in experience at ${experienceCompany}` : ''}`,
        };
      }

      const originalProject = { ...foundProject };

      // Update only the fields that were provided
      if (title !== undefined) foundProject.title = title;
      if (description !== undefined) foundProject.description = description;
      if (start !== undefined) foundProject.start = start;
      if (end !== undefined) foundProject.end = end;
      if (technologies !== undefined) foundProject.technologies = technologies;
      if (role !== undefined) foundProject.role = role;
      if (teamSize !== undefined) foundProject.teamSize = teamSize;

      await updateUserFilteredData(userId, filteredData);

      // Send real-time UI update event
      sendProfileUpdateEvent(runtimeContext, 'project_updated', {
        experience: {
          id: foundExperience.id,
          title: foundExperience.title,
          company: foundExperience.company
        },
        project: foundProject,
        originalProject,
        action: 'updated'
      });

      // Update in vector database
      try {
        await profileVectorManager.storeProject(userId, {
          id: foundProject.id,
          title: foundProject.title,
          description: foundProject.description,
          technologies: foundProject.technologies,
          role: foundProject.role,
          start: foundProject.start,
          end: foundProject.end,
          experience: {
            id: foundExperience.id,
            title: foundExperience.title,
            company: foundExperience.company,
          },
        });
      } catch (error) {
        console.log('Vector storage failed, continuing without it:', error instanceof Error ? error.message : error);
      }

      return {
        success: true,
        project: foundProject,
        originalProject,
        experience: {
          id: foundExperience.id,
          title: foundExperience.title,
          company: foundExperience.company,
        },
        message: `Updated project: ${foundProject.title} at ${foundExperience.company}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update project',
      };
    }
  },
});

// Tool: Get a specific project update
export const getProjectUpdate = createTool({
  id: 'get-project-update',
  description: 'Get details of a specific project update by ID or title.',
  inputSchema: GetProjectUpdateSchema,
  execute: async ({ context: { updateId, updateTitle, projectId, projectTitle, experienceCompany }, runtimeContext }) => {
    const userId = runtimeContext?.get('userId');
    if (!userId) {
      throw new Error('User ID not found in context');
    }
    try {
      const filteredData = await initializeFilteredData(userId);

      let foundUpdate = null;
      let foundProject = null;
      let foundExperience = null;

      // Search through all experiences, projects, and updates
      for (const experience of filteredData.experiences) {
        if (experience.projects) {
          for (const project of experience.projects) {
            if (project.updates) {
              for (const update of project.updates) {
                let matches = false;

                if (updateId && update.id === updateId) {
                  matches = true;
                } else if (updateTitle && update.title.toLowerCase().includes(updateTitle.toLowerCase())) {
                  matches = true;
                } else if (projectId && project.id === projectId) {
                  matches = true;
                } else if (projectTitle && project.title.toLowerCase().includes(projectTitle.toLowerCase())) {
                  matches = true;
                }

                // If experience filter is provided, check it too
                if (matches && experienceCompany) {
                  if (!experience.company.toLowerCase().includes(experienceCompany.toLowerCase())) {
                    matches = false;
                  }
                }

                if (matches) {
                  foundUpdate = update;
                  foundProject = project;
                  foundExperience = experience;
                  break;
                }
              }
              if (foundUpdate) break;
            }
          }
          if (foundUpdate) break;
        }
      }

      if (!foundUpdate) {
        return {
          success: false,
          error: `Project update not found with the provided criteria`,
        };
      }

      return {
        success: true,
        update: foundUpdate,
        project: {
          id: foundProject.id,
          title: foundProject.title,
        },
        experience: {
          id: foundExperience.id,
          title: foundExperience.title,
          company: foundExperience.company,
        },
        message: `Found update: ${foundUpdate.title} in project ${foundProject.title}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get project update',
      };
    }
  },
});

// Tool: Add update to project using WDRL framework
export const addUpdateToProject = createTool({
  id: 'add-update-to-project',
  description: 'PRIMARY TOOL for adding project updates. Uses WDRL framework: Work (required), Decision (optional), Result (optional), Learning (optional). Always present this format to users: "**Work (Required)**: What piece of work has taken most of your attention recently? You can also optionally include: **Decision**: Key decisions/actions, **Result**: Measurable results/evidence, **Learning**: Feedback/takeaways. You can provide all details in one message or just the work description." REQUIRED: updateTitle, description (work). OPTIONAL: skills, achievements, challenges, impact, date, decisions, results, learnings.',
  inputSchema: AddUpdateToProjectSchema,
  execute: async ({ context: { projectId, projectTitle, experienceId, experienceCompany, updateTitle, description, date, skills, achievements, challenges, impact, decisions, results, learnings }, runtimeContext }) => {
    const userId = runtimeContext?.get('userId');
    if (!userId) {
      throw new Error('User ID not found in context');
    }
    try {
      const filteredData = await initializeFilteredData(userId);

      let foundProject = null;
      let foundExperience = null;
      let projectIndex = -1;

      // Search through all experiences and their projects
      for (const experience of filteredData.experiences) {
        if (experience.projects) {
          for (let idx = 0; idx < experience.projects.length; idx++) {
            const project = experience.projects[idx];
            let matches = false;

            if (projectId && project.id === projectId) {
              matches = true;
            } else if (projectTitle && project.title.toLowerCase().includes(projectTitle.toLowerCase())) {
              matches = true;
            }

            // If experience filter is provided, check it too
            if (matches && (experienceId || experienceCompany)) {
              if (experienceId && experience.id !== experienceId) {
                matches = false;
              } else if (experienceCompany && !experience.company.toLowerCase().includes(experienceCompany.toLowerCase())) {
                matches = false;
              }
            }

            if (matches) {
              foundProject = project;
              foundExperience = experience;
              projectIndex = idx;
              break;
            }
          }
          if (foundProject) break;
        }
      }

      if (!foundProject) {
        return {
          success: false,
          error: `Project ${projectId || projectTitle} not found${experienceCompany ? ` in experience at ${experienceCompany}` : ''}`,
        };
      }

      // Create new update with WDRL framework
      const newUpdate: ProjectUpdate = {
        id: randomUUID(),
        date: date || new Date().toISOString().split('T')[0],
        title: updateTitle,
        description, // Work - required field
        skills,
        achievements,
        challenges,
        impact,
        // WDRL framework fields
        decisions, // Decision - key decisions made
        results, // Result - measurable outcomes
        learnings, // Learning - feedback and takeaways
      };

      // Add update to project
      if (!foundProject.updates) {
        foundProject.updates = [];
      }
      foundProject.updates.push(newUpdate);

      // Add skills to the main skills array
      skills.forEach(skill => {
        if (!filteredData.skills.includes(skill)) {
          filteredData.skills.push(skill);
        }
      });

      await updateUserFilteredData(userId, filteredData);

      // Send real-time UI update event
      sendProfileUpdateEvent(runtimeContext, 'project_update_added', {
        experience: {
          id: foundExperience.id,
          title: foundExperience.title,
          company: foundExperience.company
        },
        project: {
          id: foundProject.id,
          title: foundProject.title
        },
        update: newUpdate,
        addedSkills: skills,
        action: 'added'
      });

      // Store in vector database
      try {
        await profileVectorManager.storeEntity(userId, {
          id: newUpdate.id,
          title: updateTitle,
          description,
          skills,
          achievements,
          challenges,
          impact,
          decisions,
          results,
          learnings,
          date: newUpdate.date,
          project: {
            id: foundProject.id,
            title: foundProject.title,
          },
          experience: {
            id: foundExperience.id,
            title: foundExperience.title,
            company: foundExperience.company,
          },
        }, 'project_update');
      } catch (error) {
        console.log('Vector storage failed, continuing without it:', error instanceof Error ? error.message : error);
      }

      return {
        success: true,
        update: newUpdate,
        project: {
          id: foundProject.id,
          title: foundProject.title,
        },
        experience: {
          id: foundExperience.id,
          title: foundExperience.title,
          company: foundExperience.company,
        },
        addedSkills: skills,
        message: `Added update "${updateTitle}" to project "${foundProject.title}" at ${foundExperience.company}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add project update',
      };
    }
  },
});

// Tool: Update existing project update
export const updateProjectUpdate = createTool({
  id: 'update-project-update',
  description: 'Update an existing project update entry.',
  inputSchema: UpdateProjectUpdateSchema,
  execute: async ({ context: { updateId, updateTitle, projectId, projectTitle, experienceCompany, title, description, date, skills, achievements, challenges, impact, decisions, results, learnings }, runtimeContext }) => {
    const userId = runtimeContext?.get('userId');
    if (!userId) {
      throw new Error('User ID not found in context');
    }
    try {
      const filteredData = await initializeFilteredData(userId);

      let foundUpdate = null;
      let foundProject = null;
      let foundExperience = null;
      let updateIndex = -1;

      // Search through all experiences, projects, and updates
      for (const experience of filteredData.experiences) {
        if (experience.projects) {
          for (const project of experience.projects) {
            if (project.updates) {
              for (let idx = 0; idx < project.updates.length; idx++) {
                const update = project.updates[idx];
                let matches = false;

                if (updateId && update.id === updateId) {
                  matches = true;
                } else if (updateTitle && update.title.toLowerCase().includes(updateTitle.toLowerCase())) {
                  matches = true;
                }

                // Additional filters
                if (matches && projectId && project.id !== projectId) {
                  matches = false;
                } else if (matches && projectTitle && !project.title.toLowerCase().includes(projectTitle.toLowerCase())) {
                  matches = false;
                } else if (matches && experienceCompany && !experience.company.toLowerCase().includes(experienceCompany.toLowerCase())) {
                  matches = false;
                }

                if (matches) {
                  foundUpdate = update;
                  foundProject = project;
                  foundExperience = experience;
                  updateIndex = idx;
                  break;
                }
              }
              if (foundUpdate) break;
            }
          }
          if (foundUpdate) break;
        }
      }

      if (!foundUpdate) {
        return {
          success: false,
          error: `Project update ${updateId || updateTitle} not found`,
        };
      }

      const originalUpdate = { ...foundUpdate };

      // Update only the fields that were provided
      if (title !== undefined) foundUpdate.title = title;
      if (description !== undefined) foundUpdate.description = description;
      if (date !== undefined) foundUpdate.date = date;
      if (skills !== undefined) {
        foundUpdate.skills = skills;
        // Add new skills to the main skills array
        skills.forEach(skill => {
          if (!filteredData.skills.includes(skill)) {
            filteredData.skills.push(skill);
          }
        });
      }
      if (achievements !== undefined) foundUpdate.achievements = achievements;
      if (challenges !== undefined) foundUpdate.challenges = challenges;
      if (impact !== undefined) foundUpdate.impact = impact;
      // WDRL Framework fields
      if (decisions !== undefined) foundUpdate.decisions = decisions;
      if (results !== undefined) foundUpdate.results = results;
      if (learnings !== undefined) foundUpdate.learnings = learnings;

      await updateUserFilteredData(userId, filteredData);

      // Send real-time UI update event
      sendProfileUpdateEvent(runtimeContext, 'project_update_updated', {
        experience: {
          id: foundExperience.id,
          title: foundExperience.title,
          company: foundExperience.company
        },
        project: {
          id: foundProject.id,
          title: foundProject.title
        },
        update: foundUpdate,
        originalUpdate,
        action: 'updated'
      });

      // Update in vector database
      try {
        await profileVectorManager.storeEntity(userId, {
          id: foundUpdate.id,
          title: foundUpdate.title,
          description: foundUpdate.description,
          skills: foundUpdate.skills,
          achievements: foundUpdate.achievements,
          challenges: foundUpdate.challenges,
          impact: foundUpdate.impact,
          decisions: foundUpdate.decisions,
          results: foundUpdate.results,
          learnings: foundUpdate.learnings,
          date: foundUpdate.date,
          project: {
            id: foundProject.id,
            title: foundProject.title,
          },
          experience: {
            id: foundExperience.id,
            title: foundExperience.title,
            company: foundExperience.company,
          },
        }, 'project_update');
      } catch (error) {
        console.log('Vector storage failed, continuing without it:', error instanceof Error ? error.message : error);
      }

      return {
        success: true,
        update: foundUpdate,
        originalUpdate,
        project: {
          id: foundProject.id,
          title: foundProject.title,
        },
        experience: {
          id: foundExperience.id,
          title: foundExperience.title,
          company: foundExperience.company,
        },
        message: `Updated project update: ${foundUpdate.title} in project ${foundProject.title}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update project update',
      };
    }
  },
});

// Tool: Get all education entries
export const getEducations = createTool({
  id: 'get-educations',
  description: 'Retrieve all education entries from the user\'s filtered profile data',
  inputSchema: z.object({}),
  execute: async ({ runtimeContext }) => {
    const userId = runtimeContext?.get('userId');
    if (!userId) {
      throw new Error('User ID not found in context');
    }
    try {
      const filteredData = await initializeFilteredData(userId);

      const educations = filteredData.education.map((edu, index) => ({
        index,
        school: edu.school,
        degree: edu.degree,
        field: edu.field,
        start: edu.start,
        end: edu.end,
      }));

      return {
        success: true,
        educations,
        educationCount: educations.length,
        message: `Retrieved ${educations.length} education entr${educations.length === 1 ? 'y' : 'ies'}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get education entries',
      };
    }
  },
});

// Tool: Get a specific education entry
export const getEducation = createTool({
  id: 'get-education',
  description: 'Get details of a specific education entry by index, school name, or degree',
  inputSchema: GetEducationSchema,
  execute: async ({ context: { educationIndex, school, degree }, runtimeContext }) => {
    const userId = runtimeContext?.get('userId');
    if (!userId) {
      throw new Error('User ID not found in context');
    }
    try {
      const filteredData = await initializeFilteredData(userId);

      let foundEducation = null;
      let foundIndex = -1;

      if (educationIndex !== undefined) {
        if (educationIndex >= 0 && educationIndex < filteredData.education.length) {
          foundEducation = filteredData.education[educationIndex];
          foundIndex = educationIndex;
        }
      } else {
        // Search by school or degree
        for (let i = 0; i < filteredData.education.length; i++) {
          const edu = filteredData.education[i];
          let matches = false;

          if (school && edu.school.toLowerCase().includes(school.toLowerCase())) {
            matches = true;
          } else if (degree && edu.degree && edu.degree.toLowerCase().includes(degree.toLowerCase())) {
            matches = true;
          }

          if (matches) {
            foundEducation = edu;
            foundIndex = i;
            break;
          }
        }
      }

      if (!foundEducation) {
        return {
          success: false,
          error: `Education entry not found with the provided criteria`,
        };
      }

      return {
        success: true,
        education: {
          index: foundIndex,
          ...foundEducation,
        },
        message: `Found education: ${foundEducation.degree ? foundEducation.degree + ' at ' : ''}${foundEducation.school}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get education entry',
      };
    }
  },
});

// Tool: Update existing education entry
export const updateEducation = createTool({
  id: 'update-education',
  description: 'Update an existing education entry. Can find by index or school name.',
  inputSchema: UpdateEducationSchema,
  execute: async ({ context: { educationIndex, school, degree, field, start, end, newSchool, newDegree, newField, newStart, newEnd }, runtimeContext }) => {
    const userId = runtimeContext?.get('userId');
    if (!userId) {
      throw new Error('User ID not found in context');
    }
    try {
      const filteredData = await initializeFilteredData(userId);

      let foundIndex = -1;

      // Find the education entry
      if (educationIndex !== undefined) {
        if (educationIndex >= 0 && educationIndex < filteredData.education.length) {
          foundIndex = educationIndex;
        }
      } else if (school) {
        for (let i = 0; i < filteredData.education.length; i++) {
          const edu = filteredData.education[i];
          if (edu.school.toLowerCase().includes(school.toLowerCase())) {
            foundIndex = i;
            break;
          }
        }
      }

      if (foundIndex === -1) {
        return {
          success: false,
          error: `Education entry ${educationIndex !== undefined ? `at index ${educationIndex}` : `for school "${school}"`} not found`,
        };
      }

      const education = filteredData.education[foundIndex];
      const originalEducation = { ...education };

      // Update fields - prioritize "new" prefixed fields, then fall back to regular fields
      if (newSchool !== undefined) education.school = newSchool;
      else if (school !== undefined && school !== education.school) education.school = school;

      if (newDegree !== undefined) education.degree = newDegree;
      else if (degree !== undefined) education.degree = degree;

      if (newField !== undefined) education.field = newField;
      else if (field !== undefined) education.field = field;

      if (newStart !== undefined) education.start = newStart;
      else if (start !== undefined) education.start = start;

      if (newEnd !== undefined) education.end = newEnd;
      else if (end !== undefined) education.end = end;

      await updateUserFilteredData(userId, filteredData);

      // Send real-time UI update event
      sendProfileUpdateEvent(runtimeContext, 'education_updated', {
        education,
        originalEducation,
        index: foundIndex,
        action: 'updated'
      });

      // Update in vector database
      try {
        await profileVectorManager.storeEducation(userId, {
          school: education.school,
          degree: education.degree,
          field: education.field,
          start: education.start,
          end: education.end,
        });
      } catch (error) {
        console.log('Vector storage failed, continuing without it:', error instanceof Error ? error.message : error);
      }

      return {
        success: true,
        education: {
          index: foundIndex,
          ...education,
        },
        originalEducation,
        message: `Updated education: ${education.degree ? education.degree + ' at ' : ''}${education.school}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update education entry',
      };
    }
  },
});

// Export essential tools only - removed duplicates and getter tools (use working memory instead)
export const careerTools = [
  // Experience management
  addExperience,          // Add new work experience
  getExperiences,         // Get all experiences (for search/context)
  updateExperience,       // Update existing experience

  // Education management
  addEducation,           // Add new education entry
  updateEducation,        // Update existing education

  // Project management
  addProjectToExperience, // Add new project to an experience (primary project tool)
  addUpdateToProject,     // Add WDRL-format update to existing project

  // Intelligent search
  semanticSearch          // Find similar entries to make add vs update decisions
];
