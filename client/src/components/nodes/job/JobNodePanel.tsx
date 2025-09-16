import { TimelineNode } from '@shared/schema';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence,motion } from 'framer-motion';
import { X } from 'lucide-react';
import React, { useState } from 'react';

import { useProfileViewStore } from '../../../stores/profile-view-store';
import { formatDateRange } from '../../../utils/date-parser';
import { handleAPIError, showSuccessToast } from '../../../utils/error-toast';
import { NodeIcon } from '../../icons/NodeIcons';
import { ShareButton } from '../../share/ShareButton';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../../ui/alert-dialog';
import { InsightsSection } from '../shared/InsightsSection';
import { JobForm } from './JobModal';

interface JobNodePanelProps {
  node: TimelineNode;
  deleteNode?: (nodeId: string) => Promise<void>;
}

interface JobViewProps {
  node: TimelineNode;
  onEdit: () => void;
  onDelete: () => void;
  canEdit: boolean;
  isDeleting?: boolean;
  isDeleteDialogOpen: boolean;
  setIsDeleteDialogOpen: (open: boolean) => void;
}

const JobView: React.FC<JobViewProps> = ({ node, onEdit, onDelete, canEdit, isDeleting, isDeleteDialogOpen, setIsDeleteDialogOpen }) => {
  console.log('🎭 JobView received isDeleting prop:', isDeleting);
  // Extract organization name with fallback
  const organizationName = (node.meta as any)?.organizationName || (node.meta as any)?.company || 'Company';
  
  const getJobTitle = () => {
    if (node.meta.role && organizationName !== 'Company') {
      return `${node.meta.role} at ${organizationName}`;
    } else if (node.meta.role) {
      return node.meta.role;
    } else if (organizationName !== 'Company') {
      return `Job at ${organizationName}`;
    }
    return 'Job';
  };

  return (
    <>
      {/* Job Title with Magic Card Effect */}
      <div className="relative mb-6 p-6 rounded-2xl bg-gradient-to-br from-white to-slate-50 border border-slate-200/50 shadow-lg">
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-cyan-500/5 via-transparent to-cyan-600/5"></div>
        <div className="relative">
          <h3 className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
            {getJobTitle()}
          </h3>
          {organizationName && organizationName !== 'Company' && (
            <p className="text-lg text-slate-600 mt-1">{organizationName}</p>
          )}
          {node.meta.location && (
            <div className="flex items-center mt-2 text-sm text-slate-500">
              <div className="w-1 h-1 bg-slate-400 rounded-full mr-2"></div>
              {node.meta.location}
            </div>
          )}
        </div>
      </div>

      {/* Duration */}
      {(node.meta.startDate || node.meta.endDate) && (
        <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-cyan-50 to-slate-50 border border-cyan-200/50">
          <span className="text-xs font-semibold text-cyan-600 uppercase tracking-wider">Duration</span>
          <p className="text-slate-900 mt-2 font-medium">
            {formatDateRange(node.meta.startDate, node.meta.endDate)}
          </p>
        </div>
      )}

      {/* Description */}
      {node.meta.description && (
        <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-slate-50 to-white border border-slate-200/50">
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Description</span>
          <p className="text-slate-900 mt-2 whitespace-pre-wrap leading-relaxed">{node.meta.description}</p>
        </div>
      )}

      {/* Enhanced Action Buttons - Only show if can edit */}
      {canEdit && (
        <div className="flex gap-3 mt-8">
          <button
            onClick={onEdit}
            className="group relative flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-medium transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/25 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-600 to-cyan-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
            <span className="relative z-10">Edit</span>
          </button>

          <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogTrigger asChild>
              <button
                data-testid="delete-button-panel"
                disabled={isDeleting}
                className="group relative flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white font-medium transition-all duration-300 hover:shadow-lg hover:shadow-red-500/25 overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-red-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                <span className="relative z-10 flex items-center justify-center">
                  {isDeleting ? (
                    <>
                      <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>DELETING...</span>
                    </>
                  ) : (
                    'Delete'
                  )}
                </span>
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-white border border-slate-200 shadow-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-slate-900">Delete Job</AlertDialogTitle>
                <AlertDialogDescription className="text-slate-600">
                  Are you sure you want to delete "{getJobTitle()}"? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel 
                  className="bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-300"
                  disabled={isDeleting}
                >
                  Cancel
                </AlertDialogCancel>
                <button
                  data-testid="delete-button-confirm"
                  onClick={(e) => {
                    e.preventDefault();
                    onDelete();
                  }}
                  disabled={isDeleting}
                  className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-md font-medium"
                >
                  Delete
                </button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {/* Insights Section */}
      <InsightsSection nodeId={node.id} />
    </>
  );
};

export const JobNodePanel: React.FC<JobNodePanelProps> = ({ node, deleteNode: deleteNodeProp }) => {
  const closePanel = useProfileViewStore((state) => state.closePanel);
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Use server-driven permissions from node data
  const canEdit = node.permissions?.canEdit;
  // Use passed deleteNode function or undefined if not provided
  const deleteNode = deleteNodeProp;

  // Delete mutation with loading state and data refresh
  const deleteMutation = useMutation({
    mutationFn: async () => {
      console.log('🚀 Mutation function started, isPending should be true');
      if (!deleteNode) {
        throw new Error('Delete operation not available in read-only mode');
      }
      
      console.log('⏳ Calling deleteNode function...');
      // Wait for the API call to complete
      await deleteNode(node.id);
      
      console.log('🔄 API call completed, invalidating cache...');
      // Wait for cache invalidation to complete
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['timeline'] }),
        queryClient.invalidateQueries({ queryKey: ['nodes'] })
      ]);
      console.log('✅ Cache invalidation completed');
    },
    onSuccess: () => {
      console.log('🎉 Mutation success callback');
      showSuccessToast('Job deleted successfully!');
      setIsDeleteDialogOpen(false); // Close dialog first
      closePanel(); // Close panel after successful deletion
    },
    onError: (error) => {
      console.log('❌ Mutation error callback:', error);
      handleAPIError(error, 'Job deletion');
      setIsDeleteDialogOpen(false); // Close dialog on error too
    },
  });

  const handleClose = () => {
    closePanel(); // Close the panel properly using ProfileViewStore
  };

  const handleDelete = () => {
    console.log('🔥 Delete button clicked, starting mutation...');
    console.log('🔍 Before mutation - isPending:', deleteMutation.isPending);
    deleteMutation.mutate();
    console.log('🔍 After mutation call - isPending:', deleteMutation.isPending);
  };

  const renderContent = () => {
    if (mode === 'edit') {
      return (
        <JobForm
          node={node}
          onSuccess={() => setMode('view')}
          onFailure={(error) => console.error('Failed to update job:', error)}
        />
      );
    }

    console.log('🔍 JobView render - isDeleting:', deleteMutation.isPending);
    return (
      <JobView
        node={node}
        onEdit={() => canEdit && setMode('edit')}
        onDelete={handleDelete}
        canEdit={!!canEdit}
        isDeleting={deleteMutation.isPending}
        isDeleteDialogOpen={isDeleteDialogOpen}
        setIsDeleteDialogOpen={setIsDeleteDialogOpen}
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
        className="fixed right-0 top-0 h-full w-96 z-50 overflow-hidden"
        style={{ colorScheme: 'light' }}
      >
        {/* Magic Card Container with Border Beam */}
        <div className="relative h-full bg-gradient-to-br from-slate-50 via-white to-slate-100 shadow-2xl border border-slate-200">
          {/* Animated Border Beam */}
          <div className="absolute inset-0 rounded-none overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent animate-pulse"></div>
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-shimmer"></div>
          </div>

          <div className="relative h-full flex flex-col backdrop-blur-sm bg-white/80">
            {/* Enhanced Header with Gradient */}
            <div className="px-6 py-4 border-b border-slate-200/50 flex items-center justify-between bg-gradient-to-r from-slate-50/50 to-white/50 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center shadow-lg">
                  <NodeIcon type="job" size={20} className="text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-bold bg-gradient-to-r from-slate-700 to-slate-900 bg-clip-text text-transparent uppercase tracking-wider">
                    Job Experience
                  </h2>
                  <div className="w-8 h-0.5 bg-gradient-to-r from-cyan-500 to-cyan-600 rounded-full"></div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Share Button - Only show for nodes that can be shared */}
                {node.permissions?.canShare && (
                  <ShareButton
                    nodes={[node]}
                    variant="ghost"
                    size="icon"
                    className="text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                  />
                )}
                
                <button
                  onClick={handleClose}
                  className="group relative p-2 rounded-full transition-all duration-300 hover:bg-slate-100 hover:shadow-lg"
                >
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-slate-400/0 via-slate-400/10 to-slate-400/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <X className="h-5 w-5 text-slate-400 group-hover:text-slate-600 relative z-10 transition-colors duration-300" />
                </button>
              </div>
            </div>

            {/* Enhanced Content Area */}
            <div className="flex-1 overflow-y-auto">
              <div className="relative p-6">
                {/* Subtle background pattern */}
                <div className="absolute inset-0 opacity-5">
                  <div className="absolute inset-0" style={{
                    backgroundImage: `radial-gradient(circle at 1px 1px, rgb(148 163 184) 1px, transparent 0)`,
                    backgroundSize: '20px 20px'
                  }}></div>
                </div>

                <div className="relative z-10">
                  {renderContent()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
