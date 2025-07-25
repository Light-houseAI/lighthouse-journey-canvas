import React, { memo, useState } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { motion } from 'framer-motion';
import { FaEdit, FaTrash, FaSave, FaTimes, FaPlus } from 'react-icons/fa';
import { Button } from '@/components/ui/button';
import STARModal from './shared/STARModal';
import { useChatIntegration, createExperienceUpdateMessage } from '@/hooks/useChatIntegration';
import {
  ExperienceData,
  getTypeIcon,
  getTypeGradient,
  getBlurClasses,
  formatDate
} from './shared/nodeUtils';

const ExperienceNode: React.FC<NodeProps> = ({ data, selected, id }) => {
  const experienceData = data as unknown as ExperienceData;
  const gradient = getTypeGradient(experienceData.type);
  const icon = getTypeIcon(experienceData.type);

  // Chat integration
  const { addChatMessageAndOpen } = useChatIntegration();

  // Extended data from the actual node
  const isUpdated = (data as any).isUpdated;
  const isSubMilestone = (data as any).isSubMilestone;
  const hasSubMilestones = (data as any).hasSubMilestones;
  const isFocused = (data as any).isFocused;
  const isBlurred = (data as any).isBlurred;
  const hasProjects = (data as any).hasProjects;

  // Extract active projects from originalData
  const originalData = (data as any).originalData;
  const projects = originalData?.projects || [];
  const activeProjects = projects.filter((project: any) => {
    // Same logic as in the timeline component
    const endValue = project.end;
    if (!endValue || endValue.toLowerCase() === 'present' || endValue.toLowerCase() === 'current') {
      return true;
    }
    return false; // Simplified for now - could add date parsing
  }).map((project: any) => ({
    name: project.title || project.name || 'Unnamed Project',
    organization: project.organization || project.company
  }));

  // State management
  const [showSTARDetails, setShowSTARDetails] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(experienceData.title);
  const [editDescription, setEditDescription] = useState(experienceData.description);
  const [showAddButton, setShowAddButton] = useState(false);

  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();

    // Priority 1: If this experience has STAR details, show them
    if ((data as any).starDetails) {
      setShowSTARDetails(!showSTARDetails);
    }
    // Priority 2: For experience nodes with projects, call the focus mode handler
    else if (experienceData.hasProjects && (data as any).onNodeClick && typeof (data as any).onNodeClick === 'function') {
      (data as any).onNodeClick(experienceData, id);
    }
    // Priority 3: Default click handler
    else if ((data as any).onNodeClick && typeof (data as any).onNodeClick === 'function') {
      (data as any).onNodeClick(experienceData, id);
    }
  };

  const handleEdit = (event: React.MouseEvent) => {
    event.stopPropagation();
    setIsEditing(true);
  };

  const handleSave = async (event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      // Update milestone in database
      await fetch('/api/update-milestone', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          milestoneId: id,
          title: editTitle,
          description: editDescription
        }),
      });

      // Update local data
      experienceData.title = editTitle;
      experienceData.description = editDescription;

      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update milestone:', error);
      alert('Failed to update milestone. Please try again.');
    }
  };

  const handleCancel = (event: React.MouseEvent) => {
    event.stopPropagation();
    setEditTitle(experienceData.title);
    setEditDescription(experienceData.description);
    setIsEditing(false);
  };

  const handleDelete = async (event: React.MouseEvent) => {
    event.stopPropagation();
    if (confirm('Are you sure you want to delete this experience?')) {
      try {
        // Delete from database
        await fetch('/api/delete-milestone', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ milestoneId: id }),
        });

        // Call the onNodeDelete callback if available
        const onNodeDelete = (data as any).onNodeDelete;
        if (onNodeDelete && typeof onNodeDelete === 'function') {
          onNodeDelete(id);
        }
      } catch (error) {
        console.error('Failed to delete experience:', error);
        alert('Failed to delete experience. Please try again.');
      }
    }
  };

  const handleAddUpdate = (event: React.MouseEvent) => {
    event.stopPropagation();

    // Create experience-specific update message with project context
    const message = createExperienceUpdateMessage(
      experienceData.title,
      experienceData.organization || 'Your Organization',
      activeProjects
    );

    addChatMessageAndOpen(message);
  };

  return (
    <div onClick={handleClick} className={`relative ${getBlurClasses(isBlurred, isFocused)}`}>
      {/* Label Card - positioned above the node */}
      <div className={`absolute left-1/2 transform -translate-x-1/2 z-10 ${
        isSubMilestone ? '-top-48' : '-top-40'
      }`}>
        <div className={`bg-gray-900/90 backdrop-blur-sm rounded-2xl px-4 py-3 shadow-xl text-center border ${
          isSubMilestone
            ? 'border-yellow-500/40 bg-slate-700/90 min-w-[180px]'
            : 'border-white/10 min-w-[200px]'
        }`}>
          {isEditing ? (
            <div className="space-y-2">
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full px-2 py-1 text-xs bg-gray-800 border border-gray-600 rounded text-white"
                onClick={(e) => e.stopPropagation()}
              />
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full px-2 py-1 text-xs bg-gray-800 border border-gray-600 rounded text-white resize-none"
                rows={2}
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
              <h3 className={`font-bold leading-tight mb-1 ${
                isSubMilestone ? 'text-yellow-100 text-xs' : 'text-white text-sm'
              }`}>
                {experienceData.title}
              </h3>
              <p className={`text-xs mb-2 ${isSubMilestone ? 'text-yellow-200/80' : 'text-white/80'}`}>
                {formatDate(experienceData.date)}
              </p>
              <p className={`text-xs mb-2 text-white/80`}>
                {experienceData.duration}
              </p>
              {(isSubMilestone || experienceData.type === 'update') && (
                <div className="flex gap-1 justify-center mt-2">
                  <Button size="sm" variant="outline" className="h-6 px-2 text-xs opacity-70 hover:opacity-100" onClick={handleEdit}>
                    <FaEdit className="w-3 h-3" />
                  </Button>
                  <Button size="sm" variant="outline" className="h-6 px-2 text-xs opacity-70 hover:opacity-100 text-red-400" onClick={handleDelete}>
                    <FaTrash className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </>
          )}
          {experienceData.organization && !isSubMilestone && (
            <div className="inline-block bg-white/20 backdrop-blur-sm rounded-full px-3 py-1">
              <span className="text-white text-xs font-medium">
                {experienceData.organization}
              </span>
            </div>
          )}
          {hasSubMilestones && !isSubMilestone && (
            <div className="flex items-center justify-center gap-1 mt-2">
              <div className="w-1 h-1 bg-yellow-400 rounded-full"></div>
              <span className="text-yellow-300 text-xs">Has projects</span>
            </div>
          )}
        </div>
        {/* Connector line from label to node */}
        <div className={`absolute top-full left-1/2 transform -translate-x-1/2 w-px ${
          isSubMilestone ? 'h-8 bg-yellow-400/30' : 'h-10 bg-white/30'
        }`}></div>
      </div>

      {/* Main Circular Node */}
      <div
        className={`
          relative w-20 h-20 rounded-full
          bg-gradient-to-br ${gradient}
          shadow-2xl
          flex items-center justify-center
          transition-all duration-300 ease-out
          cursor-pointer
          ${selected ? 'ring-4 ring-white/50 scale-110' : 'hover:scale-105'}
          ${isUpdated ? 'ring-2 ring-yellow-400 animate-pulse' : ''}
          ${hasProjects ? 'ring-2 ring-amber-400/60' : ''}
        `}
        style={{
          filter: 'drop-shadow(0 0 20px rgba(99, 102, 241, 0.4))',
        }}
      >
        {/* Glow effect */}
        <div
          className={`
            absolute inset-0 rounded-full
            bg-gradient-to-br ${gradient}
            opacity-60 blur-sm scale-110
          `}
        />

        {/* Icon */}
        <div className="relative z-10 flex items-center justify-center">
          {icon}
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
        <Handle
          type="source"
          position={Position.Bottom}
          id="bottom"
          className="w-3 h-3 bg-white/80 border-2 border-gray-300 opacity-0 hover:opacity-100 transition-opacity"
        />
      </div>

      {/* Add Update Button */}
      {!isSubMilestone && (
        <div
          className="absolute -bottom-2 -right-2 z-20"
          onMouseEnter={() => setShowAddButton(true)}
          onMouseLeave={() => setShowAddButton(false)}
        >
          <motion.button
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: showAddButton ? 1 : 0.7, scale: 1 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleAddUpdate}
            className="w-8 h-8 bg-blue-500/90 hover:bg-blue-600/90 rounded-full flex items-center justify-center text-white border-2 border-blue-400/50 backdrop-blur-sm transition-all"
          >
            <FaPlus className="w-3 h-3" />
          </motion.button>
        </div>
      )}

      {/* STAR Details Modal */}
      {showSTARDetails && (data as any).starDetails && (
        <STARModal
          isOpen={showSTARDetails}
          onClose={() => setShowSTARDetails(false)}
          starDetails={(data as any).starDetails}
        />
      )}
    </div>
  );
};

export default memo(ExperienceNode);
