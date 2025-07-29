import React, { memo, useState } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { motion } from 'framer-motion';
import { FaEdit, FaTrash, FaSave, FaTimes, FaPlus, FaExpand, FaCompress } from 'react-icons/fa';
import { Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useJourneyStore, WorkExperienceNodeData } from '@/stores/journey-store';
import { formatDateRange } from '@/utils/date-parser';
import { getBlurClasses, getLabelPositionClasses, getLabelZIndexClass, getFlexPositionClasses } from './shared/nodeUtils';

const WorkExperienceNode: React.FC<NodeProps> = ({ data, selected, id }) => {
  // Type assertion for data
  const workData = data as WorkExperienceNodeData;
  const {
    setFocusedExperience,
    focusedExperienceId,
    highlightedNodeId,
    zoomToFocusedNode
  } = useJourneyStore();

  // Local state for editing
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(workData.title);
  const [editCompany, setEditCompany] = useState(workData.company);
  const [editDescription, setEditDescription] = useState(workData.description);
  const [showAddButton, setShowAddButton] = useState(false);

  // Calculate derived states
  const isHighlighted = highlightedNodeId === id || workData.isHighlighted;
  const isFocused = focusedExperienceId === id || workData.isFocused;
  const isBlurred = workData.isBlurred && !isFocused;
  const hasProjects = workData.projects && workData.projects.length > 0;

  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();

    // Toggle focus mode for any experience
    if (isFocused) {
      setFocusedExperience(null);
    } else {
      setFocusedExperience(id);
      // Wait for React to update the nodes, then zoom
      setTimeout(() => {
        zoomToFocusedNode(id);
      }, 50);
    }

    // Call custom click handler if provided
    if (workData.onNodeClick) {
      workData.onNodeClick(data, id);
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
    setEditTitle(workData.title);
    setEditCompany(workData.company);
    setEditDescription(workData.description);
    setIsEditing(false);
  };

  const handleDelete = (event: React.MouseEvent) => {
    event.stopPropagation();

    if (confirm('Are you sure you want to delete this work experience?')) {
      // TODO: Implement node delete functionality in the new store
      console.log('Delete functionality needs to be implemented');

      // Call custom delete handler if provided
      if (workData.onNodeDelete) {
        workData.onNodeDelete(id);
      }
    }
  };

  const handleAddProject = (event: React.MouseEvent) => {
    event.stopPropagation();

    // TODO: Implement add project functionality in the new store
    console.log('Add project functionality needs to be implemented');
  };


  return (
    <div onClick={handleClick} className={`
      ${getFlexPositionClasses(workData.branch as number, 'workExperience', id)}
      ${getBlurClasses(isBlurred, isFocused)}
      gap-4 min-h-[160px] w-full
    `}>
      {/* Main Circular Node Container - ensures proper relative positioning */}
      <div className="relative flex items-center justify-center">
        <div
          className={`
            w-20 h-20 rounded-full
            bg-gradient-to-br from-emerald-400 to-emerald-600
            shadow-2xl
            flex items-center justify-center
            transition-all duration-300 ease-out
            cursor-pointer
            ${isHighlighted ? 'ring-2 ring-emerald-400 animate-pulse' : ''}
            ${hasProjects ? 'ring-2 ring-amber-400/60' : ''}
          `}
          style={{
            filter: 'drop-shadow(0 0 20px rgba(16, 185, 129, 0.4))',
          }}
        >
        {/* Glow effect - hidden in focus mode to avoid double circles */}
        {!isFocused && (
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 opacity-60 blur-sm scale-110" />
        )}

        {/* Icon */}
        <div className="relative z-10 flex items-center justify-center">
          <Briefcase size={28} className="text-white filter drop-shadow-sm" />
        </div>

        {/* Connection handles */}
        <Handle
          type="target"
          position={Position.Left}
          id="left"
          className="w-3 h-3 bg-white/80 border-2 border-gray-300 opacity-0 hover:opacity-100 transition-opacity"
        />
        <Handle
          type="source"
          position={Position.Left}
          id="left"
          className="w-3 h-3 bg-white/80 border-2 border-gray-300 opacity-0 hover:opacity-100 transition-opacity"
        />
        <Handle
          type="source"
          position={Position.Right}
          id="right"
          className="w-3 h-3 bg-white/80 border-2 border-gray-300 opacity-0 hover:opacity-100 transition-opacity"
        />
        <Handle
          type="source"
          position={Position.Bottom}
          id="bottom"
          className="w-3 h-3 bg-white/80 border-2 border-gray-300 opacity-0 hover:opacity-100 transition-opacity"
        />
        </div>

        {/* Add Project Button - positioned relative to the circular node */}
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
          onClick={handleAddProject}
          className="w-8 h-8 bg-amber-500/90 hover:bg-amber-600/90 rounded-full flex items-center justify-center text-white border-2 border-amber-400/50 backdrop-blur-sm transition-all"
          title="Add Project"
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
        ${isHighlighted ? 'border-emerald-400/60 ring-2 ring-emerald-400/30' : 'border-white/10'}
      `}>
          {isEditing ? (
            <div className="space-y-2">
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full px-2 py-1 text-xs bg-gray-800 border border-gray-600 rounded text-white"
                placeholder="Job Title"
                onClick={(e) => e.stopPropagation()}
              />
              <input
                value={editCompany}
                onChange={(e) => setEditCompany(e.target.value)}
                className="w-full px-2 py-1 text-xs bg-gray-800 border border-gray-600 rounded text-white"
                placeholder="Company"
                onClick={(e) => e.stopPropagation()}
              />
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full px-2 py-1 text-xs bg-gray-800 border border-gray-600 rounded text-white resize-none"
                rows={2}
                placeholder="Description"
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
                {workData.title}
              </h3>
              <p className="text-xs mb-2 text-white/80">
                {workData.company}
              </p>
              <p className="text-xs mb-2 text-white/60">
                {formatDateRange(workData.start, workData.end)}
              </p>
              {workData.location && (
                <p className="text-xs mb-2 text-white/60">
                  {workData.location}
                </p>
              )}
              <div className="flex gap-1 justify-center mt-2">
                <Button size="sm" variant="outline" className="h-6 px-2 text-xs opacity-70 hover:opacity-100" onClick={handleEdit}>
                  <FaEdit className="w-3 h-3" />
                </Button>
                <Button size="sm" variant="outline" className="h-6 px-2 text-xs opacity-70 hover:opacity-100 text-red-400" onClick={handleDelete}>
                  <FaTrash className="w-3 h-3" />
                </Button>
                {hasProjects && (
                  <Button size="sm" variant="outline" className="h-6 px-2 text-xs opacity-70 hover:opacity-100" onClick={(e) => { e.stopPropagation(); handleClick(e); }}>
                    {isFocused ? <FaCompress className="w-3 h-3" /> : <FaExpand className="w-3 h-3" />}
                  </Button>
                )}
              </div>
            </>
          )}

          {hasProjects && (
            <div className="flex items-center justify-center gap-1 mt-2">
              <div className="w-1 h-1 bg-amber-400 rounded-full"></div>
              <span className="text-amber-300 text-xs">
                {workData.projects?.length} project{workData.projects?.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
      </div>
    </div>
  );
};

export default memo(WorkExperienceNode);
