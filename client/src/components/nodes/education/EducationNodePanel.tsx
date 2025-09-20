import { TimelineNode } from '@shared/schema';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import React, { useState } from 'react';

import { useAuthStore } from '../../../stores/auth-store';
import { useProfileViewStore } from '../../../stores/profile-view-store';
import { formatDateRange } from '../../../utils/date-parser';
import { handleAPIError, showSuccessToast } from '../../../utils/error-toast';
import { NodeIcon } from '../../icons/NodeIcons';
import { ShareButton } from '../../share/ShareButton';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../../ui/alert-dialog';
import { InsightsSection } from '../shared/InsightsSection';
import { EducationForm } from './EducationModal';

interface EducationNodePanelProps {
  node: TimelineNode;
  deleteNode?: (nodeId: string) => Promise<void>;
}

interface EducationViewProps {
  node: TimelineNode;
  onEdit: () => void;
  onDelete: () => void;
  canEdit: boolean;
  isDeleting?: boolean;
}

const EducationView: React.FC<EducationViewProps> = ({
  node,
  onEdit,
  onDelete,
  canEdit,
  isDeleting,
}) => {
  // Extract organization name with fallback
  const organizationName =
    (node.meta as any)?.organizationName ||
    (node.meta as any)?.institution ||
    (node.meta as any)?.school ||
    'Institution';

  const getEducationTitle = () => {
    if (node.meta.degree && organizationName !== 'Institution') {
      return node.meta.field
        ? `${node.meta.degree} in ${node.meta.field} at ${organizationName}`
        : `${node.meta.degree} at ${organizationName}`;
    } else if (node.meta.degree) {
      return node.meta.field
        ? `${node.meta.degree} in ${node.meta.field}`
        : node.meta.degree;
    } else if (organizationName !== 'Institution') {
      return organizationName;
    }
    return 'Education';
  };

  return (
    <>
      {/* Education Title with Magic Card Effect */}
      <div className="relative mb-6 rounded-2xl border border-emerald-200/50 bg-gradient-to-br from-white to-emerald-50 p-6 shadow-lg">
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-emerald-500/5 via-transparent to-teal-500/5"></div>
        <div className="relative">
          <h3 className="bg-gradient-to-r from-emerald-800 to-teal-600 bg-clip-text text-2xl font-bold text-transparent">
            {getEducationTitle()}
          </h3>
          {organizationName !== 'Institution' && (
            <p className="mt-1 text-lg text-emerald-600">{organizationName}</p>
          )}
          {node.meta.location && (
            <div className="mt-2 flex items-center text-sm text-emerald-500">
              <div className="mr-2 h-1 w-1 rounded-full bg-emerald-400"></div>
              {node.meta.location}
            </div>
          )}
        </div>
      </div>

      {/* Duration */}
      {(node.meta.startDate || node.meta.endDate) && (
        <div className="mb-6 rounded-xl border border-emerald-200/50 bg-gradient-to-r from-emerald-50 to-teal-50 p-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
            Duration
          </span>
          <p className="mt-2 font-medium text-slate-900">
            {formatDateRange(node.meta.startDate, node.meta.endDate)}
          </p>
        </div>
      )}

      {/* Degree & Field */}
      {(node.meta.degree || node.meta.field) && (
        <div className="mb-6 rounded-xl border border-teal-200/50 bg-gradient-to-r from-teal-50 to-cyan-50 p-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-teal-600">
            Study
          </span>
          <div className="mt-2">
            {node.meta.degree && (
              <p className="font-medium text-slate-900">{node.meta.degree}</p>
            )}
            {node.meta.field && (
              <p className="text-sm text-teal-600">Field: {node.meta.field}</p>
            )}
          </div>
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

      {/* Enhanced Action Buttons - Only show if can edit */}
      {canEdit && (
        <div className="mt-8 flex gap-3">
          <button
            onClick={onEdit}
            className="group relative flex-1 overflow-hidden rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-3 font-medium text-white transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/25"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-teal-700 opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
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
            <AlertDialogContent className="border border-slate-200 bg-white shadow-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-slate-900">
                  Delete Education
                </AlertDialogTitle>
                <AlertDialogDescription className="text-slate-600">
                  {`Are you sure you want to delete "${getEducationTitle()}"? This action cannot be undone.`}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200">
                  Cancel
                </AlertDialogCancel>
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

export const EducationNodePanel: React.FC<EducationNodePanelProps> = ({
  node,
  deleteNode: deleteNodeProp,
}) => {
  const { user } = useAuthStore();
  const closePanel = useProfileViewStore((state) => state.closePanel);
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'view' | 'edit'>('view');

  // Check if current user owns this node
  const isOwner = user && user.id === node.userId;

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
      showSuccessToast('Education deleted successfully!');
      closePanel(); // Close panel after successful deletion
    },
    onError: (error) => {
      handleAPIError(error, 'Education deletion');
    },
  });

  const handleClose = () => {
    closePanel(); // Close the panel properly using ProfileViewStore
  };

  const handleDelete = () => {
    deleteMutation.mutate();
  };

  const renderContent = () => {
    if (mode === 'edit' && canEdit) {
      return (
        <EducationForm
          node={node}
          onSuccess={() => setMode('view')}
          onFailure={(error) =>
            console.error('Failed to update education:', error)
          }
        />
      );
    }

    return (
      <EducationView
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
        <div className="relative h-full border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-teal-50 shadow-2xl">
          {/* Animated Border Beam */}
          <div className="absolute inset-0 overflow-hidden rounded-none">
            <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent"></div>
            <div className="animate-shimmer absolute left-0 top-0 h-[1px] w-full bg-gradient-to-r from-transparent via-emerald-400 to-transparent"></div>
          </div>

          <div className="relative flex h-full flex-col bg-white/80 backdrop-blur-sm">
            {/* Enhanced Header with Gradient */}
            <div className="flex items-center justify-between border-b border-emerald-200/50 bg-gradient-to-r from-emerald-50/50 to-white/50 px-6 py-4 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg">
                  <NodeIcon type="education" size={20} className="text-white" />
                </div>
                <div>
                  <h2 className="bg-gradient-to-r from-emerald-700 to-teal-900 bg-clip-text text-sm font-bold uppercase tracking-wider text-transparent">
                    Education
                  </h2>
                  <div className="h-0.5 w-8 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600"></div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Share Button - Only show for node owners */}
                {isOwner && (
                  <ShareButton
                    nodes={[node]}
                    variant="ghost"
                    size="icon"
                    className="text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  />
                )}

                <button
                  onClick={handleClose}
                  className="group relative rounded-full p-2 transition-all duration-300 hover:bg-emerald-100 hover:shadow-lg"
                >
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-emerald-400/0 via-emerald-400/10 to-emerald-400/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
                  <X className="relative z-10 h-5 w-5 text-emerald-400 transition-colors duration-300 group-hover:text-emerald-600" />
                </button>
              </div>
            </div>

            {/* Enhanced Content Area */}
            <div className="flex-1 overflow-y-auto">
              <div className="relative p-6">
                {/* Subtle background pattern */}
                <div className="absolute inset-0 opacity-5">
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundImage: `radial-gradient(circle at 1px 1px, rgb(16 185 129) 1px, transparent 0)`,
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
