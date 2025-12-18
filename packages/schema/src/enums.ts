// ============================================================================
// TIMELINE NODE ENUMS
// ============================================================================

export enum TimelineNodeType {
  Job = 'job',
  Education = 'education',
  Project = 'project',
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
// WORK TRACK CATEGORY ENUMS (LIG-247: Desktop Session Mapping)
// ============================================================================

/**
 * Standard work track categories for classifying desktop sessions.
 * These 27 categories represent common knowledge worker activities
 * and map to existing TimelineNodeType values.
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
