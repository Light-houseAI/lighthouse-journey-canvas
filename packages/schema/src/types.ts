import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

import {
  OrganizationType,
  OrgMemberRole,
  PermissionAction,
  PolicyEffect,
  ProjectStatus,
  ProjectType,
  SubjectType,
  TimelineNodeType,
  VisibilityLevel,
} from './enums';
import {
  timelineNodeMetaSchema,
  organizationMetadataSchema,
  nodeInsightResourcesSchema,
  validateNodeMeta,
  safeValidateNodeMeta,
  TimelineNodeMetaType,
  OrganizationMetadataType,
  NodeInsightResourcesType,
} from './json-schemas';
import {
  nodeInsights,
  nodePolicies,
  organizations,
  orgMembers,
  timelineNodes,
  users,
} from './schema';

// ============================================================================
// USER VALIDATION SCHEMAS
// ============================================================================

// Drizzle schema for user insertion
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  hasCompletedOnboarding: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;

export const usernameInputSchema = z.object({
  username: z
    .string()
    .min(1, 'Username is required')
    .regex(
      /^[a-zA-Z0-9-_]+$/,
      'Username can only contain letters, numbers, hyphens, and underscores'
    ),
});

// Username validation schema for settings page
export const userNameUpdateSchema = z.object({
  userName: z
    .string()
    .min(3, 'Username must be at least 3 characters long')
    .max(30, 'Username must be less than 30 characters')
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'Username can only contain letters, numbers, underscores, and dashes'
    )
    .refine(
      (val) => !val.startsWith('-') && !val.endsWith('-'),
      'Username cannot start or end with a dash'
    )
    .optional(),
});

// Name validation schemas
export const firstNameUpdateSchema = z.object({
  firstName: z
    .string()
    .min(1, 'First name must be at least 1 character long')
    .max(50, 'First name must be less than 50 characters')
    .regex(
      /^[a-zA-Z\\s'-]+$/,
      'First name can only contain letters, spaces, hyphens, and apostrophes'
    )
    .optional(),
});

export const lastNameUpdateSchema = z.object({
  lastName: z
    .string()
    .min(1, 'Last name must be at least 1 character long')
    .max(50, 'Last name must be less than 50 characters')
    .regex(
      /^[a-zA-Z\\s'-]+$/,
      'Last name can only contain letters, spaces, hyphens, and apostrophes'
    )
    .optional(),
});

// Profile update schema
export const profileUpdateSchema = z.object({
  firstName: firstNameUpdateSchema.shape.firstName,
  lastName: lastNameUpdateSchema.shape.lastName,
  userName: userNameUpdateSchema.shape.userName,
  interest: z.string().optional(),
});

// Auth schemas
export const signUpSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
});

export const signInSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const interestSchema = z.object({
  interest: z.enum(
    ['find-job', 'grow-career', 'change-careers', 'start-startup'],
    {
      errorMap: () => ({ message: 'Please select your interest' }),
    }
  ),
});
// ============================================================================
// PROFILE DATA TYPES (Legacy - used for onboarding transformation)
// ============================================================================

// Profile experience interface for onboarding data transformation
export interface ProfileExperience {
  title: string | { name: string };
  company: string;
  location?: string;
  start?: string;
  end?: string;
  current?: boolean;
  description?: string;
  responsibilities?: string[];
  type?: string;
  projects?: any[];
}

// Profile education interface for onboarding data transformation
export interface ProfileEducation {
  school: string;
  degree?: string;
  field?: string;
  start?: string;
  end?: string;
  location?: string;
  description?: string;
}

// Complete profile data interface for onboarding data transformation
export interface ProfileData {
  name: string;
  headline?: string;
  location?: string;
  about?: string;
  avatarUrl?: string;
  experiences: ProfileExperience[];
  education: ProfileEducation[];
  skills: string[];
}

// Profile insertion schema for onboarding
export const insertProfileSchema = z.object({
  username: z.string(),
  rawData: z.custom<ProfileData>(),
  filteredData: z.custom<ProfileData>(),
});

// ============================================================================
// TIMELINE NODE VALIDATION SCHEMAS
// ============================================================================

// Node Type Enum Schema
export const nodeTypeSchema = z.nativeEnum(TimelineNodeType);

// Base Node Schema
export const baseNodeSchema = z.object({
  id: z.string().uuid(),
  type: nodeTypeSchema,
  title: z.string(),
  description: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// Parent Node Reference Schema
export const parentNodeReferenceSchema = z
  .object({
    id: z.string().uuid(),
    type: nodeTypeSchema,
    title: z.string(),
  })
  .strict();

// Project Schema
export const projectSchema = baseNodeSchema.extend({
  type: z.literal('project'),
  technologies: z.array(z.string()).optional(),
  projectType: z
    .enum(['personal', 'professional', 'academic', 'freelance', 'open-source'])
    .optional(),
});

// Action Schema (Future Implementation)
export const actionSchema = baseNodeSchema.extend({
  type: z.literal('action'),
  projects: z.array(projectSchema).optional(),
});

// Event Schema (Future Implementation)
export const eventSchema = baseNodeSchema.extend({
  type: z.literal('event'),
  location: z.string().optional(),
  projects: z.array(projectSchema).optional(),
  actions: z.array(actionSchema).optional(),
});

// Career Transition Schema (Future Implementation)
export const careerTransitionSchema = baseNodeSchema.extend({
  type: z.literal('careerTransition'),
  projects: z.array(projectSchema).optional(),
  events: z.array(eventSchema).optional(),
  actions: z.array(actionSchema).optional(),
});

// Job Schema
export const jobSchema = baseNodeSchema.extend({
  type: z.literal('job'),
  company: z.string().optional(),
  position: z.string().optional(),
  location: z.string().optional(),
  projects: z.array(projectSchema).optional(),
  events: z.array(eventSchema).optional(),
  actions: z.array(actionSchema).optional(),
});

// Education Schema
export const educationSchema = baseNodeSchema.extend({
  type: z.literal('education'),
  institution: z.string().optional(),
  degree: z.string().optional(),
  field: z.string().optional(),
  location: z.string().optional(),
  projects: z.array(projectSchema).optional(),
  events: z.array(eventSchema).optional(),
  actions: z.array(actionSchema).optional(),
});

// Union schema for any node type
export const anyNodeSchema = z.discriminatedUnion('type', [
  jobSchema,
  educationSchema,
  projectSchema,
  eventSchema,
  actionSchema,
  careerTransitionSchema,
]);

// Create DTO Schemas (for API requests) - separate schemas for each node type
export const jobCreateSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  startDate: z
    .string()
    .refine(
      (val) => !val || /^\\d{4}-\\d{2}$/.test(val),
      'Date must be in YYYY-MM format or empty'
    )
    .nullish(),
  endDate: z
    .string()
    .refine(
      (val) => !val || /^\\d{4}-\\d{2}$/.test(val),
      'Date must be in YYYY-MM format or empty'
    )
    .nullish(),
});

export const educationCreateSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  startDate: z
    .string()
    .refine(
      (val) => !val || /^\\d{4}-\\d{2}$/.test(val),
      'Date must be in YYYY-MM format or empty'
    )
    .optional(),
  endDate: z
    .string()
    .refine(
      (val) => !val || /^\\d{4}-\\d{2}$/.test(val),
      'Date must be in YYYY-MM format or empty'
    )
    .optional(),
});

export const projectCreateSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  startDate: z
    .string()
    .refine(
      (val) => !val || /^\\d{4}-\\d{2}$/.test(val),
      'Date must be in YYYY-MM format or empty'
    )
    .nullish(),
  endDate: z
    .string()
    .refine(
      (val) => !val || /^\\d{4}-\\d{2}$/.test(val),
      'Date must be in YYYY-MM format or empty'
    )
    .nullish(),
  technologies: z.array(z.string()).optional(),
  projectType: z
    .enum(['personal', 'professional', 'academic', 'freelance', 'open-source'])
    .optional(),
});

export const eventCreateSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  startDate: z
    .string()
    .refine(
      (val) => !val || /^\\d{4}-\\d{2}$/.test(val),
      'Date must be in YYYY-MM format or empty'
    )
    .nullish(),
  endDate: z
    .string()
    .refine(
      (val) => !val || /^\\d{4}-\\d{2}$/.test(val),
      'Date must be in YYYY-MM format or empty'
    )
    .nullish(),
  eventType: z.string().optional(),
  location: z.string().optional(),
  organizer: z.string().optional(),
});

export const actionCreateSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  startDate: z
    .string()
    .refine(
      (val) => !val || /^\\d{4}-\\d{2}$/.test(val),
      'Date must be in YYYY-MM format or empty'
    )
    .nullish(),
  endDate: z
    .string()
    .refine(
      (val) => !val || /^\\d{4}-\\d{2}$/.test(val),
      'Date must be in YYYY-MM format or empty'
    )
    .nullish(),
  category: z.string().optional(),
  impact: z.string().optional(),
  verification: z.string().optional(),
});

export const careerTransitionCreateSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  startDate: z
    .string()
    .refine(
      (val) => !val || /^\\d{4}-\\d{2}$/.test(val),
      'Date must be in YYYY-MM format or empty'
    )
    .nullish(),
  endDate: z
    .string()
    .refine(
      (val) => !val || /^\\d{4}-\\d{2}$/.test(val),
      'Date must be in YYYY-MM format or empty'
    )
    .nullish(),
});

// Update Schemas - separate schemas for each node type
export const jobUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  startDate: z
    .string()
    .refine(
      (val) => !val || /^\\d{4}-\\d{2}$/.test(val),
      'Date must be in YYYY-MM format or empty'
    )
    .nullish(),
  endDate: z
    .string()
    .refine(
      (val) => !val || /^\\d{4}-\\d{2}$/.test(val),
      'Date must be in YYYY-MM format or empty'
    )
    .nullish(),
});

export const educationUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  startDate: z
    .string()
    .refine(
      (val) => !val || /^\\d{4}-\\d{2}$/.test(val),
      'Date must be in YYYY-MM format or empty'
    )
    .nullish(),
  endDate: z
    .string()
    .refine(
      (val) => !val || /^\\d{4}-\\d{2}$/.test(val),
      'Date must be in YYYY-MM format or empty'
    )
    .nullish(),
});

export const projectNodeUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  startDate: z
    .string()
    .refine(
      (val) => !val || /^\\d{4}-\\d{2}$/.test(val),
      'Date must be in YYYY-MM format or empty'
    )
    .nullish(),
  endDate: z
    .string()
    .refine(
      (val) => !val || /^\\d{4}-\\d{2}$/.test(val),
      'Date must be in YYYY-MM format or empty'
    )
    .nullish(),
  technologies: z.array(z.string()).optional(),
  projectType: z
    .enum(['personal', 'professional', 'academic', 'freelance', 'open-source'])
    .optional(),
});

export const eventUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  startDate: z
    .string()
    .refine(
      (val) => !val || /^\\d{4}-\\d{2}$/.test(val),
      'Date must be in YYYY-MM format or empty'
    )
    .nullish(),
  endDate: z
    .string()
    .refine(
      (val) => !val || /^\\d{4}-\\d{2}$/.test(val),
      'Date must be in YYYY-MM format or empty'
    )
    .nullish(),
  eventType: z.string().optional(),
  location: z.string().optional(),
  organizer: z.string().optional(),
});

export const actionUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  startDate: z
    .string()
    .refine(
      (val) => !val || /^\\d{4}-\\d{2}$/.test(val),
      'Date must be in YYYY-MM format or empty'
    )
    .nullish(),
  endDate: z
    .string()
    .refine(
      (val) => !val || /^\\d{4}-\\d{2}$/.test(val),
      'Date must be in YYYY-MM format or empty'
    )
    .nullish(),
});

export const careerTransitionUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  startDate: z
    .string()
    .refine(
      (val) => !val || /^\\d{4}-\\d{2}$/.test(val),
      'Date must be in YYYY-MM format or empty'
    )
    .nullish(),
  endDate: z
    .string()
    .refine(
      (val) => !val || /^\\d{4}-\\d{2}$/.test(val),
      'Date must be in YYYY-MM format or empty'
    )
    .nullish(),
});

// ============================================================================
// NODE METADATA VALIDATION SCHEMAS
// ============================================================================

// Re-export metadata schemas from json-schemas for backward compatibility
export {
  jobMetaSchema,
  educationMetaSchema,
  projectMetaSchema,
  eventMetaSchema,
  actionMetaSchema,
  careerTransitionMetaSchema,
  timelineNodeMetaSchema as nodeMetaSchema,
} from './json-schemas';

// Zod schemas for timeline nodes with strongly typed metadata
export const createTimelineNodeSchema = z.object({
  type: z.nativeEnum(TimelineNodeType),
  parentId: z.string().uuid().optional(),
  meta: timelineNodeMetaSchema,
});

export const updateTimelineNodeSchema = z.object({
  meta: timelineNodeMetaSchema.optional(),
});

export const moveTimelineNodeSchema = z.object({
  newParentId: z.string().uuid().nullable(),
});

// ============================================================================
// INSIGHTS VALIDATION SCHEMAS
// ============================================================================

// Validation schemas for insights with strongly typed resources
export const insightCreateSchema = z.object({
  description: z
    .string()
    .min(1, 'Description is required')
    .max(2000, 'Description too long'),
  resources: nodeInsightResourcesSchema
    .max(10, 'Maximum 10 resources allowed')
    .default([]),
});

export const insightUpdateSchema = z.object({
  description: z
    .string()
    .min(1, 'Description is required')
    .max(2000, 'Description too long')
    .optional(),
  resources: nodeInsightResourcesSchema
    .max(10, 'Maximum 10 resources allowed')
    .optional(),
});

// ============================================================================
// PERMISSIONS VALIDATION SCHEMAS
// ============================================================================

// Zod validation schemas
export const organizationCreateSchema = z.object({
  name: z.string().min(1, 'Organization name is required').max(255),
  type: z.nativeEnum(OrganizationType),
  metadata: organizationMetadataSchema.default({}),
});

export const organizationUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  type: z.nativeEnum(OrganizationType).optional(),
  metadata: organizationMetadataSchema.optional(),
});

export const orgMemberCreateSchema = z.object({
  userId: z.number().int().positive(),
  role: z.nativeEnum(OrgMemberRole).default(OrgMemberRole.Member),
});

export const orgMemberUpdateSchema = z.object({
  role: z.nativeEnum(OrgMemberRole),
});

export const nodePolicyCreateSchema = z.object({
  nodeId: z.string().uuid().optional(), // Optional for backward compatibility
  level: z.nativeEnum(VisibilityLevel),
  action: z.nativeEnum(PermissionAction).default(PermissionAction.View),
  subjectType: z.nativeEnum(SubjectType),
  subjectId: z.number().int().positive().optional(),
  effect: z.nativeEnum(PolicyEffect).default(PolicyEffect.Allow),
  expiresAt: z.string().datetime().optional(),
});

export const nodePolicyUpdateSchema = z.object({
  level: z.nativeEnum(VisibilityLevel).optional(),
  action: z.nativeEnum(PermissionAction).optional(),
  effect: z.nativeEnum(PolicyEffect).optional(),
  expiresAt: z.string().datetime().optional(),
});

export const setNodePermissionsSchema = z.object({
  policies: z
    .array(nodePolicyCreateSchema)
    .max(100, 'Maximum 100 policies per request'),
});

export const accessCheckSchema = z.object({
  userId: z.number().int().positive().nullable(),
  nodeId: z.string().uuid(),
  action: z.nativeEnum(PermissionAction).default(PermissionAction.View),
  level: z.nativeEnum(VisibilityLevel).default(VisibilityLevel.Overview),
});

// ============================================================================
// TYPESCRIPT TYPE EXPORTS
// ============================================================================

// User types
export type UsernameInput = z.infer<typeof usernameInputSchema>;
export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;
export type SignUp = z.infer<typeof signUpSchema>;
export type SignIn = z.infer<typeof signInSchema>;
export type Interest = z.infer<typeof interestSchema>;
export type User = typeof users.$inferSelect;

// Timeline Node types
export type NodeType = z.infer<typeof nodeTypeSchema>;
export type BaseNode = z.infer<typeof baseNodeSchema>;
export type Job = z.infer<typeof jobSchema>;
export type Education = z.infer<typeof educationSchema>;
export type Project = z.infer<typeof projectSchema>;
export type Event = z.infer<typeof eventSchema>;
export type Action = z.infer<typeof actionSchema>;
export type CareerTransition = z.infer<typeof careerTransitionSchema>;
export type AnyNode = z.infer<typeof anyNodeSchema>;
export type ParentNodeReference = z.infer<typeof parentNodeReferenceSchema>;

// Create/Update DTO types
export type JobCreateDTO = z.infer<typeof jobCreateSchema>;
export type JobUpdateDTO = z.infer<typeof jobUpdateSchema>;
export type EducationCreateDTO = z.infer<typeof educationCreateSchema>;
export type EducationUpdateDTO = z.infer<typeof educationUpdateSchema>;
export type ProjectCreateDTO = z.infer<typeof projectCreateSchema>;
export type ProjectUpdateDTO = z.infer<typeof projectNodeUpdateSchema>;
export type EventCreateDTO = z.infer<typeof eventCreateSchema>;
export type EventUpdateDTO = z.infer<typeof eventUpdateSchema>;
export type ActionCreateDTO = z.infer<typeof actionCreateSchema>;
export type ActionUpdateDTO = z.infer<typeof actionUpdateSchema>;
export type CareerTransitionCreateDTO = z.infer<
  typeof careerTransitionCreateSchema
>;
export type CareerTransitionUpdateDTO = z.infer<
  typeof careerTransitionUpdateSchema
>;

// Timeline node database types
export type TimelineNode = typeof timelineNodes.$inferSelect;
export type CreateTimelineNodeDTO = z.infer<typeof createTimelineNodeSchema>;
export type UpdateTimelineNodeDTO = z.infer<typeof updateTimelineNodeSchema>;
export type MoveTimelineNodeDTO = z.infer<typeof moveTimelineNodeSchema>;

// Insights types
export type NodeInsight = typeof nodeInsights.$inferSelect;
export type InsightCreateDTO = z.infer<typeof insightCreateSchema>;
export type InsightUpdateDTO = z.infer<typeof insightUpdateSchema>;

// Organization and Permission types
export type Organization = typeof organizations.$inferSelect;
export type OrganizationCreateDTO = z.infer<typeof organizationCreateSchema>;
export type OrganizationUpdateDTO = z.infer<typeof organizationUpdateSchema>;

export type OrgMember = typeof orgMembers.$inferSelect;
export type OrgMemberCreateDTO = z.infer<typeof orgMemberCreateSchema>;
export type OrgMemberUpdateDTO = z.infer<typeof orgMemberUpdateSchema>;

export type NodePolicy = typeof nodePolicies.$inferSelect;
export type NodePolicyCreateDTO = z.infer<typeof nodePolicyCreateSchema>;
export type NodePolicyUpdateDTO = z.infer<typeof nodePolicyUpdateSchema>;
export type SetNodePermissionsDTO = z.infer<typeof setNodePermissionsSchema>;
export type AccessCheckDTO = z.infer<typeof accessCheckSchema>;

// Permission response interfaces
export interface NodeAccessLevel {
  canView: boolean;
  canEdit: boolean;
  visibilityLevel: VisibilityLevel | null;
}

export interface NodeWithPermissions {
  id: string;
  overview: {
    id: string;
    type: TimelineNodeType;
    title: string;
    startDate?: string;
    endDate?: string;
    org?: {
      id: number;
      name: string;
      type: string;
    };
  };
  full?: {
    description?: string;
    meta: TimelineNodeMetaType;
    parentId?: string;
    children?: NodeWithPermissions[];
  };
  accessLevel: VisibilityLevel;
  canEdit: boolean;
  permissions?: {
    canShare: boolean;
    policies: NodePolicy[];
  };
}

export interface EffectivePermissions {
  public?: VisibilityLevel;
  organizations: Array<{ orgId: number; level: VisibilityLevel }>;
  users: Array<{ userId: number; level: VisibilityLevel }>;
}

// Enhanced TimelineNode interface that includes permission metadata
export interface TimelineNodeWithPermissions extends TimelineNode {
  permissions: {
    canView: boolean;
    canEdit: boolean;
    canShare: boolean;
    canDelete: boolean;
    accessLevel: VisibilityLevel;
    shouldShowMatches: boolean;
  };
}

// Permission presets for common use cases
export const PermissionPresets = {
  PRIVATE: [], // No policies = owner only

  PUBLIC_OVERVIEW: [
    {
      level: VisibilityLevel.Overview,
      action: PermissionAction.View,
      subjectType: SubjectType.Public,
      effect: PolicyEffect.Allow,
    },
  ],

  PUBLIC_FULL: [
    {
      level: VisibilityLevel.Overview,
      action: PermissionAction.View,
      subjectType: SubjectType.Public,
      effect: PolicyEffect.Allow,
    },
    {
      level: VisibilityLevel.Full,
      action: PermissionAction.View,
      subjectType: SubjectType.Public,
      effect: PolicyEffect.Allow,
    },
  ],

  ORG_VIEWABLE: (orgId: number) => [
    {
      level: VisibilityLevel.Overview,
      action: PermissionAction.View,
      subjectType: SubjectType.Organization,
      subjectId: orgId,
      effect: PolicyEffect.Allow,
    },
    {
      level: VisibilityLevel.Full,
      action: PermissionAction.View,
      subjectType: SubjectType.Organization,
      subjectId: orgId,
      effect: PolicyEffect.Allow,
    },
  ],
} as const;

export interface RefreshTokenRecord {
  tokenId: string;
  userId: number;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  lastUsedAt?: Date;
  revokedAt?: Date;
  ipAddress?: string;
  userAgent?: string;
}

// ============================================================================
// EXPERIENCE MATCHES SYSTEM (LIG-179)
// ============================================================================

// Experience match data returned by the backend API
export interface ExperienceMatchData {
  nodeId: string;
  userId: number;
  matchCount: number;
  matches: MatchSummary[];
  searchQuery: string;
  similarityThreshold: number;
  lastUpdated: string;
  cacheTTL: number;
}

// Summary of a matched profile or opportunity
export interface MatchSummary {
  id: string;
  name: string;
  title: string;
  company?: string;
  score: number;
  matchType: 'profile' | 'opportunity';
  previewText?: string;
}

// Props for the ViewMatchesButton component
export interface ViewMatchesButtonProps {
  node: TimelineNode;
  variant?: 'default' | 'ghost' | 'outline';
  size?: 'sm' | 'default' | 'icon';
  className?: string;
  onNavigate?: (query: string) => void;
}

// Internal state for the ViewMatchesButton component
export interface ViewMatchesButtonState {
  isLoading: boolean;
  isVisible: boolean;
  matchCount: number;
  matches: MatchSummary[];
  error?: string;
  lastFetched?: number;
}

// Request parameters for experience matches API
export interface GetExperienceMatchesParams {
  nodeId: string;
}

export interface GetExperienceMatchesQuery {
  forceRefresh?: boolean;
}

// API response schema for experience matches
export interface ExperienceMatchesResponse {
  success: boolean;
  data?: ExperienceMatchData;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
}

// Experience matches validation schemas
export const experienceMatchDataSchema = z.object({
  nodeId: z.string().uuid(),
  userId: z.number().positive(),
  matchCount: z.number().min(0).max(100),
  matches: z.array(z.object({
    id: z.string(),
    name: z.string().min(1).max(100),
    title: z.string().max(200),
    company: z.string().max(100).optional(),
    score: z.number().min(0).max(1),
    matchType: z.enum(['profile', 'opportunity']),
    previewText: z.string().max(200).optional()
  })).max(3),
  searchQuery: z.string().min(1).max(500),
  similarityThreshold: z.number().min(0).max(1),
  lastUpdated: z.string().datetime(),
  cacheTTL: z.number().positive()
});

export const matchSummarySchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  title: z.string().max(200),
  company: z.string().max(100).optional(),
  score: z.number().min(0).max(1),
  matchType: z.enum(['profile', 'opportunity']),
  previewText: z.string().max(200).optional()
});

// Current experience detection utility function type
export type IsCurrentExperienceFunction = (node: TimelineNode) => boolean;
