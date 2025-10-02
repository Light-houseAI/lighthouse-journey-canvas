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
