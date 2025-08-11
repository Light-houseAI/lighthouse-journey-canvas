import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { NodeIcon } from '../../icons/NodeIcons';
import { HierarchyNode, NodeMetadata } from '../../../services/hierarchy-api';
import { useHierarchyStore } from '../../../stores/hierarchy-store';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../../ui/alert-dialog';
import { formatDateRange } from '../../../utils/date-parser';

interface CareerTransitionNodePanelProps {
  node: HierarchyNode;
}

interface CareerTransitionViewProps {
  node: HierarchyNode;
  onEdit: () => void;
  onDelete: () => void;
  loading: boolean;
}

const CareerTransitionView: React.FC<CareerTransitionViewProps> = ({ node, onEdit, onDelete, loading }) => {
  const getCareerTransitionTitle = () => {
    // Generate title from node meta.title or create a default one
    return node.meta.title || 'Career Transition';
  };

  return (
    <>
      {/* Career Transition Title */}
      <div className="mb-6">
        <h3 className="text-2xl font-bold text-gray-900">{getCareerTransitionTitle()}</h3>
        {(node.meta as any).transitionType && (
          <span className="inline-block mt-2 px-3 py-1 bg-orange-100 text-orange-700 text-sm rounded-full capitalize">
            {(node.meta as any).transitionType.replace('_', ' ')}
          </span>
        )}
      </div>
      
      {/* Duration */}
      {(node.meta.startDate || node.meta.endDate) && (
        <div className="mb-4">
          <span className="text-sm font-medium text-gray-500">Duration</span>
          <p className="text-gray-900 mt-1">
            {formatDateRange(node.meta.startDate, node.meta.endDate)}
          </p>
        </div>
      )}

      {/* Transition Details */}
      {((node.meta as any).fromRole || (node.meta as any).toRole) && (
        <div className="mb-4">
          <span className="text-sm font-medium text-gray-500">Transition</span>
          <div className="mt-1">
            {(node.meta as any).fromRole && (
              <p className="text-gray-900">From: {(node.meta as any).fromRole}</p>
            )}
            {(node.meta as any).toRole && (
              <p className="text-gray-900">To: {(node.meta as any).toRole}</p>
            )}
          </div>
        </div>
      )}

      {/* Reason */}
      {(node.meta as any).reason && (
        <div className="mb-4">
          <span className="text-sm font-medium text-gray-500">Reason</span>
          <p className="text-gray-900 mt-1">{(node.meta as any).reason}</p>
        </div>
      )}

      {/* Outcome */}
      {(node.meta as any).outcome && (
        <div className="mb-4">
          <span className="text-sm font-medium text-gray-500">Outcome</span>
          <p className="text-gray-900 mt-1">{(node.meta as any).outcome}</p>
        </div>
      )}

      {/* Description */}
      {node.meta.description && (
        <div className="mb-4">
          <span className="text-sm font-medium text-gray-500">Description</span>
          <p className="text-gray-900 mt-1 whitespace-pre-wrap">{node.meta.description}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 mt-6">
        <Button
          variant="outline"
          className="flex-1"
          onClick={onEdit}
        >
          Edit
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
              disabled={loading}
            >
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Career Transition</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{getCareerTransitionTitle()}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete} className="bg-red-500 hover:bg-red-600">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );
};

interface CareerTransitionEditProps {
  node: HierarchyNode;
  onSave: (data: { meta: Partial<NodeMetadata> }) => void;
  onCancel: () => void;
  loading: boolean;
}

const CareerTransitionEdit: React.FC<CareerTransitionEditProps> = ({ node, onSave, onCancel, loading }) => {
  const [formData, setFormData] = useState<{
    meta: Partial<NodeMetadata>;
  }>({
    meta: { ...node.meta },
  });

  const handleFormChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      meta: { ...prev.meta, [field]: value }
    }));
  };

  const handleSave = () => {
    onSave(formData);
  };

  return (
    <>
      <div className="mb-6">
        <h3 className="text-2xl font-bold text-gray-900">Edit Career Transition</h3>
        <p className="text-lg text-gray-600">Update the career transition information</p>
      </div>

      <div className="space-y-4">
        {/* Label */}
        <div className="space-y-2">
          <label htmlFor="title" className="text-sm font-medium text-gray-700">Career Transition Title</label>
          <Input
            id="title"
            value={formData.meta.title || ''}
            onChange={(e) => handleFormChange('title', e.target.value)}
            placeholder="Enter career transition title"
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <label htmlFor="description" className="text-sm font-medium text-gray-700">Description</label>
          <Textarea
            id="description"
            value={formData.meta.description || ''}
            onChange={(e) => handleFormChange('description', e.target.value)}
            placeholder="Add a description..."
            rows={3}
          />
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 mt-6">
          <Button
            onClick={handleSave}
            variant="outline"
            className="flex-1"
            disabled={loading}
          >
            Save
          </Button>
          <Button
            onClick={onCancel}
            variant="outline"
            className="flex-1"
          >
            Cancel
          </Button>
        </div>
      </div>
    </>
  );
};

export const CareerTransitionNodePanel: React.FC<CareerTransitionNodePanelProps> = ({ node }) => {
  const {
    loading,
    updateNode,
    deleteNode,
    selectNode,
  } = useHierarchyStore();

  const [mode, setMode] = useState<'view' | 'edit'>('view');

  const handleClose = () => {
    selectNode(null); // Clear selection
  };

  const handleSave = async (data: { meta: Partial<NodeMetadata> }) => {
    try {
      await updateNode(node.id, data);
      setMode('view');
    } catch (error) {
      console.error('Failed to save career transition node:', error);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteNode(node.id);
    } catch (error) {
      console.error('Failed to delete career transition node:', error);
    }
  };

  const renderContent = () => {
    if (mode === 'edit') {
      return (
        <CareerTransitionEdit
          node={node}
          onSave={handleSave}
          onCancel={() => setMode('view')}
          loading={loading}
        />
      );
    }

    return (
      <CareerTransitionView
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
        className="fixed right-0 top-0 h-full w-96 bg-white shadow-2xl z-50 overflow-hidden text-gray-900"
        style={{ colorScheme: 'light' }}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <NodeIcon type="careerTransition" size={20} className="text-white" />
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Career Transition
              </span>
            </div>
            <Button
              onClick={handleClose}
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {renderContent()}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
