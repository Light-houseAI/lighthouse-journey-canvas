/**
 * PublicAccessSection Component
 *
 * Inline public access control with dropdown for visibility level
 * Used within NetworksAccessSection
 */

import { cn } from '@journey/components';
import { Button } from '@journey/components';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@journey/components'; // was: dropdown-menu
import {
  PermissionAction,
  PolicyEffect,
  SubjectType,
  TimelineNode,
  VisibilityLevel,
} from '@journey/schema';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Loader2 } from 'lucide-react';
import React from 'react';

import { useToast } from '../../hooks/use-toast';
import { CurrentPermissions } from '../../hooks/useSharing';
import {
  deleteNodePermission,
  setNodePermissions,
} from '../../services/permission-api';
import { useShareStore } from '../../stores/share-store';

interface PublicAccessSectionProps {
  className?: string;
  currentPermissions?: CurrentPermissions;
  userNodes: TimelineNode[];
}

export const PublicAccessSection: React.FC<PublicAccessSectionProps> = ({
  className,
  currentPermissions,
  userNodes,
}) => {
  const { config } = useShareStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get current public access state from props
  const isPublicEnabled = currentPermissions?.public?.enabled || false;
  const publicAccessLevel =
    currentPermissions?.public?.accessLevel || VisibilityLevel.Overview;

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
      // Get node IDs from config and userNodes props
      const allNodeIds = userNodes.map((node) => node.id);
      const nodesToUpdate = config.shareAllNodes
        ? allNodeIds
        : config.selectedNodes;

      if (nodesToUpdate.length === 0) {
        throw new Error('No nodes available for updating');
      }

      // If setting to "No access", delete all public policies
      if (newLevel === 'No access') {
        if (currentPermissions?.public?.policyIds) {
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
        if (currentPermissions?.public?.policyIds) {
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
                action: PermissionAction.View,
                subjectType: SubjectType.Public,
                effect: PolicyEffect.Allow,
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
      // Invalidate sharing permissions query to refresh the data
      await queryClient.invalidateQueries({
        queryKey: ['sharing', 'permissions', nodesToUpdate],
      });

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
