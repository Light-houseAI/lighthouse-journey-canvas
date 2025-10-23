/**
 * useSharing Hook
 *
 * TanStack Query hooks for managing sharing/permission operations.
 * Handles server state for permissions, leaving UI state to share-store.ts
 *
 * Operations:
 * - useCurrentPermissions: Fetch current permissions for nodes
 * - useSharePermissions: Execute share operation (create permissions)
 * - useUpdatePermission: Update a permission
 * - useRemovePermission: Remove a permission
 */

import {
  NodePolicyCreateDTO,
  OrganizationType,
  PermissionAction,
  PolicyEffect,
  SubjectType,
  VisibilityLevel,
} from '@journey/schema';
import { TimelineNode } from '@journey/schema';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getOrganizationsByIds } from '../services/organization-api';
import {
  deleteNodePermission,
  type EnrichedNodePolicy,
  getBulkNodePermissions,
  setBulkNodePermissions,
  updateBulkNodePermissions,
  updateNodePermission,
} from '../services/permission-api';

// ============================================================================
// Types
// ============================================================================

export interface NodeInfo {
  nodeId: string;
  nodeTitle: string;
  nodeType: string;
}

export interface CurrentUserPermission {
  id: number;
  name: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  email?: string;
  experienceLine?: string;
  avatarUrl?: string;
  accessLevel: VisibilityLevel;
  policyIds: string[]; // ALL policy IDs for this user across all nodes
  expiresAt?: string;
  nodes: NodeInfo[]; // Which nodes this permission applies to
}

export interface CurrentOrgPermission {
  id: number;
  name: string;
  type: OrganizationType;
  accessLevel: VisibilityLevel;
  policyIds: string[]; // ALL policy IDs for this org across all nodes
  expiresAt?: string;
  nodes: NodeInfo[]; // Which nodes this permission applies to
}

export interface CurrentPublicPermission {
  enabled: boolean;
  accessLevel: VisibilityLevel;
  policyIds: string[]; // ALL policy IDs for public access across all nodes
  expiresAt?: string;
  nodes: NodeInfo[]; // Which nodes this permission applies to
}

export interface CurrentPermissions {
  users: CurrentUserPermission[];
  organizations: CurrentOrgPermission[];
  public: CurrentPublicPermission | null;
}

export interface ShareTarget {
  type: 'user' | 'organization' | 'public';
  id?: number; // For user/organization targets
  name: string;
  email?: string; // For user targets
  accessLevel: VisibilityLevel; // Per-target access level
}

export interface ShareConfiguration {
  selectedNodes: string[]; // Node IDs to share
  shareAllNodes: boolean; // Whether to share all user's nodes
  targets: ShareTarget[]; // Who to share with
}

// ============================================================================
// Query Keys
// ============================================================================

export const sharingKeys = {
  all: ['sharing'] as const,
  permissions: (nodeIds: string[]) =>
    [...sharingKeys.all, 'permissions', nodeIds] as const,
};

// ============================================================================
// Hooks
// ============================================================================

/**
 * Fetch current permissions for nodes
 */
export function useCurrentPermissions(
  nodeIds: string[],
  userNodes: TimelineNode[]
) {
  return useQuery({
    queryKey: sharingKeys.permissions(nodeIds),
    queryFn: async () => {
      if (nodeIds.length === 0) {
        return {
          users: [],
          organizations: [],
          public: null,
        };
      }

      console.log('🔍 Fetching bulk permissions for nodes:', nodeIds);
      const nodePermissionsResults = await getBulkNodePermissions(nodeIds);
      console.log('📋 Found bulk permissions by node:', nodePermissionsResults);

      // Get node information for display
      const nodeInfoMap = new Map<string, NodeInfo>();
      for (const nodeId of nodeIds) {
        const node = userNodes.find((n) => n.id === nodeId);
        if (node) {
          nodeInfoMap.set(nodeId, {
            nodeId: nodeId,
            nodeTitle: (() => {
              if (node.type === 'job') {
                return node.meta?.company || 'Untitled Job';
              } else if (node.type === 'education') {
                return node.meta?.institution || 'Untitled Education';
              } else {
                return node.meta?.title || 'Untitled';
              }
            })(),
            nodeType: node.type,
          });
        }
      }

      // Aggregate permissions by subject (user/org/public) across all nodes
      const userPermissionsMap = new Map<
        number,
        {
          accessLevel: VisibilityLevel;
          policyIds: string[];
          nodes: NodeInfo[];
          expiresAt?: string;
        }
      >();

      const orgPermissionsMap = new Map<
        number,
        {
          accessLevel: VisibilityLevel;
          policyIds: string[];
          nodes: NodeInfo[];
          expiresAt?: string;
        }
      >();

      const publicNodes: NodeInfo[] = [];
      const publicPolicyIds: string[] = [];
      let publicAccessLevel: VisibilityLevel | null = null;
      let publicExpiresAt: string | undefined;

      // Process all node permissions
      for (const { nodeId, policies } of nodePermissionsResults) {
        const nodeInfo = nodeInfoMap.get(nodeId);
        if (!nodeInfo) continue;

        for (const policy of policies) {
          if (policy.subjectType === 'user' && policy.subjectId) {
            const userId = policy.subjectId;
            const existing = userPermissionsMap.get(userId);

            if (existing) {
              existing.policyIds.push(policy.id);
              existing.nodes.push(nodeInfo);
              // Use the most permissive access level
              if (
                policy.level === VisibilityLevel.Full ||
                existing.accessLevel === VisibilityLevel.Overview
              ) {
                existing.accessLevel = policy.level;
              }
            } else {
              userPermissionsMap.set(userId, {
                accessLevel: policy.level,
                policyIds: [policy.id],
                nodes: [nodeInfo],
                expiresAt: policy.expiresAt
                  ? policy.expiresAt.toISOString()
                  : undefined,
              });
            }
          } else if (policy.subjectType === 'org' && policy.subjectId) {
            const orgId = policy.subjectId;
            const existing = orgPermissionsMap.get(orgId);

            if (existing) {
              existing.policyIds.push(policy.id);
              existing.nodes.push(nodeInfo);
              // Use the most permissive access level
              if (
                policy.level === VisibilityLevel.Full ||
                existing.accessLevel === VisibilityLevel.Overview
              ) {
                existing.accessLevel = policy.level;
              }
            } else {
              orgPermissionsMap.set(orgId, {
                accessLevel: policy.level,
                policyIds: [policy.id],
                nodes: [nodeInfo],
                expiresAt: policy.expiresAt
                  ? policy.expiresAt.toISOString()
                  : undefined,
              });
            }
          } else if (policy.subjectType === 'public') {
            publicPolicyIds.push(policy.id);
            publicNodes.push(nodeInfo);
            // Use the most permissive access level
            if (
              publicAccessLevel === null ||
              policy.level === VisibilityLevel.Full
            ) {
              publicAccessLevel = policy.level;
            }
            if (!publicExpiresAt) {
              publicExpiresAt = policy.expiresAt
                ? policy.expiresAt.toISOString()
                : undefined;
            }
          }
        }
      }

      // Create a map to store user info from enriched policies
      const userInfoMap = new Map<number, any>();

      // Extract user info from enriched policies
      for (const { policies } of nodePermissionsResults) {
        for (const policy of policies) {
          if (
            policy.subjectType === 'user' &&
            policy.subjectId &&
            (policy as any).userInfo
          ) {
            userInfoMap.set(policy.subjectId, (policy as any).userInfo);
          }
        }
      }

      // Lookup organization names
      const orgIds = Array.from(orgPermissionsMap.keys());
      const orgs = orgIds.length > 0 ? await getOrganizationsByIds(orgIds) : [];
      const orgLookup = new Map(orgs.map((o) => [o.id, o]));

      // Convert aggregated user permissions to final format with proper names
      const userPermissions: CurrentUserPermission[] = [];
      for (const [userId, permData] of userPermissionsMap) {
        const user = userInfoMap.get(userId);
        console.log(`👤 User ${userId}:`, permData, user);

        // Construct full name from firstName + lastName, fallback to userName or User ID
        const fullName =
          user?.firstName && user?.lastName
            ? `${user.firstName} ${user.lastName}`.trim()
            : user?.userName || `User ${userId}`;

        userPermissions.push({
          id: userId,
          name: fullName,
          firstName: user?.firstName,
          lastName: user?.lastName,
          username: user?.userName,
          email: user?.email,
          experienceLine: user?.experienceLine,
          avatarUrl: user?.avatarUrl,
          accessLevel: permData.accessLevel,
          policyIds: permData.policyIds,
          expiresAt: permData.expiresAt,
          nodes: permData.nodes,
        });
      }

      // Convert aggregated organization permissions to final format with proper names
      const orgPermissions: CurrentOrgPermission[] = [];
      for (const [orgId, permData] of orgPermissionsMap) {
        const org = orgLookup.get(orgId);
        console.log(`🏢 Org ${orgId}:`, permData, org);

        orgPermissions.push({
          id: orgId,
          name: org?.name || `Organization ${orgId}`,
          type: org?.type || OrganizationType.Company,
          accessLevel: permData.accessLevel,
          policyIds: permData.policyIds,
          expiresAt: permData.expiresAt,
          nodes: permData.nodes,
        });
      }

      // Create public permission object if exists
      const publicPermission: CurrentPublicPermission | null =
        publicNodes.length > 0 && publicAccessLevel
          ? {
              enabled: true,
              accessLevel: publicAccessLevel,
              policyIds: publicPolicyIds,
              expiresAt: publicExpiresAt,
              nodes: publicNodes,
            }
          : null;

      console.log('✅ Processed permissions:', {
        users: userPermissions,
        organizations: orgPermissions,
        public: publicPermission,
      });

      return {
        users: userPermissions,
        organizations: orgPermissions,
        public: publicPermission,
      };
    },
    enabled: nodeIds.length > 0,
  });
}

/**
 * Execute share operation (create permissions)
 */
export function useSharePermissions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      config,
      userNodes,
    }: {
      config: ShareConfiguration;
      userNodes: TimelineNode[];
    }) => {
      if (config.targets.length === 0) {
        throw new Error('Please select at least one target to share with');
      }

      // Determine which nodes to share
      const nodeIds = config.shareAllNodes
        ? userNodes.map((n) => n.id)
        : config.selectedNodes;

      if (nodeIds.length === 0) {
        throw new Error('No nodes selected for sharing');
      }

      // Get existing policies to merge intelligently
      const existingPoliciesResults = await getBulkNodePermissions(nodeIds);
      const existingPoliciesMap = new Map<string, EnrichedNodePolicy[]>();
      existingPoliciesResults.forEach((result) => {
        existingPoliciesMap.set(result.nodeId, result.policies);
      });

      // Create new policies for selected targets
      const policies: NodePolicyCreateDTO[] = [];

      for (const nodeId of nodeIds) {
        const existingPolicies = existingPoliciesMap.get(nodeId) || [];

        // Create a map of existing policies by subject for conflict resolution
        const existingBySubject = new Map<string, EnrichedNodePolicy>();
        existingPolicies.forEach((policy) => {
          const key =
            policy.subjectType === 'public'
              ? 'public'
              : `${policy.subjectType}-${policy.subjectId}`;
          existingBySubject.set(key, policy);
        });

        // Add/update policies for each target
        for (const target of config.targets) {
          const subjectKey =
            target.type === 'public'
              ? 'public'
              : `${target.type === 'user' ? 'user' : 'org'}-${target.id}`;

          const newPolicy: NodePolicyCreateDTO = {
            nodeId,
            level: target.accessLevel,
            action: PermissionAction.View,
            subjectType:
              target.type === 'public'
                ? SubjectType.Public
                : target.type === 'user'
                  ? SubjectType.User
                  : SubjectType.Organization,
            subjectId: target.type === 'public' ? undefined : target.id,
            effect: PolicyEffect.Allow,
          };

          // Always add the new policy (it will replace any existing policy for this subject)
          policies.push(newPolicy);

          // Mark this subject as handled
          existingBySubject.delete(subjectKey);
        }

        // Preserve existing policies that weren't updated
        existingPolicies.forEach((policy) => {
          const key =
            policy.subjectType === 'public'
              ? 'public'
              : `${policy.subjectType}-${policy.subjectId}`;

          if (existingBySubject.has(key)) {
            // This policy wasn't updated, so preserve it
            policies.push({
              nodeId,
              level: policy.level,
              action: policy.action,
              subjectType: policy.subjectType,
              subjectId: policy.subjectId || undefined,
              effect: policy.effect,
              expiresAt: policy.expiresAt?.toISOString(),
            });
          }
        });
      }

      // Execute the bulk permission update
      await setBulkNodePermissions(policies);

      return nodeIds;
    },
    onSuccess: (nodeIds) => {
      // Invalidate permissions queries for affected nodes
      queryClient.invalidateQueries({
        queryKey: sharingKeys.permissions(nodeIds),
      });
      console.log('✅ Share successful, invalidated permissions for:', nodeIds);
    },
  });
}

/**
 * Remove a permission
 */
export function useRemovePermission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      subjectKey,
      nodeId,
      currentPermissions,
    }: {
      subjectKey: string;
      nodeId?: string;
      currentPermissions: CurrentPermissions;
    }) => {
      // Find the permission being removed to get policy IDs for this subject
      let policiesToRemove: Array<{ nodeId: string; policyId: string }> = [];

      // Check user permissions - subjectKey format: "user-{id}"
      if (subjectKey.startsWith('user-')) {
        const userId = parseInt(subjectKey.split('-')[1]);
        const userPerm = currentPermissions.users.find((u) => u.id === userId);
        if (userPerm) {
          if (nodeId) {
            // Single node operation - find specific policy for this node
            const nodeIndex = userPerm.nodes.findIndex(
              (n) => n.nodeId === nodeId
            );
            if (nodeIndex >= 0) {
              policiesToRemove = [
                {
                  nodeId: nodeId,
                  policyId:
                    userPerm.policyIds[nodeIndex] || userPerm.policyIds[0],
                },
              ];
            }
          } else {
            // Multi-node operation - get all policies across all nodes for this user
            policiesToRemove = userPerm.nodes.map((node, index) => ({
              nodeId: node.nodeId,
              policyId: userPerm.policyIds[index] || userPerm.policyIds[0],
            }));
          }
        }
      }
      // Check organization permissions - subjectKey format: "org-{id}"
      else if (subjectKey.startsWith('org-')) {
        const orgId = parseInt(subjectKey.split('-')[1]);
        const orgPerm = currentPermissions.organizations.find(
          (o) => o.id === orgId
        );
        if (orgPerm) {
          if (nodeId) {
            // Single node operation - find specific policy for this node
            const nodeIndex = orgPerm.nodes.findIndex(
              (n) => n.nodeId === nodeId
            );
            if (nodeIndex >= 0) {
              policiesToRemove = [
                {
                  nodeId: nodeId,
                  policyId:
                    orgPerm.policyIds[nodeIndex] || orgPerm.policyIds[0],
                },
              ];
            }
          } else {
            // Multi-node operation - get all policies across all nodes for this organization
            policiesToRemove = orgPerm.nodes.map((node, index) => ({
              nodeId: node.nodeId,
              policyId: orgPerm.policyIds[index] || orgPerm.policyIds[0],
            }));
          }
        }
      }
      // Check public permissions - subjectKey format: "public"
      else if (subjectKey === 'public' && currentPermissions.public) {
        const publicPerm = currentPermissions.public;
        if (nodeId) {
          // Single node operation - find specific policy for this node
          const nodeIndex = publicPerm.nodes.findIndex(
            (n) => n.nodeId === nodeId
          );
          if (nodeIndex >= 0) {
            policiesToRemove = [
              {
                nodeId: nodeId,
                policyId:
                  publicPerm.policyIds[nodeIndex] || publicPerm.policyIds[0],
              },
            ];
          }
        } else {
          // Multi-node operation - get all policies for public access
          policiesToRemove = publicPerm.nodes.map((node, index) => ({
            nodeId: node.nodeId,
            policyId: publicPerm.policyIds[index] || publicPerm.policyIds[0],
          }));
        }
      }

      if (policiesToRemove.length === 0) {
        throw new Error('Could not find policies for permission removal');
      }

      // Delete policies (single node or all nodes for this subject)
      await Promise.all(
        policiesToRemove.map(({ nodeId, policyId }) =>
          deleteNodePermission(nodeId, policyId)
        )
      );

      return policiesToRemove.map((p) => p.nodeId);
    },
    onSuccess: (affectedNodeIds) => {
      // Invalidate permissions queries for affected nodes
      queryClient.invalidateQueries({
        queryKey: sharingKeys.permissions(affectedNodeIds),
      });
      console.log(
        '✅ Permission removed, invalidated permissions for:',
        affectedNodeIds
      );
    },
  });
}

/**
 * Update a permission
 */
export function useUpdatePermission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      subjectKey,
      newLevel,
      nodeId,
      currentPermissions,
    }: {
      subjectKey: string;
      newLevel: VisibilityLevel;
      nodeId?: string;
      currentPermissions: CurrentPermissions;
    }) => {
      // Find policies for this subject and update them
      let policiesToUpdate: string[] = [];

      // Check user permissions - subjectKey format: "user-{id}"
      if (subjectKey.startsWith('user-')) {
        const userId = parseInt(subjectKey.split('-')[1]);
        const userPerm = currentPermissions.users.find((u) => u.id === userId);
        if (userPerm) {
          if (nodeId) {
            // Single node operation - find specific policy for this node
            const nodeIndex = userPerm.nodes.findIndex(
              (n) => n.nodeId === nodeId
            );
            if (nodeIndex >= 0) {
              policiesToUpdate = [
                userPerm.policyIds[nodeIndex] || userPerm.policyIds[0],
              ];
            }
          } else {
            // Multi-node operation - update all policies for this user
            policiesToUpdate = userPerm.policyIds;
          }
        }
      }
      // Check organization permissions - subjectKey format: "org-{id}"
      else if (subjectKey.startsWith('org-')) {
        const orgId = parseInt(subjectKey.split('-')[1]);
        const orgPerm = currentPermissions.organizations.find(
          (o) => o.id === orgId
        );
        if (orgPerm) {
          if (nodeId) {
            // Single node operation - find specific policy for this node
            const nodeIndex = orgPerm.nodes.findIndex(
              (n) => n.nodeId === nodeId
            );
            if (nodeIndex >= 0) {
              policiesToUpdate = [
                orgPerm.policyIds[nodeIndex] || orgPerm.policyIds[0],
              ];
            }
          } else {
            // Multi-node operation - update all policies for this organization
            policiesToUpdate = orgPerm.policyIds;
          }
        }
      }
      // Check public permissions - subjectKey format: "public"
      else if (subjectKey === 'public' && currentPermissions.public) {
        if (nodeId) {
          // Single node operation - find specific policy for this node
          const nodeIndex = currentPermissions.public.nodes.findIndex(
            (n) => n.nodeId === nodeId
          );
          if (nodeIndex >= 0) {
            policiesToUpdate = [
              currentPermissions.public.policyIds[nodeIndex] ||
                currentPermissions.public.policyIds[0],
            ];
          }
        } else {
          // Multi-node operation - update all policies for public access
          policiesToUpdate = currentPermissions.public.policyIds;
        }
      }

      if (policiesToUpdate.length === 0) {
        throw new Error('Could not find policies for permission update');
      }

      // Update policies (single node or all nodes for this subject)
      if (policiesToUpdate.length === 1) {
        // Single policy update
        await updateNodePermission(policiesToUpdate[0], {
          level: newLevel,
        });
      } else if (policiesToUpdate.length > 1) {
        // Bulk policy update for better performance
        await updateBulkNodePermissions(
          policiesToUpdate.map((policyId) => ({
            policyId,
            updates: { level: newLevel },
          }))
        );
      }

      // Return affected node IDs for invalidation
      const affectedNodeIds: string[] = [];
      if (subjectKey.startsWith('user-')) {
        const userId = parseInt(subjectKey.split('-')[1]);
        const userPerm = currentPermissions.users.find((u) => u.id === userId);
        if (userPerm) {
          affectedNodeIds.push(...userPerm.nodes.map((n) => n.nodeId));
        }
      } else if (subjectKey.startsWith('org-')) {
        const orgId = parseInt(subjectKey.split('-')[1]);
        const orgPerm = currentPermissions.organizations.find(
          (o) => o.id === orgId
        );
        if (orgPerm) {
          affectedNodeIds.push(...orgPerm.nodes.map((n) => n.nodeId));
        }
      } else if (subjectKey === 'public' && currentPermissions.public) {
        affectedNodeIds.push(
          ...currentPermissions.public.nodes.map((n) => n.nodeId)
        );
      }

      return affectedNodeIds;
    },
    onSuccess: (affectedNodeIds) => {
      // Invalidate permissions queries for affected nodes
      queryClient.invalidateQueries({
        queryKey: sharingKeys.permissions(affectedNodeIds),
      });
      console.log(
        '✅ Permission updated, invalidated permissions for:',
        affectedNodeIds
      );
    },
  });
}
