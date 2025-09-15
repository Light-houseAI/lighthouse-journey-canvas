import { TimelineNode } from '@shared/schema';
import { AnimatePresence,motion } from 'framer-motion';
import { X } from 'lucide-react';
import React, { useState } from 'react';

import { useProfileViewStore } from '../../../stores/profile-view-store';
import { formatDateRange } from '../../../utils/date-parser';
import { NodeIcon } from '../../icons/NodeIcons';
import { ShareButton } from '../../share/ShareButton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../../ui/alert-dialog';
import { InsightsSection } from '../shared/InsightsSection';
import { ProjectForm } from './ProjectModal';

interface ProjectNodePanelProps {
  node: TimelineNode;
}

interface ProjectViewProps {
  node: TimelineNode;
  onEdit: () => void;
  onDelete: () => void;
  canEdit: boolean;
}

const ProjectView: React.FC<ProjectViewProps> = ({ node, onEdit, onDelete, canEdit }) => {
  const getProjectTitle = () => {
    return node.meta.title || node.meta.description || 'Project';
  };

  return (
    <>
      {/* Project Title with Magic Card Effect */}
      <div className="relative mb-6 p-6 rounded-2xl bg-gradient-to-br from-white to-purple-50 border border-purple-200/50 shadow-lg">
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-purple-600/5 via-transparent to-purple-700/5"></div>
        <div className="relative">
          <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-800 to-pink-600 bg-clip-text text-transparent">
            {getProjectTitle()}
          </h3>
          {node.meta.projectType && (
            <span className="inline-block mt-3 px-4 py-2 bg-gradient-to-r from-purple-100 to-purple-100 text-purple-700 text-sm rounded-full font-medium capitalize border border-purple-200/50">
              {node.meta.projectType}
            </span>
          )}
        </div>
      </div>
      
      {/* Duration */}
      {(node.meta.startDate || node.meta.endDate) && (
        <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-purple-50 to-slate-50 border border-purple-200/50">
          <span className="text-xs font-semibold text-purple-600 uppercase tracking-wider">Duration</span>
          <p className="text-slate-900 mt-2 font-medium">
            {formatDateRange(node.meta.startDate, node.meta.endDate)}
          </p>
        </div>
      )}

      {/* Technologies */}
      {node.meta.technologies && node.meta.technologies.length > 0 && (
        <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-pink-50 to-purple-50 border border-pink-200/50">
          <span className="text-xs font-semibold text-pink-600 uppercase tracking-wider">Technologies</span>
          <div className="mt-3 flex flex-wrap gap-2">
            {node.meta.technologies.map((tech: string, index: number) => (
              <span
                key={index}
                className="px-3 py-1 bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 text-xs rounded-full font-medium border border-purple-200/30"
              >
                {tech.trim()}
              </span>
            ))}
          </div>
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
            className="group relative flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-purple-700 text-white font-medium transition-all duration-300 hover:shadow-lg hover:shadow-purple-600/25 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-purple-700 to-purple-800 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
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
                <AlertDialogTitle className="text-slate-900">Delete Project</AlertDialogTitle>
                <AlertDialogDescription className="text-slate-600">
                  Are you sure you want to delete "{getProjectTitle()}"? This action cannot be undone.
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
      )}

      {/* Insights Section */}
      <InsightsSection nodeId={node.id} />
    </>
  );
};



export const ProjectNodePanel: React.FC<ProjectNodePanelProps> = ({ node }) => {
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
    try {
      await deleteNode(node.id);
    } catch (error) {
      console.error('Failed to delete project node:', error);
    }
  };

  const renderContent = () => {
    if (mode === 'edit' && canEdit) {
      return (
        <ProjectForm
          node={node}
          onSuccess={() => setMode('view')}
          onFailure={(error) => console.error('Failed to update project:', error)}
        />
      );
    }

    return (
      <ProjectView
        node={node}
        onEdit={() => setMode('edit')}
        onDelete={handleDelete}
        canEdit={canEdit}
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
        <div className="relative h-full bg-gradient-to-br from-purple-50 via-white to-pink-50 shadow-2xl border border-purple-200">
          {/* Animated Border Beam */}
          <div className="absolute inset-0 rounded-none overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-600/20 to-transparent animate-pulse"></div>
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-purple-500 to-transparent animate-shimmer"></div>
          </div>
          
          <div className="relative h-full flex flex-col backdrop-blur-sm bg-white/80">
            {/* Enhanced Header with Gradient */}
            <div className="px-6 py-4 border-b border-purple-200/50 flex items-center justify-between bg-gradient-to-r from-purple-50/50 to-white/50 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-purple-700 flex items-center justify-center shadow-lg">
                  <NodeIcon type="project" size={20} className="text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-bold bg-gradient-to-r from-purple-700 to-pink-900 bg-clip-text text-transparent uppercase tracking-wider">
                    Project
                  </h2>
                  <div className="w-8 h-0.5 bg-gradient-to-r from-purple-600 to-purple-700 rounded-full"></div>
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
                  className="group relative p-2 rounded-full transition-all duration-300 hover:bg-purple-100 hover:shadow-lg"
                >
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-400/0 via-purple-400/10 to-purple-400/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <X className="h-5 w-5 text-purple-400 group-hover:text-purple-600 relative z-10 transition-colors duration-300" />
                </button>
              </div>
            </div>

            {/* Enhanced Content Area */}
            <div className="flex-1 overflow-y-auto">
              <div className="relative p-6">
                {/* Subtle background pattern */}
                <div className="absolute inset-0 opacity-5">
                  <div className="absolute inset-0" style={{
                    backgroundImage: `radial-gradient(circle at 1px 1px, rgb(147 51 234) 1px, transparent 0)`,
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