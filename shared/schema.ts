import {
  boolean,
  integer,
  json,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import {
  OrganizationType,
  OrgMemberRole,
  PermissionAction,
  PolicyEffect,
  SubjectType,
  TimelineNodeType,
  VisibilityLevel,
} from './enums';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  userName: text('user_name').unique(),
  interest: text('interest'),
  hasCompletedOnboarding: boolean('has_completed_onboarding').default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
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

// Organizations table
export const organizations = pgTable('organizations', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  type: organizationTypeEnum('type').notNull(),
  metadata: json('metadata').$type<Record<string, any>>().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
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
    joinedAt: timestamp('joined_at').notNull().defaultNow(),
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
  createdAt: timestamp('created_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at'),
});
