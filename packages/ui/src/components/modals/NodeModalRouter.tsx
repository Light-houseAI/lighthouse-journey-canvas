import { Dialog, DialogContent, DialogOverlay } from '@journey/components'; // was: dialog
import { TimelineNodeType } from '@journey/schema';
import React from 'react';

import { ActionForm } from '../nodes/action';
import { CareerTransitionForm } from '../nodes/career-transition';
import { EducationForm } from '../nodes/education';
import { EventForm } from '../nodes/event';
import { JobForm } from '../nodes/job';
import { ProjectForm } from '../nodes/project';

interface NodeContext {
  insertionPoint: 'between' | 'after' | 'branch';
  parentNode?: {
    id: string;
    title: string;
    type: string;
  };
  targetNode?: {
    id: string;
    title: string;
    type: string;
  };
  availableTypes: string[];
  nodeType: TimelineNodeType;
  parentId?: string; // Add parentId for hierarchical creation
  suggestedData?: any;
}

interface NodeModalRouterProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onFailure?: (error: string) => void;
  context: NodeContext;
  renderWithoutDialog?: boolean; // If true, renders form directly without Dialog wrapper
}

export const NodeModalRouter: React.FC<NodeModalRouterProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onFailure,
  context,
  renderWithoutDialog = false,
}) => {
  // Common form props
  const formProps = {
    parentId: context.parentId,
    onSuccess: () => {
      onSuccess?.();
      if (!renderWithoutDialog) {
        onClose();
      }
    },
    onFailure,
  };

  // Render form component based on node type
  const renderForm = () => {
    switch (context.nodeType) {
      case TimelineNodeType.Job:
        return <JobForm {...formProps} />;
      case TimelineNodeType.Education:
        return <EducationForm {...formProps} />;
      case TimelineNodeType.Project:
        return <ProjectForm {...formProps} />;
      case TimelineNodeType.Event:
        return <EventForm {...formProps} />;
      case TimelineNodeType.Action:
        return <ActionForm {...formProps} />;
      case TimelineNodeType.CareerTransition:
        return <CareerTransitionForm {...formProps} />;
      default:
        return null;
    }
  };

  // If renderWithoutDialog is true, return form directly
  if (renderWithoutDialog) {
    return renderForm();
  }

  // Otherwise, wrap in Dialog
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogOverlay />
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border-gray-200 bg-white text-gray-900 shadow-2xl">
        {renderForm()}
      </DialogContent>
    </Dialog>
  );
};
