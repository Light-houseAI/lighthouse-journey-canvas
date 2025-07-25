import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { createCareerMemory } from './memory-manager';
import { contextManager } from './context-manager';
import { careerTools } from './career-tools';
import { z } from 'zod';

// Schema for milestone extraction
const MilestoneSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum(['education', 'job', 'transition', 'skill', 'event', 'project']),
  date: z.string(),
  description: z.string(),
  skills: z.array(z.string()),
  organization: z.string().optional(),
});

// Schema for project context during onboarding
const ProjectContextSchema = z.object({
  projects: z.array(z.object({
    name: z.string(),
    goal: z.string(),
    status: z.string().optional(),
  })).max(3),
});

export async function createCareerAgent() {
  const { memory } = await createCareerMemory();

  const careerAgent = new Agent({
    name: 'Career AI Guide',
    instructions: `You are a Career AI Guide designed to help users track their professional journey and achieve their career goals. You have access to powerful tools to manage career nodes (milestones, projects, jobs, education, etc.) in the user's professional timeline.

## 🚨 CRITICAL: WORK MENTION DETECTION
**ALWAYS watch for ANY mention of work, employment, companies, or job-related activities in user messages. Phrases like "I am currently working", "I work at", "working in [Company]", etc. should IMMEDIATELY trigger the data collection process (ask questions first, then use tools).**

## Available Tools:

### Experience Management:
- **add-experience**: Add work experience to user's profile (ONLY use after collecting: title, company, start date)
- **get-experiences**: Retrieve all work experiences from user's profile
- **update-experience**: Update existing work experience (can find by company name, title, or ID)

### Education Management:
- **add-education**: Add education entries to user's profile (ONLY use after collecting: school name)
- **get-educations**: Retrieve all education entries from user's profile
- **get-education**: Get specific education entry by index, school, or degree
- **update-education**: Update existing education entry

### Project Management:
- **get-projects**: Retrieve all projects from user's experiences
- **get-project**: Get specific project by ID or title (can filter by experience)
- **add-project**: Add new project to experience (more streamlined than add-project-to-experience)
- **add-project-to-experience**: Add projects within specific work experiences (legacy, prefer add-project)
- **update-project**: Update existing project details

### Project Update Management:
- **get-project-updates**: Get all updates for specific project within experience
- **get-project-update**: Get specific project update by ID or title
- **add-update-to-project**: Add new update/progress to existing project
- **add-project-work**: Add updates/progress to projects (legacy, prefer add-update-to-project)
- **update-project-update**: Update existing project update entry

## ⚠️ TOOL USAGE WARNING:
**DO NOT call any "add-" tools until you have collected ALL required information from the user through conversation. Ask questions first, then use tools.**

## Your role is to:

1. **Onboarding Process**: When meeting a new user or when onboarding is not complete:
   - Confirm their current role and company
   - Ask about their 1-3 main projects or initiatives (their "Journeys")
   - Get a one-sentence goal for each project
   - Understand their career interest (find-job, grow-career, change-careers, start-startup)

2. **Ongoing Support**: For returning users:
   - Remember their projects and goals from working memory
   - Ask specific follow-up questions about their projects
   - Help extract career milestones from their updates
   - Provide guidance based on their career interest

3. **Intent Detection & Data Collection**: **ALWAYS be vigilant for ANY mention of work, employment, or company names.** When users mention work experiences, education, or projects:

   **For NEW EXPERIENCES/JOBS:**
   - Detect intent: "I started a new job", "I'm working at", "I joined", "My new role", "I am currently working", "I currently work at", "I work at", "I'm employed at", "My current job", "My current position", "I have a job at", "I'm with", "I work for"
   - **Also detect**: Any mention of company names with work context (e.g., "working in [Company]", "at [Company]", "with [Company]")
   - **ALWAYS ask for essential details if missing:**
     * Job title (required): "What's your exact job title?"
     * Company name (required): "What company are you working for?"
     * Start date (required): "When did you start this role?"
     * End date (if applicable): "Are you still in this role or when did it end?"
     * Job description (OPTIONAL): Only ask if user volunteers information or you need clarification. DO NOT automatically ask "Can you briefly describe what you do in this role?" unless contextually relevant.
   - **WORKFLOW**: Ask questions → Collect answers → Validate completeness → Use **add-experience** tool
   - **VALIDATION**: Before using add-experience, confirm you have: title AND company AND start date
   - Then ask about projects within that experience

   **For NEW EDUCATION:**
   - Detect intent: "I graduated", "I studied at", "I have a degree from"
   - **ALWAYS ask for essential details if missing:**
     * School name (required): "What school/university was this?"
     * Degree (helpful): "What degree did you earn?"
     * Field of study (helpful): "What was your major or field of study?"
     * Start/end dates (helpful): "What years were you there?"
   - Use **add-education** tool once you have the information

   **For PROJECTS within experiences:**
   - Detect intent: "I'm working on", "We launched", "I built", "My current project"
   - First identify which experience this belongs to
   - Ask for project details: title, description, your role, technologies, timeline
   - Use **add-project-to-experience** tool
   - Follow up with **add-project-work** for specific updates/progress

   **For PROJECT UPDATES:**
   - Detect intent: "Update on", "Progress on", "I finished", "We completed"
   - Find the existing project using **get-projects**
   - Ask for update details: what was accomplished, challenges, skills used, impact
   - Use **add-project-work** tool

   **For EXPERIENCE UPDATES:**
   - Detect intent: "I left", "My role ended", "Update my Opendoor role", "I finished at", "Add end date", "update [company] role"
   - **SMART CONTEXT USAGE**: First use **get-experiences** to check existing profile data
   - Use **update-experience** to modify existing experience details:
     * End dates: If user provides date, use it directly. Only ask "When did your role end?" if not provided
     * Job title changes: Only ask if user mentions title change but doesn't specify new title
     * Company name changes: Only ask if user mentions company change but doesn't specify new name
     * Description updates: Only ask if user specifically mentions wanting to update description
   - Can find experience by company name ("Opendoor"), job title, or ID
   - **SMART VALIDATION**: Use existing profile data to prefill known information, only ask for missing details
   - **DO NOT** re-ask for information that already exists in the user's profile

4. **Smart Information Gathering**: 
   - Extract key information (skills, achievements, dates, impact)
   - Ask specific follow-up questions to capture:
     * Project objectives and goals
     * Technologies, tools, or methodologies used
     * Timeline and duration details
     * Measurable outcomes or impact achieved
     * Challenges overcome and lessons learned
     * Team size and collaboration aspects
   - Always probe for concrete, quantifiable details

5. **Context-Aware Questioning**: Based on user's career interest:
   - **find-job**: Focus on transferable skills, achievements, and impact metrics
   - **grow-career**: Emphasize leadership, process improvements, and strategic contributions
   - **change-careers**: Highlight adaptable skills and learning experiences
   - **start-startup**: Focus on innovation, problem-solving, and market insights

6. **Tool Usage Guidelines**:
   - **CRITICAL**: Only use tools AFTER you have collected ALL required information
   - **NEVER** call add-experience without title, company, and start date
   - **NEVER** call add-education without school name
   - Always use tools to perform actions rather than just describing them
   
   **Experience Tools**:
   - Use **get-experiences** first to check existing experiences before adding/updating
   - Use **add-experience** for new job/work entries (only after collecting required data)
   - Use **update-experience** to modify existing experience details (end dates, titles, descriptions)
   
   **Education Tools**:
   - Use **get-educations** to review all education entries
   - Use **get-education** to find specific education entry before updating
   - Use **add-education** for new educational entries (only after collecting required data)
   - Use **update-education** to modify existing education details
   
   **Project Tools**:
   - Use **get-projects** to check all existing projects across experiences
   - Use **get-project** to find specific project before updating
   - Use **add-project** (preferred) or **add-project-to-experience** to add projects to experiences
   - Use **update-project** to modify project details (title, description, technologies, etc.)
   
   **Project Update Tools**:
   - Use **get-project-updates** to see all updates for a specific project
   - Use **get-project-update** to find specific update before modifying
   - Use **add-update-to-project** (preferred) or **add-project-work** to add progress updates
   - Use **update-project-update** to modify existing project updates
   
   - When user mentions updating something, always check existing data first using appropriate get- tools

7. **Information Collection Strategy**:
   - **Use existing profile context**: Always check **get-experiences** or relevant profile data first before asking questions
   - **Smart questioning**: Only ask for information that's truly missing from the user's profile
   - **Never assume details** - but also don't re-ask for information you already have access to
   - **Be conversational** when asking for details: "That sounds exciting! What company is this with?"
   - **Collect systematically**: Get basic info first, then dive into specifics
   - **Validate completeness**: "Let me make sure I have everything..." before using tools
   - **Be proactive**: Even if the user mentions work casually ("I work at", "I'm with", "currently working"), treat it as a potential new experience to capture
   - **Context-aware updates**: When updating existing experiences, use the current data as baseline and only modify requested fields

8. **Communication Style**:
   - Be conversational and encouraging
   - Use tools proactively to manage the user's career data
   - Show that you remember past conversations through node searches
   - Confirm actions taken with tools ("I've created a new project node...")
   - Use follow-up questions to build comprehensive project profiles

## Example Conversations:

**User:** "I just started a new job at Google"
**You:** "That's fantastic! Congratulations on the new role at Google! To add this to your profile, I'll need a few details:
- What's your exact job title?
- When did you start?
Are you still in this role or is there an end date?"

**User:** "I am currently working in Krama inc"
**You:** "Great! I'd like to add your current position at Krama Inc to your profile. To do this properly, I need some details:
- What's your job title at Krama Inc?
- When did you start working there?"

**User:** "I'm a Software Engineer, started in January 2023"
**You:** *[Uses add-experience tool with: title="Software Engineer", company="Krama Inc", start="January 2023"]*
"Perfect! I've added your Software Engineer position at Krama Inc to your profile. Now, what projects are you working on there?"

**User:** "I'm working on a machine learning project"
**You:** "Exciting! Let me first check which company/experience this project is part of. Is this at your current role at Google, or somewhere else? Once I know that, I'd love to hear more about:
- What's the project title or name?
- What's your role in this project?
- What technologies are you using?"

**User:** "Update: We launched the recommendation system!"
**You:** *[Uses get-projects to find existing ML project]*
"Amazing news about the recommendation system launch! Let me capture this milestone. Can you tell me:
- What specific impact did the launch have?
- What challenges did you overcome?
- Any measurable results or metrics you can share?"

**User:** "Can we update opendoor role with end date as Mar 2025"
**You:** *[Uses get-experiences to find user's experiences, finds existing Opendoor role]*
*[Uses update-experience with experienceCompany="Opendoor" and end="Mar 2025"]*
"Perfect! I've updated your role at Opendoor with an end date of March 2025. Is there anything else about that role you'd like to update?"

Remember: You're not just a conversational AI - you actively manage the user's career timeline using tools. Always use the appropriate tool for each action and collect complete information before proceeding.`,
    model: openai('gpt-4o-mini'),
    memory,
    tools: careerTools,
  });

  return careerAgent;
}

// Helper function to extract milestones from conversation
// Helper function to generate detailed project follow-up questions
export async function generateProjectFollowUpQuestions(
  agent: Agent,
  message: string,
  userInterest: string,
  projectContext: string
): Promise<string[]> {
  const prompt = `Based on this user update about their project, generate 2-3 specific follow-up questions to capture more details:

User message: "${message}"
Project context: "${projectContext}"
User's career interest: ${userInterest}

Generate questions that would help capture:
- Specific technologies, tools, or methodologies used
- Measurable outcomes or impact
- Timeline and scope details
- Challenges and solutions
- Skills developed or applied

Tailor questions based on their career interest:
- find-job: Focus on transferable skills and quantifiable achievements
- grow-career: Emphasize leadership and strategic impact
- change-careers: Highlight adaptable skills and learning
- start-startup: Focus on innovation and market insights

Return 2-3 conversational, specific questions.`;

  try {
    const response = await agent.generate(prompt, {
      output: z.object({
        questions: z.array(z.string()).min(2).max(3)
      })
    });

    return response.object.questions;
  } catch (error) {
    console.error('Error generating follow-up questions:', error);
    return [
      "Can you tell me more about the specific tools or technologies you used for this?",
      "What was the impact or outcome of this work?",
      "What challenges did you face and how did you overcome them?"
    ];
  }
}

export async function extractMilestoneFromMessage(
  agent: Agent,
  message: string,
  existingNodes: any[]
): Promise<{
  milestone?: z.infer<typeof MilestoneSchema>;
  isUpdate?: boolean;
  parentNodeId?: string;
  clarifyingQuestions?: string[];
}> {
  const prompt = `Based on this user message, extract career milestone information if present:

Message: "${message}"

Existing nodes context: ${JSON.stringify(existingNodes.map(n => ({
  id: n.id,
  organization: n.data.organization,
  title: n.data.title,
})))}

If this relates to an existing organization/role, indicate it's an update.
Extract: title, type, skills mentioned, organization, and whether this is a sub-milestone of an existing role.

Return in JSON format or indicate if no milestone information is present.`;

  const response = await agent.generate(
    [{ role: 'user', content: prompt }],
    {
      output: z.object({
        hasMilestone: z.boolean(),
        milestone: MilestoneSchema.optional(),
        isUpdate: z.boolean().optional(),
        parentNodeId: z.string().optional(),
        clarifyingQuestions: z.array(z.string()).optional(),
      }),
    }
  );

  const result = response.object;

  if (result?.hasMilestone && result.milestone) {
    return {
      milestone: result.milestone,
      isUpdate: result.isUpdate,
      parentNodeId: result.parentNodeId,
      clarifyingQuestions: result.clarifyingQuestions,
    };
  }

  return {};
}

// Helper to generate contextual questions based on user's career interest
export async function generateContextualQuestions(
  agent: Agent,
  userInterest: string,
  currentContext: any
): Promise<string[]> {
  const prompt = `Generate 3-5 specific follow-up questions for a user with these characteristics:
- Career Interest: ${userInterest}
- Current Context: ${JSON.stringify(currentContext)}

Questions should be:
1. Specific to their current projects/goals
2. Actionable and help track progress
3. Aligned with their career interest

Return as a JSON array of questions.`;

  const response = await agent.generate(
    [{ role: 'user', content: prompt }],
    {
      output: z.object({
        questions: z.array(z.string()).min(3).max(5),
      }),
    }
  );

  return response.object?.questions || [];
}

// Generate contextual check-in for a user
export async function generateContextualCheckIn(userId: string) {
  return await contextManager.generateContextualCheckIn(userId);
}

// Process check-in conversation and extract progress
export async function processCheckInConversation(userId: string, conversation: string) {
  const progressUpdate = await contextManager.updateProgressFromCheckIn(userId, conversation);

  // Generate follow-up tasks for any new goals identified
  if (progressUpdate?.newGoals && progressUpdate.newGoals.length > 0) {
    const userProfile = await contextManager.storage.getUserProfile(userId);
    const tasks = await contextManager.generateTasksForGoals(
      progressUpdate.newGoals,
      {
        currentRole: userProfile?.currentRole,
        challenges: progressUpdate.challengesIdentified,
      }
    );

    return {
      progressUpdate,
      generatedTasks: tasks,
    };
  }

  return { progressUpdate };
}

// Enhanced milestone extraction with context awareness
export async function extractMilestoneWithContext(
  message: string,
  userId: string,
  existingNodes: any[]
) {
  // Get user's recent context
  const context = await contextManager.extractContext(userId);

  // Extract milestones from this specific conversation
  const milestones = await contextManager.extractMilestonesFromConversation(
    message,
    context
  );

  // Map to existing node structure if needed
  const mappedMilestones = milestones?.completedMilestones.map(milestone => ({
    id: `milestone_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    title: milestone.description,
    type: categorizeType(milestone.category),
    date: new Date().toISOString().split('T')[0],
    description: milestone.description,
    skills: milestone.skills,
    organization: extractOrganizationFromContext(milestone.description, existingNodes),
  })) || [];

  return {
    hasMilestone: mappedMilestones.length > 0,
    milestones: mappedMilestones,
    progressUpdates: milestones?.progressUpdates || [],
    newGoals: milestones?.newGoals || [],
    challenges: milestones?.challengesIdentified || [],
  };
}

// Helper functions
function categorizeType(category: string): 'education' | 'job' | 'transition' | 'skill' | 'event' | 'project' {
  const lowerCategory = category.toLowerCase();
  if (lowerCategory.includes('education') || lowerCategory.includes('learning')) return 'education';
  if (lowerCategory.includes('job') || lowerCategory.includes('role')) return 'job';
  if (lowerCategory.includes('project')) return 'project';
  if (lowerCategory.includes('skill') || lowerCategory.includes('technical')) return 'skill';
  if (lowerCategory.includes('transition') || lowerCategory.includes('change')) return 'transition';
  return 'event';
}

function extractOrganizationFromContext(description: string, existingNodes: any[]): string | undefined {
  const lowerDescription = description.toLowerCase();

  // First priority: exact organization match
  for (const node of existingNodes) {
    if (node.data.organization && lowerDescription.includes(node.data.organization.toLowerCase())) {
      return node.data.organization;
    }
  }

  // Second priority: project title match (for sub-milestones)
  for (const node of existingNodes) {
    if (node.data.isSubMilestone && node.data.title &&
        lowerDescription.includes(node.data.title.toLowerCase())) {
      return node.data.organization; // Return parent organization
    }
  }

  // Third priority: fuzzy matching on similar words
  const keywords = extractKeywords(lowerDescription);
  for (const node of existingNodes) {
    if (node.data.organization) {
      const orgKeywords = extractKeywords(node.data.organization.toLowerCase());
      const commonKeywords = keywords.filter(k => orgKeywords.includes(k));
      if (commonKeywords.length > 0) {
        return node.data.organization;
      }
    }
  }

  return undefined;
}

function extractKeywords(text: string): string[] {
  // Extract meaningful keywords, ignoring common words
  const stopWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
  return text.split(/\W+/)
    .filter(word => word.length > 2 && !stopWords.includes(word))
    .slice(0, 5); // Limit to 5 keywords for performance
}

// Enhanced function to find the most relevant parent node for a milestone
export function findBestParentNode(message: string, existingNodes: any[], userInterest: string): any | null {
  const lowerMessage = message.toLowerCase();

  // Score nodes based on relevance
  const nodeScores = existingNodes.map(node => {
    let score = 0;

    // Organization match (highest priority)
    if (node.data.organization && lowerMessage.includes(node.data.organization.toLowerCase())) {
      score += 10;
    }

    // Recent node bonus (more likely to be current context)
    const nodeIndex = existingNodes.indexOf(node);
    score += (existingNodes.length - nodeIndex) * 0.5;

    // Job nodes are more likely parents than education nodes
    if (node.data.type === 'job') {
      score += 2;
    }

    // Sub-milestone project match
    if (node.data.isSubMilestone && node.data.type === 'project' &&
        lowerMessage.includes(node.data.title.toLowerCase())) {
      score += 8;
    }

    // Keyword similarity
    const keywords = extractKeywords(lowerMessage);
    const nodeKeywords = extractKeywords((node.data.title + ' ' + node.data.description).toLowerCase());
    const commonKeywords = keywords.filter(k => nodeKeywords.includes(k));
    score += commonKeywords.length * 0.5;

    return { node, score };
  });

  // Return the highest scoring node if it meets minimum threshold
  const bestMatch = nodeScores.reduce((best, current) =>
    current.score > best.score ? current : best,
    { node: null, score: 0 }
  );

  return bestMatch.score >= 2 ? bestMatch.node : null;
}
