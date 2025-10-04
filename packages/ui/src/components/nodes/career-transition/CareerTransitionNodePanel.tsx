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
import { TimelineNode, UpdateResponse } from '@journey/schema';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import React, { useState } from 'react';

import { useProfileViewStore } from '../../../stores/profile-view-store';
import { formatDateRange } from '../../../utils/date-parser';
import { handleAPIError, showSuccessToast } from '../../../utils/error-toast';
import { NodeIcon } from '../../icons/NodeIcons';
import { InsightsSection } from '../shared/InsightsSection';
import { CareerTransitionForm } from './CareerTransitionModal';
import { CareerUpdatesList } from './CareerUpdatesList';
import { CareerUpdateWizard } from './wizard/CareerUpdateWizard';

interface CareerTransitionNodePanelProps {
  node: TimelineNode;
  deleteNode?: (nodeId: string) => Promise<void>;
}

interface CareerTransitionViewProps {
  node: TimelineNode;
  onEdit: () => void;
  onDelete: () => void;
  canEdit: boolean;
  isDeleting?: boolean;
  onShowUpdateModal?: () => void;
  onEditUpdate?: (update: UpdateResponse) => void;
}

const CareerTransitionView: React.FC<CareerTransitionViewProps> = ({
  node,
  onShowUpdateModal,
  onEditUpdate,
  onEdit,
  onDelete,
  canEdit,
  isDeleting,
}) => {
  const getCareerTransitionTitle = () => {
    // Generate title from node meta.title or create a default one
    return node.meta.title || 'Career Transition';
  };

  return (
    <>
      {/* Career Transition Title with Magic Card Effect */}
      <div className="relative mb-6 rounded-2xl border border-violet-200/50 bg-gradient-to-br from-white to-violet-50 p-6 shadow-lg">
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-violet-500/5 via-transparent to-violet-600/5"></div>
        <div className="relative">
          <h3 className="bg-gradient-to-r from-violet-800 to-violet-600 bg-clip-text text-2xl font-bold text-transparent">
            {getCareerTransitionTitle()}
          </h3>
          {(node.meta as any).transitionType && (
            <span className="mt-2 inline-block rounded-full bg-violet-100 px-3 py-1 text-sm font-medium capitalize text-violet-700">
              {(node.meta as any).transitionType.replace('_', ' ')}
            </span>
          )}
        </div>
      </div>

      {/* Duration */}
      {(node.meta.startDate || node.meta.endDate) && (
        <div className="mb-6 rounded-xl border border-violet-200/50 bg-gradient-to-r from-violet-50 to-slate-50 p-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-violet-600">
            Duration
          </span>
          <p className="mt-2 font-medium text-slate-900">
            {formatDateRange(node.meta.startDate, node.meta.endDate)}
          </p>
        </div>
      )}

      {/* Transition Details */}
      {((node.meta as any).fromRole || (node.meta as any).toRole) && (
        <div className="mb-6 rounded-xl border border-violet-200/50 bg-gradient-to-r from-violet-50 to-white p-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-violet-600">
            Transition
          </span>
          <div className="mt-2 space-y-1">
            {(node.meta as any).fromRole && (
              <p className="font-medium text-slate-900">
                From: {(node.meta as any).fromRole}
              </p>
            )}
            {(node.meta as any).toRole && (
              <p className="font-medium text-slate-900">
                To: {(node.meta as any).toRole}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Reason */}
      {(node.meta as any).reason && (
        <div className="mb-6 rounded-xl border border-slate-200/50 bg-gradient-to-r from-slate-50 to-white p-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
            Reason
          </span>
          <p className="mt-2 whitespace-pre-wrap leading-relaxed text-slate-900">
            {(node.meta as any).reason}
          </p>
        </div>
      )}

      {/* Outcome */}
      {(node.meta as any).outcome && (
        <div className="mb-6 rounded-xl border border-violet-200/50 bg-gradient-to-r from-violet-50 to-violet-100 p-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-violet-600">
            Outcome
          </span>
          <p className="mt-2 whitespace-pre-wrap leading-relaxed text-slate-900">
            {(node.meta as any).outcome}
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

      {/* Career Updates Section */}
      <div className="mb-6 mt-6 rounded-xl border border-violet-200/50 bg-gradient-to-r from-violet-50 to-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="bg-gradient-to-r from-violet-800 to-violet-600 bg-clip-text text-xl font-bold text-transparent">
            Career Updates
          </h3>
          {canEdit && (
            <button
              onClick={onShowUpdateModal}
              className="rounded-lg bg-gradient-to-r from-violet-500 to-violet-600 px-4 py-2 text-sm font-medium text-white shadow-md transition-all hover:shadow-lg"
            >
              Add Update
            </button>
          )}
        </div>

        <CareerUpdatesList
          nodeId={node.id}
          canEdit={!!canEdit}
          onEditUpdate={onEditUpdate}
        />
      </div>

      {/* Enhanced Action Buttons - Only show if can edit */}
      {canEdit && (
        <div className="mt-8 flex gap-3">
          <button
            onClick={onEdit}
            className="group relative flex-1 overflow-hidden rounded-xl bg-gradient-to-r from-violet-500 to-violet-600 px-6 py-3 font-medium text-white transition-all duration-300 hover:shadow-lg hover:shadow-violet-500/25"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-violet-700 opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
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
                <AlertDialogTitle>Delete Career Transition</AlertDialogTitle>
                <AlertDialogDescription>
                  {`Are you sure you want to delete "${getCareerTransitionTitle()}"? This action cannot be undone.`}
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

      <InsightsSection node={node} />
    </>
  );
};

export const CareerTransitionNodePanel: React.FC<
  CareerTransitionNodePanelProps
> = ({ node, deleteNode: deleteNodeProp }) => {
  const closePanel = useProfileViewStore((state) => state.closePanel);
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [showUpdateModal, setShowUpdateModal] = useState(false);

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
      showSuccessToast('Career transition deleted successfully!');
      closePanel(); // Close panel after successful deletion
    },
    onError: (error) => {
      handleAPIError(error, 'Career transition deletion');
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
        <CareerTransitionForm
          node={node}
          onSuccess={() => setMode('view')}
          onFailure={(error) =>
            console.error('Failed to update career transition:', error)
          }
        />
      );
    }

    return (
      <CareerTransitionView
        onShowUpdateModal={() => {
          setShowUpdateModal(true);
        }}
        onEditUpdate={() => {
          setShowUpdateModal(true);
        }}
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
        <div className="relative h-full border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-100 shadow-2xl">
          {/* Animated Border Beam */}
          <div className="absolute inset-0 overflow-hidden rounded-none">
            <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-violet-500/20 to-transparent"></div>
            <div className="animate-shimmer absolute left-0 top-0 h-[1px] w-full bg-gradient-to-r from-transparent via-violet-400 to-transparent"></div>
          </div>

          <div className="relative flex h-full flex-col bg-white/80 backdrop-blur-sm">
            {/* Enhanced Header with Gradient */}
            <div className="flex items-center justify-between border-b border-slate-200/50 bg-gradient-to-r from-slate-50/50 to-white/50 px-6 py-4 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-violet-600 shadow-lg">
                  <NodeIcon
                    type="careerTransition"
                    size={20}
                    className="text-white"
                  />
                </div>
                <div>
                  <h2 className="bg-gradient-to-r from-slate-700 to-slate-900 bg-clip-text text-sm font-bold uppercase tracking-wider text-transparent">
                    Career Transition
                  </h2>
                  <div className="h-0.5 w-8 rounded-full bg-gradient-to-r from-violet-500 to-violet-600"></div>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="group relative rounded-full p-2 transition-all duration-300 hover:bg-slate-100 hover:shadow-lg"
              >
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-slate-400/0 via-slate-400/10 to-slate-400/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
                <X className="relative z-10 h-5 w-5 text-slate-400 transition-colors duration-300 group-hover:text-slate-600" />
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
                      backgroundImage: `radial-gradient(circle at 1px 1px, rgb(148 163 184) 1px, transparent 0)`,
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

      {/* Career Update Modal */}
      {showUpdateModal && (
        <CareerUpdateWizard
          nodeId={node.id}
          onSuccess={() => {
            setShowUpdateModal(false);
            queryClient.invalidateQueries({ queryKey: ['updates', node.id] });
            queryClient.invalidateQueries({ queryKey: ['timeline'] });
          }}
          onCancel={() => {
            setShowUpdateModal(false);
          }}
        />
      )}
    </AnimatePresence>
  );
};
