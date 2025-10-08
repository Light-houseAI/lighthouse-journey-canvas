import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
  GradientButton,
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
import { ShareButton } from '../../share/ShareButton';
import { InsightsSection } from '../shared/InsightsSection';
import { EventForm } from './EventModal';

interface EventNodePanelProps {
  node: TimelineNode;
  deleteNode?: (nodeId: string) => Promise<void>;
}

interface EventViewProps {
  node: TimelineNode;
  onEdit: () => void;
  onDelete: () => void;
  canEdit: boolean;
  isDeleting?: boolean;
}

const EventView: React.FC<EventViewProps> = ({
  node,
  onEdit,
  onDelete,
  canEdit,
  isDeleting,
}) => {
  const getEventTitle = () => {
    // Generate title from event title or meta
    return node.meta.title || 'Event';
  };

  return (
    <>
      {/* Event Title with Magic Card Effect */}
      <div className="relative mb-6 rounded-2xl border border-slate-200/50 bg-gradient-to-br from-white to-slate-50 p-6 shadow-lg">
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-orange-500/5 via-transparent to-orange-600/5"></div>
        <div className="relative">
          <h3 className="bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-2xl font-bold text-transparent">
            {getEventTitle()}
          </h3>
          {node.meta.eventType && (
            <span className="mt-2 inline-block rounded-full bg-orange-100 px-3 py-1 text-sm font-medium capitalize text-orange-700">
              {node.meta.eventType}
            </span>
          )}
          {node.meta.location && (
            <div className="mt-2 flex items-center text-sm text-slate-500">
              <div className="mr-2 h-1 w-1 rounded-full bg-slate-400"></div>
              {node.meta.location}
            </div>
          )}
        </div>
      </div>

      {/* Duration */}
      {(node.meta.startDate || node.meta.endDate) && (
        <div className="mb-6 rounded-xl border border-orange-200/50 bg-gradient-to-r from-orange-50 to-slate-50 p-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-orange-600">
            Duration
          </span>
          <p className="mt-2 font-medium text-slate-900">
            {formatDateRange(node.meta.startDate, node.meta.endDate)}
          </p>
        </div>
      )}

      {/* Organizer */}
      {node.meta.organizer && (
        <div className="mb-6 rounded-xl border border-orange-200/50 bg-gradient-to-r from-orange-50 to-white p-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-orange-600">
            Organizer
          </span>
          <p className="mt-2 font-medium text-slate-900">
            {node.meta.organizer}
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

      {/* Enhanced Action Buttons - Only show if can edit */}
      {canEdit && (
        <div className="mt-8 flex gap-3">
          <GradientButton
            onClick={onEdit}
            variant="orange"
            className="flex-1"
          >
            Edit
          </GradientButton>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <GradientButton
                data-testid="delete-button-panel"
                disabled={isDeleting}
                variant="destructive"
                className="flex-1"
              >
                <span className="flex items-center justify-center">
                  {isDeleting ? (
                    <>
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                      <span>DELETING...</span>
                    </>
                  ) : (
                    'Delete'
                  )}
                </span>
              </GradientButton>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Event</AlertDialogTitle>
                <AlertDialogDescription>
                  {`Are you sure you want to delete "${getEventTitle()}"? This action cannot be undone.`}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <GradientButton
                  data-testid="delete-button-confirm"
                  onClick={(e) => {
                    e.preventDefault();
                    onDelete();
                  }}
                  disabled={isDeleting}
                  variant="destructive"
                >
                  Delete
                </GradientButton>
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

export const EventNodePanel: React.FC<EventNodePanelProps> = ({
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
      showSuccessToast('Event deleted successfully!');
      closePanel(); // Close panel after successful deletion
    },
    onError: (error) => {
      handleAPIError(error, 'Event deletion');
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
        <EventForm
          node={node}
          onSuccess={() => setMode('view')}
          onFailure={(error) => console.error('Failed to update event:', error)}
        />
      );
    }

    return (
      <EventView
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
            <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-orange-500/20 to-transparent"></div>
            <div className="animate-shimmer absolute left-0 top-0 h-[1px] w-full bg-gradient-to-r from-transparent via-orange-400 to-transparent"></div>
          </div>

          <div className="relative flex h-full flex-col bg-white/80 backdrop-blur-sm">
            {/* Enhanced Header with Gradient */}
            <div className="flex items-center justify-between border-b border-slate-200/50 bg-gradient-to-r from-slate-50/50 to-white/50 px-6 py-4 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-orange-600 shadow-lg">
                  <NodeIcon type="event" size={20} className="text-white" />
                </div>
                <div>
                  <h2 className="bg-gradient-to-r from-slate-700 to-slate-900 bg-clip-text text-sm font-bold uppercase tracking-wider text-transparent">
                    Event Experience
                  </h2>
                  <div className="h-0.5 w-8 rounded-full bg-gradient-to-r from-orange-500 to-orange-600"></div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Share Button - Only show for nodes that can be shared */}
                {node.permissions?.canShare && (
                  <ShareButton
                    nodes={[node]}
                    variant="ghost"
                    size="icon"
                    className="text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  />
                )}

                <Button
                  onClick={handleClose}
                  variant="ghost"
                  className="group relative rounded-full p-2 transition-all duration-300 hover:bg-slate-100 hover:shadow-lg"
                >
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-slate-400/0 via-slate-400/10 to-slate-400/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
                  <X className="relative z-10 h-5 w-5 text-slate-400 transition-colors duration-300 group-hover:text-slate-600" />
                </Button>
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
    </AnimatePresence>
  );
};
