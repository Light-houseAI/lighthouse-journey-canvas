import React, { memo, useState, useRef } from 'react';
import { NodeProps } from '@xyflow/react';
import { motion } from 'framer-motion';
import { FaEdit, FaTrash, FaSave, FaTimes, FaCode, FaClipboardList } from 'react-icons/fa';
import { Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ProjectNodeData } from './shared/nodeUtils';
import { useNodeBehaviors } from '@/hooks/useNodeBehaviors';
import { useUICoordinatorStore } from '@/stores/ui-coordinator-store';
import { useJourneyStore } from '@/stores/journey-store';
import { formatDateRange } from '@/utils/date-parser';
import { getBlurClasses, getFlexPositionClasses } from './shared/nodeUtils';
import { BaseNode } from './shared/BaseNode';
import ProjectUpdatesModal from './shared/ProjectUpdatesModal';

const ProjectNode: React.FC<NodeProps> = ({ data, selected, id }) => {
  // Type assertion for data
  const projectData = data as ProjectNodeData;

  // Component-centric behavior composition
  const { focus, selection, highlight, interaction } = useNodeBehaviors(id);
  const { zoomToFocusedNode } = useUICoordinatorStore();
  const { setFocusedExperience, expandedNodeId, setExpandedNode } = useJourneyStore();

  // Expansion logic - single expanded node like focus
  const isExpanded = expandedNodeId === id;
  const hasExpandableContent = Boolean(projectData.children && projectData.children.length > 0);

  const handleToggleExpansion = () => {
    if (isExpanded) {
      // If already expanded, collapse it
      setExpandedNode(null);
    } else {
      // Expand this node (closes any other expanded node)
      setExpandedNode(id);
    }
  };

  // Local state for editing
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(projectData.title);
  const [editDescription, setEditDescription] = useState(projectData.description);
  const [editTechnologies, setEditTechnologies] = useState(
    Array.isArray(projectData.technologies)
      ? projectData.technologies.join(', ')
      : (projectData.technologies || '')
  );
  const [showDetails, setShowDetails] = useState(false);
  const [showUpdates, setShowUpdates] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const nodeRef = useRef<HTMLDivElement>(null);

  // Enhanced focus/blur logic - show only focused node and its children
  const { focusedExperienceId } = useJourneyStore();
  const isFocused = focusedExperienceId === id;
  const isChildOfFocused = Boolean(focusedExperienceId && projectData.parentId === focusedExperienceId);
  const isBlurred = Boolean(focusedExperienceId && !isFocused && !isChildOfFocused && projectData.level === 0);
  const isHighlighted = projectData.isHighlighted || highlight.isHighlighted;

  // Color coding based on completion status
  const isCompleted = projectData.isCompleted || Boolean(projectData.endDate);
  const isOngoing = projectData.isOngoing || !projectData.endDate;
  const isSuggested = projectData.isSuggested || false;

  // Event handlers (defined before JSX to avoid hoisting issues)
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

  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();

    console.log('🎯 ProjectNode clicked:', {
      nodeId: id,
      currentFocused: focusedExperienceId,
      isFocused
    });

    // Node handles its own focus directly
    if (isFocused) {
      // If already focused, clear focus
      setFocusedExperience(null);
    } else {
      // Focus this node
      setFocusedExperience(id);
      // Zoom to focused node
      setTimeout(() => {
        zoomToFocusedNode(id);
      }, 50);
    }
  };

  // Prepare project-specific content
  const statusIndicator = projectData.technologies && projectData.technologies.length > 0 ? (
    <div className="absolute -top-1 -right-1 z-20">
      <div className="w-4 h-4 bg-green-500 rounded-full border-2 border-white/80 flex items-center justify-center">
        <FaCode className="w-2 h-2 text-white" />
      </div>
    </div>
  ) : null;

  const customContent = isEditing ? (
    <div className="space-y-2 mt-2">
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
      {showDetails && projectData.technologies && projectData.technologies.length > 0 && (
        <div className="flex flex-wrap gap-1 justify-center mt-2">
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
      <div className="flex items-center justify-center gap-1 mt-1">
        <div className="w-1 h-1 bg-emerald-400 rounded-full"></div>
        <span className="text-emerald-300 text-xs">Project</span>
      </div>
    </>
  );


  // Extract project index for staggered animations
  const projectIndex = id.includes('-project-')
    ? parseInt(id.split('-project-')[1]) || 0
    : 0;

  return (
    <motion.div
      ref={nodeRef}
      initial={{
        scale: 0.8,
        opacity: 0,
        y: 20
      }}
      animate={{
        scale: 1,
        opacity: 1,
        y: 0
      }}
      exit={{
        scale: 0.8,
        opacity: 0,
        y: -20
      }}
      transition={{
        type: "spring",
        stiffness: 100,
        damping: 15,
        delay: projectIndex * 0.1, // Staggered entrance based on project index
      }}
      whileHover={{
        scale: 1.02,
        transition: { duration: 0.2 }
      }}
      className={`
        ${getFlexPositionClasses((projectData as any).branch, 'project', id)}
        ${getBlurClasses(isBlurred, isFocused)}
      `}
    >
      <BaseNode
        id={id}
        start={projectData.startDate}
        end={projectData.endDate}
        isCompleted={isCompleted}
        isOngoing={isOngoing}
        isSuggested={isSuggested}
        suggestedReason={(projectData as any).suggestedReason}
        isHighlighted={isHighlighted}
        isHovered={isHovered}
        hasExpandableContent={hasExpandableContent}
        isExpanded={isExpanded}
        icon={<Wrench size={20} className="text-white filter drop-shadow-sm" />}
        nodeSize="small"
        title={isEditing ? editTitle : projectData.title}
        dateText={formatDateRange(projectData.startDate, projectData.endDate)}
        description={!isEditing && !showDetails ? projectData.description : undefined}
        onClick={handleClick}
        onExpandToggle={handleToggleExpansion}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        handles={projectData.handles || {
          left: true,
          right: true,
          bottom: true,
          leftSource: true
        }}
        statusIndicator={statusIndicator}
        animationDelay={projectIndex * 0.1}
        additionalContent={
          <>
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
          </>
        }
      />
    </motion.div>
  );
};

export default memo(ProjectNode);
