import React, { memo, useState } from 'react';
import { NodeProps } from '@xyflow/react';
import { FaEdit, FaTrash, FaSave, FaTimes } from 'react-icons/fa';
import { Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WorkExperienceNodeData } from '@/stores/journey-store';
import { useNodeBehaviors } from '@/hooks/useNodeBehaviors';
import { useUICoordinatorStore } from '@/stores/ui-coordinator-store';
import { useExpandableNode } from '@/hooks/useExpandableNode';
import { formatDateRange } from '@/utils/date-parser';
import { getBlurClasses, getFlexPositionClasses } from './shared/nodeUtils';
import { BaseNode } from './shared/BaseNode';

const WorkExperienceNode: React.FC<NodeProps> = ({ data, selected, id }) => {
  // Type assertion for data
  const workData = data as WorkExperienceNodeData;

  // Component-centric behavior composition
  const { focus, selection, highlight, interaction } = useNodeBehaviors(id);
  const { zoomToFocusedNode } = useUICoordinatorStore();

  // Expansion logic
  const expandable = useExpandableNode({
    nodeId: id,
    nodeData: workData,
    onToggleExpansion: workData.onToggleExpansion
  });

  // Local state for editing
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(workData.title);
  const [editCompany, setEditCompany] = useState(workData.company);
  const [editDescription, setEditDescription] = useState(workData.description);
  const [isHovered, setIsHovered] = useState(false);

  // Calculate derived states using behavior composition
  const isHighlighted = highlight.isHighlighted || workData.isHighlighted;
  const isFocused = focus.isFocused || workData.isFocused;
  const isBlurred = focus.isBlurred && !isFocused;
  const hasProjects = workData.projects && workData.projects.length > 0;

  // Color coding based on completion status
  const isCompleted = workData.isCompleted || Boolean(workData.end);
  const isOngoing = workData.isOngoing || !workData.end;
  const isSuggested = workData.isSuggested || false;

  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();

    // If node has expandable content, prioritize expansion over focus
    if (expandable.hasExpandableContent) {
      expandable.toggleExpansion();
    } else {
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

  // Prepare custom content for editing state
  const customContent = isEditing ? (
    <div className="space-y-2 mt-2">
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
        rows={3}
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
    <div className="flex gap-1 justify-center mt-2">
      <Button size="sm" variant="outline" className="h-6 px-2 text-xs opacity-70 hover:opacity-100" onClick={handleEdit}>
        <FaEdit className="w-3 h-3" />
      </Button>
      <Button size="sm" variant="outline" className="h-6 px-2 text-xs opacity-70 hover:opacity-100 text-red-400" onClick={handleDelete}>
        <FaTrash className="w-3 h-3" />
      </Button>
    </div>
  );

  return (
    <div className={`
      ${getFlexPositionClasses(workData.branch as number, 'workExperience', id)}
      ${getBlurClasses(isBlurred, isFocused)}
    `}>
      <BaseNode
        id={id}
        start={workData.start}
        end={workData.end}
        isCompleted={isCompleted}
        isOngoing={isOngoing}
        isSuggested={isSuggested}
        suggestedReason={workData.suggestedReason}
        isHighlighted={isHighlighted}
        isHovered={isHovered}
        hasExpandableContent={expandable.hasExpandableContent}
        isExpanded={expandable.isExpanded}
        icon={<Briefcase size={24} className="text-white filter drop-shadow-sm" />}
        nodeSize="medium"
        title={isEditing ? editTitle : workData.title}
        subtitle={isEditing ? editCompany : workData.company}
        dateText={isEditing ? '' : (isSuggested ? 'Suggested' : formatDateRange(workData.start, workData.end, workData.isOngoing))}
        onClick={handleClick}
        onExpandToggle={expandable.toggleExpansion}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        handles={workData.handles || {
          left: true,
          right: true,
          bottom: true,
          leftSource: true
        }}
        animationDelay={0.1}
      />
    </div>
  );
};

export default memo(WorkExperienceNode);
