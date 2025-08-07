import React, { memo, useState } from 'react';
import { NodeProps } from '@xyflow/react';
import { FaEdit, FaTrash, FaSave, FaTimes } from 'react-icons/fa';
import { Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { JobNodeData } from './shared/nodeUtils';
import { useNodeBehaviors } from '@/hooks/useNodeBehaviors';
import { useUICoordinatorStore } from '@/stores/ui-coordinator-store';
import { useJourneyStore } from '@/stores/journey-store';

import { formatDateRange } from '@/utils/date-parser';
import { getBlurClasses, getFlexPositionClasses } from './shared/nodeUtils';
import { BaseNode } from './shared/BaseNode';

const JobNode: React.FC<NodeProps> = ({ data, selected, id }) => {
  // Type assertion for data
  const jobData = data as JobNodeData;

  // Component-centric behavior composition
  const { focus, selection, highlight, interaction } = useNodeBehaviors(id);
  const { zoomToFocusedNode } = useUICoordinatorStore();
  const { setFocusedExperience, expandedNodeId, setExpandedNode } = useJourneyStore();

  // Expansion logic - single expanded node like focus
  const isExpanded = expandedNodeId === id;
  const hasExpandableContent = Boolean(jobData.children && jobData.children.length > 0);

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
  const [editTitle, setEditTitle] = useState(jobData.title);
  const [editCompany, setEditCompany] = useState(jobData.company);
  const [editDescription, setEditDescription] = useState(jobData.description);
  const [isHovered, setIsHovered] = useState(false);

  // Simplified focus/blur logic - each node calculates its own state
  const globalFocusedNodeId = jobData.globalFocusedNodeId;
  const isFocused = globalFocusedNodeId === id;
  const isBlurred = Boolean(globalFocusedNodeId && !isFocused && jobData.level === 0);
  const isHighlighted = jobData.isHighlighted || highlight.isHighlighted;

  // Color coding based on completion status
  const isCompleted = jobData.isCompleted || Boolean(jobData.endDate);
  const isOngoing = jobData.isOngoing || !jobData.endDate;
  const isSuggested = jobData.isSuggested || false;

  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();

    console.log('🎯 JobNode clicked:', {
      nodeId: id,
      currentFocused: globalFocusedNodeId,
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
    setEditTitle(jobData.title);
    setEditCompany(jobData.company);
    setEditDescription(jobData.description);
    setIsEditing(false);
  };

  const handleDelete = (event: React.MouseEvent) => {
    event.stopPropagation();

    if (confirm('Are you sure you want to delete this work experience?')) {
      // TODO: Implement node delete functionality in the new store
      console.log('Delete functionality needs to be implemented');

      // Call custom delete handler if provided
      if (jobData.onNodeDelete) {
        jobData.onNodeDelete(id);
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
      ${getFlexPositionClasses(jobData.branch as number, 'job', id)}
      ${getBlurClasses(isBlurred, isFocused)}
    `}>
      <BaseNode
        id={id}
        start={jobData.startDate}
        end={jobData.endDate}
        isCompleted={isCompleted}
        isOngoing={isOngoing}
        isSuggested={isSuggested}
        suggestedReason={jobData.suggestedReason}
        isHighlighted={isHighlighted}
        isHovered={isHovered}
        hasExpandableContent={hasExpandableContent}
        isExpanded={isExpanded}
        icon={<Briefcase size={24} className="text-white filter drop-shadow-sm" />}
        nodeSize="medium"
        title={isEditing ? editTitle : jobData.title}
        subtitle={isEditing
          ? editCompany
          : (jobData.company && jobData.company !== 'Unknown Company'
             ? jobData.company
             : '')}
        dateText={isEditing ? '' : (isSuggested ? 'Suggested' : formatDateRange(jobData.startDate, jobData.endDate, jobData.isOngoing))}
        onClick={handleClick}
        onExpandToggle={handleToggleExpansion}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        handles={jobData.handles || {
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

export default memo(JobNode);
