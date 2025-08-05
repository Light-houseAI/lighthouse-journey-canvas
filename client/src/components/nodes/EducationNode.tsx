import React, { memo, useState } from 'react';
import { NodeProps } from '@xyflow/react';
import { FaEdit, FaTrash, FaSave, FaTimes } from 'react-icons/fa';
import { GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EducationNodeData } from '@/stores/journey-store';
import { useNodeBehaviors } from '@/hooks/useNodeBehaviors';
import { useUICoordinatorStore } from '@/stores/ui-coordinator-store';
import { useExpandableNode } from '@/hooks/useExpandableNode';
import { formatDateRange } from '@/utils/date-parser';
import { getBlurClasses, getFlexPositionClasses } from './shared/nodeUtils';
import { BaseNode } from './shared/BaseNode';

const EducationNode: React.FC<NodeProps> = ({ data, selected, id }) => {
  // Type assertion for data
  const educationData = data as EducationNodeData;

  // Component-centric behavior composition
  const { focus, selection, highlight, interaction } = useNodeBehaviors(id);
  const { zoomToFocusedNode } = useUICoordinatorStore();

  // Expansion logic
  const expandable = useExpandableNode({
    nodeId: id,
    nodeData: educationData,
    onToggleExpansion: educationData.onToggleExpansion
  });

  // Local state for editing
  const [isEditing, setIsEditing] = useState(false);
  const [editSchool, setEditSchool] = useState(educationData.school);
  const [editDegree, setEditDegree] = useState(educationData.degree);
  const [editField, setEditField] = useState(educationData.field);
  const [editDescription, setEditDescription] = useState(educationData.description || '');
  const [isHovered, setIsHovered] = useState(false);

  // Calculate derived states using behavior composition
  const isHighlighted = highlight.isHighlighted || educationData.isHighlighted;
  const isFocused = focus.isFocused || educationData.isFocused;
  const isBlurred = focus.isBlurred && !isFocused;

  // Color coding based on completion status
  const isCompleted = educationData.isCompleted || Boolean(educationData.end);
  const isOngoing = educationData.isOngoing || !educationData.end;
  const isSuggested = educationData.isSuggested || false;

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

  // Prepare custom content for editing state
  const customContent = isEditing ? (
    <div className="space-y-2 mt-2">
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
      ${getFlexPositionClasses(educationData.branch as number, 'education', id)}
      ${getBlurClasses(isBlurred, isFocused)}
    `}>
      <BaseNode
        id={id}
        start={educationData.start}
        end={educationData.end}
        isCompleted={isCompleted}
        isOngoing={isOngoing}
        isSuggested={isSuggested}
        suggestedReason={educationData.suggestedReason}
        isHighlighted={isHighlighted}
        isHovered={isHovered}
        hasExpandableContent={expandable.hasExpandableContent}
        isExpanded={expandable.isExpanded}
        icon={<GraduationCap size={24} className="text-white filter drop-shadow-sm" />}
        nodeSize="medium"
        title={isEditing ? `${editDegree} in ${editField}` : `${educationData.degree} in ${educationData.field}`}
        subtitle={isEditing ? editSchool : educationData.school}
        dateText={isEditing ? '' : (isSuggested ? 'Suggested' : formatDateRange(educationData.start, educationData.end, educationData.isOngoing))}
        description={!isEditing && educationData.description ? educationData.description : undefined}
        onClick={handleClick}
        onExpandToggle={expandable.toggleExpansion}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        handles={educationData.handles || {
          left: true,
          right: true
        }}
        animationDelay={0.2}
      />
    </div>
  );
};

export default memo(EducationNode);
