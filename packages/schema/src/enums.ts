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
