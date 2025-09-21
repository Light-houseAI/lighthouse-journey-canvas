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
