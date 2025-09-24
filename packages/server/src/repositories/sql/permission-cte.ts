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

/**
 * Generates the subject keys CTE that defines user identity hierarchy.
 *
 * Defines subject identities in order of specificity:
 * - user (specificity: 3) - Most specific, represents the individual user
 * - public (specificity: 0) - Least specific, represents public access
 *
 * @param currentUserId The ID of the user whose permissions are being evaluated
 * @returns SQL fragment for the subject_keys CTE
 */
export function getSubjectKeysCTE(currentUserId: number) {
  return sql`
    subject_keys AS (
      SELECT subject_type, subject_id, specificity FROM (VALUES
        ('user'::subject_type, ${currentUserId}::integer, 3),
        ('public'::subject_type, NULL::integer, 0)
      ) AS v(subject_type, subject_id, specificity)
    )
  `;
}

/**
 * Generates the relevant policies CTE for a specific target user's nodes.
 *
 * Retrieves all policies that could affect access to the target user's nodes by:
 * - Joining with timeline_node_closure to include policies on ancestor nodes
 * - Matching policies against subject keys (user identities)
 * - Filtering by action type and optional visibility level
 * - Excluding expired policies
 *
 * @param targetUserId The ID of the user whose nodes are being accessed
 * @param action The permission action being evaluated (default: 'view')
 * @param level Optional visibility level filter
 * @returns SQL fragment for the relevant_policies CTE
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
 * Generates the relevant policies CTE without target user constraint.
 *
 * Used for search scenarios where we check permissions across all users.
 * Retrieves all policies that could affect the current user's access by:
 * - Joining with timeline_node_closure to include policies on ancestor nodes
 * - Matching policies against subject keys (user identities)
 * - Filtering by action type and visibility level
 * - Excluding expired policies
 *
 * @param action The permission action being evaluated (default: 'view')
 * @param level The visibility level required (default: 'overview')
 * @returns SQL fragment for the relevant_policies CTE
 */
export function getRelevantPoliciesForSearchCTE(
  action: string = 'view',
  level: string = 'overview'
) {
  return sql`
    relevant_policies AS (
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
 * Generates the ranked policies CTE that applies precedence rules.
 *
 * Applies the following precedence rules in order:
 * 1. Effect: DENY takes precedence over ALLOW
 * 2. Distance: Policies on closer ancestors take precedence
 * 3. Specificity: More specific subjects (user > public) take precedence
 * 4. Creation time: Newer policies take precedence over older ones
 *
 * The resulting precedence_rank (1 = highest priority) determines which
 * policy is effective for each node.
 *
 * @returns SQL fragment for the ranked_policies CTE
 */
export function getRankedPoliciesCTE() {
  return sql`
    ranked_policies AS (
      SELECT
        *,
        ROW_NUMBER() OVER (
          PARTITION BY descendant_id
          ORDER BY
            CASE effect WHEN 'DENY' THEN 0 ELSE 1 END,
            distance ASC,
            specificity DESC,
            created_at DESC
        ) as precedence_rank
      FROM relevant_policies
    )
  `;
}

/**
 * Generates the authorized nodes CTE for target user scenario.
 *
 * Includes all descendant nodes where the user has ALLOW permission.
 * Uses the winning policy (precedence_rank = 1) for each node and
 * expands access to all descendants via timeline_node_closure.
 *
 * @returns SQL fragment for the authorized_nodes CTE
 */
export function getAuthorizedNodesCTE() {
  return sql`
    authorized_nodes AS (
      SELECT DISTINCT tnc.descendant_id as node_id
      FROM ranked_policies rp
      JOIN timeline_node_closure tnc ON tnc.ancestor_id = rp.node_id
      WHERE rp.precedence_rank = 1 AND rp.effect = 'ALLOW'
    )
  `;
}

/**
 * Generates the authorized nodes CTE for search scenario.
 *
 * Includes nodes accessible to the user through two paths:
 * 1. Permission-based access: Nodes where the winning policy grants ALLOW
 * 2. Ownership: All nodes owned by the requesting user (implicit full access)
 *
 * The UNION ensures both sets are combined without duplicates.
 *
 * @param currentUserId The ID of the user performing the search
 * @returns SQL fragment for the authorized_nodes CTE
 */
export function getAuthorizedNodesForSearchCTE(currentUserId: number) {
  return sql`
    authorized_nodes AS (
      SELECT DISTINCT descendant_id as node_id
      FROM ranked_policies
      WHERE precedence_rank = 1 AND effect = 'ALLOW'

      UNION

      SELECT id as node_id
      FROM timeline_nodes
      WHERE user_id = ${currentUserId}
    )
  `;
}

/**
 * Builds complete permission filtering CTE chain for getAllNodes scenario.
 *
 * Generates a complete SQL CTE chain that:
 * 1. Defines subject identities (user and public) with specificity levels
 * 2. Retrieves all relevant policies affecting the target user's nodes
 * 3. Ranks policies by precedence (DENY > ALLOW, closer > farther, newer > older)
 * 4. Determines the winning policy for each node
 * 5. Expands ALLOW permissions to all descendant nodes
 *
 * @param currentUserId The ID of the user whose permissions are being evaluated
 * @param targetUserId The ID of the user whose nodes are being accessed
 * @param action The permission action being evaluated (default: 'view')
 * @param level Optional visibility level filter
 * @returns Complete SQL CTE chain as a string for direct embedding in queries
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
      SELECT subject_type, subject_id, specificity FROM (VALUES
        ('user'::subject_type, ${currentUserId}::integer, 3),
        ('public'::subject_type, NULL::integer, 0)
      ) AS v(subject_type, subject_id, specificity)
    ),
    relevant_policies AS (
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
      SELECT
        *,
        ROW_NUMBER() OVER (
          PARTITION BY node_id
          ORDER BY
            CASE effect WHEN 'DENY' THEN 0 ELSE 1 END,
            distance ASC,
            specificity DESC,
            created_at DESC
        ) as precedence_rank
      FROM relevant_policies
    ),
    effective_permissions AS (
      SELECT node_id, effect
      FROM ranked_policies
      WHERE precedence_rank = 1
    ),
    authorized_nodes AS (
      SELECT DISTINCT tnc.descendant_id as node_id
      FROM effective_permissions ep
      JOIN timeline_node_closure tnc ON tnc.ancestor_id = ep.node_id
      WHERE ep.effect = 'ALLOW'
    )
  `;
}

/**
 * Builds complete permission filtering CTE chain for search scenario.
 *
 * Generates a complete SQL CTE chain optimized for search operations that:
 * 1. Defines subject identities (user and public) with specificity levels
 * 2. Retrieves all relevant policies across all nodes (no target user filter)
 * 3. Ranks policies by precedence (DENY > ALLOW, closer > farther, newer > older)
 * 4. Includes both permission-based access and owned nodes
 *
 * The key difference from getAllNodes is that this includes a UNION to ensure
 * users always have full access to their own nodes regardless of policies.
 *
 * @param currentUserId The ID of the user performing the search
 * @param action The permission action being evaluated (default: 'view')
 * @returns Complete SQL CTE chain as a string for direct embedding in queries
 */
export function buildPermissionCTEForSearch(
  currentUserId: number,
  action: string = 'view'
): string {
  return `
    WITH subject_keys AS (
      SELECT subject_type, subject_id, specificity FROM (VALUES
        ('user'::subject_type, ${currentUserId}::integer, 3),
        ('public'::subject_type, NULL::integer, 0)
      ) AS v(subject_type, subject_id, specificity)
    ),
    relevant_policies AS (
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
        AND (np.expires_at IS NULL OR np.expires_at > NOW())
    ),
    ranked_policies AS (
      SELECT
        *,
        ROW_NUMBER() OVER (
          PARTITION BY descendant_id
          ORDER BY
            CASE effect WHEN 'DENY' THEN 0 ELSE 1 END,
            distance ASC,
            specificity DESC,
            created_at DESC
        ) as precedence_rank
      FROM relevant_policies
    ),
    authorized_nodes AS (
      SELECT DISTINCT descendant_id as node_id
      FROM ranked_policies
      WHERE precedence_rank = 1 AND effect = 'ALLOW'

      UNION

      SELECT id as node_id
      FROM timeline_nodes
      WHERE user_id = ${currentUserId}
    )
  `;
}
