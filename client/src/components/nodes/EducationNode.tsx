import React, { memo, useState } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { motion } from 'framer-motion';
import { FaEdit, FaTrash, FaSave, FaTimes, FaPlus } from 'react-icons/fa';
import { GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EducationNodeData } from '@/stores/data-store';
import { useNodeBehaviors } from '@/hooks/useNodeBehaviors';
import { useUICoordinatorStore } from '@/stores/ui-coordinator-store';
import { formatDateRange } from '@/utils/date-parser';
import { getBlurClasses, getLabelPositionClasses, getLabelZIndexClass, getFlexPositionClasses } from './shared/nodeUtils';

const EducationNode: React.FC<NodeProps> = ({ data, selected, id }) => {
  // Type assertion for data
  const educationData = data as EducationNodeData;

  // Component-centric behavior composition
  const { focus, selection, highlight, interaction } = useNodeBehaviors(id);
  const { zoomToFocusedNode } = useUICoordinatorStore();

  // Local state for editing
  const [isEditing, setIsEditing] = useState(false);
  const [editSchool, setEditSchool] = useState(educationData.school);
  const [editDegree, setEditDegree] = useState(educationData.degree);
  const [editField, setEditField] = useState(educationData.field);
  const [editDescription, setEditDescription] = useState(educationData.description || '');
  const [showAddButton, setShowAddButton] = useState(false);

  // Calculate derived states using behavior composition
  const isHighlighted = highlight.isHighlighted || educationData.isHighlighted;
  const isFocused = focus.isFocused || educationData.isFocused;
  const isBlurred = focus.isBlurred && !isFocused;

  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();

    // Toggle focus mode using behavior composition
    if (isFocused) {
      focus.clearFocus();
    } else {
      focus.focus();
      // Wait for React to update the nodes, then zoom
      setTimeout(() => {
        zoomToFocusedNode(id);
      }, 50);
    }

    // Call custom click handler if provided
    if (educationData.onNodeClick) {
      educationData.onNodeClick(educationData, id);
    }
  };

  const handleEdit = (event: React.MouseEvent) => {
    event.stopPropagation();
    setIsEditing(true);
  };

  const handleSave = (event: React.MouseEvent) => {
    event.stopPropagation();

    // TODO: Implement node update functionality in the new store
    console.log('Save functionality needs to be implemented');
    setIsEditing(false);
  };

  const handleCancel = (event: React.MouseEvent) => {
    event.stopPropagation();
    setEditSchool(educationData.school);
    setEditDegree(educationData.degree);
    setEditField(educationData.field);
    setEditDescription(educationData.description || '');
    setIsEditing(false);
  };

  const handleDelete = (event: React.MouseEvent) => {
    event.stopPropagation();

    if (confirm('Are you sure you want to delete this education entry?')) {
      // TODO: Implement node delete functionality in the new store
      console.log('Delete functionality needs to be implemented');

      // Call custom delete handler if provided
      if (educationData.onNodeDelete) {
        educationData.onNodeDelete(id);
      }
    }
  };


  return (
    <div onClick={handleClick} className={`
      ${getFlexPositionClasses(educationData.branch as number, 'education', id)}
      ${getBlurClasses(isBlurred, isFocused)}
      gap-4 min-h-[160px] w-full
    `}>

      {/* Main Circular Node Container - ensures proper relative positioning */}
      <div className="relative flex items-center justify-center">
        <div
          className={`
            w-20 h-20 rounded-full
            bg-gradient-to-br from-blue-400 to-blue-600
            shadow-2xl
            flex items-center justify-center
            transition-all duration-300 ease-out
            cursor-pointer
            ${selected ? 'ring-4 ring-white/50 scale-110' : 'hover:scale-105'}
            ${isHighlighted ? 'ring-2 ring-blue-400 animate-pulse' : ''}
          `}
          style={{
            filter: 'drop-shadow(0 0 20px rgba(59, 130, 246, 0.4))',
          }}
        >
        {/* Glow effect - hidden in focus mode to avoid double circles */}
        {!isFocused && (
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 opacity-60 blur-sm scale-110" />
        )}

        {/* Icon */}
        <div className="relative z-10 flex items-center justify-center">
          <GraduationCap size={28} className="text-white filter drop-shadow-sm" />
        </div>

        {/* Connection handles */}
        <Handle
          type="target"
          position={Position.Left}
          className="w-3 h-3 bg-white/80 border-2 border-gray-300 opacity-0 hover:opacity-100 transition-opacity"
        />
        <Handle
          type="source"
          position={Position.Right}
          className="w-3 h-3 bg-white/80 border-2 border-gray-300 opacity-0 hover:opacity-100 transition-opacity"
        />
        </div>

        {/* Add Update Button */}
        <div
          className="absolute -bottom-1 -right-1 z-20"
          onMouseEnter={() => setShowAddButton(true)}
          onMouseLeave={() => setShowAddButton(false)}
        >
        <motion.button
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: showAddButton ? 1 : 0.7, scale: 1 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={(e) => e.stopPropagation()}
          className="w-8 h-8 bg-blue-500/90 hover:bg-blue-600/90 rounded-full flex items-center justify-center text-white border-2 border-blue-400/50 backdrop-blur-sm transition-all"
          title="Add Achievement"
        >
          <FaPlus className="w-3 h-3" />
        </motion.button>
        </div>
      </div>

            {/* Label Card - using flex positioning */}
      <div className={`
        flex flex-col items-center justify-center text-center
        bg-gray-900/90 backdrop-blur-sm rounded-2xl px-4 py-3 shadow-xl
        border min-w-[200px] max-w-[240px]
        ${getLabelZIndexClass(isHighlighted, isFocused)}
        ${isHighlighted ? 'border-blue-400/60 ring-2 ring-blue-400/30' : 'border-white/10'}
      `}>
          {isEditing ? (
            <div className="space-y-2">
              <input
                value={editSchool}
                onChange={(e) => setEditSchool(e.target.value)}
                className="w-full px-2 py-1 text-xs bg-gray-800 border border-gray-600 rounded text-white"
                placeholder="School/Institution"
                onClick={(e) => e.stopPropagation()}
              />
              <input
                value={editDegree}
                onChange={(e) => setEditDegree(e.target.value)}
                className="w-full px-2 py-1 text-xs bg-gray-800 border border-gray-600 rounded text-white"
                placeholder="Degree"
                onClick={(e) => e.stopPropagation()}
              />
              <input
                value={editField}
                onChange={(e) => setEditField(e.target.value)}
                className="w-full px-2 py-1 text-xs bg-gray-800 border border-gray-600 rounded text-white"
                placeholder="Field of Study"
                onClick={(e) => e.stopPropagation()}
              />
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full px-2 py-1 text-xs bg-gray-800 border border-gray-600 rounded text-white resize-none"
                rows={2}
                placeholder="Description (optional)"
                onClick={(e) => e.stopPropagation()}
              />
              <div className="flex gap-1 justify-center">
                <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={handleSave}>
                  <FaSave className="w-3 h-3" />
                </Button>
                <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={handleCancel}>
                  <FaTimes className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ) : (
            <>
              <h3 className="font-bold leading-tight mb-1 text-white text-sm">
                {educationData.degree} in {educationData.field}
              </h3>
              <p className="text-xs mb-2 text-white/80">
                {educationData.school}
              </p>
              <p className="text-xs mb-2 text-white/60">
                {formatDateRange(educationData.start, educationData.end)}
              </p>
              {educationData.description && (
                <p className="text-xs mb-2 text-white/70 max-w-[180px] line-clamp-2">
                  {educationData.description}
                </p>
              )}
              <div className="flex gap-1 justify-center mt-2">
                <Button size="sm" variant="outline" className="h-6 px-2 text-xs opacity-70 hover:opacity-100" onClick={handleEdit}>
                  <FaEdit className="w-3 h-3" />
                </Button>
                <Button size="sm" variant="outline" className="h-6 px-2 text-xs opacity-70 hover:opacity-100 text-red-400" onClick={handleDelete}>
                  <FaTrash className="w-3 h-3" />
                </Button>
              </div>
            </>
          )}
      </div>

    </div>
  );
};

export default memo(EducationNode);
