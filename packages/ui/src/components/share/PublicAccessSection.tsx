/**
 * PublicAccessSection Component
 *
 * Inline public access control with dropdown for visibility level
 * Used within NetworksAccessSection
 */

import { VisibilityLevel } from '@journey/schema';
import { ChevronDown, Loader2 } from 'lucide-react';
import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useShareStore } from '@/stores/share-store';
import { useToast } from '@/hooks/use-toast';
import {
  setNodePermissions,
  deleteNodePermission,
} from '@/services/permission-api';

interface PublicAccessSectionProps {
  className?: string;
}

export const PublicAccessSection: React.FC<PublicAccessSectionProps> = ({
  className,
}) => {
  const { currentPermissions } = useShareStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get current public access state
  const isPublicEnabled = currentPermissions.public?.enabled || false;
  const publicAccessLevel =
    currentPermissions.public?.accessLevel || VisibilityLevel.Overview;

  // Determine the display text
  const getAccessLevelText = () => {
    if (!isPublicEnabled) return 'No access';
    return publicAccessLevel === VisibilityLevel.Full
      ? 'Full access'
      : 'Limited access';
  };

  // Mutation for changing public access
  const changePublicAccessMutation = useMutation({
    mutationFn: async (
      newLevel: 'No access' | 'Limited access' | 'Full access'
    ) => {
      // Get fresh values from store
      const { config, userNodes, currentPermissions } =
        useShareStore.getState();
      const freshSelectedNodeIds = config.selectedNodes;
      const freshShareAllNodes = config.shareAllNodes;
      const freshAllNodeIds = userNodes.map((node) => node.id);
      const nodesToUpdate = freshShareAllNodes
        ? freshAllNodeIds
        : freshSelectedNodeIds;

      if (nodesToUpdate.length === 0) {
        throw new Error('No nodes available for updating');
      }

      // If setting to "No access", delete all public policies
      if (newLevel === 'No access') {
        if (currentPermissions.public?.policyIds) {
          const deletePromises = currentPermissions.public.nodes.map((node) => {
            const nodeIndex = currentPermissions.public!.nodes.findIndex(
              (n) => n.nodeId === node.nodeId
            );
            const policyId = currentPermissions.public!.policyIds[nodeIndex];
            if (policyId) {
              return deleteNodePermission(node.nodeId, policyId);
            }
            return Promise.resolve();
          });
          await Promise.all(deletePromises);
        }
      } else {
        // First delete existing public policies if any
        if (currentPermissions.public?.policyIds) {
          const deletePromises = currentPermissions.public.nodes.map((node) => {
            const nodeIndex = currentPermissions.public!.nodes.findIndex(
              (n) => n.nodeId === node.nodeId
            );
            const policyId = currentPermissions.public!.policyIds[nodeIndex];
            if (policyId) {
              return deleteNodePermission(node.nodeId, policyId);
            }
            return Promise.resolve();
          });
          await Promise.all(deletePromises);
        }

        // Then create new policies with the selected level
        const level =
          newLevel === 'Full access'
            ? VisibilityLevel.Full
            : VisibilityLevel.Overview;
        const promises = nodesToUpdate.map((nodeId) =>
          setNodePermissions(
            [
              {
                level,
                action: 'view',
                subjectType: 'public',
                effect: 'ALLOW',
              },
            ],
            nodeId
          )
        );
        await Promise.all(promises);
      }

      return { newLevel, nodesToUpdate };
    },
    onSuccess: async ({ newLevel, nodesToUpdate }) => {
      // Invalidate queries
      await queryClient.invalidateQueries({
        queryKey: ['nodePermissions', nodesToUpdate],
      });

      // Refetch current permissions
      const { fetchCurrentPermissions } = useShareStore.getState();
      await fetchCurrentPermissions(nodesToUpdate);

      toast({
        title: 'Public access updated',
        description:
          newLevel === 'No access'
            ? 'Public access has been disabled'
            : `Public access set to ${newLevel}`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Error updating public access',
        description:
          error instanceof Error ? error.message : 'Failed to update',
        variant: 'destructive',
      });
    },
  });

  const handleAccessLevelChange = (
    level: 'No access' | 'Limited access' | 'Full access'
  ) => {
    changePublicAccessMutation.mutate(level);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'flex items-center gap-2 rounded px-2 py-1 text-sm font-semibold text-black transition-colors hover:bg-gray-50',
            className
          )}
          disabled={changePublicAccessMutation.isPending}
        >
          {changePublicAccessMutation.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <>
              {getAccessLevelText()}
              <ChevronDown className="h-4 w-4" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[200px]">
        <DropdownMenuItem
          onClick={() => handleAccessLevelChange('No access')}
          className={cn(
            'cursor-pointer',
            getAccessLevelText() === 'No access' && 'bg-gray-100'
          )}
        >
          No access
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleAccessLevelChange('Limited access')}
          className={cn(
            'cursor-pointer',
            getAccessLevelText() === 'Limited access' && 'bg-gray-100'
          )}
        >
          Limited access
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleAccessLevelChange('Full access')}
          className={cn(
            'cursor-pointer',
            getAccessLevelText() === 'Full access' && 'bg-gray-100'
          )}
        >
          Full access
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
