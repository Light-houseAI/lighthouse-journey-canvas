import { TimelineNode } from '@shared/schema';
import { AnimatePresence,motion } from 'framer-motion';
import { X } from 'lucide-react';
import React, { useState } from 'react';

import { useProfileViewStore } from '../../../stores/profile-view-store';
import { formatDateRange } from '../../../utils/date-parser';
import { NodeIcon } from '../../icons/NodeIcons';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../../ui/alert-dialog';
import { InsightsSection } from '../shared/InsightsSection';
import { CareerTransitionForm } from './CareerTransitionModal';

interface CareerTransitionNodePanelProps {
  node: TimelineNode;
}

interface CareerTransitionViewProps {
  node: TimelineNode;
  onEdit: () => void;
  onDelete: () => void;
}

const CareerTransitionView: React.FC<CareerTransitionViewProps> = ({ node, onEdit, onDelete }) => {
  const getCareerTransitionTitle = () => {
    // Generate title from node meta.title or create a default one
    return node.meta.title || 'Career Transition';
  };

  return (
    <>
      {/* Career Transition Title with Magic Card Effect */}
      <div className="relative mb-6 p-6 rounded-2xl bg-gradient-to-br from-white to-violet-50 border border-violet-200/50 shadow-lg">
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-violet-500/5 via-transparent to-violet-600/5"></div>
        <div className="relative">
          <h3 className="text-2xl font-bold bg-gradient-to-r from-violet-800 to-violet-600 bg-clip-text text-transparent">
            {getCareerTransitionTitle()}
          </h3>
          {(node.meta as any).transitionType && (
            <span className="inline-block mt-2 px-3 py-1 bg-violet-100 text-violet-700 text-sm rounded-full capitalize font-medium">
              {(node.meta as any).transitionType.replace('_', ' ')}
            </span>
          )}
        </div>
      </div>
      
      {/* Duration */}
      {(node.meta.startDate || node.meta.endDate) && (
        <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-violet-50 to-slate-50 border border-violet-200/50">
          <span className="text-xs font-semibold text-violet-600 uppercase tracking-wider">Duration</span>
          <p className="text-slate-900 mt-2 font-medium">
            {formatDateRange(node.meta.startDate, node.meta.endDate)}
          </p>
        </div>
      )}

      {/* Transition Details */}
      {((node.meta as any).fromRole || (node.meta as any).toRole) && (
        <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-violet-50 to-white border border-violet-200/50">
          <span className="text-xs font-semibold text-violet-600 uppercase tracking-wider">Transition</span>
          <div className="mt-2 space-y-1">
            {(node.meta as any).fromRole && (
              <p className="text-slate-900 font-medium">From: {(node.meta as any).fromRole}</p>
            )}
            {(node.meta as any).toRole && (
              <p className="text-slate-900 font-medium">To: {(node.meta as any).toRole}</p>
            )}
          </div>
        </div>
      )}

      {/* Reason */}
      {(node.meta as any).reason && (
        <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-slate-50 to-white border border-slate-200/50">
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Reason</span>
          <p className="text-slate-900 mt-2 whitespace-pre-wrap leading-relaxed">{(node.meta as any).reason}</p>
        </div>
      )}

      {/* Outcome */}
      {(node.meta as any).outcome && (
        <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-violet-50 to-violet-100 border border-violet-200/50">
          <span className="text-xs font-semibold text-violet-600 uppercase tracking-wider">Outcome</span>
          <p className="text-slate-900 mt-2 whitespace-pre-wrap leading-relaxed">{(node.meta as any).outcome}</p>
        </div>
      )}

      {/* Description */}
      {node.meta.description && (
        <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-slate-50 to-white border border-slate-200/50">
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Description</span>
          <p className="text-slate-900 mt-2 whitespace-pre-wrap leading-relaxed">{node.meta.description}</p>
        </div>
      )}

      {/* Enhanced Action Buttons */}
      <div className="flex gap-3 mt-8">
        <button
          onClick={onEdit}
          className="group relative flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-violet-600 text-white font-medium transition-all duration-300 hover:shadow-lg hover:shadow-violet-500/25 overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-violet-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
          <span className="relative z-10">Edit</span>
        </button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              className="group relative flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white font-medium transition-all duration-300 hover:shadow-lg hover:shadow-red-500/25 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-red-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
              <span className="relative z-10">Delete</span>
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent className="bg-white border border-slate-200 shadow-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-slate-900">Delete Career Transition</AlertDialogTitle>
              <AlertDialogDescription className="text-slate-600">
                Are you sure you want to delete "{getCareerTransitionTitle()}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-300">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={onDelete}
                className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Insights Section */}
      <InsightsSection nodeId={node.id} />
    </>
  );
};



export const CareerTransitionNodePanel: React.FC<CareerTransitionNodePanelProps> = ({ node }) => {
  const closePanel = useProfileViewStore((state) => state.closePanel);
  const [mode, setMode] = useState<'view' | 'edit'>('view');

  // Use server-driven permissions from node data
  const canEdit = node.permissions?.canEdit;
  // Note: For ProfileListView context, we don't have delete functionality yet
  const deleteNode = undefined;

  const handleClose = () => {
    closePanel(); // Close the panel properly using ProfileViewStore
  };

  const handleDelete = async () => {
    if (!deleteNode) {
      console.warn('Delete operation not available in read-only mode');
      return;
    }
    
    try {
      await deleteNode(node.id);
    } catch (error) {
      console.error('Failed to delete career transition node:', error);
    }
  };

  const renderContent = () => {
    if (mode === 'edit' && canEdit) {
      return (
        <CareerTransitionForm
          node={node}
          onSuccess={() => setMode('view')}
          onFailure={(error) => console.error('Failed to update career transition:', error)}
        />
      );
    }

    return (
      <CareerTransitionView
        node={node}
        onEdit={() => canEdit && setMode('edit')}
        onDelete={handleDelete}
        canEdit={!!canEdit}
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
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-violet-500/20 to-transparent animate-pulse"></div>
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-violet-400 to-transparent animate-shimmer"></div>
          </div>

          <div className="relative h-full flex flex-col backdrop-blur-sm bg-white/80">
            {/* Enhanced Header with Gradient */}
            <div className="px-6 py-4 border-b border-slate-200/50 flex items-center justify-between bg-gradient-to-r from-slate-50/50 to-white/50 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shadow-lg">
                  <NodeIcon type="careerTransition" size={20} className="text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-bold bg-gradient-to-r from-slate-700 to-slate-900 bg-clip-text text-transparent uppercase tracking-wider">
                    Career Transition
                  </h2>
                  <div className="w-8 h-0.5 bg-gradient-to-r from-violet-500 to-violet-600 rounded-full"></div>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="group relative p-2 rounded-full transition-all duration-300 hover:bg-slate-100 hover:shadow-lg"
              >
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-slate-400/0 via-slate-400/10 to-slate-400/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <X className="h-5 w-5 text-slate-400 group-hover:text-slate-600 relative z-10 transition-colors duration-300" />
              </button>
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
