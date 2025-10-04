import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@journey/components';
import { TimelineNode } from '@journey/schema';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import React, { useState } from 'react';

import { useProfileViewStore } from '../../../stores/profile-view-store';
import { formatDateRange } from '../../../utils/date-parser';
import { handleAPIError, showSuccessToast } from '../../../utils/error-toast';
import { NodeIcon } from '../../icons/NodeIcons';
import { InsightsSection } from '../shared/InsightsSection';
import { ActionForm } from './ActionModal';

interface ActionNodePanelProps {
  node: TimelineNode;
  deleteNode?: (nodeId: string) => Promise<void>;
}

interface ActionViewProps {
  node: TimelineNode;
  onEdit: () => void;
  onDelete: () => void;
  canEdit: boolean;
  isDeleting?: boolean;
}

const ActionView: React.FC<ActionViewProps> = ({
  node,
  onEdit,
  onDelete,
  canEdit,
  isDeleting,
}) => {
  const getActionTitle = () => {
    return node.meta.title || 'Action';
  };

  return (
    <>
      {/* Action Title with Magic Card Effect */}
      <div className="relative mb-6 rounded-2xl border border-orange-200/50 bg-gradient-to-br from-white to-orange-50 p-6 shadow-lg">
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-red-500/5 via-transparent to-red-600/5"></div>
        <div className="relative">
          <h3 className="bg-gradient-to-r from-orange-800 to-amber-600 bg-clip-text text-2xl font-bold text-transparent">
            {getActionTitle()}
          </h3>
          {(node.meta as any).category && (
            <span className="mt-3 inline-block rounded-full border border-red-200/50 bg-gradient-to-r from-red-100 to-red-100 px-4 py-2 text-sm font-medium capitalize text-red-700">
              {(node.meta as any).category}
            </span>
          )}
        </div>
      </div>

      {/* Duration */}
      {(node.meta.startDate || node.meta.endDate) && (
        <div className="mb-6 rounded-xl border border-red-200/50 bg-gradient-to-r from-red-50 to-slate-50 p-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-red-600">
            Duration
          </span>
          <p className="mt-2 font-medium text-slate-900">
            {formatDateRange(node.meta.startDate, node.meta.endDate)}
          </p>
        </div>
      )}

      {/* Description */}
      {node.meta.description && (
        <div className="mb-6 rounded-xl border border-slate-200/50 bg-gradient-to-r from-slate-50 to-white p-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
            Description
          </span>
          <p className="mt-2 whitespace-pre-wrap leading-relaxed text-slate-900">
            {node.meta.description}
          </p>
        </div>
      )}

      {/* Impact */}
      {(node.meta as any).impact && (
        <div className="mb-6 rounded-xl border border-amber-200/50 bg-gradient-to-r from-amber-50 to-yellow-50 p-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-600">
            Impact
          </span>
          <p className="mt-2 leading-relaxed text-slate-900">
            {(node.meta as any).impact}
          </p>
        </div>
      )}

      {/* Verification */}
      {(node.meta as any).verification && (
        <div className="mb-6 rounded-xl border border-green-200/50 bg-gradient-to-r from-green-50 to-emerald-50 p-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-green-600">
            Verification
          </span>
          <p className="mt-2 leading-relaxed text-slate-900">
            {(node.meta as any).verification}
          </p>
        </div>
      )}

      {/* Enhanced Action Buttons - Only show for nodes that can be edited */}
      {canEdit && (
        <div className="mt-8 flex gap-3">
          <button
            onClick={onEdit}
            className="group relative flex-1 overflow-hidden rounded-xl bg-gradient-to-r from-red-500 to-red-600 px-6 py-3 font-medium text-white transition-all duration-300 hover:shadow-lg hover:shadow-red-500/25"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-red-700 opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
            <div className="absolute inset-0 translate-x-[-100%] bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-[100%]"></div>
            <span className="relative z-10">Edit</span>
          </button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                data-testid="delete-button-panel"
                disabled={isDeleting}
                className="group relative flex-1 overflow-hidden rounded-xl bg-gradient-to-r from-red-500 to-red-600 px-6 py-3 font-medium text-white transition-all duration-300 hover:shadow-lg hover:shadow-red-500/25 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-red-700 opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
                <div className="absolute inset-0 translate-x-[-100%] bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-[100%]"></div>
                <span className="relative z-10 flex items-center justify-center">
                  {isDeleting ? (
                    <>
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                      <span>DELETING...</span>
                    </>
                  ) : (
                    'Delete'
                  )}
                </span>
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Action</AlertDialogTitle>
                <AlertDialogDescription>
                  {`Are you sure you want to delete "${getActionTitle()}"? This action cannot be undone.`}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <button
                  data-testid="delete-button-confirm"
                  onClick={(e) => {
                    e.preventDefault();
                    onDelete();
                  }}
                  disabled={isDeleting}
                  className="rounded-md bg-gradient-to-r from-red-500 to-red-600 px-4 py-2 font-medium text-white shadow-lg hover:from-red-600 hover:to-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Delete
                </button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {/* Insights Section */}
      <InsightsSection node={node} />
    </>
  );
};

export const ActionNodePanel: React.FC<ActionNodePanelProps> = ({
  node,
  deleteNode: deleteNodeProp,
}) => {
  const closePanel = useProfileViewStore((state) => state.closePanel);
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'view' | 'edit'>('view');

  // Use server-driven permissions from node data
  const canEdit = node.permissions?.canEdit;
  // Use passed deleteNode function or undefined if not provided
  const deleteNode = deleteNodeProp;

  // Delete mutation with loading state and data refresh
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deleteNode) {
        throw new Error('Delete operation not available in read-only mode');
      }

      // Wait for the API call to complete
      await deleteNode(node.id);

      // Wait for cache invalidation to complete
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['timeline'] }),
        queryClient.invalidateQueries({ queryKey: ['nodes'] }),
      ]);
    },
    onSuccess: () => {
      showSuccessToast('Action deleted successfully!');
      closePanel(); // Close panel after successful deletion
    },
    onError: (error) => {
      handleAPIError(error, 'Action deletion');
    },
  });

  const handleClose = () => {
    closePanel(); // Close the panel properly using ProfileViewStore
  };

  const handleDelete = () => {
    deleteMutation.mutate();
  };

  const renderContent = () => {
    if (mode === 'edit') {
      return (
        <ActionForm
          node={node}
          onSuccess={() => setMode('view')}
          onFailure={(error) =>
            console.error('Failed to update action:', error)
          }
        />
      );
    }

    return (
      <ActionView
        node={node}
        onEdit={() => canEdit && setMode('edit')}
        onDelete={handleDelete}
        canEdit={!!canEdit}
        isDeleting={deleteMutation.isPending}
      />
    );
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed right-0 top-0 z-50 h-full w-96 overflow-hidden"
        style={{ colorScheme: 'light' }}
      >
        {/* Magic Card Container with Border Beam */}
        <div className="relative h-full border border-orange-200 bg-gradient-to-br from-orange-50 via-white to-amber-50 shadow-2xl">
          {/* Animated Border Beam */}
          <div className="absolute inset-0 overflow-hidden rounded-none">
            <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-red-500/20 to-transparent"></div>
            <div className="animate-shimmer absolute left-0 top-0 h-[1px] w-full bg-gradient-to-r from-transparent via-red-400 to-transparent"></div>
          </div>

          <div className="relative flex h-full flex-col bg-white/80 backdrop-blur-sm">
            {/* Enhanced Header with Gradient */}
            <div className="flex items-center justify-between border-b border-orange-200/50 bg-gradient-to-r from-orange-50/50 to-white/50 px-6 py-4 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-600 shadow-lg">
                  <NodeIcon type="action" size={20} className="text-white" />
                </div>
                <div>
                  <h2 className="bg-gradient-to-r from-orange-700 to-amber-900 bg-clip-text text-sm font-bold uppercase tracking-wider text-transparent">
                    Action
                  </h2>
                  <div className="h-0.5 w-8 rounded-full bg-gradient-to-r from-red-500 to-red-600"></div>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="group relative rounded-full p-2 transition-all duration-300 hover:bg-orange-100 hover:shadow-lg"
              >
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-orange-400/0 via-orange-400/10 to-orange-400/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
                <X className="relative z-10 h-5 w-5 text-orange-400 transition-colors duration-300 group-hover:text-orange-600" />
              </button>
            </div>

            {/* Enhanced Content Area */}
            <div className="flex-1 overflow-y-auto">
              <div className="relative p-6">
                {/* Subtle background pattern */}
                <div className="absolute inset-0 opacity-5">
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundImage: `radial-gradient(circle at 1px 1px, rgb(251 146 60) 1px, transparent 0)`,
                      backgroundSize: '20px 20px',
                    }}
                  ></div>
                </div>

                <div className="relative z-10">{renderContent()}</div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
