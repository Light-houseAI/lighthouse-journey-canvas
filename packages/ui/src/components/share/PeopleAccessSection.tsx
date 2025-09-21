/**
 * PeopleAccessSection Component
 *
 * Displays people with current access and search functionality for new people.
 * Shows only search when no permissions exist, as per requirements.
 * When people have access, shows search at top + people list (Figma design 5696-15067).
 */

import { VisibilityLevel } from '@journey/schema';
import { Loader2, Users } from 'lucide-react';
import React, { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useShareStore } from '@/stores/share-store';
import { useToast } from '@/hooks/use-toast';
import {
  setNodePermissions,
  getNodePermissions,
  deleteNodePermission,
} from '@/services/permission-api';
import { SearchPeopleComponent } from './SearchPeopleComponent';
import {
  BulkPersonPermissionsView,
  BulkPersonPermissions,
} from './BulkPersonPermissionsView';
import { UserSearchResult } from '@/services/user-api';

interface PeopleAccessSectionProps {
  className?: string;
  onViewChange?: (isOpen: boolean) => void;
}

export const PeopleAccessSection: React.FC<PeopleAccessSectionProps> = ({
  className,
  onViewChange,
}) => {
  const { config, userNodes, currentPermissions, isLoadingPermissions } =
    useShareStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedPerson, setSelectedPerson] = useState<UserSearchResult | null>(
    null
  );
  const [selectedPeople, setSelectedPeople] = useState<UserSearchResult[]>([]);
  const [userAccessLevels, setUserAccessLevels] = useState<
    Record<number, 'Limited access' | 'Full access'>
  >({});
  const [removingUserId, setRemovingUserId] = useState<number | null>(null);

  // Get the current node context
  const selectedNodeIds = config.selectedNodes;
  const shareAllNodes = config.shareAllNodes;

  // Get all node IDs when sharing all nodes
  const allNodeIds = userNodes.map((node) => node.id);
  const nodesToCheck = shareAllNodes ? allNodeIds : selectedNodeIds;

  // Create a map of user permissions with access levels from store
  const userPermissionsMap = useMemo(() => {
    const map = new Map<
      number,
      {
        user: UserSearchResult;
        accessLevel: VisibilityLevel;
      }
    >();

    // Use currentPermissions.users from the store
    currentPermissions.users.forEach((userPerm) => {
      // Check if we have a local override for this user's access level
      const localLevel = userAccessLevels[userPerm.id];
      const accessLevel = localLevel
        ? localLevel === 'Full access'
          ? VisibilityLevel.Full
          : VisibilityLevel.Overview
        : userPerm.accessLevel;

      map.set(userPerm.id, {
        user: {
          id: userPerm.id,
          userName: userPerm.username || userPerm.name || `User ${userPerm.id}`,
          firstName: userPerm.firstName,
          lastName: userPerm.lastName,
          email: userPerm.email,
          experienceLine: userPerm.experienceLine,
          avatarUrl: userPerm.avatarUrl,
        },
        accessLevel,
      });
    });

    return map;
  }, [currentPermissions.users, userAccessLevels]);

  // Mutation for removing person access
  const removeAccessMutation = useMutation({
    mutationFn: async (userId: number) => {
      setRemovingUserId(userId);
      // Get fresh values from store to avoid stale closure
      const { config, userNodes } = useShareStore.getState();
      const freshSelectedNodeIds = config.selectedNodes;
      const freshShareAllNodes = config.shareAllNodes;
      const freshAllNodeIds = userNodes.map((node) => node.id);
      const nodesToUpdate = freshShareAllNodes
        ? freshAllNodeIds
        : freshSelectedNodeIds;

      if (nodesToUpdate.length === 0) {
        throw new Error('No nodes available for updating');
      }

      // Get existing permissions and delete ones for this user
      const promises = nodesToUpdate.map(async (nodeId) => {
        const policies = await getNodePermissions(nodeId);
        const policiesToDelete = policies.filter(
          (p) => p.subjectType === 'user' && p.subjectId === userId
        );

        // Delete each policy
        const deletePromises = policiesToDelete.map((policy) =>
          deleteNodePermission(nodeId, policy.id)
        );

        await Promise.all(deletePromises);
      });

      await Promise.all(promises);
      return { userId, nodesToUpdate }; // Return both for onSuccess
    },
    onSuccess: async (data) => {
      const { userId, nodesToUpdate } = data;

      // Remove the access level for this user
      setUserAccessLevels((prev) => {
        const newLevels = { ...prev };
        delete newLevels[userId];
        return newLevels;
      });

      // Invalidate the query to refresh the data
      await queryClient.invalidateQueries({
        queryKey: ['nodePermissions', nodesToUpdate],
      });

      // Refetch the current permissions from the store
      const { fetchCurrentPermissions } = useShareStore.getState();
      await fetchCurrentPermissions(nodesToUpdate);

      toast({
        title: 'Access removed',
        description: 'Person access has been removed successfully.',
      });

      setRemovingUserId(null);
    },
    onError: (error) => {
      setRemovingUserId(null);
      toast({
        title: 'Error removing access',
        description:
          error instanceof Error ? error.message : 'Failed to remove access',
        variant: 'destructive',
      });
    },
  });

  // Mutation for saving single person permissions
  const savePermissionsMutation = useMutation({
    mutationFn: async (permissions: BulkPersonPermissions) => {
      // Use all node IDs if sharing all, otherwise use selected node IDs
      const nodesToUpdate = shareAllNodes ? allNodeIds : selectedNodeIds;

      if (nodesToUpdate.length === 0) {
        throw new Error('No nodes available for sharing');
      }

      // Save permissions for each person and each node
      const promises = [];
      for (const userId of permissions.userIds) {
        for (const nodeId of nodesToUpdate) {
          promises.push(
            setNodePermissions(
              [
                {
                  level:
                    permissions.detailLevel === 'overview'
                      ? 'overview'
                      : 'full',
                  action: 'view',
                  subjectType: 'user',
                  subjectId: userId,
                  effect: 'ALLOW',
                },
              ],
              nodeId
            )
          );
        }
      }

      await Promise.all(promises);
    },
    onSuccess: async (_, permissions) => {
      // Update access levels for all users
      const updates: Record<number, 'Limited access' | 'Full access'> = {};
      permissions.userIds.forEach((userId) => {
        updates[userId] =
          permissions.detailLevel === 'overview'
            ? 'Limited access'
            : 'Full access';
      });

      setUserAccessLevels((prev) => ({
        ...prev,
        ...updates,
      }));

      // Invalidate the query to refresh the data
      await queryClient.invalidateQueries({
        queryKey: ['nodePermissions', nodesToCheck],
      });

      // Refetch the current permissions from the store
      const { fetchCurrentPermissions } = useShareStore.getState();
      await fetchCurrentPermissions(nodesToCheck);

      toast({
        title: 'Permissions saved',
        description: 'Person access settings have been updated successfully.',
      });
      setSelectedPerson(null);
      onViewChange?.(false);
    },
    onError: (error) => {
      toast({
        title: 'Error saving permissions',
        description:
          error instanceof Error ? error.message : 'Failed to save permissions',
        variant: 'destructive',
      });
    },
  });

  // Mutation for saving bulk person permissions
  const saveBulkPermissionsMutation = useMutation({
    mutationFn: async (permissions: BulkPersonPermissions) => {
      // Use all node IDs if sharing all, otherwise use selected node IDs
      const nodesToUpdate = shareAllNodes ? allNodeIds : selectedNodeIds;

      if (nodesToUpdate.length === 0) {
        throw new Error('No nodes available for sharing');
      }

      // Save permissions for each person and each node
      const promises = [];
      for (const userId of permissions.userIds) {
        for (const nodeId of nodesToUpdate) {
          promises.push(
            setNodePermissions(
              [
                {
                  level:
                    permissions.detailLevel === 'overview'
                      ? 'overview'
                      : 'full',
                  action: 'view',
                  subjectType: 'user',
                  subjectId: userId,
                  effect: 'ALLOW',
                },
              ],
              nodeId
            )
          );
        }
      }

      await Promise.all(promises);
    },
    onSuccess: async (_, permissions) => {
      // Update access levels for all users
      const updates: Record<number, 'Limited access' | 'Full access'> = {};
      permissions.userIds.forEach((userId) => {
        updates[userId] =
          permissions.detailLevel === 'overview'
            ? 'Limited access'
            : 'Full access';
      });

      setUserAccessLevels((prev) => ({
        ...prev,
        ...updates,
      }));

      // Invalidate the query to refresh the data
      await queryClient.invalidateQueries({
        queryKey: ['nodePermissions', nodesToCheck],
      });

      // Refetch the current permissions from the store
      const { fetchCurrentPermissions } = useShareStore.getState();
      await fetchCurrentPermissions(nodesToCheck);

      toast({
        title: 'Permissions saved',
        description: `Access settings have been updated for ${selectedPeople.length} people.`,
      });
      setSelectedPeople([]);
      onViewChange?.(false);
    },
    onError: (error) => {
      toast({
        title: 'Error saving permissions',
        description:
          error instanceof Error ? error.message : 'Failed to save permissions',
        variant: 'destructive',
      });
    },
  });

  const handlePersonSelect = (person: UserSearchResult) => {
    setSelectedPerson(person);
    onViewChange?.(true);
  };

  const handleMultiplePeopleSelect = (people: UserSearchResult[]) => {
    setSelectedPeople(people);
    onViewChange?.(true);
  };

  const handlePersonPermissionsBack = () => {
    setSelectedPerson(null);
    setSelectedPeople([]);
    onViewChange?.(false);
  };

  // Loading state
  if (isLoadingPermissions) {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm text-muted-foreground">
            Loading current access...
          </span>
        </div>
      </div>
    );
  }

  // If single or multiple people are selected, show the bulk permissions view
  if (selectedPerson || selectedPeople.length > 0) {
    const peopleToEdit = selectedPerson ? [selectedPerson] : selectedPeople;

    // Get current access level (only for single person)
    let currentAccessLevel: 'overview' | 'full' | undefined;
    if (selectedPerson) {
      const userPermission = userPermissionsMap.get(selectedPerson.id);
      currentAccessLevel =
        userPermission?.accessLevel === VisibilityLevel.Overview
          ? 'overview'
          : userPermission?.accessLevel === VisibilityLevel.Full
            ? 'full'
            : undefined;
    }

    return (
      <BulkPersonPermissionsView
        people={peopleToEdit}
        currentAccessLevel={currentAccessLevel}
        onBack={handlePersonPermissionsBack}
        onSave={(permissions) =>
          selectedPerson
            ? savePermissionsMutation.mutate(permissions)
            : saveBulkPermissionsMutation.mutate(permissions)
        }
        isSaving={
          selectedPerson
            ? savePermissionsMutation.isPending
            : saveBulkPermissionsMutation.isPending
        }
        className={className}
      />
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Search Component - Always at the top with multi-select enabled */}
      <SearchPeopleComponent
        placeholder="Search for people by name"
        onPersonSelect={handlePersonSelect}
        onMultipleSelect={handleMultiplePeopleSelect}
        multiSelect={true}
        excludeUserIds={Array.from(userPermissionsMap.keys())}
      />

      {/* Conditional content based on whether people have access */}
      {userPermissionsMap.size === 0 ? (
        /* Empty State - Show illustration below search */
        <div className="space-y-6 pt-4 text-center">
          {/* Empty state illustration and text */}
          <div className="flex justify-center">
            <div className="flex h-44 w-44 items-center justify-center rounded-full bg-gradient-to-br from-purple-100 to-blue-100">
              <div className="flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-purple-200 to-blue-200">
                <div className="relative">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-purple-500">
                    <Users className="h-8 w-8 text-white" />
                  </div>
                  <div className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-blue-500">
                    <Users className="h-3 w-3 text-white" />
                  </div>
                  <div className="absolute -bottom-2 -left-2 flex h-5 w-5 items-center justify-center rounded-full bg-purple-300">
                    <Users className="h-2.5 w-2.5 text-white" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <h3 className="text-lg font-semibold text-gray-900">
              Your journey is private by default
            </h3>
            <p className="mx-auto max-w-md text-gray-600">
              Share with others to pass on your knowledge, receive help, and
              build connections along the way.
            </p>
          </div>
        </div>
      ) : (
        /* People List - Show existing people with access */
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-gray-900">
            People with view access
          </h3>

          {/* People list */}
          <div className="space-y-3">
            {Array.from(userPermissionsMap.values()).map(
              ({ user, accessLevel }) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between rounded-xl border border-gray-200 p-4"
                  data-testid={`permission-${user.userName.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <Avatar className="h-12 w-12 border border-white">
                      <AvatarImage src={user.avatarUrl} alt={user.userName} />
                      <AvatarFallback className="bg-blue-100">
                        {user.firstName && user.lastName ? (
                          `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
                        ) : user.firstName ? (
                          user.firstName.slice(0, 2).toUpperCase()
                        ) : user.lastName ? (
                          user.lastName.slice(0, 2).toUpperCase()
                        ) : user.userName ? (
                          user.userName.slice(0, 2).toUpperCase()
                        ) : (
                          <Users className="h-6 w-6 text-blue-600" />
                        )}
                      </AvatarFallback>
                    </Avatar>

                    {/* Person Info */}
                    <div className="space-y-0.5">
                      <div className="text-base font-semibold text-gray-900">
                        {user.firstName && user.lastName
                          ? `${user.firstName} ${user.lastName}`
                          : user.firstName ||
                            user.lastName ||
                            user.userName ||
                            `User ${user.id}`}
                      </div>
                      {user.experienceLine && (
                        <div className="text-sm text-gray-600">
                          {user.experienceLine}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Access Level Controls */}
                  <div className="flex items-center gap-2">
                    {/* Access level label */}
                    <span className="mr-2 text-sm font-medium text-gray-700">
                      {userAccessLevels[user.id] ||
                        (accessLevel === VisibilityLevel.Overview
                          ? 'Limited access'
                          : 'Full access')}
                    </span>

                    {/* Edit Access button */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handlePersonSelect(user)}
                      className="h-8"
                    >
                      Edit access
                    </Button>

                    {/* Remove Access button */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => removeAccessMutation.mutate(user.id)}
                      disabled={removingUserId === user.id}
                      className="h-8 border-red-200 text-red-600 hover:bg-red-50"
                    >
                      {removingUserId === user.id
                        ? 'Removing...'
                        : 'Remove access'}
                    </Button>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
};
