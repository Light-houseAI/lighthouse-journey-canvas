/**
 * NetworksAccessSection Component
 *
 * Displays user's actual organizations fetched from API
 * Shows universities, employers, and includes a general public option
 */

import {
  GraduationCap,
  Building2,
  Globe,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Organization } from '@shared/types';
import { getUserOrganizations } from '@/services/organization-api';
import {
  setNodePermissions,
  getNodePermissions,
  deleteNodePermission,
} from '@/services/permission-api';
import { VisibilityLevel } from '@shared/enums';
import {
  NetworkPermissionsView,
  NetworkPermissions,
} from './NetworkPermissionsView';
import { PublicAccessSection } from './PublicAccessSection';
import { useToast } from '@/hooks/use-toast';
import { useShareStore } from '@/stores/share-store';
import { Button } from '@/components/ui/button';

interface NetworkItem {
  id: string;
  organizationId?: number; // Original organization ID for API calls
  name: string;
  description: string;
  icon: React.ElementType;
  type: 'university' | 'employer' | 'public' | 'other';
  memberCount?: number;
  accessLevel: 'No access' | 'Limited access' | 'Full access';
  isPublic?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// Public network item is always available
const PUBLIC_NETWORK_ITEM: NetworkItem = {
  id: 'public',
  name: 'Public',
  description: 'Anybody with an account or share link',
  icon: Globe,
  type: 'public',
  accessLevel: 'No access',
  isPublic: true,
};

// Helper functions
function getOrgIcon(type: string): React.ElementType {
  switch (type) {
    case 'educational_institution':
    case 'university':
      return GraduationCap;
    case 'company':
    case 'employer':
      return Building2;
    default:
      return Building2;
  }
}

function getOrgDescription(type: string): string {
  switch (type) {
    case 'educational_institution':
      return 'Educational institution';
    case 'company':
      return 'Organization';
    default:
      return 'Organization';
  }
}

function mapOrgType(
  type: string
): 'university' | 'employer' | 'public' | 'other' {
  switch (type) {
    case 'educational_institution':
      return 'university';
    case 'company':
      return 'employer';
    default:
      return 'other';
  }
}

interface NetworksAccessSectionProps {
  onViewChange?: (isOpen: boolean) => void;
}

export const NetworksAccessSection: React.FC<NetworksAccessSectionProps> = ({
  onViewChange,
}) => {
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkItem | null>(
    null
  );
  const [networkAccessLevels, setNetworkAccessLevels] = useState<
    Record<string, 'Limited access' | 'Full access'>
  >({});
  const [removingNetworkId, setRemovingNetworkId] = useState<number | null>(
    null
  );
  const { toast } = useToast();
  const { config, userNodes, currentPermissions, isLoadingPermissions } =
    useShareStore();

  // Get the current node context
  const selectedNodeIds = config.selectedNodes;
  const shareAllNodes = config.shareAllNodes;

  // Get all node IDs when sharing all nodes
  const allNodeIds = userNodes.map((node) => node.id);

  // Fetch user's organizations from API
  const { data: organizations = [], isLoading: isLoadingOrgs } = useQuery({
    queryKey: ['userOrganizations'],
    queryFn: getUserOrganizations,
  });

  // Get organization permissions from the store (already fetched by ShareModal)
  const orgPermissionsMap = useMemo(() => {
    const map = new Map<number, VisibilityLevel>();

    // Use currentPermissions.organizations from the store
    currentPermissions.organizations.forEach((org) => {
      map.set(org.id, org.accessLevel);
    });

    return map;
  }, [currentPermissions.organizations]);

  // Mutation for removing network access
  const removeAccessMutation = useMutation({
    mutationFn: async (organizationId: number) => {
      setRemovingNetworkId(organizationId);
      const nodesToUpdate = shareAllNodes ? allNodeIds : selectedNodeIds;

      if (nodesToUpdate.length === 0) {
        throw new Error('No nodes available for updating');
      }

      // Get existing permissions and delete ones for this organization
      const promises = nodesToUpdate.map(async (nodeId) => {
        const policies = await getNodePermissions(nodeId);
        const policiesToDelete = policies.filter(
          (p) => p.subjectType === 'org' && p.subjectId === organizationId
        );

        // Delete each policy
        const deletePromises = policiesToDelete.map((policy) =>
          deleteNodePermission(nodeId, policy.id)
        );

        await Promise.all(deletePromises);
      });

      await Promise.all(promises);
    },
    onSuccess: (_, organizationId) => {
      // Remove the access level for this network
      setNetworkAccessLevels((prev) => {
        const newLevels = { ...prev };
        delete newLevels[organizationId.toString()];
        return newLevels;
      });

      toast({
        title: 'Access removed',
        description: 'Network access has been removed successfully.',
      });

      setRemovingNetworkId(null);
    },
    onError: (error) => {
      setRemovingNetworkId(null);
      toast({
        title: 'Error removing access',
        description:
          error instanceof Error ? error.message : 'Failed to remove access',
        variant: 'destructive',
      });
    },
  });

  // Mutation for saving network permissions
  const savePermissionsMutation = useMutation({
    mutationFn: async (permissions: NetworkPermissions) => {
      // Use all node IDs if sharing all, otherwise use selected node IDs
      const nodesToUpdate = shareAllNodes ? allNodeIds : selectedNodeIds;

      if (nodesToUpdate.length === 0) {
        throw new Error('No nodes available for sharing');
      }

      // Save permissions for each node
      const promises = nodesToUpdate.map((nodeId) => {
        return setNodePermissions(
          [
            {
              level:
                permissions.detailLevel === 'overview' ? 'overview' : 'full',
              action: 'view',
              subjectType: 'org',
              subjectId: permissions.organizationId,
              effect: 'ALLOW',
            },
          ],
          nodeId
        );
      });

      await Promise.all(promises);
    },
    onSuccess: (_, permissions) => {
      // Update the access level for this network
      setNetworkAccessLevels((prev) => ({
        ...prev,
        [permissions.organizationId.toString()]:
          permissions.detailLevel === 'overview'
            ? 'Limited access'
            : 'Full access',
      }));

      toast({
        title: 'Permissions saved',
        description: 'Network access settings have been updated successfully.',
      });
      setSelectedNetwork(null);
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

  // Convert organizations to NetworkItems and combine with permissions
  const networkItems: NetworkItem[] = useMemo(() => {
    const items = organizations.map((org) => {
      // Check both the permissions map and local state for access level
      const permissionLevel = orgPermissionsMap.get(org.id);
      const localLevel = networkAccessLevels[org.id.toString()];

      let accessLevel: 'No access' | 'Limited access' | 'Full access' =
        'No access';
      if (localLevel) {
        accessLevel = localLevel;
      } else if (permissionLevel) {
        accessLevel =
          permissionLevel === 'overview' ? 'Limited access' : 'Full access';
      }

      return {
        id: org.id.toString(),
        organizationId: org.id,
        name: org.name,
        description: getOrgDescription(org.type),
        icon: getOrgIcon(org.type),
        type: mapOrgType(org.type),
        accessLevel,
        createdAt: org.createdAt,
        updatedAt: org.updatedAt,
      };
    });

    return [...items, PUBLIC_NETWORK_ITEM];
  }, [organizations, orgPermissionsMap, networkAccessLevels]);

  const handleNetworkClick = (network: NetworkItem) => {
    setSelectedNetwork(network);
    onViewChange?.(true);
  };

  const handleBack = () => {
    setSelectedNetwork(null);
    onViewChange?.(false);
  };

  // If a network is selected, show the permissions view
  if (selectedNetwork) {
    // For public network, create a special organization object
    const organization: Organization = selectedNetwork.isPublic
      ? {
          id: 0,
          name: selectedNetwork.name,
          type: 'company' as any,
          metadata: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      : {
          id:
            selectedNetwork.organizationId || parseInt(selectedNetwork.id) || 0,
          name: selectedNetwork.name,
          type: (selectedNetwork.type === 'university'
            ? 'educational_institution'
            : selectedNetwork.type === 'employer'
              ? 'company'
              : 'company') as any,
          metadata: null,
          createdAt: selectedNetwork.createdAt || new Date(),
          updatedAt: selectedNetwork.updatedAt || new Date(),
        };

    return (
      <NetworkPermissionsView
        organization={organization}
        currentAccessLevel={
          selectedNetwork.accessLevel === 'Limited access'
            ? 'overview'
            : selectedNetwork.accessLevel === 'Full access'
              ? 'full'
              : undefined
        }
        onBack={handleBack}
        onSave={(permissions) => savePermissionsMutation.mutate(permissions)}
        isSaving={savePermissionsMutation.isPending}
      />
    );
  }

  // Show loading state while fetching organizations or permissions from store
  const isLoading = isLoadingOrgs || isLoadingPermissions;
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        <span className="ml-2 text-sm text-gray-600">
          Loading organizations...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-0" data-testid="networks-access-section">
      {networkItems.map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-4 border-b border-gray-100 py-4 last:border-0"
          data-testid={`selected-network-${item.name.replace(/\s+/g, '')}`}
        >
          {/* Icon */}
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
            <item.icon className="h-8 w-8 text-gray-800" strokeWidth={1.5} />
          </div>

          {/* Text */}
          <div className="flex-1">
            <div className="font-semibold text-gray-900">{item.name}</div>
            <div className="text-sm text-gray-600">
              {item.description}
              {!item.isPublic &&
                item.memberCount &&
                ` (${item.memberCount} members)`}
            </div>
          </div>

          {/* Access Level Controls */}
          <div className="flex items-center gap-2">
            {/* For public item, use the dropdown */}
            {item.isPublic ? (
              <PublicAccessSection />
            ) : item.accessLevel !== 'No access' ? (
              <>
                {/* Access level label */}
                <span className="mr-2 text-sm font-medium text-gray-700">
                  {item.accessLevel}
                </span>

                {/* Edit Access button */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleNetworkClick(item)}
                  className="h-8"
                >
                  Edit access
                </Button>

                {/* Remove Access button */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    removeAccessMutation.mutate(
                      item.organizationId || parseInt(item.id)
                    )
                  }
                  disabled={
                    removingNetworkId ===
                    (item.organizationId || parseInt(item.id))
                  }
                  className="h-8 border-red-200 text-red-600 hover:bg-red-50"
                >
                  {removingNetworkId ===
                  (item.organizationId || parseInt(item.id))
                    ? 'Removing...'
                    : 'Remove access'}
                </Button>
              </>
            ) : (
              <button
                onClick={() => handleNetworkClick(item)}
                className="flex items-center gap-2 rounded px-2 py-1 text-sm font-semibold text-black transition-colors hover:bg-gray-50"
                data-testid={`network-access-button-${item.name}`}
              >
                {item.accessLevel}
                <ChevronRight className="h-[18px] w-[18px]" />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
