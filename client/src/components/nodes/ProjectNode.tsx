import React, { memo, useState, useRef, useCallback } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { motion } from 'framer-motion';
import { FaEdit, FaTrash, FaSave, FaTimes, FaCode, FaClipboardList } from 'react-icons/fa';
import { Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useJourneyStore, ProjectNodeData } from '@/stores/journey-store';
import { formatDateRange } from '@/utils/date-parser';
import { getBlurClasses, getLabelPositionClasses, getLabelZIndexClass, getFlexPositionClasses } from './shared/nodeUtils';
import ProjectUpdatesModal from './shared/ProjectUpdatesModal';

const ProjectNode: React.FC<NodeProps> = ({ data, selected, id }) => {
  // Type assertion for data
  const projectData = data as ProjectNodeData;
  const {
    highlightedNodeId,
    zoomToFocusedNode
  } = useJourneyStore();

  // Local state for editing
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(projectData.title);
  const [editDescription, setEditDescription] = useState(projectData.description);
  const [editTechnologies, setEditTechnologies] = useState(projectData.technologies?.join(', ') || '');
  const [showDetails, setShowDetails] = useState(false);
  const [showUpdates, setShowUpdates] = useState(false);
  const nodeRef = useRef<HTMLDivElement>(null);

  // Calculate derived states
  const isHighlighted = highlightedNodeId === id || projectData.isHighlighted;

  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();

    // Debug: Log project data to see structure
    console.log('Project data:', projectData);
    console.log('Available fields in projectData:', Object.keys(projectData));
    if ((projectData as any).originalProject) {
      console.log('Original project fields:', Object.keys((projectData as any).originalProject));
    }

    const foundUpdates = (projectData as any).projectUpdates ||
      (projectData as any).updates ||
      (projectData as any).milestones ||
      (projectData as any).tasks ||
      (projectData as any).workItems ||
      (projectData as any).entries ||
      (projectData as any).originalProject?.updates ||
      (projectData as any).originalProject?.projectUpdates ||
      (projectData as any).originalProject?.milestones ||
      (projectData as any).originalProject?.tasks ||
      (projectData as any).originalProject?.workItems ||
      (projectData as any).originalProject?.entries ||
      [];

    console.log('Project updates found:', foundUpdates);
    console.log('Number of updates:', foundUpdates.length);

    // Toggle project updates view
    const willShowUpdates = !showUpdates;
    setShowUpdates(willShowUpdates);

    // If showing updates, zoom to parent experience
    if (willShowUpdates) {
      if (projectData.parentExperienceId) {
        setTimeout(() => {
          zoomToFocusedNode(projectData.parentExperienceId, true); // true = extra modal space
        }, 50);
      }
    }

    // Call custom click handler if provided
    if (projectData.onNodeClick) {
      projectData.onNodeClick(data, id);
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
    setEditTitle(projectData.title);
    setEditDescription(projectData.description);
    setEditTechnologies(projectData.technologies?.join(', ') || '');
    setIsEditing(false);
  };

  const handleDelete = (event: React.MouseEvent) => {
    event.stopPropagation();

    if (confirm('Are you sure you want to delete this project?')) {
      // TODO: Implement node delete functionality in the new store
      console.log('Delete functionality needs to be implemented');

      // Call custom delete handler if provided
      if (projectData.onNodeDelete) {
        projectData.onNodeDelete(id);
      }
    }
  };


  return (
    <div 
      ref={nodeRef}
      onClick={handleClick} 
      className={`
        ${getFlexPositionClasses((projectData as any).branch, 'project', id)}
        transition-all duration-500 gap-4 min-h-[160px] w-full relative
      `}
    >

      {/* Main Circular Node Container - ensures proper relative positioning */}
      <div className="relative flex items-center justify-center">
        <div
          className={`
            w-16 h-16 rounded-full
            bg-gradient-to-br from-amber-400 to-amber-600
            shadow-xl
            flex items-center justify-center
            transition-all duration-300 ease-out
            cursor-pointer
            ${selected ? 'ring-4 ring-white/50 scale-110' : 'hover:scale-105'}
            ${isHighlighted ? 'ring-2 ring-amber-400 animate-pulse' : ''}
          `}
          style={{
            filter: 'drop-shadow(0 0 15px rgba(245, 158, 11, 0.4))',
          }}
        >
          {/* Glow effect - projects don't have focus mode but keeping consistent */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 opacity-60 blur-sm scale-110" />

          {/* Icon */}
          <div className="relative z-10 flex items-center justify-center">
            <Wrench size={20} className="text-white filter drop-shadow-sm" />
          </div>

          {/* Connection handles */}
          <Handle
            type="target"
            position={Position.Top}
            id="top"
            className="w-3 h-3 bg-white/80 border-2 border-gray-300 opacity-0 hover:opacity-100 transition-opacity"
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="bottom"
            className="w-3 h-3 bg-white/80 border-2 border-gray-300 opacity-0 hover:opacity-100 transition-opacity"
          />
        </div>

        {/* Project Status Indicator */}
        {projectData.technologies && projectData.technologies.length > 0 && (
          <div className="absolute -top-1 -right-1 z-20">
            <div className="w-4 h-4 bg-green-500 rounded-full border-2 border-white/80 flex items-center justify-center">
              <FaCode className="w-2 h-2 text-white" />
            </div>
          </div>
        )}
      </div>

      {/* Label Card - using flex positioning */}
      <div className={`
        flex flex-col items-center justify-center text-center
        bg-gray-900/90 backdrop-blur-sm rounded-2xl px-4 py-3 shadow-xl
        border min-w-[220px] max-w-[260px]
        ${getLabelZIndexClass(isHighlighted)}
        ${isHighlighted ? 'border-amber-400/60 ring-2 ring-amber-400/30' : 'border-white/10'}
      `}>
        {isEditing ? (
          <div className="space-y-2">
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full px-2 py-1 text-xs bg-gray-800 border border-gray-600 rounded text-white"
              placeholder="Project Title"
              onClick={(e) => e.stopPropagation()}
            />
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              className="w-full px-2 py-1 text-xs bg-gray-800 border border-gray-600 rounded text-white resize-none"
              rows={3}
              placeholder="Project Description"
              onClick={(e) => e.stopPropagation()}
            />
            <input
              value={editTechnologies}
              onChange={(e) => setEditTechnologies(e.target.value)}
              className="w-full px-2 py-1 text-xs bg-gray-800 border border-gray-600 rounded text-white"
              placeholder="Technologies (comma-separated)"
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
              {projectData.title}
            </h3>
            <p className="text-xs mb-2 text-white/60">
              {(projectData.start || projectData.end)
                ? formatDateRange(projectData.start, projectData.end)
                : 'No time range'
              }
            </p>

            {showDetails ? (
              <div className="space-y-2">
                <p className="text-xs text-white/80 max-w-[200px] line-clamp-3">
                  {projectData.description}
                </p>

                {projectData.technologies && projectData.technologies.length > 0 && (
                  <div className="flex flex-wrap gap-1 justify-center">
                    {projectData.technologies.slice(0, 3).map((tech, index) => (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="text-xs px-2 py-0 bg-amber-500/20 text-amber-200"
                      >
                        {tech}
                      </Badge>
                    ))}
                    {projectData.technologies.length > 3 && (
                      <Badge
                        variant="secondary"
                        className="text-xs px-2 py-0 bg-gray-500/20 text-gray-300"
                      >
                        +{projectData.technologies.length - 3}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-white/70 max-w-[180px] line-clamp-2">
                {projectData.description}
              </p>
            )}

            <div className="flex gap-1 justify-center mt-2">
              <Button size="sm" variant="outline" className="h-6 px-2 text-xs opacity-70 hover:opacity-100" onClick={handleEdit}>
                <FaEdit className="w-3 h-3" />
              </Button>
              <Button size="sm" variant="outline" className="h-6 px-2 text-xs opacity-70 hover:opacity-100 text-red-400" onClick={handleDelete}>
                <FaTrash className="w-3 h-3" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-xs opacity-70 hover:opacity-100"
                onClick={(e) => { e.stopPropagation(); setShowDetails(!showDetails); }}
              >
                <FaCode className="w-3 h-3" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-xs opacity-70 hover:opacity-100"
                onClick={(e) => { e.stopPropagation(); setShowUpdates(!showUpdates); }}
              >
                <FaClipboardList className="w-3 h-3" />
              </Button>
            </div>
          </>
        )}

        {/* Parent Experience Indicator */}
        <div className="flex items-center justify-center gap-1 mt-1">
          <div className="w-1 h-1 bg-emerald-400 rounded-full"></div>
          <span className="text-emerald-300 text-xs">Project</span>
        </div>
      </div>

      {/* Project Updates Modal */}
      {showUpdates && (
        <ProjectUpdatesModal
          isOpen={showUpdates}
          onClose={() => setShowUpdates(false)}
          projectUpdates={
            (projectData as any).projectUpdates ||
            (projectData as any).updates ||
            (projectData as any).milestones ||
            (projectData as any).tasks ||
            (projectData as any).workItems ||
            (projectData as any).entries ||
            (projectData as any).originalProject?.updates ||
            (projectData as any).originalProject?.projectUpdates ||
            (projectData as any).originalProject?.milestones ||
            (projectData as any).originalProject?.tasks ||
            (projectData as any).originalProject?.workItems ||
            (projectData as any).originalProject?.entries ||
            []
          }
        />
      )}
    </div>
  );
};

export default memo(ProjectNode);
