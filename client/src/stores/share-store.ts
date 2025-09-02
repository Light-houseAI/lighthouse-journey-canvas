/**
 * Share Store
 *
 * Manages sharing modal state and share configurations using Zustand
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { getErrorMessage } from '../utils/error-toast';
import {
  TimelineNode,
  NodePolicy,
  Organization
} from '@shared/schema';
import {
  VisibilityLevel,
  SubjectType,
  PolicyEffect,
  PermissionAction,
  OrganizationType
} from '@shared/enums';
import {
  NodePolicyCreateDTO
} from '@shared/types';
import { UserSearchResult } from '../services/user-api';


// Share configuration types
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
  // Removed global accessLevel - now per-target
}

// Current permissions display types
export interface NodeInfo {
  nodeId: string;
  nodeTitle: string;
  nodeType: string;
}

export interface CurrentUserPermission {
  id: number;
  name: string;
  email?: string;
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

interface ShareState {
  // Modal state
  isModalOpen: boolean;
  isLoading: boolean;
  error: string | null;

  // Share configuration
  config: ShareConfiguration;

  // Current permissions state
  currentPermissions: CurrentPermissions;
  isLoadingPermissions: boolean;

  // Available data for selection
  userNodes: TimelineNode[];
  searchResults: {
    users: UserSearchResult[];
    organizations: Organization[];
  };

  // UI state
  searchQuery: string;
  activeTab: 'users' | 'organizations' | 'public';

  // Actions
  openModal: (nodes?: TimelineNode[]) => void;
  openModalWithSelection: (allNodes: TimelineNode[], selectedNodeIds: string[]) => void;
  closeModal: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;

  // Configuration actions
  toggleShareAllNodes: () => void;
  addNode: (nodeId: string) => void;
  removeNode: (nodeId: string) => void;
  setTargetAccessLevel: (target: ShareTarget, level: VisibilityLevel) => void;
  addTarget: (target: ShareTarget) => void;
  removeTarget: (target: ShareTarget) => void;
  clearTargets: () => void;

  // Search actions
  setSearchQuery: (query: string) => void;
  setSearchResults: (users: UserSearchResult[], organizations: Organization[]) => void;
  setActiveTab: (tab: 'users' | 'organizations' | 'public') => void;

  // Current permissions actions
  fetchCurrentPermissions: (nodeIds: string[]) => Promise<void>;
  removePermission: (subjectKey: string, nodeId?: string) => Promise<void>;
  updatePermission: (subjectKey: string, newLevel: VisibilityLevel, nodeId?: string) => Promise<void>;

  // Share execution
  executeShare: () => Promise<void>;
  resetConfiguration: () => void;

  // Helper methods
  getUserSubjectKey: (userId: number) => string;
  getOrgSubjectKey: (orgId: number) => string;
  getPublicSubjectKey: () => string;
}

const defaultConfig: ShareConfiguration = {
  selectedNodes: [],
  shareAllNodes: false,
  targets: [],
};

export const useShareStore = create<ShareState>()(
  devtools(
    immer((set, get) => ({
      // Initial state
      isModalOpen: false,
      isLoading: false,
      error: null,
      config: { ...defaultConfig },
      currentPermissions: {
        users: [],
        organizations: [],
        public: null,
      },
      isLoadingPermissions: false,
      userNodes: [],
      searchResults: {
        users: [],
        organizations: [],
      },
      searchQuery: '',
      activeTab: 'users',

      // Modal actions
      openModal: (nodes?: TimelineNode[]) => set((state) => {
        state.isModalOpen = true;
        state.error = null;
        if (nodes) {
          // If nodes are provided, they represent the available user nodes
          state.userNodes = nodes;
          // Default to share all when opening without specific selection
          state.config.selectedNodes = [];
          state.config.shareAllNodes = true;
        }
      }),

      openModalWithSelection: (allNodes: TimelineNode[], selectedNodeIds: string[]) => set((state) => {
        state.isModalOpen = true;
        state.error = null;
        state.userNodes = allNodes;
        state.config.selectedNodes = selectedNodeIds;
        state.config.shareAllNodes = false;
      }),

      closeModal: () => set((state) => {
        state.isModalOpen = false;
        state.error = null;
        // Reset configuration when closing
        state.config = { ...defaultConfig };
        state.searchQuery = '';
        state.searchResults = { users: [], organizations: [] };
      }),

      setLoading: (loading) => set((state) => {
        state.isLoading = loading;
      }),

      setError: (error) => set((state) => {
        state.error = error;
        state.isLoading = false;
      }),

      clearError: () => set((state) => {
        state.error = null;
      }),

      // Configuration actions
      toggleShareAllNodes: () => set((state) => {
        state.config.shareAllNodes = !state.config.shareAllNodes;
        if (state.config.shareAllNodes) {
          // When sharing all nodes, clear selected nodes
          state.config.selectedNodes = [];
        }
      }),

      addNode: (nodeId) => set((state) => {
        if (!state.config.selectedNodes.includes(nodeId)) {
          state.config.selectedNodes.push(nodeId);
        }
        // If adding specific nodes, disable share all
        if (state.config.selectedNodes.length > 0) {
          state.config.shareAllNodes = false;
        }
      }),

      removeNode: (nodeId) => set((state) => {
        const index = state.config.selectedNodes.indexOf(nodeId);
        if (index > -1) {
          state.config.selectedNodes.splice(index, 1);
        }
      }),

      setTargetAccessLevel: (target, level) => set((state) => {
        const existingTargetIndex = state.config.targets.findIndex(t =>
          t.type === target.type &&
          (target.id ? t.id === target.id : t.type === 'public')
        );

        if (existingTargetIndex !== -1) {
          state.config.targets[existingTargetIndex].accessLevel = level;
        }
      }),

      addTarget: (target) => set((state) => {
        // Check if target already exists
        const exists = state.config.targets.some(t =>
          t.type === target.type &&
          (target.id ? t.id === target.id : t.type === 'public')
        );

        if (!exists) {
          // Ensure target has an access level (default to Overview if not provided)
          const targetWithAccessLevel = {
            ...target,
            accessLevel: target.accessLevel || VisibilityLevel.Overview
          };
          state.config.targets.push(targetWithAccessLevel);
        }
      }),

      removeTarget: (target) => set((state) => {
        const index = state.config.targets.findIndex(t =>
          t.type === target.type &&
          (target.id ? t.id === target.id : t.type === 'public')
        );
        if (index > -1) {
          state.config.targets.splice(index, 1);
        }
      }),

      clearTargets: () => set((state) => {
        state.config.targets = [];
      }),

      // Search actions
      setSearchQuery: (query) => set((state) => {
        state.searchQuery = query;
      }),

      setSearchResults: (users, organizations) => set((state) => {
        state.searchResults.users = users;
        state.searchResults.organizations = organizations;
      }),

      setActiveTab: (tab) => set((state) => {
        state.activeTab = tab;
      }),

      // Share execution
      executeShare: async () => {
        const state = get();

        if (state.config.targets.length === 0) {
          set((draft) => {
            draft.error = 'Please select at least one target to share with';
          });
          return;
        }

        set((draft) => {
          draft.isLoading = true;
          draft.error = null;
        });

        try {
          const { setBulkNodePermissions, getBulkNodePermissions } = await import('../services/permission-api');

          // Determine which nodes to share
          const nodeIds = state.config.shareAllNodes
            ? state.userNodes.map(n => n.id)
            : state.config.selectedNodes;

          if (nodeIds.length === 0) {
            throw new Error('No nodes selected for sharing');
          }

          // Get existing policies to merge intelligently
          const existingPoliciesResults = await getBulkNodePermissions(nodeIds);
          const existingPoliciesMap = new Map<string, NodePolicy[]>();
          existingPoliciesResults.forEach(result => {
            existingPoliciesMap.set(result.nodeId, result.policies);
          });

          // Create new policies for selected targets
          const policies: NodePolicyCreateDTO[] = [];

          for (const nodeId of nodeIds) {
            const existingPolicies = existingPoliciesMap.get(nodeId) || [];

            // Create a map of existing policies by subject for conflict resolution
            const existingBySubject = new Map<string, NodePolicy>();
            existingPolicies.forEach(policy => {
              const key = policy.subjectType === SubjectType.Public
                ? 'public'
                : `${policy.subjectType}-${policy.subjectId}`;
              existingBySubject.set(key, policy);
            });

            // Add/update policies for each target
            for (const target of state.config.targets) {
              const subjectKey = target.type === 'public'
                ? 'public'
                : `${target.type === 'user' ? SubjectType.User : SubjectType.Organization}-${target.id}`;

              const newPolicy: NodePolicyCreateDTO = {
                nodeId,
                level: target.accessLevel,
                action: PermissionAction.View,
                subjectType: target.type === 'public'
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
            existingPolicies.forEach(policy => {
              const key = policy.subjectType === SubjectType.Public
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
                  expiresAt: policy.expiresAt?.toISOString()
                });
              }
            });
          }

          // Execute the bulk permission update
          await setBulkNodePermissions(policies);

          set((draft) => {
            draft.isLoading = false;
            draft.isModalOpen = false;
            draft.config = { ...defaultConfig };
          });

        } catch (error) {
          set((draft) => {
            draft.error = getErrorMessage(error);
            draft.isLoading = false;
          });
        }
      },

      resetConfiguration: () => set((state) => {
        state.config = { ...defaultConfig };
        state.error = null;
      }),

      // Current permissions actions
      fetchCurrentPermissions: async (nodeIds: string[]) => {
        if (nodeIds.length === 0) return;

        set((draft) => {
          draft.isLoadingPermissions = true;
        });

        try {
          const { getBulkNodePermissions } = await import('../services/permission-api');

          // Fetch permissions for all nodes in bulk
          console.log('🔍 Fetching bulk permissions for nodes:', nodeIds);
          const nodePermissionsResults = await getBulkNodePermissions(nodeIds);
          console.log('📋 Found bulk permissions by node:', nodePermissionsResults);

          // Get node information for display
          const state = get();
          const nodeInfoMap = new Map<string, NodeInfo>();
          for (const nodeId of nodeIds) {
            const node = state.userNodes.find(n => n.id === nodeId);
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
                nodeType: node.type
              });
            }
          }

          // Aggregate permissions by subject (user/org/public) across all nodes
          const userPermissionsMap = new Map<number, {
            accessLevel: VisibilityLevel;
            policyIds: string[];
            nodes: NodeInfo[];
            expiresAt?: string;
          }>();

          const orgPermissionsMap = new Map<number, {
            accessLevel: VisibilityLevel;
            policyIds: string[];
            nodes: NodeInfo[];
            expiresAt?: string;
          }>();

          let publicNodes: NodeInfo[] = [];
          let publicPolicyIds: string[] = [];
          let publicAccessLevel: VisibilityLevel | null = null;
          let publicExpiresAt: string | undefined;

          // Process all node permissions
          for (const { nodeId, policies } of nodePermissionsResults) {
            const nodeInfo = nodeInfoMap.get(nodeId);
            if (!nodeInfo) continue;

            for (const policy of policies) {
              if (policy.subjectType === SubjectType.User && policy.subjectId) {
                const userId = policy.subjectId;
                const existing = userPermissionsMap.get(userId);

                if (existing) {
                  existing.policyIds.push(policy.id);
                  existing.nodes.push(nodeInfo);
                  // Use the most permissive access level
                  if (policy.level === VisibilityLevel.Full || existing.accessLevel === VisibilityLevel.Overview) {
                    existing.accessLevel = policy.level;
                  }
                } else {
                  userPermissionsMap.set(userId, {
                    accessLevel: policy.level,
                    policyIds: [policy.id],
                    nodes: [nodeInfo],
                    expiresAt: policy.expiresAt ? policy.expiresAt.toISOString() : undefined,
                  });
                }
              } else if (policy.subjectType === SubjectType.Organization && policy.subjectId) {
                const orgId = policy.subjectId;
                const existing = orgPermissionsMap.get(orgId);

                if (existing) {
                  existing.policyIds.push(policy.id);
                  existing.nodes.push(nodeInfo);
                  // Use the most permissive access level
                  if (policy.level === VisibilityLevel.Full || existing.accessLevel === VisibilityLevel.Overview) {
                    existing.accessLevel = policy.level;
                  }
                } else {
                  orgPermissionsMap.set(orgId, {
                    accessLevel: policy.level,
                    policyIds: [policy.id],
                    nodes: [nodeInfo],
                    expiresAt: policy.expiresAt ? policy.expiresAt.toISOString() : undefined,
                  });
                }
              } else if (policy.subjectType === SubjectType.Public) {
                publicPolicyIds.push(policy.id);
                publicNodes.push(nodeInfo);
                // Use the most permissive access level
                if (publicAccessLevel === null || policy.level === VisibilityLevel.Full) {
                  publicAccessLevel = policy.level;
                }
                if (!publicExpiresAt) {
                  publicExpiresAt = policy.expiresAt ? policy.expiresAt.toISOString() : undefined;
                }
              }
            }
          }

          // Lookup user and organization names
          const userIds = Array.from(userPermissionsMap.keys());
          const orgIds = Array.from(orgPermissionsMap.keys());

          const [users, orgs] = await Promise.all([
            userIds.length > 0 ? import('../services/user-api').then(mod => mod.getUsersByIds(userIds)) : Promise.resolve([]),
            orgIds.length > 0 ? import('../services/organization-api').then(mod => mod.getOrganizationsByIds(orgIds)) : Promise.resolve([])
          ]);

          // Create lookup maps
          const userLookup = new Map(users.map(u => [u.id, u]));
          const orgLookup = new Map(orgs.map(o => [o.id, o]));

          // Convert aggregated user permissions to final format with proper names
          const userPermissions: CurrentUserPermission[] = [];
          for (const [userId, permData] of userPermissionsMap) {
            const user = userLookup.get(userId);
            console.log(`👤 User ${userId}:`, permData, user);

            userPermissions.push({
              id: userId,
              name: user?.userName || user?.email, // Use actual name or fallback
              email: user?.email, // Real email from lookup
              accessLevel: permData.accessLevel,
              policyIds: permData.policyIds, // Store ALL policy IDs
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
              name: org?.name || `Organization ${orgId}`, // Use actual name or fallback
              type: org?.type || OrganizationType.Company, // Use real type or default
              accessLevel: permData.accessLevel,
              policyIds: permData.policyIds, // Store ALL policy IDs
              expiresAt: permData.expiresAt,
              nodes: permData.nodes,
            });
          }

          // Create public permission object if exists
          const publicPermission: CurrentPublicPermission | null = publicNodes.length > 0 ? {
            enabled: true,
            accessLevel: publicAccessLevel!,
            policyIds: publicPolicyIds, // Store ALL policy IDs
            expiresAt: publicExpiresAt,
            nodes: publicNodes,
          } : null;

          set((draft) => {
            draft.currentPermissions = {
              users: userPermissions,
              organizations: orgPermissions,
              public: publicPermission,
            };
            draft.isLoadingPermissions = false;
            console.log('✅ Set currentPermissions:', {
              users: userPermissions,
              organizations: orgPermissions,
              public: publicPermission,
            });
          });

        } catch (error) {
          console.error('Failed to fetch permissions:', error);
          set((draft) => {
            draft.error = getErrorMessage(error);
            draft.isLoadingPermissions = false;
          });
        }
      },

      removePermission: async (subjectKey: string, nodeId?: string) => {
        try {
          const { deleteNodePermission } = await import('../services/permission-api');
          const { currentPermissions } = get();

          // Find the permission being removed to get policy IDs for this subject
          let policiesToRemove: Array<{ nodeId: string; policyId: string }> = [];

          // Check user permissions - subjectKey format: "user-{id}"
          if (subjectKey.startsWith('user-')) {
            const userId = parseInt(subjectKey.split('-')[1]);
            const userPerm = currentPermissions.users.find(u => u.id === userId);
            if (userPerm) {
              if (nodeId) {
                // Single node operation - find specific policy for this node
                const nodeIndex = userPerm.nodes.findIndex(n => n.nodeId === nodeId);
                if (nodeIndex >= 0) {
                  policiesToRemove = [{
                    nodeId: nodeId,
                    policyId: userPerm.policyIds[nodeIndex] || userPerm.policyIds[0]
                  }];
                }
              } else {
                // Multi-node operation - get all policies across all nodes for this user
                policiesToRemove = userPerm.nodes.map((node, index) => ({
                  nodeId: node.nodeId,
                  policyId: userPerm.policyIds[index] || userPerm.policyIds[0]
                }));
              }
            }
          }

          // Check organization permissions - subjectKey format: "org-{id}"
          else if (subjectKey.startsWith('org-')) {
            const orgId = parseInt(subjectKey.split('-')[1]);
            const orgPerm = currentPermissions.organizations.find(o => o.id === orgId);
            if (orgPerm) {
              if (nodeId) {
                // Single node operation - find specific policy for this node
                const nodeIndex = orgPerm.nodes.findIndex(n => n.nodeId === nodeId);
                if (nodeIndex >= 0) {
                  policiesToRemove = [{
                    nodeId: nodeId,
                    policyId: orgPerm.policyIds[nodeIndex] || orgPerm.policyIds[0]
                  }];
                }
              } else {
                // Multi-node operation - get all policies across all nodes for this organization
                policiesToRemove = orgPerm.nodes.map((node, index) => ({
                  nodeId: node.nodeId,
                  policyId: orgPerm.policyIds[index] || orgPerm.policyIds[0]
                }));
              }
            }
          }

          // Check public permissions - subjectKey format: "public"
          else if (subjectKey === 'public' && currentPermissions.public) {
            if (nodeId) {
              // Single node operation - find specific policy for this node
              const nodeIndex = currentPermissions.public.nodes.findIndex(n => n.nodeId === nodeId);
              if (nodeIndex >= 0) {
                policiesToRemove = [{
                  nodeId: nodeId,
                  policyId: currentPermissions.public.policyIds[nodeIndex] || currentPermissions.public.policyIds[0]
                }];
              }
            } else {
              // Multi-node operation - get all policies for public access
              policiesToRemove = currentPermissions.public.nodes.map((node, index) => ({
                nodeId: node.nodeId,
                policyId: currentPermissions.public.policyIds[index] || currentPermissions.public.policyIds[0]
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

          // Update local state
          set((draft) => {
            if (subjectKey.startsWith('user-')) {
              const userId = parseInt(subjectKey.split('-')[1]);
              const userIndex = draft.currentPermissions.users.findIndex(u => u.id === userId);
              if (userIndex >= 0) {
                if (nodeId) {
                  // Remove specific node from user's permission
                  const nodeIndex = draft.currentPermissions.users[userIndex].nodes.findIndex(n => n.nodeId === nodeId);
                  if (nodeIndex >= 0) {
                    draft.currentPermissions.users[userIndex].nodes.splice(nodeIndex, 1);
                    draft.currentPermissions.users[userIndex].policyIds.splice(nodeIndex, 1);
                  }
                  // If no nodes left, remove the entire user permission
                  if (draft.currentPermissions.users[userIndex].nodes.length === 0) {
                    draft.currentPermissions.users.splice(userIndex, 1);
                  }
                } else {
                  // Remove entire user permission
                  draft.currentPermissions.users.splice(userIndex, 1);
                }
              }
            } else if (subjectKey.startsWith('org-')) {
              const orgId = parseInt(subjectKey.split('-')[1]);
              const orgIndex = draft.currentPermissions.organizations.findIndex(o => o.id === orgId);
              if (orgIndex >= 0) {
                if (nodeId) {
                  // Remove specific node from org's permission
                  const nodeIndex = draft.currentPermissions.organizations[orgIndex].nodes.findIndex(n => n.nodeId === nodeId);
                  if (nodeIndex >= 0) {
                    draft.currentPermissions.organizations[orgIndex].nodes.splice(nodeIndex, 1);
                    draft.currentPermissions.organizations[orgIndex].policyIds.splice(nodeIndex, 1);
                  }
                  // If no nodes left, remove the entire org permission
                  if (draft.currentPermissions.organizations[orgIndex].nodes.length === 0) {
                    draft.currentPermissions.organizations.splice(orgIndex, 1);
                  }
                } else {
                  // Remove entire org permission
                  draft.currentPermissions.organizations.splice(orgIndex, 1);
                }
              }
            } else if (subjectKey === 'public' && draft.currentPermissions.public) {
              if (nodeId) {
                // Remove specific node from public permission
                const nodeIndex = draft.currentPermissions.public.nodes.findIndex(n => n.nodeId === nodeId);
                if (nodeIndex >= 0) {
                  draft.currentPermissions.public.nodes.splice(nodeIndex, 1);
                  draft.currentPermissions.public.policyIds.splice(nodeIndex, 1);
                }
                // If no nodes left, remove the entire public permission
                if (draft.currentPermissions.public.nodes.length === 0) {
                  draft.currentPermissions.public = null;
                }
              } else {
                // Remove entire public permission
                draft.currentPermissions.public = null;
              }
            }
          });

        } catch (error) {
          set((draft) => {
            draft.error = getErrorMessage(error);
          });
          throw error;
        }
      },

      updatePermission: async (subjectKey: string, newLevel: VisibilityLevel, nodeId?: string) => {
        try {
          const { currentPermissions } = get();

          // Find policies for this subject and update them
          let policiesToUpdate: string[] = [];

          // Check user permissions - subjectKey format: "user-{id}"
          if (subjectKey.startsWith('user-')) {
            const userId = parseInt(subjectKey.split('-')[1]);
            const userPerm = currentPermissions.users.find(u => u.id === userId);
            if (userPerm) {
              if (nodeId) {
                // Single node operation - find specific policy for this node
                const nodeIndex = userPerm.nodes.findIndex(n => n.nodeId === nodeId);
                if (nodeIndex >= 0) {
                  policiesToUpdate = [userPerm.policyIds[nodeIndex] || userPerm.policyIds[0]];
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
            const orgPerm = currentPermissions.organizations.find(o => o.id === orgId);
            if (orgPerm) {
              if (nodeId) {
                // Single node operation - find specific policy for this node
                const nodeIndex = orgPerm.nodes.findIndex(n => n.nodeId === nodeId);
                if (nodeIndex >= 0) {
                  policiesToUpdate = [orgPerm.policyIds[nodeIndex] || orgPerm.policyIds[0]];
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
              const nodeIndex = currentPermissions.public.nodes.findIndex(n => n.nodeId === nodeId);
              if (nodeIndex >= 0) {
                policiesToUpdate = [currentPermissions.public.policyIds[nodeIndex] || currentPermissions.public.policyIds[0]];
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
            const { updateNodePermission } = await import('../services/permission-api');
            await updateNodePermission(policiesToUpdate[0], { level: newLevel });
          } else if (policiesToUpdate.length > 1) {
            // Bulk policy update for better performance
            const { updateBulkNodePermissions } = await import('../services/permission-api');
            await updateBulkNodePermissions(
              policiesToUpdate.map(policyId => ({
                policyId,
                updates: { level: newLevel }
              }))
            );
          }

          // Update local state
          set((draft) => {
            if (subjectKey.startsWith('user-')) {
              const userId = parseInt(subjectKey.split('-')[1]);
              const userIndex = draft.currentPermissions.users.findIndex(u => u.id === userId);
              if (userIndex >= 0) {
                if (nodeId) {
                  // Note: For single node updates, we keep the same access level at the subject level
                  // because the UI shows the most permissive level across all nodes
                  // Individual node permissions are managed at the API level
                } else {
                  // Multi-node operation - update the subject's overall access level
                  draft.currentPermissions.users[userIndex].accessLevel = newLevel;
                }
              }
            } else if (subjectKey.startsWith('org-')) {
              const orgId = parseInt(subjectKey.split('-')[1]);
              const orgIndex = draft.currentPermissions.organizations.findIndex(o => o.id === orgId);
              if (orgIndex >= 0) {
                if (nodeId) {
                  // Note: For single node updates, we keep the same access level at the subject level
                } else {
                  // Multi-node operation - update the subject's overall access level
                  draft.currentPermissions.organizations[orgIndex].accessLevel = newLevel;
                }
              }
            } else if (subjectKey === 'public' && draft.currentPermissions.public) {
              if (nodeId) {
                // Note: For single node updates, we keep the same access level at the subject level
              } else {
                // Multi-node operation - update the subject's overall access level
                draft.currentPermissions.public.accessLevel = newLevel;
              }
            }
          });

        } catch (error) {
          set((draft) => {
            draft.error = getErrorMessage(error);
          });
        }
      },

      // Helper methods for generating subject keys
      getUserSubjectKey: (userId: number) => `user-${userId}`,
      getOrgSubjectKey: (orgId: number) => `org-${orgId}`,
      getPublicSubjectKey: () => 'public',
    })),
    { name: 'share-store' }
  )
);
