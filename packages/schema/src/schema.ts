import {
  bigint,
  boolean,
  doublePrecision,
  integer,
  json,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uuid,
  varchar,
  vector,
} from 'drizzle-orm/pg-core';
import { z } from 'zod';

import {
  EventType,
  FeedbackFeatureType,
  FeedbackRating,
  OnboardingType,
  OrganizationType,
  OrgMemberRole,
  PermissionAction,
  PolicyEffect,
  SessionFeedbackType,
  SessionMappingAction,
  SubjectType,
  TimelineNodeType,
  VisibilityLevel,
  WorkTrackCategory,
} from './enums';

// Onboarding type enum for PostgreSQL
export const onboardingTypeEnum = pgEnum('onboarding_type', [
  OnboardingType.LinkedIn,
  OnboardingType.Desktop,
]);

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  userName: text('user_name').unique(),
  interest: text('interest'),
  hasCompletedOnboarding: boolean('has_completed_onboarding').default(false),
  onboardingType: onboardingTypeEnum('onboarding_type').default(
    OnboardingType.Desktop
  ),
  createdAt: timestamp('created_at', { withTimezone: false })
    .notNull()
    .defaultNow(),
});

// User storage quota tracking for file uploads
export const userStorageUsage = pgTable('user_storage_usage', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: integer('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  bytesUsed: bigint('bytes_used', { mode: 'number' }).notNull().default(0),
  quotaBytes: bigint('quota_bytes', { mode: 'number' })
    .notNull()
    .default(104857600), // 100MB default
  createdAt: timestamp('created_at', { withTimezone: false })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: false })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// ============================================================================
// HIERARCHICAL TIMELINE SYSTEM
// ============================================================================

// Hierarchical Timeline System Schema
export const timelineNodeTypeEnum = pgEnum(
  'timeline_node_type',
  Object.values(TimelineNodeType) as [string, ...string[]]
);

export const timelineNodes: any = pgTable('timeline_nodes', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: timelineNodeTypeEnum('type').notNull(),
  parentId: uuid('parent_id').references(() => timelineNodes.id, {
    onDelete: 'set null',
  }),
  meta: json('meta').$type<Record<string, any>>().notNull().default({}),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: false })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: false })
    .notNull()
    .defaultNow(),
});

// Timeline node closure table for transitive hierarchy queries
export const timelineNodeClosure = pgTable(
  'timeline_node_closure',
  {
    ancestorId: uuid('ancestor_id')
      .notNull()
      .references(() => timelineNodes.id, { onDelete: 'cascade' }),
    descendantId: uuid('descendant_id')
      .notNull()
      .references(() => timelineNodes.id, { onDelete: 'cascade' }),
    depth: integer('depth').notNull().default(0),
  },
  (table) => [
    // Composite primary key on ancestor and descendant
    primaryKey({ columns: [table.ancestorId, table.descendantId] }),
  ]
);

// ============================================================================
// NODE INSIGHTS SYSTEM
// ============================================================================

// Node Insights table schema
export const nodeInsights = pgTable('node_insights', {
  id: uuid('id').primaryKey().defaultRandom(),
  nodeId: uuid('node_id')
    .notNull()
    .references(() => timelineNodes.id, { onDelete: 'cascade' }),
  description: text('description').notNull(),
  resources: json('resources').$type<string[]>().default([]), // Array of URL strings
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ============================================================================
// NODE PERMISSIONS SYSTEM (PRD Implementation)
// ============================================================================

// Database enums
export const organizationTypeEnum = pgEnum('organization_type', [
  OrganizationType.Company,
  OrganizationType.EducationalInstitution,
]);
export const orgMemberRoleEnum = pgEnum('org_member_role', [
  OrgMemberRole.Member,
]);

export const eventTypeEnum = pgEnum('event_type', [
  EventType.Interview,
  EventType.Networking,
  EventType.Conference,
  EventType.Workshop,
  EventType.Other,
]);

// Organizations table
export const organizations = pgTable('organizations', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  type: organizationTypeEnum('type').notNull(),
  metadata: json('metadata').$type<OrganizationMetadata>().default({}),
  createdAt: timestamp('created_at', { withTimezone: false })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: false })
    .notNull()
    .defaultNow(),
});

// ============================================================================
// JSON Field Metadata Schemas (LIG-209)
// ============================================================================

/**
 * Schema for organizations.metadata JSON field
 * Stores additional organizational information beyond core fields
 */
export const organizationMetadataSchema = z
  .object({
    website: z.string().url().optional(),
    industry: z.string().optional(),
    size: z
      .enum(['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'])
      .optional(),
    location: z.string().optional(),
    description: z.string().optional(),
    logoUrl: z.string().url().optional(),
    foundedYear: z.number().int().min(1800).max(2100).optional(),
  })
  .passthrough(); // Allow additional fields for future extensibility

export type OrganizationMetadata = z.infer<typeof organizationMetadataSchema>;

/**
 * Schema for graphrag_chunks.meta JSON field
 * Stores chunk-specific metadata extracted from timeline nodes
 */
export const graphragChunkMetaSchema = z
  .object({
    // Temporal metadata
    startDate: z.string().optional(),
    endDate: z.string().optional(),

    // Entity metadata
    company: z.string().optional(),
    role: z.string().optional(),
    title: z.string().optional(),
    location: z.string().optional(),

    // Skill/technology metadata
    skills: z.array(z.string()).optional(),
    technologies: z.array(z.string()).optional(),

    // Educational metadata
    degree: z.string().optional(),
    field: z.string().optional(),
    institution: z.string().optional(),

    // Company document metadata (for nodeType='company_document')
    documentId: z.number().optional(),
    documentType: z.enum(['pdf', 'docx']).optional(),
    pageNumber: z.number().optional(),
    sectionTitle: z.string().optional(),
    chunkIndex: z.number().optional(),
    isCompanyDoc: z.boolean().optional(),
  })
  .passthrough(); // Allow additional fields for future extensibility

export type GraphRAGChunkMeta = z.infer<typeof graphragChunkMetaSchema>;

/**
 * Schema for graphrag_edges.meta JSON field
 * Stores edge-specific metadata for relationship quality and context
 */
export const graphragEdgeMetaSchema = z
  .object({
    // Relationship quality metrics
    confidence: z.number().min(0).max(1).optional(),
    reason: z.string().optional(),

    // Temporal relationship metadata
    temporalDistance: z.number().optional(), // Distance in days between events
    temporalRelation: z
      .enum(['before', 'after', 'during', 'overlapping'])
      .optional(),

    // Semantic relationship metadata
    semanticSimilarity: z.number().min(0).max(1).optional(),
    sharedEntities: z.array(z.string()).optional(),
  })
  .passthrough(); // Allow additional fields for future extensibility

export type GraphRAGEdgeMeta = z.infer<typeof graphragEdgeMetaSchema>;

// ============================================================================

export const updates = pgTable('updates', {
  id: uuid('id').primaryKey().defaultRandom(),
  nodeId: uuid('node_id')
    .notNull()
    .references(() => timelineNodes.id, {
      onDelete: 'cascade',
    }),
  // Other notes
  notes: text('notes'),
  // Metadata - stores all activity flags (job search prep + interview activity)
  meta: json('meta').$type<Record<string, any>>().notNull().default({}),
  // Metadata
  renderedText: text('rendered_text'), // For vector DB search
  isDeleted: boolean('is_deleted').notNull().default(false),
  // LIG-207: Stage timestamps for career transition tracking
  stageStartedAt: timestamp('stage_started_at', { withTimezone: false }),
  stageEndedAt: timestamp('stage_ended_at', { withTimezone: false }),
  createdAt: timestamp('created_at', { withTimezone: false })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: false })
    .notNull()
    .defaultNow(),
});

// Organization members table
export const orgMembers = pgTable(
  'org_members',
  {
    orgId: integer('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: orgMemberRoleEnum('role').notNull().default(OrgMemberRole.Member),
    joinedAt: timestamp('joined_at', { withTimezone: false })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    primaryKey: [table.orgId, table.userId],
  })
);

export const visibilityLevelEnum = pgEnum('visibility_level', [
  VisibilityLevel.Overview,
  VisibilityLevel.Full,
]);

export const permissionActionEnum = pgEnum('permission_action', [
  PermissionAction.View,
]);

export const subjectTypeEnum = pgEnum('subject_type', [
  SubjectType.User,
  SubjectType.Organization,
  SubjectType.Public,
]);

export const policyEffectEnum = pgEnum('policy_effect', [
  PolicyEffect.Allow,
  PolicyEffect.Deny,
]);

// Node policies table
export const nodePolicies = pgTable('node_policies', {
  id: uuid('id').primaryKey().defaultRandom(),
  nodeId: uuid('node_id')
    .notNull()
    .references(() => timelineNodes.id, { onDelete: 'cascade' }),
  level: visibilityLevelEnum('level').notNull(),
  action: permissionActionEnum('action')
    .notNull()
    .default(PermissionAction.View),
  subjectType: subjectTypeEnum('subject_type').notNull(),
  subjectId: integer('subject_id'), // NULL for public, user_id or org_id otherwise
  effect: policyEffectEnum('effect').notNull().default(PolicyEffect.Allow),
  grantedBy: integer('granted_by')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: false })
    .notNull()
    .defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: false }),
});

// ============================================================================
// JWT REFRESH TOKENS
// ============================================================================

// Refresh tokens table for JWT authentication
export const refreshTokens = pgTable('refresh_tokens', {
  tokenId: uuid('token_id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: false }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: false })
    .notNull()
    .defaultNow(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: false }),
  revokedAt: timestamp('revoked_at', { withTimezone: false }),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
});
// ============================================================================
// GRAPHRAG VECTOR SEARCH SYSTEM
// ============================================================================

// GraphRAG Chunks Table
// Stores chunked content from timeline nodes for vector search
export const graphragChunks = pgTable('graphrag_chunks', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  nodeId: uuid('node_id').references(() => timelineNodes.id, {
    onDelete: 'cascade',
  }), // Can be null for user-level chunks without specific node
  chunkText: text('chunk_text').notNull(),
  embedding: vector('embedding', { dimensions: 1536 }).notNull(), // OpenAI text-embedding-3-small dimension
  nodeType: varchar('node_type', { length: 50 }).notNull(),
  meta: json('meta').$type<GraphRAGChunkMeta>().default({}),
  tenantId: varchar('tenant_id', { length: 100 }).default('default'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// GraphRAG Edges Table
// Stores relationships between chunks for graph-aware search
export const graphragEdges = pgTable('graphrag_edges', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  srcChunkId: bigint('src_chunk_id', { mode: 'number' })
    .notNull()
    .references(() => graphragChunks.id, { onDelete: 'cascade' }),
  dstChunkId: bigint('dst_chunk_id', { mode: 'number' })
    .notNull()
    .references(() => graphragChunks.id, { onDelete: 'cascade' }),
  relType: varchar('rel_type', { length: 50 }).notNull(), // 'parent_child', 'temporal', 'semantic', etc.
  weight: doublePrecision('weight').default(1.0),
  directed: boolean('directed').default(true),
  meta: json('meta').$type<GraphRAGEdgeMeta>().default({}),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// User Files Table
// Tracks all uploaded files for quota management and cleanup
export const userFiles = pgTable('user_files', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  userId: bigint('user_id', { mode: 'number' })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  storageKey: varchar('storage_key', { length: 500 }).notNull().unique(),
  filename: varchar('filename', { length: 255 }).notNull(),
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
  fileType: varchar('file_type', { length: 50 }).notNull(), // 'resume', 'cover_letter', etc.
  deletedAt: timestamp('deleted_at', { withTimezone: true }), // Soft delete timestamp
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ============================================================================
// DESKTOP SESSION MAPPING SYSTEM (LIG-247)
// ============================================================================

// Work Track Category enum for PostgreSQL
export const workTrackCategoryEnum = pgEnum(
  'work_track_category',
  Object.values(WorkTrackCategory) as [string, ...string[]]
);

// Session Feedback Type enum for PostgreSQL
export const sessionFeedbackTypeEnum = pgEnum(
  'session_feedback_type',
  Object.values(SessionFeedbackType) as [string, ...string[]]
);

// Session Mapping Action enum for PostgreSQL
export const sessionMappingActionEnum = pgEnum(
  'session_mapping_action',
  Object.values(SessionMappingAction) as [string, ...string[]]
);

/**
 * Session Mappings Table
 * Lightweight table to track session classification and node mapping.
 * Full session data (chapters, steps) is stored in node.meta.chapters.
 * This table only stores mapping metadata for classification and RLHF.
 */
export const sessionMappings = pgTable('session_mappings', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  // Desktop session reference (links to local session on desktop app)
  desktopSessionId: varchar('desktop_session_id', { length: 100 }).notNull(),

  // Classification result
  category: workTrackCategoryEnum('category').notNull(),
  categoryConfidence: doublePrecision('category_confidence'),

  // Node mapping
  nodeId: uuid('node_id').references(() => timelineNodes.id, {
    onDelete: 'set null',
  }),
  nodeMatchConfidence: doublePrecision('node_match_confidence'),
  mappingAction: sessionMappingActionEnum('mapping_action'),

  // Session metadata (denormalized for queries without fetching from node)
  workflowName: text('workflow_name'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  durationSeconds: integer('duration_seconds'),

  // Embedding for similarity search when matching future sessions
  summaryEmbedding: vector('summary_embedding', { dimensions: 1536 }),

  // High-level summary for display (from desktop app's generated summary)
  highLevelSummary: text('high_level_summary'),

  // LLM-generated title derived from highLevelSummary (when no user-defined title)
  generatedTitle: text('generated_title'),

  // User-provided notes to improve summary accuracy
  // These are additional context, goals, or details the user added
  userNotes: text('user_notes'),

  // Full AI-generated summary from Desktop-companion
  // Contains schema_version, highLevelSummary, and either:
  // - V1: chapters with granular_steps
  // - V2: workflows with semantic_steps and 4-tier classification
  summary: jsonb('summary'),

  // Screenshot-level descriptions from Gemini Vision analysis
  // Keyed by timestamp, contains description, app, and category
  // Used for granular insight generation with fine-grained activity context
  screenshotDescriptions: jsonb('screenshot_descriptions'),

  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/**
 * Session Classification Feedback Table
 * Captures user corrections for RLHF learning.
 * When users reclassify or remap sessions, we log the correction
 * to improve future classification accuracy.
 */
export const sessionClassificationFeedback = pgTable(
  'session_classification_feedback',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sessionMappingId: uuid('session_mapping_id')
      .notNull()
      .references(() => sessionMappings.id, { onDelete: 'cascade' }),

    // Original classification
    originalCategory: workTrackCategoryEnum('original_category').notNull(),
    originalNodeId: uuid('original_node_id'),

    // User correction
    correctedCategory: workTrackCategoryEnum('corrected_category'),
    correctedNodeId: uuid('corrected_node_id'),
    feedbackType: sessionFeedbackTypeEnum('feedback_type').notNull(),

    // Context for learning
    userRole: varchar('user_role', { length: 100 }), // e.g., 'software_engineer', 'product_manager'
    userReason: text('user_reason'), // Optional reason for the correction

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  }
);

// ============================================================================
// WORKFLOW SCREENSHOTS SYSTEM
// ============================================================================

/**
 * Workflow Screenshots Table
 * Stores analyzed session screenshots with vector embeddings for hybrid search.
 * Enables workflow analysis with BM25 lexical search + similarity search.
 */
export const workflowScreenshots = pgTable('workflow_screenshots', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  nodeId: varchar('node_id', { length: 255 }).notNull(),
  sessionId: varchar('session_id', { length: 255 }).notNull(),

  // Screenshot storage
  screenshotPath: text('screenshot_path').notNull(),
  cloudUrl: text('cloud_url'),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),

  // Workflow categorization
  workflowTag: varchar('workflow_tag', { length: 100 }).notNull(),

  // AI-generated content
  summary: text('summary'),
  analysis: text('analysis'),

  // Vector embedding for similarity search
  embedding: vector('embedding', { dimensions: 1536 }),

  // Additional metadata
  meta: json('meta').$type<Record<string, any>>().default({}),

  // Graph RAG references
  arangoActivityKey: varchar('arango_activity_key', { length: 255 }),
  entitiesExtracted: json('entities_extracted')
    .$type<Array<{ name: string; type: string; confidence: number }>>()
    .default([]),
  conceptsExtracted: json('concepts_extracted')
    .$type<Array<{ name: string; relevanceScore: number }>>()
    .default([]),

  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// ============================================================================
// GRAPH RAG - CONCEPT EMBEDDINGS
// ============================================================================

export const conceptEmbeddings = pgTable('concept_embeddings', {
  id: serial('id').primaryKey(),
  conceptName: varchar('concept_name', { length: 255 }).notNull().unique(),
  category: varchar('category', { length: 100 }),
  embedding: vector('embedding', { dimensions: 1536 }).notNull(),
  sourceType: varchar('source_type', { length: 50 }), // 'extracted', 'user_defined', 'system'
  frequency: integer('frequency').notNull().default(1),
  firstSeen: timestamp('first_seen', { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastSeen: timestamp('last_seen', { withTimezone: true })
    .notNull()
    .defaultNow(),
  meta: json('meta').$type<Record<string, any>>().default({}),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// ============================================================================
// GRAPH RAG - ENTITY EMBEDDINGS
// ============================================================================

export const entityEmbeddings = pgTable('entity_embeddings', {
  id: serial('id').primaryKey(),
  entityName: varchar('entity_name', { length: 255 }).notNull(),
  entityType: varchar('entity_type', { length: 100 }).notNull(), // 'technology', 'person', 'organization', 'tool'
  embedding: vector('embedding', { dimensions: 1536 }).notNull(),
  frequency: integer('frequency').notNull().default(1),
  firstSeen: timestamp('first_seen', { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastSeen: timestamp('last_seen', { withTimezone: true })
    .notNull()
    .defaultNow(),
  meta: json('meta').$type<Record<string, any>>().default({}),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// ============================================================================
// USER FEEDBACK SYSTEM (Thumbs Up/Down)
// ============================================================================

// Feedback Rating enum for PostgreSQL
export const feedbackRatingEnum = pgEnum(
  'feedback_rating',
  Object.values(FeedbackRating) as [string, ...string[]]
);

// Feedback Feature Type enum for PostgreSQL
export const feedbackFeatureTypeEnum = pgEnum(
  'feedback_feature_type',
  Object.values(FeedbackFeatureType) as [string, ...string[]]
);

/**
 * User Feedback Table
 * Stores thumbs up/down feedback for various features across desktop and web apps.
 * Supports feedback for:
 * - Desktop app: Final Summary in review window
 * - Web app: Workflow Analysis, Top Workflow, AI Usage Overview panels
 */
export const userFeedback = pgTable('user_feedback', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  // What feature is being rated
  featureType: feedbackFeatureTypeEnum('feature_type').notNull(),

  // The rating (thumbs up or thumbs down)
  rating: feedbackRatingEnum('rating').notNull(),

  // Optional comment for additional context
  comment: text('comment'),

  // Context data - stores feature-specific metadata (e.g., analysis ID, session ID, summary content)
  contextData: json('context_data').$type<Record<string, any>>().default({}),

  // Reference to the node this feedback is associated with (if applicable)
  nodeId: uuid('node_id').references(() => timelineNodes.id, {
    onDelete: 'set null',
  }),

  // For desktop app - reference to the session mapping
  sessionMappingId: uuid('session_mapping_id').references(() => sessionMappings.id, {
    onDelete: 'set null',
  }),

  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ============================================================================
// PLATFORM INSIGHT GENERATION SYSTEM
// ============================================================================

/**
 * Insight Job Status enum for PostgreSQL
 */
export const insightJobStatusEnum = pgEnum('insight_job_status', [
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled',
]);

/**
 * Platform Workflow Type enum for PostgreSQL
 */
export const platformWorkflowTypeEnum = pgEnum('platform_workflow_type', [
  'research',
  'coding',
  'documentation',
  'debugging',
  'testing',
  'design',
  'planning',
  'learning',
  'communication',
  'analysis',
  'deployment',
  'code_review',
  'market_analysis',
  'writing',
  'meeting',
  'other',
]);

/**
 * Platform Step Type enum for PostgreSQL
 */
export const platformStepTypeEnum = pgEnum('platform_step_type', [
  'search',
  'read',
  'write',
  'edit',
  'navigate',
  'copy',
  'paste',
  'review',
  'compile',
  'run',
  'debug',
  'commit',
  'deploy',
  'communicate',
  'idle',
  'other',
]);

/**
 * Role Category enum for PostgreSQL
 */
export const roleCategoryEnum = pgEnum('role_category', [
  'software_engineer',
  'product_manager',
  'designer',
  'data_scientist',
  'devops',
  'qa_engineer',
  'technical_writer',
  'manager',
  'other',
]);

/**
 * Platform Workflow Patterns Table (Anonymized cross-user data)
 * Stores anonymized workflow patterns for peer comparison in insight generation.
 * All user-identifying information is removed before storage.
 */
export const platformWorkflowPatterns = pgTable('platform_workflow_patterns', {
  id: serial('id').primaryKey(),
  workflowHash: varchar('workflow_hash', { length: 64 }).notNull(),
  workflowType: platformWorkflowTypeEnum('workflow_type').notNull(),
  roleCategory: roleCategoryEnum('role_category'),
  stepCount: integer('step_count').notNull(),
  avgDurationSeconds: integer('avg_duration_seconds').notNull(),
  occurrenceCount: integer('occurrence_count').notNull().default(1),
  efficiencyScore: numeric('efficiency_score', { precision: 5, scale: 2 }),
  stepSequence: json('step_sequence')
    .$type<Array<{
      order: number;
      type: string;
      toolCategory: string;
      avgDuration: number;
      description?: string;
    }>>()
    .notNull(),
  toolPatterns: json('tool_patterns')
    .$type<Record<string, number>>()
    .default({}),
  embedding: vector('embedding', { dimensions: 1536 }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/**
 * Platform Step Patterns Table (Anonymized step-level data)
 * Stores anonymized step patterns for fine-grained workflow comparison.
 */
export const platformStepPatterns = pgTable('platform_step_patterns', {
  id: serial('id').primaryKey(),
  stepHash: varchar('step_hash', { length: 64 }).notNull(),
  stepType: platformStepTypeEnum('step_type').notNull(),
  toolCategory: varchar('tool_category', { length: 100 }),
  avgDurationSeconds: integer('avg_duration_seconds').notNull(),
  occurrenceCount: integer('occurrence_count').notNull().default(1),
  efficiencyIndicators: json('efficiency_indicators')
    .$type<{
      contextSwitches?: number;
      idlePercentage?: number;
      reworkRate?: number;
    }>()
    .default({}),
  embedding: vector('embedding', { dimensions: 1536 }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/**
 * Insight Generation Jobs Table (Async job tracking)
 * Tracks the status and results of insight generation requests.
 * Supports async processing with progress updates and result storage.
 */
export const insightGenerationJobs = pgTable('insight_generation_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  nodeId: uuid('node_id').references(() => timelineNodes.id, {
    onDelete: 'set null',
  }),
  query: text('query').notNull(),
  status: insightJobStatusEnum('status').notNull().default('pending'),
  progress: integer('progress').default(0),
  currentStage: varchar('current_stage', { length: 100 }),
  agentStates: json('agent_states')
    .$type<{
      a1?: { status: string; output?: any };
      a2?: { status: string; output?: any };
      a3?: { status: string; output?: any };
      a4Web?: { status: string; output?: any };
      a4Company?: { status: string; output?: any };
    }>()
    .default({}),
  result: json('result').$type<Record<string, any>>(),
  errorMessage: text('error_message'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ============================================================================
// COMPANY DOCUMENTS FOR RAG
// ============================================================================

/**
 * Company Document Processing Status enum for PostgreSQL
 */
export const companyDocProcessingStatusEnum = pgEnum('company_doc_processing_status', [
  'pending',
  'processing',
  'completed',
  'failed',
]);

/**
 * Company RAG Documents Table
 * Stores metadata for uploaded company documents (PDF/DOCX) used in RAG-based insight generation.
 * Document chunks are stored in graphrag_chunks with nodeType='company_document'.
 * Note: Uses 'company_rag_documents' to avoid conflict with existing 'company_documents' table.
 */
export const companyDocuments = pgTable('company_rag_documents', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  storageKey: varchar('storage_key', { length: 500 }).notNull().unique(),
  filename: varchar('filename', { length: 255 }).notNull(),
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),

  // Processing status tracking
  processingStatus: varchar('processing_status', { length: 50 })
    .notNull()
    .default('pending'),
  processingError: text('processing_error'),
  chunkCount: integer('chunk_count').default(0),

  // Timestamps
  processedAt: timestamp('processed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// Type exports for company documents
export type CompanyDocument = typeof companyDocuments.$inferSelect;
export type InsertCompanyDocument = typeof companyDocuments.$inferInsert;
export type CompanyDocProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed';

// ============================================================================
// QUERY TRACING SYSTEM (Internal Dashboard)
// ============================================================================

/**
 * Query Trace Status enum for PostgreSQL
 */
export const queryTraceStatusEnum = pgEnum('query_trace_status', [
  'started',
  'completed',
  'failed',
]);

/**
 * Agent Trace Status enum for PostgreSQL
 */
export const agentTraceStatusEnum = pgEnum('agent_trace_status', [
  'pending',
  'running',
  'completed',
  'failed',
  'skipped',
]);

/**
 * Query Traces Table - Main trace record per query
 * Stores high-level query information and routing decisions for the internal dashboard.
 * Admin-only access with 30-day retention.
 */
export const queryTraces = pgTable('query_traces', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: uuid('job_id').references(() => insightGenerationJobs.id, {
    onDelete: 'set null',
  }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  // Query Information
  rawQuery: text('raw_query').notNull(),
  queryClassification: json('query_classification').$type<{
    scope: string;
    intent: string;
    specificity: string;
    filters: Record<string, unknown>;
    routing: {
      maxResults: number;
      agentsToRun: string[];
      includePeerComparison: boolean;
      includeWebSearch: boolean;
      includeFeatureAdoption: boolean;
      useSemanticSearch: boolean;
    };
    confidence: number;
    reasoning: string;
  }>(),

  // Routing Information
  routingDecision: json('routing_decision').$type<{
    agentsToRun: string[];
    reason: string;
    peerDataUsable: boolean;
    companyDocsAvailable: boolean;
  }>(),
  agentPath: varchar('agent_path', { length: 255 }), // e.g., "A1→A2→A3→A5"

  // Timing
  totalProcessingTimeMs: integer('total_processing_time_ms'),
  status: queryTraceStatusEnum('status').notNull().default('started'),

  // Context Metadata
  hasAttachedSessions: boolean('has_attached_sessions').default(false),
  attachedSessionCount: integer('attached_session_count').default(0),
  hasConversationMemory: boolean('has_conversation_memory').default(false),

  // Timestamps
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Agent Traces Table - Per-agent execution record
 * Stores input/output summaries and timing for each agent in the pipeline.
 */
export const agentTraces = pgTable('agent_traces', {
  id: uuid('id').primaryKey().defaultRandom(),
  queryTraceId: uuid('query_trace_id')
    .notNull()
    .references(() => queryTraces.id, { onDelete: 'cascade' }),

  // Agent Identification
  agentId: varchar('agent_id', { length: 50 }).notNull(), // A1_RETRIEVAL, A2_JUDGE, etc.
  agentName: varchar('agent_name', { length: 100 }).notNull(),
  executionOrder: integer('execution_order').notNull(),

  // Status
  status: agentTraceStatusEnum('status').notNull().default('pending'),

  // Input Summary (truncated/summarized to avoid large payloads)
  inputSummary: json('input_summary').$type<{
    stateSnapshot: {
      hasUserEvidence: boolean;
      userEvidenceWorkflowCount?: number;
      userEvidenceStepCount?: number;
      hasPeerEvidence: boolean;
      peerEvidenceWorkflowCount?: number;
      hasUserDiagnostics: boolean;
      inefficiencyCount?: number;
      opportunityCount?: number;
      efficiencyScore?: number;
    };
    relevantInputFields: string[];
  }>(),

  // Output Summary (truncated/summarized)
  outputSummary: json('output_summary').$type<{
    stateChanges: string[];
    keyMetrics: Record<string, number | string | boolean>;
    errorsEncountered: string[];
  }>(),

  // Performance
  processingTimeMs: integer('processing_time_ms'),
  llmCallCount: integer('llm_call_count').default(0),
  llmTokensUsed: integer('llm_tokens_used').default(0),
  modelUsed: varchar('model_used', { length: 100 }),

  // Quality/Retry Information
  retryCount: integer('retry_count').default(0),
  critiqueResult: json('critique_result').$type<{
    passed: boolean;
    issues: Array<{
      type: string;
      description: string;
      severity: string;
    }>;
  }>(),

  // Timestamps
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Trace Payloads Table - Large payload storage (optional)
 * Stores full input/output payloads for failed or flagged queries.
 * Separate table to manage storage costs with shorter retention.
 */
export const tracePayloads = pgTable('trace_payloads', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentTraceId: uuid('agent_trace_id')
    .notNull()
    .references(() => agentTraces.id, { onDelete: 'cascade' }),
  payloadType: varchar('payload_type', { length: 20 }).notNull(), // 'input' | 'output'
  payload: jsonb('payload').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Data Source Traces Table - External data sources queried
 * Tracks all external data sources accessed during query processing.
 */
export const dataSourceTraces = pgTable('data_source_traces', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentTraceId: uuid('agent_trace_id')
    .notNull()
    .references(() => agentTraces.id, { onDelete: 'cascade' }),

  sourceName: varchar('source_name', { length: 100 }).notNull(), // 'NLQ_Service', 'Perplexity', 'Platform_Workflows', etc.
  sourceType: varchar('source_type', { length: 50 }).notNull(), // 'database', 'api', 'embedding_search'

  // Query details
  queryDescription: text('query_description'),
  parametersUsed: json('parameters_used').$type<Record<string, unknown>>(),

  // Results
  resultCount: integer('result_count'),
  resultSummary: text('result_summary'),

  // Performance
  latencyMs: integer('latency_ms'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Type exports for query tracing
export type QueryTrace = typeof queryTraces.$inferSelect;
export type InsertQueryTrace = typeof queryTraces.$inferInsert;
export type AgentTrace = typeof agentTraces.$inferSelect;
export type InsertAgentTrace = typeof agentTraces.$inferInsert;
export type TracePayload = typeof tracePayloads.$inferSelect;
export type InsertTracePayload = typeof tracePayloads.$inferInsert;
export type DataSourceTrace = typeof dataSourceTraces.$inferSelect;
export type InsertDataSourceTrace = typeof dataSourceTraces.$inferInsert;
export type QueryTraceStatus = 'started' | 'completed' | 'failed';
export type AgentTraceStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
