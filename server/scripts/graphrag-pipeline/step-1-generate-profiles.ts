#!/usr/bin/env tsx
/**
 * Step 1: Generate Career Profiles using GPT-4o-mini
 *
 * This script generates realistic career profiles with proper hierarchy
 * and saves them as JSON files for further processing.
 *
 * Usage:
 *   npx tsx pipeline/step-1-generate-profiles.ts --count 5
 *   npx tsx pipeline/step-1-generate-profiles.ts --count 10 --role engineer
 *   npx tsx pipeline/step-1-generate-profiles.ts --count 100 --all-roles
 */

import { faker } from '@faker-js/faker';
import dotenv from 'dotenv';
import * as fs from 'fs/promises';
import { OpenAI } from 'openai';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

import {
  type ExperienceLevel,
  ROLE_DISTRIBUTIONS,
  type RoleType,
} from './config/diversity-matrix';
import {
  getValidChildTypes,
  type NodeHierarchy,
  ROOT_ONLY_NODES,
  TimelineNodeType,
  validateHierarchy} from './config/hierarchy-rules';

dotenv.config();

interface TimelineNode {
  id: string;
  type: TimelineNodeType;
  parentId?: string;
  meta: {
    // For all node types
    startDate: string;
    endDate?: string | null;

    // For project/event/action/careerTransition
    title?: string;
    description?: string;

    // For job nodes
    company?: string;
    role?: string;
    location?: string;

    // For education nodes
    institution?: string;
    degree?: string;
    field?: string;
  };
}

interface Insight {
  id: string;
  nodeId: string;
  description: string;
  resources: string[];
}

interface CareerProfile {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  userName?: string;
  interest?: string;
  timelineNodes: TimelineNode[];
  insights: Insight[];
  createdAt: string;
}

class ProfileGenerator {
  private openai: OpenAI;
  private outputDir: string;
  private usedEmails: Set<string>;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('❌ OPENAI_API_KEY is required');
    }

    this.openai = new OpenAI({ apiKey });
    this.outputDir = path.join(process.cwd(), 'server', 'scripts', 'graphrag-pipeline', 'data', 'profiles');
    this.usedEmails = new Set<string>();
  }

  async initialize() {
    // Ensure output directory exists
    await fs.mkdir(this.outputDir, { recursive: true });
    console.log(`📁 Output directory ready: ${this.outputDir}`);
  }

  /**
   * Generate a unique email using Faker.js
   */
  private generateUniqueEmail(): string {
    let email = faker.internet.email().toLowerCase();
    let counter = 1;

    while (this.usedEmails.has(email)) {
      const [username, domain] = email.split('@');
      email = `${username}${counter}@${domain}`;
      counter++;
    }

    this.usedEmails.add(email);
    return email;
  }

  /**
   * Generate a single career profile
   */
  async generateProfile(
    userId: string,
    roleType: RoleType,
    experienceLevel: ExperienceLevel
  ): Promise<CareerProfile> {
    // Use Faker for name generation with fallback to diversity matrix
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const fullName = `${firstName} ${lastName}`;
    const email = this.generateUniqueEmail();
    const userName = `${firstName.toLowerCase()}${lastName.toLowerCase()}${userId.slice(-3)}`;

    console.log(`🤖 Generating profile for ${fullName} (${roleType} - ${experienceLevel})...`);

    // Generate complete profile using GPT-4o-mini
    const profileData = await this.generateCompleteProfile(
      fullName,
      roleType,
      experienceLevel
    );

    // Generate insights for key nodes
    const insights = await this.generateInsights(profileData.timelineNodes);

    return {
      userId,
      firstName,
      lastName,
      email,
      userName,
      interest: profileData.interest,
      timelineNodes: profileData.timelineNodes,
      insights,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Generate complete profile including timeline using GPT-4o-mini
   */
  private async generateCompleteProfile(
    name: string,
    roleType: RoleType,
    experienceLevel: ExperienceLevel
  ): Promise<{ timelineNodes: TimelineNode[]; interest: string }> {


    // Let LLM determine experience years based on level
    const experienceYears = {
      'junior': '1-2 years',
      'mid': '3-5 years',
      'senior': '6-8 years',
      'lead': '8-12 years'
    }[experienceLevel] || '2-4 years';

    const prompt = `Generate a complete career profile for a ${roleType} professional:

Profile Details to Generate:
- Name: ${name}
- Role Type: ${roleType} (engineer/pm/designer)
- Experience Level: ${experienceLevel} (${experienceYears})

Please generate:
1. A professional interest statement (1 sentence about what motivates them professionally)
2. A comprehensive timeline showing their career journey

Create realistic details for:
- Current company name (believable tech company)
- Current job title appropriate for ${experienceLevel} ${roleType}
- Education background (university, degree, field of study)
- Previous roles showing logical career progression
- Projects, events, actions that shaped their career

Create a comprehensive JSON array of timeline nodes that tells a complete career story following these STRICT HIERARCHY RULES:

LEVEL 1 - ROOT NODES (parentId: null):
- education: Educational background only
- job: Work positions only
- careerTransition: Career changes only

LEVEL 2+ - CHILD NODES (must have parentId):
- project: Can be child of job, careerTransition, or another project
- event: Can be child of job, careerTransition, project, or another event
- action: Can be child of job, careerTransition, project, event, or another action

FORBIDDEN COMBINATIONS (will cause validation errors):
- job cannot be child of job
- education cannot be child of anything
- careerTransition cannot be child of anything
- No circular references (node cannot reference itself)

Generate 4-6 root nodes and 2-4 child nodes per job to create a realistic career journey.

Include diverse node types:
- Multiple jobs showing career progression (all as root nodes)
- Key projects with measurable outcomes
- Important events (conferences, training, certifications, team changes)
- Specific actions (implementations, optimizations, leadership initiatives)
- Career transitions explaining motivations and outcomes (all as root nodes)

Return ONLY valid JSON object with this structure:
{
  "interest": "One sentence about professional interests and motivations",
  "timelineNodes": [
    // FOR JOB/EDUCATION NODES:
    {
      "id": "unique-id",
      "type": "education|job",
      "parentId": null,
      "meta": {
        "company": "Company Name", "role": "Job Title", "location": "City, State", "startDate": "YYYY-MM", "endDate": "YYYY-MM or null" // for job
        "institution": "University Name", "degree": "Degree Type", "field": "Field of Study", "startDate": "YYYY-MM", "endDate": "YYYY-MM" // for education
      }
    },
    // FOR OTHER NODES (project/event/action/careerTransition):
    {
      "id": "unique-id",
      "type": "project|event|action|careerTransition",
      "parentId": "parent-id or null for root",
      "meta": {
        "title": "Short title",
        "description": "2-3 sentence description",
        "startDate": "YYYY-MM",
        "endDate": "YYYY-MM or null if ongoing"
      }
    }
  ]
}

CRITICAL FIELD RULES:
- job nodes: meta: {company, role, location, startDate, endDate} (NO title, description at root)
- education nodes: meta: {institution, degree, field, startDate, endDate} (NO title, description at root)
- project/event/action/careerTransition nodes: meta: {title, description, startDate, endDate}

VALIDATION CHECKLIST - Ensure:
✓ All education, job, careerTransition nodes have parentId: null
✓ All project, event, action nodes have valid parentId referencing existing node
✓ No job is child of another job
✓ No education or careerTransition nodes have parents
✓ Every parentId references an existing node id in the array
✓ Dates progress chronologically
✓ Use EXACT type values: education, job, careerTransition, project, event, action

Be specific and realistic for ${roleType} role.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
        max_tokens: 2000,
      });

      const content = response.choices[0]?.message?.content || '{}';

      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON object found in response');
      }

      const profileData = JSON.parse(jsonMatch[0]) as { interest: string; timelineNodes: TimelineNode[] };
      let nodes = profileData.timelineNodes || [];

      // Validate and fix node types
      nodes = nodes.map(node => ({
        ...node,
        id: node.id || uuidv4(),
        type: this.normalizeNodeType(node.type),
      }));

      // Validate hierarchy
      const hierarchyNodes = this.convertToHierarchy(nodes);
      const validation = validateHierarchy(hierarchyNodes);

      if (!validation.valid) {
        console.warn('⚠️ Hierarchy validation issues:', validation.errors);
        // Attempt to fix common issues
        nodes = this.fixHierarchyIssues(nodes);
      }

      return {
        timelineNodes: nodes,
        interest: profileData.interest || this.getDefaultInterest(roleType)
      };
    } catch (error) {
      console.error('❌ Error generating profile:', error);
      throw error;
    }
  }

  /**
   * Normalize node types from various formats
   */
  private normalizeNodeType(type: string): TimelineNodeType {
    const normalized = type.toLowerCase().replace(/[^a-z]/g, '');

    // Handle common variations
    const typeMap: Record<string, TimelineNodeType> = {
      'education': TimelineNodeType.Education,
      'job': TimelineNodeType.Job,
      'project': TimelineNodeType.Project,
      'projects': TimelineNodeType.Project,
      'workproject': TimelineNodeType.Project,
      'workprojects': TimelineNodeType.Project,
      'event': TimelineNodeType.Event,
      'events': TimelineNodeType.Event,
      'action': TimelineNodeType.Action,
      'actions': TimelineNodeType.Action,
      'careertransition': TimelineNodeType.CareerTransition,
      'transition': TimelineNodeType.CareerTransition,
    };

    return typeMap[normalized] || TimelineNodeType.Event;
  }

  /**
   * Convert flat node list to hierarchy for validation
   */
  private convertToHierarchy(nodes: TimelineNode[]): NodeHierarchy[] {
    const nodeMap = new Map<string, NodeHierarchy>();
    const rootNodes: NodeHierarchy[] = [];

    // First pass: create all nodes
    for (const node of nodes) {
      nodeMap.set(node.id, {
        id: node.id,
        type: node.type,
        parentId: node.parentId,
        children: [],
      });
    }

    // Second pass: build hierarchy
    for (const node of nodes) {
      const hierarchyNode = nodeMap.get(node.id)!;

      if (node.parentId) {
        const parent = nodeMap.get(node.parentId);
        if (parent) {
          parent.children = parent.children || [];
          parent.children.push(hierarchyNode);
        } else {
          // Parent doesn't exist, make it a root node
          hierarchyNode.parentId = undefined;
          rootNodes.push(hierarchyNode);
        }
      } else {
        rootNodes.push(hierarchyNode);
      }
    }

    return rootNodes;
  }

  /**
   * Fix common hierarchy issues
   */
  private fixHierarchyIssues(nodes: TimelineNode[]): TimelineNode[] {
    const fixed: TimelineNode[] = [];
    const rootNodeIds = new Set<string>();

    // First, identify valid root nodes
    for (const node of nodes) {
      if (!node.parentId && ROOT_ONLY_NODES.has(node.type)) {
        fixed.push(node);
        rootNodeIds.add(node.id);
      }
    }

    // If no valid root nodes, create a default job
    if (rootNodeIds.size === 0) {
      const defaultJob: TimelineNode = {
        id: uuidv4(),
        type: TimelineNodeType.Job,
        title: 'Current Position',
        description: 'Current professional role',
        startDate: '2024-01',
        meta: {},
      };
      fixed.push(defaultJob);
      rootNodeIds.add(defaultJob.id);
    }

    // Now add child nodes with valid parents
    for (const node of nodes) {
      if (node.parentId && !fixed.find(n => n.id === node.id)) {
        // Check if parent exists and allows this child type
        const parent = nodes.find(n => n.id === node.parentId);
        if (parent) {
          const validChildren = getValidChildTypes(parent.type);
          if (validChildren.includes(node.type)) {
            fixed.push(node);
          } else {
            // Invalid child type, skip or reassign
            console.log(`⚠️ Skipping invalid child: ${node.type} under ${parent.type}`);
          }
        }
      }
    }

    return fixed;
  }

  /**
   * Get default interest based on role type
   */
  private getDefaultInterest(roleType: RoleType): string {
    const interests = {
      engineer: 'Building scalable systems and solving complex technical challenges',
      pm: 'Product strategy and user experience optimization',
      designer: 'Creating intuitive and beautiful user interfaces'
    };
    return interests[roleType];
  }


  /**
   * Generate insights for timeline nodes
   */
  private async generateInsights(nodes: TimelineNode[]): Promise<Insight[]> {
    const insights: Insight[] = [];

    // Select more nodes for insights to create richer learning content
    const jobNodes = nodes.filter(n => n.type === TimelineNodeType.Job);
    const projectNodes = nodes.filter(n => n.type === TimelineNodeType.Project);
    const eventNodes = nodes.filter(n => n.type === TimelineNodeType.Event);
    const actionNodes = nodes.filter(n => n.type === TimelineNodeType.Action).slice(0, 2);
    const transitionNodes = nodes.filter(n => n.type === TimelineNodeType.CareerTransition);

    // Generate multiple insights per significant node type
    const keyNodes = [...jobNodes, ...projectNodes, ...eventNodes, ...actionNodes, ...transitionNodes];

    for (const node of keyNodes) {
      // Customize the prompt based on node type for more relevant insights
      const nodeTypeContext = {
        [TimelineNodeType.Job]: "job experience and professional growth",
        [TimelineNodeType.Project]: "project management and execution",
        [TimelineNodeType.Event]: "professional development and learning opportunity",
        [TimelineNodeType.Action]: "specific action or implementation",
        [TimelineNodeType.CareerTransition]: "career change and transition strategy"
      };

      const context = nodeTypeContext[node.type] || "professional experience";

      const prompt = `Generate a career insight that would be valuable advice for other professionals based on this ${context}:
${node.title}: ${node.description}

Create a JSON object with:
{
  "description": "Exactly 2 sentences of practical advice that other professionals could benefit from. Focus on one specific learning, challenge overcome, or strategy used that would help others in similar situations.",
  "resources": ["Book title", "Online course", "Tool/framework", "Community/platform", "Article/blog"]
}

Keep it concise - exactly 2 sentences with actionable, specific insights. Include 3-5 diverse resources. Return ONLY valid JSON.`;

      try {
        const response = await this.openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 200,
        });

        const content = response.choices[0]?.message?.content || '{}';
        const jsonMatch = content.match(/\{[\s\S]*\}/);

        if (jsonMatch) {
          const insightData = JSON.parse(jsonMatch[0]);
          insights.push({
            id: uuidv4(),
            nodeId: node.id,
            description: insightData.description || 'Key learning experience',
            resources: insightData.resources || [],
          });
        }
      } catch (error) {
        console.warn('⚠️ Could not generate insight for node:', node.id, error);
      }
    }

    return insights;
  }

  /**
   * Save profile to JSON file
   */
  async saveProfile(profile: CareerProfile): Promise<void> {
    const filename = `profile-${profile.userId}.json`;
    const filepath = path.join(this.outputDir, filename);

    await fs.writeFile(
      filepath,
      JSON.stringify(profile, null, 2),
      'utf-8'
    );

    console.log(`✅ Saved profile: ${filename}`);
  }

  /**
   * Generate multiple profiles based on diversity matrix
   */
  async generateProfiles(count: number, roleFilter?: RoleType): Promise<void> {
    await this.initialize();

    console.log(`\n🚀 Generating ${count} career profiles...\n`);

    // Track profile index for name diversity
    let profileIndex = 0;
    let userId = 1000;

    // For small counts, ensure we generate at least the requested number
    if (count <= 10) {
      // Simple distribution for small counts
      const roles: RoleType[] = roleFilter ? [roleFilter] : ['engineer', 'pm', 'designer'];
      const levels: ExperienceLevel[] = ['junior', 'mid', 'senior', 'staff'];

      for (let i = 0; i < count; i++) {
        const role = roles[i % roles.length];
        const level = levels[Math.floor(i / roles.length) % levels.length];

        const roleConfig = ROLE_DISTRIBUTIONS.find(r => r.role === role);

        try {
          const profile = await this.generateProfile(
            String(userId++),
            role,
            level,
            profileIndex++
          );

          await this.saveProfile(profile);

          // Add small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`❌ Failed to generate profile ${userId}:`, error);
        }
      }
    } else {
      // Use distribution for larger counts
      for (const roleConfig of ROLE_DISTRIBUTIONS) {
        if (roleFilter && roleConfig.role !== roleFilter) {
          continue;
        }

        const roleCount = Math.max(1, Math.round((count * roleConfig.percentage) / 100));

        for (const levelConfig of roleConfig.experienceLevels) {
          const levelCount = Math.max(1, Math.round((roleCount * levelConfig.percentage) / 100));

          for (let i = 0; i < levelCount; i++) {
            if (profileIndex >= count) break;

            try {
              const profile = await this.generateProfile(
                String(userId++),
                roleConfig.role as RoleType,
                levelConfig.level as ExperienceLevel,
                profileIndex++
              );

              await this.saveProfile(profile);

              // Add small delay to avoid rate limiting
              await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
              console.error(`❌ Failed to generate profile ${userId}:`, error);
            }
          }
        }
      }
    }

    console.log(`\n✅ Generated ${profileIndex} profiles successfully!`);
    console.log(`📁 Profiles saved to: ${this.outputDir}`);
  }
}

// CLI execution
async function main() {
  const args = process.argv.slice(2);
  const countIndex = args.indexOf('--count');
  const roleIndex = args.indexOf('--role');

  const count = countIndex !== -1 ? parseInt(args[countIndex + 1]) : 5;
  const role = roleIndex !== -1 ? args[roleIndex + 1] as RoleType : undefined;

  if (isNaN(count) || count < 1) {
    console.error('❌ Invalid count. Please provide a positive number.');
    process.exit(1);
  }

  const generator = new ProfileGenerator();

  try {
    await generator.generateProfiles(count, role);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run if executed directly
main().catch(console.error);
