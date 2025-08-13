import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { NodeIcon } from '../../icons/NodeIcons';
import { TimelineNode } from '@shared/schema';
import { useHierarchyStore } from '../../../stores/hierarchy-store';
import { ActionForm } from './ActionModal';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../../ui/alert-dialog';
import { formatDateRange } from '../../../utils/date-parser';
import { InsightsSection } from '../shared/InsightsSection';

interface ActionNodePanelProps {
  node: TimelineNode;
}

interface ActionViewProps {
  node: TimelineNode;
  onEdit: () => void;
  onDelete: () => void;
  loading: boolean;
}

const ActionView: React.FC<ActionViewProps> = ({ node, onEdit, onDelete, loading }) => {
  const getActionTitle = () => {
    return node.meta.title || 'Action';
  };

  return (
    <>
      {/* Action Title with Magic Card Effect */}
      <div className="relative mb-6 p-6 rounded-2xl bg-gradient-to-br from-white to-orange-50 border border-orange-200/50 shadow-lg">
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-red-500/5 via-transparent to-red-600/5"></div>
        <div className="relative">
          <h3 className="text-2xl font-bold bg-gradient-to-r from-orange-800 to-amber-600 bg-clip-text text-transparent">
            {getActionTitle()}
          </h3>
          {(node.meta as any).category && (
            <span className="inline-block mt-3 px-4 py-2 bg-gradient-to-r from-red-100 to-red-100 text-red-700 text-sm rounded-full font-medium capitalize border border-red-200/50">
              {(node.meta as any).category}
            </span>
          )}
        </div>
      </div>
      
      {/* Duration */}
      {(node.meta.startDate || node.meta.endDate) && (
        <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-red-50 to-slate-50 border border-red-200/50">
          <span className="text-xs font-semibold text-red-600 uppercase tracking-wider">Duration</span>
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

      {/* Impact */}
      {(node.meta as any).impact && (
        <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200/50">
          <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Impact</span>
          <p className="text-slate-900 mt-2 leading-relaxed">{(node.meta as any).impact}</p>
        </div>
      )}

      {/* Verification */}
      {(node.meta as any).verification && (
        <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200/50">
          <span className="text-xs font-semibold text-green-600 uppercase tracking-wider">Verification</span>
          <p className="text-slate-900 mt-2 leading-relaxed">{(node.meta as any).verification}</p>
        </div>
      )}

      {/* Enhanced Action Buttons */}
      <div className="flex gap-3 mt-8">
        <button
          onClick={onEdit}
          className="group relative flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white font-medium transition-all duration-300 hover:shadow-lg hover:shadow-red-500/25 overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-red-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
          <span className="relative z-10">Edit</span>
        </button>
        
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              className="group relative flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white font-medium transition-all duration-300 hover:shadow-lg hover:shadow-red-500/25 overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-red-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
              <span className="relative z-10">Delete</span>
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent className="bg-white border border-slate-200 shadow-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-slate-900">Delete Action</AlertDialogTitle>
              <AlertDialogDescription className="text-slate-600">
                Are you sure you want to delete "{getActionTitle()}"? This action cannot be undone.
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



export const ActionNodePanel: React.FC<ActionNodePanelProps> = ({ node }) => {
  const {
    loading,
    updateNode,
    deleteNode,
    selectNode,
  } = useHierarchyStore();

  const [mode, setMode] = useState<'view' | 'edit'>('view');

  const handleClose = () => {
    selectNode(null);
  };

  const handleDelete = async () => {
    try {
      await deleteNode(node.id);
    } catch (error) {
      console.error('Failed to delete action node:', error);
    }
  };

  const renderContent = () => {
    if (mode === 'edit') {
      return (
        <ActionForm
          node={node}
          onSuccess={() => setMode('view')}
          onFailure={(error) => console.error('Failed to update action:', error)}
        />
      );
    }

    return (
      <ActionView
        node={node}
        onEdit={() => setMode('edit')}
        onDelete={handleDelete}
        loading={loading}
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
        <div className="relative h-full bg-gradient-to-br from-orange-50 via-white to-amber-50 shadow-2xl border border-orange-200">
          {/* Animated Border Beam */}
          <div className="absolute inset-0 rounded-none overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-red-500/20 to-transparent animate-pulse"></div>
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-red-400 to-transparent animate-shimmer"></div>
          </div>
          
          <div className="relative h-full flex flex-col backdrop-blur-sm bg-white/80">
            {/* Enhanced Header with Gradient */}
            <div className="px-6 py-4 border-b border-orange-200/50 flex items-center justify-between bg-gradient-to-r from-orange-50/50 to-white/50 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-lg">
                  <NodeIcon type="action" size={20} className="text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-bold bg-gradient-to-r from-orange-700 to-amber-900 bg-clip-text text-transparent uppercase tracking-wider">
                    Action
                  </h2>
                  <div className="w-8 h-0.5 bg-gradient-to-r from-red-500 to-red-600 rounded-full"></div>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="group relative p-2 rounded-full transition-all duration-300 hover:bg-orange-100 hover:shadow-lg"
              >
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-orange-400/0 via-orange-400/10 to-orange-400/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <X className="h-5 w-5 text-orange-400 group-hover:text-orange-600 relative z-10 transition-colors duration-300" />
              </button>
            </div>

            {/* Enhanced Content Area */}
            <div className="flex-1 overflow-y-auto">
              <div className="relative p-6">
                {/* Subtle background pattern */}
                <div className="absolute inset-0 opacity-5">
                  <div className="absolute inset-0" style={{
                    backgroundImage: `radial-gradient(circle at 1px 1px, rgb(251 146 60) 1px, transparent 0)`,
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