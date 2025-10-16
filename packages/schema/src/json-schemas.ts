/**
 * JSON Field Schemas - Strongly typed schemas for all JSON database columns
 * These schemas serve as the single source of truth for JSON field types
 */

import { z } from 'zod';
import {
  TimelineNodeType,
  ProjectType,
  ProjectStatus,
  OrganizationType,
  VisibilityLevel,
} from './enums';

// ============================================================================
// TIMELINE NODE META SCHEMAS (timeline_nodes.meta)
// ============================================================================

/**
 * Job node metadata schema
 */
export const jobMetaSchema = z.object({
  nodeType: z.literal(TimelineNodeType.Job),
  orgId: z.number().int().positive().describe('Organization ID'),
  role: z.string().min(1).describe('Job title or position'),
  location: z.string().optional().describe('Job location'),
  description: z.string().optional().describe('Role description'),
  responsibilities: z.array(z.string()).optional().describe('Key responsibilities'),
  achievements: z.array(z.string()).optional().describe('Notable achievements'),
  skills: z.array(z.string()).optional().describe('Skills used or developed'),
  employmentType: z.enum(['full-time', 'part-time', 'contract', 'internship', 'freelance']).optional(),
  remote: z.boolean().optional().describe('Remote position'),
}).strict();

/**
 * Education node metadata schema
 */
export const educationMetaSchema = z.object({
  nodeType: z.literal(TimelineNodeType.Education),
  orgId: z.number().int().positive().describe('Educational institution ID'),
  degree: z.string().min(1).describe('Degree type'),
  field: z.string().optional().describe('Field of study'),
  location: z.string().optional().describe('Campus location'),
  description: z.string().optional().describe('Study description'),
  gpa: z.number().min(0).max(4).optional().describe('Grade point average'),
  honors: z.array(z.string()).optional().describe('Honors and awards'),
  coursework: z.array(z.string()).optional().describe('Relevant coursework'),
  activities: z.array(z.string()).optional().describe('Extracurricular activities'),
}).strict();

/**
 * Project node metadata schema
 */
export const projectMetaSchema = z.object({
  nodeType: z.literal(TimelineNodeType.Project),
  title: z.string().min(1).describe('Project name'),
  description: z.string().optional().describe('Project description'),
  technologies: z.array(z.string()).optional().describe('Technologies used'),
  projectType: z.nativeEnum(ProjectType).optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
  teamSize: z.number().int().positive().optional().describe('Team size'),
  role: z.string().optional().describe('Role in project'),
  outcomes: z.array(z.string()).optional().describe('Project outcomes'),
  links: z.array(z.object({
    type: z.enum(['github', 'demo', 'documentation', 'website', 'other']),
    url: z.string().url(),
    label: z.string().optional(),
  })).optional().describe('Related links'),
}).strict();

/**
 * Event node metadata schema
 */
export const eventMetaSchema = z.object({
  nodeType: z.literal(TimelineNodeType.Event),
  title: z.string().min(1).describe('Event title'),
  description: z.string().optional().describe('Event description'),
  eventType: z.enum(['conference', 'certification', 'award', 'publication', 'speaking', 'training', 'other']).optional(),
  location: z.string().optional().describe('Event location'),
  organizer: z.string().optional().describe('Event organizer'),
  outcome: z.string().optional().describe('Event outcome or achievement'),
  certificate: z.object({
    id: z.string(),
    issuer: z.string(),
    url: z.string().url().optional(),
  }).optional().describe('Certificate details'),
}).strict();

/**
 * Action node metadata schema
 */
export const actionMetaSchema = z.object({
  nodeType: z.literal(TimelineNodeType.Action),
  title: z.string().min(1).describe('Action title'),
  description: z.string().optional().describe('Action description'),
  category: z.enum(['skill-development', 'networking', 'application', 'interview', 'research', 'other']).optional(),
  impact: z.enum(['high', 'medium', 'low']).optional(),
  status: z.enum(['planned', 'in-progress', 'completed', 'cancelled']).optional(),
  outcome: z.string().optional().describe('Action outcome'),
  metrics: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
}).strict();

/**
 * Career transition node metadata schema
 */
export const careerTransitionMetaSchema = z.object({
  nodeType: z.literal(TimelineNodeType.CareerTransition),
  title: z.string().min(1).describe('Transition title'),
  description: z.string().optional().describe('Transition description'),
  fromRole: z.string().optional().describe('Previous role'),
  toRole: z.string().optional().describe('New role'),
  reason: z.string().optional().describe('Reason for transition'),
  challenges: z.array(z.string()).optional().describe('Challenges faced'),
  learnings: z.array(z.string()).optional().describe('Key learnings'),
}).strict();

/**
 * Discriminated union for timeline node metadata
 * Automatically validates based on nodeType field
 */
export const timelineNodeMetaSchema = z.discriminatedUnion('nodeType', [
  jobMetaSchema,
  educationMetaSchema,
  projectMetaSchema,
  eventMetaSchema,
  actionMetaSchema,
  careerTransitionMetaSchema,
]);

// Type export for timeline node meta
export type TimelineNodeMetaType = z.infer<typeof timelineNodeMetaSchema>;

// Default values for each node type
export const DEFAULT_NODE_META: Record<TimelineNodeType, TimelineNodeMetaType> = {
  [TimelineNodeType.Job]: { nodeType: TimelineNodeType.Job, orgId: 0, role: '' },
  [TimelineNodeType.Education]: { nodeType: TimelineNodeType.Education, orgId: 0, degree: '' },
  [TimelineNodeType.Project]: { nodeType: TimelineNodeType.Project, title: '' },
  [TimelineNodeType.Event]: { nodeType: TimelineNodeType.Event, title: '' },
  [TimelineNodeType.Action]: { nodeType: TimelineNodeType.Action, title: '' },
  [TimelineNodeType.CareerTransition]: { nodeType: TimelineNodeType.CareerTransition, title: '' },
};

// ============================================================================
// ORGANIZATION METADATA SCHEMAS (organizations.metadata)
// ============================================================================

/**
 * Organization settings schema
 */
export const orgSettingsSchema = z.object({
  visibility: z.enum(['public', 'private', 'invite-only']).default('private'),
  features: z.array(z.enum(['job-board', 'alumni-network', 'mentorship', 'events'])).default([]),
  allowMemberSearch: z.boolean().default(false),
  requireApproval: z.boolean().default(true),
  autoVerifyDomains: z.array(z.string()).optional().describe('Email domains for auto-verification'),
}).strict();

/**
 * Organization branding schema
 */
export const orgBrandingSchema = z.object({
  logo: z.string().url().optional().describe('Logo URL'),
  coverImage: z.string().url().optional().describe('Cover image URL'),
  primaryColor: z.string().regex(/^#[0-9A-F]{6}$/i).optional().describe('Primary color hex'),
  secondaryColor: z.string().regex(/^#[0-9A-F]{6}$/i).optional().describe('Secondary color hex'),
  description: z.string().max(500).optional().describe('Organization description'),
  website: z.string().url().optional().describe('Organization website'),
}).strict();

/**
 * Organization contact information schema
 */
export const orgContactSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    postalCode: z.string().optional(),
  }).optional(),
  socialLinks: z.array(z.object({
    platform: z.enum(['linkedin', 'twitter', 'facebook', 'instagram', 'github', 'other']),
    url: z.string().url(),
  })).optional(),
}).strict();

/**
 * Complete organization metadata schema
 */
export const organizationMetadataSchema = z.object({
  settings: orgSettingsSchema.optional(),
  branding: orgBrandingSchema.optional(),
  contact: orgContactSchema.optional(),
  stats: z.object({
    memberCount: z.number().int().min(0).optional(),
    activeJobs: z.number().int().min(0).optional(),
    alumniCount: z.number().int().min(0).optional(),
  }).optional(),
  customFields: z.record(z.string(), z.unknown()).optional().describe('Organization-specific custom fields'),
}).strict();

// Type export for organization metadata
export type OrganizationMetadataType = z.infer<typeof organizationMetadataSchema>;

// Default organization metadata
export const DEFAULT_ORG_METADATA: OrganizationMetadataType = {
  settings: {
    visibility: 'private',
    features: [],
    allowMemberSearch: false,
    requireApproval: true,
  },
};

// ============================================================================
// NODE INSIGHTS RESOURCES SCHEMAS (node_insights.resources)
// ============================================================================

/**
 * Resource object schema
 */
export const resourceSchema = z.object({
  id: z.string().uuid().optional(),
  url: z.string().url().describe('Resource URL'),
  type: z.enum(['article', 'video', 'course', 'book', 'tool', 'documentation', 'other']).default('other'),
  title: z.string().optional().describe('Resource title'),
  description: z.string().optional().describe('Resource description'),
  author: z.string().optional().describe('Resource author or creator'),
  publishedDate: z.string().datetime().optional().describe('Publication date'),
  tags: z.array(z.string()).optional().describe('Resource tags'),
  relevanceScore: z.number().min(0).max(1).optional().describe('Relevance to the node'),
}).strict();

/**
 * Array of resources schema
 */
export const nodeInsightResourcesSchema = z.array(resourceSchema).max(20);

// Type export for node insight resources
export type NodeInsightResourcesType = z.infer<typeof nodeInsightResourcesSchema>;

// Default empty resources array
export const DEFAULT_RESOURCES: NodeInsightResourcesType = [];

// ============================================================================
// GRAPHRAG METADATA SCHEMAS
// ============================================================================

/**
 * GraphRAG chunk metadata schema
 */
export const graphRAGChunkMetaSchema = z.object({
  sourceType: z.enum(['timeline', 'profile', 'document', 'external']).optional(),
  extractedEntities: z.array(z.object({
    type: z.enum(['person', 'organization', 'skill', 'technology', 'location']),
    value: z.string(),
    confidence: z.number().min(0).max(1),
  })).optional(),
  keywords: z.array(z.string()).optional(),
  language: z.string().optional().describe('ISO language code'),
  processingMetadata: z.object({
    model: z.string().optional(),
    embeddingModel: z.string().optional(),
    chunkingStrategy: z.string().optional(),
    version: z.string().optional(),
  }).optional(),
}).strict();

// Type export for GraphRAG chunk meta
export type GraphRAGChunkMetaType = z.infer<typeof graphRAGChunkMetaSchema>;

/**
 * GraphRAG edge metadata schema
 */
export const graphRAGEdgeMetaSchema = z.object({
  relationshipType: z.enum(['hierarchical', 'temporal', 'semantic', 'causal', 'similarity']).optional(),
  confidence: z.number().min(0).max(1).optional(),
  bidirectional: z.boolean().optional(),
  properties: z.record(z.string(), z.unknown()).optional(),
}).strict();

// Type export for GraphRAG edge meta
export type GraphRAGEdgeMetaType = z.infer<typeof graphRAGEdgeMetaSchema>;

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validates timeline node metadata based on node type
 * @param nodeType The type of the timeline node
 * @param meta The metadata to validate
 * @returns Validated metadata or throws ZodError
 */
export function validateNodeMeta(nodeType: TimelineNodeType, meta: unknown): TimelineNodeMetaType {
  // Ensure meta includes the nodeType for discriminated union
  const metaWithType = { ...(meta as object), nodeType };
  return timelineNodeMetaSchema.parse(metaWithType);
}

/**
 * Safe validation that returns a result object
 * @param nodeType The type of the timeline node
 * @param meta The metadata to validate
 * @returns Success result with data or error result
 */
export function safeValidateNodeMeta(nodeType: TimelineNodeType, meta: unknown):
  { success: true; data: TimelineNodeMetaType } |
  { success: false; error: z.ZodError } {
  const metaWithType = { ...(meta as object), nodeType };
  const result = timelineNodeMetaSchema.safeParse(metaWithType);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Validates organization metadata
 */
export function validateOrgMetadata(metadata: unknown): OrganizationMetadataType {
  return organizationMetadataSchema.parse(metadata);
}

/**
 * Validates node insight resources
 */
export function validateResources(resources: unknown): NodeInsightResourcesType {
  return nodeInsightResourcesSchema.parse(resources);
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

export function isJobMeta(meta: TimelineNodeMetaType): meta is z.infer<typeof jobMetaSchema> {
  return meta.nodeType === TimelineNodeType.Job;
}

export function isEducationMeta(meta: TimelineNodeMetaType): meta is z.infer<typeof educationMetaSchema> {
  return meta.nodeType === TimelineNodeType.Education;
}

export function isProjectMeta(meta: TimelineNodeMetaType): meta is z.infer<typeof projectMetaSchema> {
  return meta.nodeType === TimelineNodeType.Project;
}

export function isEventMeta(meta: TimelineNodeMetaType): meta is z.infer<typeof eventMetaSchema> {
  return meta.nodeType === TimelineNodeType.Event;
}

export function isActionMeta(meta: TimelineNodeMetaType): meta is z.infer<typeof actionMetaSchema> {
  return meta.nodeType === TimelineNodeType.Action;
}

export function isCareerTransitionMeta(meta: TimelineNodeMetaType): meta is z.infer<typeof careerTransitionMetaSchema> {
  return meta.nodeType === TimelineNodeType.CareerTransition;
}