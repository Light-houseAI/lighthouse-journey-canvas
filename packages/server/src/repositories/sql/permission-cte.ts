/**
 * Shared Permission CTE SQL Fragments
 *
 * Provides reusable SQL Common Table Expressions (CTEs) for permission filtering
 * across different repositories to ensure consistent permission logic.
 *
 * The permission model implements ABAC-style evaluation with precedence rules:
 * 1. DENY > ALLOW (deny takes precedence)
 * 2. Closer distance > farther distance (in hierarchy)
 * 3. More specific > less specific (user > group > org > public)
 * 4. Newer > older policies (by creation time)
 */

import { sql } from 'drizzle-orm';

export interface PermissionCTEParams {
  currentUserId: number;
  targetUserId?: number;
  level?: 'overview' | 'full';
  action?: 'view' | 'edit' | 'delete';
}

/**
 * Generates the subject keys CTE that defines user identity hierarchy
 */
export function getSubjectKeysCTE(currentUserId: number) {
  return sql`
    subject_keys AS (
      -- Define subject identities in order of specificity (user > group > org > public)
      SELECT subject_type, subject_id, specificity FROM (VALUES
        ('user'::subject_type, ${currentUserId}::integer, 3),
        ('public'::subject_type, NULL::integer, 0)
      ) AS v(subject_type, subject_id, specificity)
    )
  `;
}

/**
 * Generates the relevant policies CTE for a specific target user's nodes
 */
export function getRelevantPoliciesCTE(
  targetUserId: number,
  action: string = 'view',
  level?: string
) {
  const levelCondition = level
    ? sql`AND np.level = ${level}::visibility_level`
    : sql``;

  return sql`
    relevant_policies AS (
      -- Get all policies that could affect this user's access to target's nodes
      SELECT
        np.id,
        np.node_id,
        np.level,
        np.action,
        np.subject_type,
        np.subject_id,
        np.effect,
        np.created_at,
        tnc.depth as distance,
        sk.specificity,
        tnc.descendant_id
      FROM node_policies np
      JOIN timeline_node_closure tnc ON tnc.ancestor_id = np.node_id
      JOIN timeline_nodes tn ON tn.id = tnc.descendant_id
      JOIN subject_keys sk ON sk.subject_type = np.subject_type
        AND (sk.subject_id = np.subject_id OR (sk.subject_id IS NULL AND np.subject_id IS NULL))
      WHERE tn.user_id = ${targetUserId}
        AND np.action = ${action}::permission_action
        ${levelCondition}
        AND (np.expires_at IS NULL OR np.expires_at > NOW())
    )
  `;
}

/**
 * Generates the relevant policies CTE without target user constraint
 * Used for search scenarios where we check permissions across all users
 */
export function getRelevantPoliciesForSearchCTE(
  action: string = 'view',
  level: string = 'overview'
) {
  return sql`
    relevant_policies AS (
      -- Get all policies that could affect this user's access
      SELECT
        np.id,
        np.node_id,
        np.level,
        np.action,
        np.subject_type,
        np.subject_id,
        np.effect,
        np.created_at,
        tnc.depth as distance,
        sk.specificity,
        tnc.descendant_id
      FROM node_policies np
      JOIN timeline_node_closure tnc ON tnc.ancestor_id = np.node_id
      JOIN subject_keys sk ON sk.subject_type = np.subject_type
        AND (sk.subject_id = np.subject_id OR (sk.subject_id IS NULL AND np.subject_id IS NULL))
      WHERE np.action = ${action}::permission_action
        AND np.level = ${level}::visibility_level
        AND (np.expires_at IS NULL OR np.expires_at > NOW())
    )
  `;
}

/**
 * Generates the ranked policies CTE that applies precedence rules
 */
export function getRankedPoliciesCTE() {
  return sql`
    ranked_policies AS (
      -- Apply precedence rules: DENY > ALLOW, closer > farther, newer > older
      SELECT
        *,
        ROW_NUMBER() OVER (
          PARTITION BY descendant_id
          ORDER BY
            CASE effect WHEN 'DENY' THEN 0 ELSE 1 END, -- DENY first
            distance ASC,                                -- closer first
            specificity DESC,                           -- more specific first
            created_at DESC                             -- newer first
        ) as precedence_rank
      FROM relevant_policies
    )
  `;
}

/**
 * Generates the authorized nodes CTE for target user scenario
 */
export function getAuthorizedNodesCTE() {
  return sql`
    authorized_nodes AS (
      -- Include all descendant nodes where user has ALLOW permission
      SELECT DISTINCT tnc.descendant_id as node_id
      FROM ranked_policies rp
      JOIN timeline_node_closure tnc ON tnc.ancestor_id = rp.node_id
      WHERE rp.precedence_rank = 1 AND rp.effect = 'ALLOW'
    )
  `;
}

/**
 * Generates the authorized nodes CTE for search scenario
 * Includes both permission-based access and own nodes
 */
export function getAuthorizedNodesForSearchCTE(currentUserId: number) {
  return sql`
    authorized_nodes AS (
      -- Get nodes where user has ALLOW permission
      SELECT DISTINCT descendant_id as node_id
      FROM ranked_policies
      WHERE precedence_rank = 1 AND effect = 'ALLOW'

      UNION

      -- Also include nodes owned by the requesting user
      SELECT id as node_id
      FROM timeline_nodes
      WHERE user_id = ${currentUserId}
    )
  `;
}

/**
 * Builds complete permission filtering CTE chain for getAllNodes scenario
 * Returns a string that can be directly embedded in SQL queries
 */
export function buildPermissionCTEForGetAllNodes(
  currentUserId: number,
  targetUserId: number,
  action: string = 'view',
  level?: string
): string {
  const levelCondition = level
    ? `AND np.level = '${level}'::visibility_level`
    : '';

  return `
    WITH subject_keys AS (
      -- Define subject identities in order of specificity (user > group > org > public)
      SELECT subject_type, subject_id, specificity FROM (VALUES
        ('user'::subject_type, ${currentUserId}::integer, 3),
        ('public'::subject_type, NULL::integer, 0)
      ) AS v(subject_type, subject_id, specificity)
    ),
    relevant_policies AS (
      -- Get all policies that could affect this user's access to target's nodes
      SELECT
        np.id,
        np.node_id,
        np.level,
        np.action,
        np.subject_type,
        np.subject_id,
        np.effect,
        np.created_at,
        tnc.depth as distance,
        sk.specificity
      FROM node_policies np
      JOIN timeline_node_closure tnc ON tnc.ancestor_id = np.node_id
      JOIN timeline_nodes tn ON tn.id = tnc.descendant_id
      JOIN subject_keys sk ON sk.subject_type = np.subject_type
        AND (sk.subject_id = np.subject_id OR (sk.subject_id IS NULL AND np.subject_id IS NULL))
      WHERE tn.user_id = ${targetUserId}
        AND np.action = '${action}'::permission_action
        ${levelCondition}
        AND (np.expires_at IS NULL OR np.expires_at > NOW())
    ),
    ranked_policies AS (
      -- Apply precedence rules: DENY > ALLOW, closer > farther, newer > older
      SELECT
        *,
        ROW_NUMBER() OVER (
          PARTITION BY node_id
          ORDER BY
            CASE effect WHEN 'DENY' THEN 0 ELSE 1 END, -- DENY first
            distance ASC,                                -- closer first
            specificity DESC,                           -- more specific first
            created_at DESC                             -- newer first
        ) as precedence_rank
      FROM relevant_policies
    ),
    effective_permissions AS (
      -- Get the winning policy for each node
      SELECT node_id, effect
      FROM ranked_policies
      WHERE precedence_rank = 1
    ),
    authorized_nodes AS (
      -- Include all descendant nodes where user has ALLOW permission
      SELECT DISTINCT tnc.descendant_id as node_id
      FROM effective_permissions ep
      JOIN timeline_node_closure tnc ON tnc.ancestor_id = ep.node_id
      WHERE ep.effect = 'ALLOW'
    )
  `;
}

/**
 * Builds complete permission filtering CTE chain for search scenario
 * Returns a string that can be directly embedded in SQL queries
 */
export function buildPermissionCTEForSearch(
  currentUserId: number,
  action: string = 'view',
  level: string = 'overview'
): string {
  return `
    WITH subject_keys AS (
      -- Define subject identities in order of specificity (user > group > org > public)
      SELECT subject_type, subject_id, specificity FROM (VALUES
        ('user'::subject_type, ${currentUserId}::integer, 3),
        ('public'::subject_type, NULL::integer, 0)
      ) AS v(subject_type, subject_id, specificity)
    ),
    relevant_policies AS (
      -- Get all policies that could affect this user's access
      SELECT
        np.id,
        np.node_id,
        np.level,
        np.action,
        np.subject_type,
        np.subject_id,
        np.effect,
        np.created_at,
        tnc.depth as distance,
        sk.specificity,
        tnc.descendant_id
      FROM node_policies np
      JOIN timeline_node_closure tnc ON tnc.ancestor_id = np.node_id
      JOIN subject_keys sk ON sk.subject_type = np.subject_type
        AND (sk.subject_id = np.subject_id OR (sk.subject_id IS NULL AND np.subject_id IS NULL))
      WHERE np.action = '${action}'::permission_action
        AND np.level = '${level}'::visibility_level
        AND (np.expires_at IS NULL OR np.expires_at > NOW())
    ),
    ranked_policies AS (
      -- Apply precedence rules: DENY > ALLOW, closer > farther, newer > older
      SELECT
        *,
        ROW_NUMBER() OVER (
          PARTITION BY descendant_id
          ORDER BY
            CASE effect WHEN 'DENY' THEN 0 ELSE 1 END, -- DENY first
            distance ASC,                                -- closer first
            specificity DESC,                           -- more specific first
            created_at DESC                             -- newer first
        ) as precedence_rank
      FROM relevant_policies
    ),
    authorized_nodes AS (
      -- Get nodes where user has ALLOW permission
      SELECT DISTINCT descendant_id as node_id
      FROM ranked_policies
      WHERE precedence_rank = 1 AND effect = 'ALLOW'

      UNION

      -- Also include nodes owned by the requesting user
      SELECT id as node_id
      FROM timeline_nodes
      WHERE user_id = ${currentUserId}
    )
  `;
}