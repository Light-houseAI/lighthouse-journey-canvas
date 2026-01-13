// ============================================================================
// TIMELINE NODE ENUMS
// ============================================================================

export enum TimelineNodeType {
  Job = 'job',
  Work = 'work',
  Education = 'education',
  Project = 'project',
  PersonalProject = 'personal_project',
  Event = 'event',
  Action = 'action',
  CareerTransition = 'careerTransition',
}

export enum ProjectType {
  Personal = 'personal',
  Professional = 'professional',
  Academic = 'academic',
  Freelance = 'freelance',
  OpenSource = 'open-source',
}

export enum ProjectStatus {
  Planning = 'planning',
  Active = 'active',
  Completed = 'completed',
}

export enum EventType {
  Interview = 'interview',
  Networking = 'networking',
  Conference = 'conference',
  Workshop = 'workshop',
  JobApplication = 'job-application',
  Other = 'other',
}

export enum InterviewStage {
  Applied = 'applied',
  Screening = 'screening',
  PhoneScreen = 'phone_screen',
  TechnicalRound = 'technical_round',
  Onsite = 'onsite',
  FinalRound = 'final_round',
  OfferReceived = 'offer_received',
  Rejected = 'rejected',
}

export enum InterviewStatus {
  Scheduled = 'scheduled',
  Completed = 'completed',
  Passed = 'passed',
  Failed = 'failed',
  Pending = 'pending',
  Cancelled = 'cancelled',
}

export enum ApplicationStatus {
  Applied = 'Applied',
  RecruiterScreen = 'Recruiter Screen',
  PhoneInterview = 'Phone Interview',
  TechnicalInterview = 'Technical Interview',
  OnsiteInterview = 'Onsite Interview',
  FinalInterview = 'Final Interview',
  Offer = 'Offer',
  OfferAccepted = 'Offer Accepted',
  OfferDeclined = 'Offer Declined',
  Rejected = 'Rejected',
  Withdrawn = 'Withdrawn',
  Ghosted = 'Ghosted',
}

export enum OutreachMethod {
  Referral = 'Referral',
  ColdApply = 'Cold Apply',
  RecruiterOutreach = 'Recruiter Outreach',
  JobBoard = 'Job Board',
  CompanyWebsite = 'Company Website',
  LinkedInMessage = 'LinkedIn Message',
  Other = 'Other',
}

export enum TodoStatus {
  Pending = 'pending',
  InProgress = 'in-progress',
  Completed = 'completed',
  Blocked = 'blocked',
}

// ============================================================================
// ONBOARDING TYPE ENUMS
// ============================================================================

/**
 * OnboardingType defines how a user completed their initial setup.
 * - linkedin: Legacy flow using LinkedIn profile extraction
 * - desktop: New flow using desktop app to create tracks
 */
export enum OnboardingType {
  LinkedIn = 'linkedin',
  Desktop = 'desktop',
}

// ============================================================================
// PERMISSIONS SYSTEM ENUMS
// ============================================================================

export enum VisibilityLevel {
  Overview = 'overview',
  Full = 'full',
}

export enum PermissionAction {
  View = 'view',
  Edit = 'edit',
}

export enum SubjectType {
  User = 'user',
  Organization = 'org',
  Public = 'public',
}

export enum PolicyEffect {
  Allow = 'ALLOW',
  Deny = 'DENY',
}

export enum OrganizationType {
  Company = 'company',
  EducationalInstitution = 'educational_institution',
  Other = 'other',
}

export enum OrgMemberRole {
  Member = 'member',
  Admin = 'admin',
}

// ============================================================================
// NETWORKING ACTIVITY ENUMS
// ============================================================================

export enum NetworkingType {
  ColdOutreach = 'Cold outreach',
  ReconnectedWithSomeone = 'Reconnected with someone',
  AttendedNetworkingEvent = 'Attended networking event',
  InformationalInterview = 'Informational interview',
}

// ============================================================================
// WORK TRACK ARCHETYPE ENUMS (Goal-Oriented Work Tracks)
// ============================================================================

/**
 * Work Track Archetypes define the UI template and workflow type for goal-oriented tracks.
 * These determine how the track is visualized (e.g., Pipeline View for fundraising,
 * Roadmap View for product development).
 */
export enum WorkTrackArchetype {
  /** Building products, features, or technical projects */
  BuildProduct = 'BUILD_PRODUCT',
  /** Marketing, content, user acquisition, growth initiatives */
  GrowthMarketing = 'GROWTH_MARKETING',
  /** Sales activities, fundraising, investor relations */
  SalesFundraising = 'SALES_FUNDRAISING',
  /** Operations, hiring, team building, HR activities */
  OperationsHiring = 'OPERATIONS_HIRING',
  /** Learning, skill development, certifications, courses */
  LearningDevelopment = 'LEARNING_DEVELOPMENT',
}

// ============================================================================
// TRACK TEMPLATE TYPE ENUMS (Narrative Visualization Templates)
// ============================================================================

/**
 * TrackTemplateType defines how session data is presented within a Work Track.
 * This is the "visualization style" that determines how aggregated sessions
 * are rendered to tell the story of work done.
 * 
 * Similar to Granola where transcripts (raw data) can be displayed in different
 * templates, our sessions (raw work data) can be visualized in different narrative formats.
 */
export enum TrackTemplateType {
  /**
   * Case Study Narrative - Shows progression from problem → research → solution → outcome
   * Best for: Strategy, Research, Product Management, Design, Growth experiments
   * Example: "Problem: Low conversion. Research: Analyzed competitors. Outcome: Identified key features."
   */
  CaseStudyNarrative = 'CASE_STUDY_NARRATIVE',

  /**
   * Workflow Approach - Shows high-level workflow steps and tool interactions
   * Best for: Coding, Debugging, DevOps, Building MVP, Technical implementation
   * Example: "Cursor (Drafting) → Terminal (Error) → StackOverflow (Fix) → Git (Push)"
   */
  WorkflowApproach = 'WORKFLOW_APPROACH',

  /**
   * Interview Prep / STAR Method - Focuses on skills gained and individual contribution
   * Best for: Learning, LeetCode, Certifications, Self-Study, Skill building
   * Example: "Situation: Needed to learn Rust. Task: Complete course. Action: 20 hrs study. Result: Built CLI tool."
   */
  InterviewPrep = 'INTERVIEW_PREP',

  /**
   * Pipeline View - Shows progress through stages (funnel-style)
   * Best for: Sales, Fundraising, Hiring, Deal flow
   * Example: "Lead → Contact → Pitch → Due Diligence → Term Sheet → Close"
   */
  PipelineView = 'PIPELINE_VIEW',

  /**
   * Timeline Chronicle - Simple chronological list of activities
   * Best for: General work tracking, administrative tasks, mixed activities
   * Example: Day-by-day breakdown of activities
   */
  TimelineChronicle = 'TIMELINE_CHRONICLE',
}

/**
 * Human-readable labels for Track Template Types
 */
export const TRACK_TEMPLATE_TYPE_LABELS: Record<TrackTemplateType, string> = {
  [TrackTemplateType.CaseStudyNarrative]: 'Case Study Narrative',
  [TrackTemplateType.WorkflowApproach]: 'Workflow Approach',
  [TrackTemplateType.InterviewPrep]: 'Interview Prep (STAR)',
  [TrackTemplateType.PipelineView]: 'Pipeline View',
  [TrackTemplateType.TimelineChronicle]: 'Timeline Chronicle',
};

/**
 * Descriptions for Track Template Types (for UI tooltips)
 */
export const TRACK_TEMPLATE_TYPE_DESCRIPTIONS: Record<TrackTemplateType, string> = {
  [TrackTemplateType.CaseStudyNarrative]: 'Shows progression from problem → research → solution → outcome',
  [TrackTemplateType.WorkflowApproach]: 'Displays workflow steps and tool interactions',
  [TrackTemplateType.InterviewPrep]: 'Highlights skills gained using STAR method',
  [TrackTemplateType.PipelineView]: 'Visualizes progress through pipeline stages',
  [TrackTemplateType.TimelineChronicle]: 'Chronological list of activities',
};

/**
 * Maps Work Track Archetypes to their recommended default Template Types
 */
export const ARCHETYPE_TO_DEFAULT_TEMPLATE: Record<WorkTrackArchetype, TrackTemplateType> = {
  [WorkTrackArchetype.BuildProduct]: TrackTemplateType.WorkflowApproach,
  [WorkTrackArchetype.GrowthMarketing]: TrackTemplateType.CaseStudyNarrative,
  [WorkTrackArchetype.SalesFundraising]: TrackTemplateType.PipelineView,
  [WorkTrackArchetype.OperationsHiring]: TrackTemplateType.PipelineView,
  [WorkTrackArchetype.LearningDevelopment]: TrackTemplateType.InterviewPrep,
};

/**
 * Human-readable labels for Work Track Archetypes
 */
export const WORK_TRACK_ARCHETYPE_LABELS: Record<WorkTrackArchetype, string> = {
  [WorkTrackArchetype.BuildProduct]: 'Build & Product',
  [WorkTrackArchetype.GrowthMarketing]: 'Growth & Marketing',
  [WorkTrackArchetype.SalesFundraising]: 'Sales & Fundraising',
  [WorkTrackArchetype.OperationsHiring]: 'Operations & Hiring',
  [WorkTrackArchetype.LearningDevelopment]: 'Learning & Development',
};

/**
 * Icons for Work Track Archetypes (for UI rendering)
 */
export const WORK_TRACK_ARCHETYPE_ICONS: Record<WorkTrackArchetype, string> = {
  [WorkTrackArchetype.BuildProduct]: '🛠️',
  [WorkTrackArchetype.GrowthMarketing]: '📈',
  [WorkTrackArchetype.SalesFundraising]: '💰',
  [WorkTrackArchetype.OperationsHiring]: '👥',
  [WorkTrackArchetype.LearningDevelopment]: '📚',
};

/**
 * Default descriptions for Work Track Archetypes
 */
export const WORK_TRACK_ARCHETYPE_DESCRIPTIONS: Record<WorkTrackArchetype, string> = {
  [WorkTrackArchetype.BuildProduct]: 'Building features, fixing bugs, technical implementation',
  [WorkTrackArchetype.GrowthMarketing]: 'User acquisition, content creation, marketing campaigns',
  [WorkTrackArchetype.SalesFundraising]: 'Sales pipeline, fundraising, investor meetings',
  [WorkTrackArchetype.OperationsHiring]: 'Hiring, team operations, HR processes',
  [WorkTrackArchetype.LearningDevelopment]: 'Learning new skills, courses, certifications',
};

// ============================================================================
// ACTIVITY CATEGORY ENUMS (LIG-247: Desktop Session Mapping)
// ============================================================================

/**
 * Activity Categories for classifying individual session activities.
 * These 27 categories represent common knowledge worker activities.
 * 
 * NOTE: These are now used as SECONDARY TAGS for analytics and granular tracking.
 * The PRIMARY grouping mechanism is now goal-oriented Work Tracks.
 * 
 * @deprecated for primary classification - use WorkTrackArchetype for track-level grouping
 */
export enum WorkTrackCategory {
  // Career Development (6)
  JobSearch = 'job_search',
  InterviewPrep = 'interview_prep',
  Networking = 'networking',
  CareerPlanning = 'career_planning',
  ResumePortfolio = 'resume_portfolio',
  PersonalBranding = 'personal_branding',

  // Learning & Education (5)
  OnlineCourse = 'online_course',
  CertificationStudy = 'certification_study',
  SelfStudy = 'self_study',
  SkillPractice = 'skill_practice',
  Research = 'research',

  // Current Role Work (6)
  CoreWork = 'core_work',
  Meetings = 'meetings',
  Communication = 'communication',
  CodeReview = 'code_review',
  PlanningStrategy = 'planning_strategy',
  Mentoring = 'mentoring',

  // Projects (4)
  WorkProject = 'work_project',
  SideProject = 'side_project',
  OpenSource = 'open_source',
  FreelanceWork = 'freelance_work',

  // Administrative (3)
  AdminTasks = 'admin_tasks',
  ToolSetup = 'tool_setup',
  Documentation = 'documentation',

  // Life Events (3)
  ConferenceEvent = 'conference_event',
  HealthWellness = 'health_wellness',
  GeneralBrowsing = 'general_browsing',
}

/**
 * Feedback types for RLHF learning when users correct classifications
 */
export enum SessionFeedbackType {
  CategoryChanged = 'category_changed',
  NodeChanged = 'node_changed',
  BothChanged = 'both_changed',
  Accepted = 'accepted',
  NewNodeCreated = 'new_node_created',
}

/**
 * Session mapping action types
 */
export enum SessionMappingAction {
  MatchedExisting = 'matched_existing',
  CreatedNew = 'created_new',
  UserSelected = 'user_selected',
}

// ============================================================================
// USER FEEDBACK ENUMS (Thumbs Up/Down Feature)
// ============================================================================

/**
 * Rating type for thumbs up/down feedback
 */
export enum FeedbackRating {
  ThumbsUp = 'thumbs_up',
  ThumbsDown = 'thumbs_down',
}

/**
 * Feature types that can receive feedback
 */
export enum FeedbackFeatureType {
  /** Desktop app - Final Summary in review window */
  DesktopSummary = 'desktop_summary',
  /** Web app - Workflow Analysis panel results */
  WorkflowAnalysis = 'workflow_analysis',
  /** Web app - Top Workflow (Hierarchical) panel results */
  TopWorkflow = 'top_workflow',
  /** Web app - AI Usage Overview panel results */
  AIUsageOverview = 'ai_usage_overview',
}

// ============================================================================
// WORK TRACK CATEGORY CONSTANTS
// ============================================================================

/**
 * Human-readable labels for each work track category
 */
export const WORK_TRACK_CATEGORY_LABELS: Record<WorkTrackCategory, string> = {
  // Career Development
  [WorkTrackCategory.JobSearch]: 'Job Search',
  [WorkTrackCategory.InterviewPrep]: 'Interview Prep',
  [WorkTrackCategory.Networking]: 'Networking',
  [WorkTrackCategory.CareerPlanning]: 'Career Planning',
  [WorkTrackCategory.ResumePortfolio]: 'Resume & Portfolio',
  [WorkTrackCategory.PersonalBranding]: 'Personal Branding',

  // Learning & Education
  [WorkTrackCategory.OnlineCourse]: 'Online Course',
  [WorkTrackCategory.CertificationStudy]: 'Certification Study',
  [WorkTrackCategory.SelfStudy]: 'Self Study',
  [WorkTrackCategory.SkillPractice]: 'Skill Practice',
  [WorkTrackCategory.Research]: 'Research',

  // Current Role Work
  [WorkTrackCategory.CoreWork]: 'Core Work',
  [WorkTrackCategory.Meetings]: 'Meetings',
  [WorkTrackCategory.Communication]: 'Communication',
  [WorkTrackCategory.CodeReview]: 'Code Review',
  [WorkTrackCategory.PlanningStrategy]: 'Planning & Strategy',
  [WorkTrackCategory.Mentoring]: 'Mentoring',

  // Projects
  [WorkTrackCategory.WorkProject]: 'Work Project',
  [WorkTrackCategory.SideProject]: 'Side Project',
  [WorkTrackCategory.OpenSource]: 'Open Source',
  [WorkTrackCategory.FreelanceWork]: 'Freelance Work',

  // Administrative
  [WorkTrackCategory.AdminTasks]: 'Admin Tasks',
  [WorkTrackCategory.ToolSetup]: 'Tool Setup',
  [WorkTrackCategory.Documentation]: 'Documentation',

  // Life Events
  [WorkTrackCategory.ConferenceEvent]: 'Conference/Event',
  [WorkTrackCategory.HealthWellness]: 'Health & Wellness',
  [WorkTrackCategory.GeneralBrowsing]: 'General Browsing',
};

/**
 * Maps work track categories to timeline node types
 */
export const WORK_TRACK_CATEGORY_TO_NODE_TYPE: Record<WorkTrackCategory, TimelineNodeType> = {
  // Career Development -> CareerTransition
  [WorkTrackCategory.JobSearch]: TimelineNodeType.CareerTransition,
  [WorkTrackCategory.InterviewPrep]: TimelineNodeType.CareerTransition,
  [WorkTrackCategory.Networking]: TimelineNodeType.Event,
  [WorkTrackCategory.CareerPlanning]: TimelineNodeType.CareerTransition,
  [WorkTrackCategory.ResumePortfolio]: TimelineNodeType.CareerTransition,
  [WorkTrackCategory.PersonalBranding]: TimelineNodeType.CareerTransition,

  // Learning & Education -> Education
  [WorkTrackCategory.OnlineCourse]: TimelineNodeType.Education,
  [WorkTrackCategory.CertificationStudy]: TimelineNodeType.Education,
  [WorkTrackCategory.SelfStudy]: TimelineNodeType.Education,
  [WorkTrackCategory.SkillPractice]: TimelineNodeType.Education,
  [WorkTrackCategory.Research]: TimelineNodeType.Education,

  // Current Role Work -> Job
  [WorkTrackCategory.CoreWork]: TimelineNodeType.Job,
  [WorkTrackCategory.Meetings]: TimelineNodeType.Job,
  [WorkTrackCategory.Communication]: TimelineNodeType.Job,
  [WorkTrackCategory.CodeReview]: TimelineNodeType.Job,
  [WorkTrackCategory.PlanningStrategy]: TimelineNodeType.Job,
  [WorkTrackCategory.Mentoring]: TimelineNodeType.Job,

  // Projects -> Project
  [WorkTrackCategory.WorkProject]: TimelineNodeType.Project,
  [WorkTrackCategory.SideProject]: TimelineNodeType.Project,
  [WorkTrackCategory.OpenSource]: TimelineNodeType.Project,
  [WorkTrackCategory.FreelanceWork]: TimelineNodeType.Project,

  // Administrative -> Action
  [WorkTrackCategory.AdminTasks]: TimelineNodeType.Action,
  [WorkTrackCategory.ToolSetup]: TimelineNodeType.Action,
  [WorkTrackCategory.Documentation]: TimelineNodeType.Action,

  // Life Events -> Event/Action
  [WorkTrackCategory.ConferenceEvent]: TimelineNodeType.Event,
  [WorkTrackCategory.HealthWellness]: TimelineNodeType.Action,
  [WorkTrackCategory.GeneralBrowsing]: TimelineNodeType.Action,
};

/**
 * Category groups for UI organization
 */
export const WORK_TRACK_CATEGORY_GROUPS: Record<string, { label: string; categories: WorkTrackCategory[] }> = {
  careerDevelopment: {
    label: 'Career Development',
    categories: [
      WorkTrackCategory.JobSearch,
      WorkTrackCategory.InterviewPrep,
      WorkTrackCategory.Networking,
      WorkTrackCategory.CareerPlanning,
      WorkTrackCategory.ResumePortfolio,
      WorkTrackCategory.PersonalBranding,
    ],
  },
  learningEducation: {
    label: 'Learning & Education',
    categories: [
      WorkTrackCategory.OnlineCourse,
      WorkTrackCategory.CertificationStudy,
      WorkTrackCategory.SelfStudy,
      WorkTrackCategory.SkillPractice,
      WorkTrackCategory.Research,
    ],
  },
  currentRoleWork: {
    label: 'Current Role Work',
    categories: [
      WorkTrackCategory.CoreWork,
      WorkTrackCategory.Meetings,
      WorkTrackCategory.Communication,
      WorkTrackCategory.CodeReview,
      WorkTrackCategory.PlanningStrategy,
      WorkTrackCategory.Mentoring,
    ],
  },
  projects: {
    label: 'Projects',
    categories: [
      WorkTrackCategory.WorkProject,
      WorkTrackCategory.SideProject,
      WorkTrackCategory.OpenSource,
      WorkTrackCategory.FreelanceWork,
    ],
  },
  administrative: {
    label: 'Administrative',
    categories: [
      WorkTrackCategory.AdminTasks,
      WorkTrackCategory.ToolSetup,
      WorkTrackCategory.Documentation,
    ],
  },
  lifeEvents: {
    label: 'Life Events',
    categories: [
      WorkTrackCategory.ConferenceEvent,
      WorkTrackCategory.HealthWellness,
      WorkTrackCategory.GeneralBrowsing,
    ],
  },
};

/**
 * Classification signals for each category (keywords and app patterns)
 */
export const CATEGORY_CLASSIFICATION_SIGNALS: Record<WorkTrackCategory, { keywords: string[]; apps: string[] }> = {
  [WorkTrackCategory.JobSearch]: {
    keywords: ['job', 'apply', 'application', 'hiring', 'position', 'opportunity', 'recruiter', 'linkedin jobs'],
    apps: ['LinkedIn', 'Indeed', 'Glassdoor', 'AngelList'],
  },
  [WorkTrackCategory.InterviewPrep]: {
    keywords: ['interview', 'leetcode', 'hackerrank', 'system design', 'behavioral', 'mock interview', 'practice'],
    apps: ['LeetCode', 'HackerRank', 'Pramp', 'InterviewBit'],
  },
  [WorkTrackCategory.Networking]: {
    keywords: ['connect', 'network', 'coffee chat', 'informational', 'reach out', 'introduction'],
    apps: ['LinkedIn', 'Twitter', 'Calendly'],
  },
  [WorkTrackCategory.CareerPlanning]: {
    keywords: ['career', 'goal', 'plan', 'roadmap', 'path', 'transition', 'growth'],
    apps: ['Notion', 'Miro', 'Figma'],
  },
  [WorkTrackCategory.ResumePortfolio]: {
    keywords: ['resume', 'cv', 'portfolio', 'cover letter', 'github profile'],
    apps: ['Google Docs', 'Canva', 'Figma', 'GitHub'],
  },
  [WorkTrackCategory.PersonalBranding]: {
    keywords: ['blog', 'post', 'article', 'brand', 'presence', 'content'],
    apps: ['Medium', 'Dev.to', 'Twitter', 'LinkedIn'],
  },
  [WorkTrackCategory.OnlineCourse]: {
    keywords: ['course', 'lesson', 'module', 'lecture', 'tutorial', 'udemy', 'coursera'],
    apps: ['Udemy', 'Coursera', 'Pluralsight', 'LinkedIn Learning', 'YouTube'],
  },
  [WorkTrackCategory.CertificationStudy]: {
    keywords: ['certification', 'exam', 'aws', 'azure', 'gcp', 'certified'],
    apps: ['A Cloud Guru', 'Whizlabs', 'Exam Topics'],
  },
  [WorkTrackCategory.SelfStudy]: {
    keywords: ['learn', 'study', 'read', 'book', 'documentation', 'docs'],
    apps: ['Safari Books', 'O\'Reilly', 'MDN'],
  },
  [WorkTrackCategory.SkillPractice]: {
    keywords: ['practice', 'exercise', 'kata', 'challenge', 'drill'],
    apps: ['Codewars', 'Exercism', 'CodePen'],
  },
  [WorkTrackCategory.Research]: {
    keywords: ['research', 'explore', 'investigate', 'compare', 'evaluate', 'analyze'],
    apps: ['Google Scholar', 'arXiv', 'Stack Overflow'],
  },
  [WorkTrackCategory.CoreWork]: {
    keywords: ['work', 'task', 'ticket', 'jira', 'sprint', 'develop', 'implement', 'feature', 'bug'],
    apps: ['VS Code', 'IntelliJ', 'Jira', 'Linear'],
  },
  [WorkTrackCategory.Meetings]: {
    keywords: ['meeting', 'call', 'standup', 'sync', 'demo', 'review'],
    apps: ['Zoom', 'Google Meet', 'Teams', 'Slack Huddle'],
  },
  [WorkTrackCategory.Communication]: {
    keywords: ['email', 'message', 'slack', 'chat', 'reply', 'respond'],
    apps: ['Slack', 'Gmail', 'Outlook', 'Discord'],
  },
  [WorkTrackCategory.CodeReview]: {
    keywords: ['review', 'pr', 'pull request', 'merge', 'approve', 'comment', 'feedback'],
    apps: ['GitHub', 'GitLab', 'Bitbucket'],
  },
  [WorkTrackCategory.PlanningStrategy]: {
    keywords: ['plan', 'roadmap', 'strategy', 'architecture', 'design', 'rfc'],
    apps: ['Notion', 'Confluence', 'Miro', 'Figma'],
  },
  [WorkTrackCategory.Mentoring]: {
    keywords: ['mentor', 'coach', 'teach', 'pair', 'guide', '1:1', 'one on one'],
    apps: ['Zoom', 'Tuple', 'Slack'],
  },
  [WorkTrackCategory.WorkProject]: {
    keywords: ['project', 'build', 'ship', 'launch', 'deploy', 'release'],
    apps: ['VS Code', 'IntelliJ', 'GitHub', 'Vercel'],
  },
  [WorkTrackCategory.SideProject]: {
    keywords: ['side project', 'personal project', 'hobby', 'experiment', 'prototype'],
    apps: ['VS Code', 'GitHub', 'Vercel', 'Netlify'],
  },
  [WorkTrackCategory.OpenSource]: {
    keywords: ['open source', 'oss', 'contribute', 'contributor', 'issue', 'fork'],
    apps: ['GitHub', 'GitLab'],
  },
  [WorkTrackCategory.FreelanceWork]: {
    keywords: ['freelance', 'client', 'contract', 'invoice', 'proposal'],
    apps: ['Upwork', 'Fiverr', 'Toptal'],
  },
  [WorkTrackCategory.AdminTasks]: {
    keywords: ['admin', 'expense', 'timesheet', 'report', 'form', 'paperwork'],
    apps: ['Expensify', 'Gusto', 'Workday'],
  },
  [WorkTrackCategory.ToolSetup]: {
    keywords: ['setup', 'install', 'configure', 'environment', 'dotfiles', 'settings'],
    apps: ['Terminal', 'VS Code', 'Homebrew'],
  },
  [WorkTrackCategory.Documentation]: {
    keywords: ['document', 'readme', 'wiki', 'guide', 'tutorial', 'how-to'],
    apps: ['Notion', 'Confluence', 'Google Docs', 'GitHub'],
  },
  [WorkTrackCategory.ConferenceEvent]: {
    keywords: ['conference', 'event', 'meetup', 'talk', 'presentation', 'workshop'],
    apps: ['Eventbrite', 'Meetup', 'Hopin'],
  },
  [WorkTrackCategory.HealthWellness]: {
    keywords: ['health', 'wellness', 'break', 'exercise', 'meditation', 'walk'],
    apps: ['Headspace', 'Calm', 'Strava'],
  },
  [WorkTrackCategory.GeneralBrowsing]: {
    keywords: ['browse', 'surf', 'read', 'watch', 'scroll'],
    apps: ['Chrome', 'Safari', 'Firefox', 'YouTube', 'Reddit'],
  },
};

// ============================================================================
// ACTIVITY CATEGORY TO ARCHETYPE MAPPING
// ============================================================================

/**
 * Maps activity categories to their most likely Work Track Archetype.
 * Used for inferring archetype when creating new tracks from session activity.
 */
export const ACTIVITY_CATEGORY_TO_ARCHETYPE: Record<WorkTrackCategory, WorkTrackArchetype> = {
  // Career Development -> varies by context
  [WorkTrackCategory.JobSearch]: WorkTrackArchetype.OperationsHiring,
  [WorkTrackCategory.InterviewPrep]: WorkTrackArchetype.LearningDevelopment,
  [WorkTrackCategory.Networking]: WorkTrackArchetype.GrowthMarketing,
  [WorkTrackCategory.CareerPlanning]: WorkTrackArchetype.OperationsHiring,
  [WorkTrackCategory.ResumePortfolio]: WorkTrackArchetype.GrowthMarketing,
  [WorkTrackCategory.PersonalBranding]: WorkTrackArchetype.GrowthMarketing,

  // Learning & Education -> Learning & Development
  [WorkTrackCategory.OnlineCourse]: WorkTrackArchetype.LearningDevelopment,
  [WorkTrackCategory.CertificationStudy]: WorkTrackArchetype.LearningDevelopment,
  [WorkTrackCategory.SelfStudy]: WorkTrackArchetype.LearningDevelopment,
  [WorkTrackCategory.SkillPractice]: WorkTrackArchetype.LearningDevelopment,
  [WorkTrackCategory.Research]: WorkTrackArchetype.LearningDevelopment,

  // Current Role Work -> Build & Product
  [WorkTrackCategory.CoreWork]: WorkTrackArchetype.BuildProduct,
  [WorkTrackCategory.Meetings]: WorkTrackArchetype.OperationsHiring,
  [WorkTrackCategory.Communication]: WorkTrackArchetype.OperationsHiring,
  [WorkTrackCategory.CodeReview]: WorkTrackArchetype.BuildProduct,
  [WorkTrackCategory.PlanningStrategy]: WorkTrackArchetype.BuildProduct,
  [WorkTrackCategory.Mentoring]: WorkTrackArchetype.OperationsHiring,

  // Projects -> Build & Product
  [WorkTrackCategory.WorkProject]: WorkTrackArchetype.BuildProduct,
  [WorkTrackCategory.SideProject]: WorkTrackArchetype.BuildProduct,
  [WorkTrackCategory.OpenSource]: WorkTrackArchetype.BuildProduct,
  [WorkTrackCategory.FreelanceWork]: WorkTrackArchetype.BuildProduct,

  // Administrative -> Operations & Hiring
  [WorkTrackCategory.AdminTasks]: WorkTrackArchetype.OperationsHiring,
  [WorkTrackCategory.ToolSetup]: WorkTrackArchetype.BuildProduct,
  [WorkTrackCategory.Documentation]: WorkTrackArchetype.BuildProduct,

  // Life Events -> varies
  [WorkTrackCategory.ConferenceEvent]: WorkTrackArchetype.LearningDevelopment,
  [WorkTrackCategory.HealthWellness]: WorkTrackArchetype.OperationsHiring,
  [WorkTrackCategory.GeneralBrowsing]: WorkTrackArchetype.LearningDevelopment,
};
