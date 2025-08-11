import React, { memo, useState } from 'react';
import { NodeProps } from '@xyflow/react';
import { FaEdit, FaTrash, FaSave, FaTimes } from 'react-icons/fa';
import { GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EducationNodeData } from './shared/nodeUtils';
import { useNodeBehaviors } from '@/hooks/useNodeBehaviors';
import { useUICoordinatorStore } from '@/stores/ui-coordinator-store';
import { useJourneyStore } from '@/stores/journey-store';

import { formatDateRange } from '@/utils/date-parser';
import { getBlurClasses, getFlexPositionClasses } from './shared/nodeUtils';
import { BaseNode } from './shared/BaseNode';

const EducationNode: React.FC<NodeProps> = ({ data, selected, id }) => {
  // Type assertion for data
  const educationData = data as EducationNodeData;

  // Component-centric behavior composition
  const { focus, selection, highlight, interaction } = useNodeBehaviors(id);
  const { zoomToFocusedNode } = useUICoordinatorStore();
  const { setFocusedExperience, expandedNodeId, setExpandedNode } = useJourneyStore();

  // Expansion logic - single expanded node like focus
  const isExpanded = expandedNodeId === id;
  const hasExpandableContent = Boolean(educationData.children && educationData.children.length > 0);

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
  const [editInstitution, setEditInstitution] = useState(educationData.institution);
  const [editDegree, setEditDegree] = useState(educationData.degree);
  const [editField, setEditField] = useState(educationData.field);
  const [editDescription, setEditDescription] = useState(educationData.description || '');
  const [isHovered, setIsHovered] = useState(false);

  // Enhanced focus/blur logic - show only focused node and its children
  const { focusedExperienceId } = useJourneyStore();
  const isFocused = focusedExperienceId === id;
  const isChildOfFocused = Boolean(focusedExperienceId && educationData.parentId === focusedExperienceId);
  const isBlurred = Boolean(focusedExperienceId && !isFocused && !isChildOfFocused && educationData.level === 0);
  const isHighlighted = educationData.isHighlighted || highlight.isHighlighted;

  // Debug focus state
  if (isFocused) {
    console.log(`🎯 EducationNode ${id} focus debug:`, {
      'store.isFocused': focus.isFocused,
      'data.isFocused': educationData.isFocused,
      'combined.isFocused': isFocused,
      'data.isBlurred': educationData.isBlurred,
      'final.isBlurred': isBlurred
    });
  }

  // Color coding based on completion status
  const isCompleted = educationData.isCompleted || Boolean(educationData.endDate);
  const isOngoing = educationData.isOngoing || !educationData.endDate;

  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();

    console.log('🎯 EducationNode clicked:', {
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
    setEditInstitution(educationData.institution);
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

  // Prepare custom content for editing state
  const customContent = isEditing ? (
    <div className="space-y-2 mt-2">
      <input
        value={editInstitution}
        onChange={(e) => setEditInstitution(e.target.value)}
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
      ${getFlexPositionClasses(undefined, 'education', id)}
      ${getBlurClasses(isBlurred, isFocused)}
    `}>
      <BaseNode
        id={id}
        start={educationData.startDate}
        end={educationData.endDate}
        isCompleted={isCompleted}
        isOngoing={isOngoing}
        isHighlighted={isHighlighted}
        isHovered={isHovered}
        hasExpandableContent={hasExpandableContent}
        isExpanded={isExpanded}
        icon={<GraduationCap size={24} className="text-white filter drop-shadow-sm" />}
        nodeSize="medium"
        title={educationData.title}
        dateText={formatDateRange(educationData.startDate, educationData.endDate)}
        description={!isEditing && educationData.description ? educationData.description : undefined}
        onClick={handleClick}
        onExpandToggle={handleToggleExpansion}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        handles={educationData.handles || {
          left: true,
          right: true,
          bottom: true,
          leftSource: true
        }}
        animationDelay={0.2}
      />
    </div>
  );
};

export default memo(EducationNode);
