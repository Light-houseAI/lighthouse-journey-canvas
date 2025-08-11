import { pgTable, text, jsonb, pgEnum, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Define a Postgres enum for node types
export const nodeType = pgEnum('node_type', 
  ['Person','Role','Company','Project','Skill']);

// Nodes table with parentId referencing nodes.id
export const nodes = pgTable('nodes', {
  id: text('id').primaryKey(),
  type: nodeType('type').notNull(),
  label: text('label').notNull(),
  parentId: text('parent_id').references(() => nodes.id, { onDelete: 'set null' }),
  meta: jsonb('meta').notNull().$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

// Relationship definition for Drizzle (optional in this example)
export const nodesRelations = relations(nodes, ({ one }) => ({
  parent: one(nodes, { fields: [nodes.parentId], references: [nodes.id] }),
}));