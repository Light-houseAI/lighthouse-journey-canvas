import {
  bigint,
  boolean,
  doublePrecision,
  integer,
  json,
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
  OrganizationType,
  OrgMemberRole,
  PermissionAction,
  PolicyEffect,
  SubjectType,
  TimelineNodeType,
  VisibilityLevel,
} from './enums';
import {
  TimelineNodeMetaType,
  OrganizationMetadataType,
  NodeInsightResourcesType,
  GraphRAGChunkMetaType,
  GraphRAGEdgeMetaType,
} from './json-schemas';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  userName: text('user_name').unique(),
  interest: text('interest'),
  hasCompletedOnboarding: boolean('has_completed_onboarding').default(false),
  createdAt: timestamp('created_at', { withTimezone: false }).notNull().defaultNow(),
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
  // Meta field is required and must be set when creating a node
  // No default value as it depends on the node type
  meta: json('meta').$type<TimelineNodeMetaType>().notNull(),
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
  resources: json('resources').$type<NodeInsightResourcesType>().default([]), // Array of resource objects with URLs and metadata
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

// Organizations table
export const organizations = pgTable('organizations', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  type: organizationTypeEnum('type').notNull(),
  metadata: json('metadata').$type<OrganizationMetadataType>().default({}),
  createdAt: timestamp('created_at', { withTimezone: false }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: false }).notNull().defaultNow(),
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
    joinedAt: timestamp('joined_at', { withTimezone: false }).notNull().defaultNow(),
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
  createdAt: timestamp('created_at', { withTimezone: false }).notNull().defaultNow(),
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
  createdAt: timestamp('created_at', { withTimezone: false }).notNull().defaultNow(),
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
  nodeId: uuid('node_id').references(() => timelineNodes.id, { onDelete: 'cascade' }), // Can be null for user-level chunks without specific node
  chunkText: text('chunk_text').notNull(),
  embedding: vector('embedding', { dimensions: 1536 }).notNull(), // OpenAI text-embedding-3-small dimension
  nodeType: varchar('node_type', { length: 50 }).notNull(),
  meta: json('meta').$type<GraphRAGChunkMetaType>().default({}),
  tenantId: varchar('tenant_id', { length: 100 }).default('default'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
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
  meta: json('meta').$type<GraphRAGEdgeMetaType>().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});



