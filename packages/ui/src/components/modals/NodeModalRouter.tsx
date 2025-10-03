import { TimelineNodeType } from '@journey/schema';
import React from 'react';

import {
  Dialog,
  DialogContent,
  DialogOverlay,
} from '@journey/components';  // was: dialog
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
}

export const NodeModalRouter: React.FC<NodeModalRouterProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onFailure,
  context,
}) => {
  // All forms now follow the same pattern with onSuccess/onFailure callbacks
  switch (context.nodeType) {
    case TimelineNodeType.Job:
      return (
        <Dialog open={isOpen} onOpenChange={onClose}>
          <DialogOverlay />
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border-gray-200 bg-white text-gray-900 shadow-2xl">
            <JobForm
              parentId={context.parentId}
              onSuccess={() => {
                onSuccess?.();
                onClose();
              }}
              onFailure={onFailure}
            />
          </DialogContent>
        </Dialog>
      );
    case TimelineNodeType.Education:
      return (
        <Dialog open={isOpen} onOpenChange={onClose}>
          <DialogOverlay />
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border-gray-200 bg-white text-gray-900 shadow-2xl">
            <EducationForm
              parentId={context.parentId}
              onSuccess={() => {
                onSuccess?.();
                onClose();
              }}
              onFailure={onFailure}
            />
          </DialogContent>
        </Dialog>
      );
    case TimelineNodeType.Project:
      return (
        <Dialog open={isOpen} onOpenChange={onClose}>
          <DialogOverlay />
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border-gray-200 bg-white text-gray-900 shadow-2xl">
            <ProjectForm
              parentId={context.parentId}
              onSuccess={() => {
                onSuccess?.();
                onClose();
              }}
              onFailure={onFailure}
            />
          </DialogContent>
        </Dialog>
      );
    case TimelineNodeType.Event:
      return (
        <Dialog open={isOpen} onOpenChange={onClose}>
          <DialogOverlay />
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border-gray-200 bg-white text-gray-900 shadow-2xl">
            <EventForm
              parentId={context.parentId}
              onSuccess={() => {
                onSuccess?.();
                onClose();
              }}
              onFailure={onFailure}
            />
          </DialogContent>
        </Dialog>
      );
    case TimelineNodeType.Action:
      return (
        <Dialog open={isOpen} onOpenChange={onClose}>
          <DialogOverlay />
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border-gray-200 bg-white text-gray-900 shadow-2xl">
            <ActionForm
              parentId={context.parentId}
              onSuccess={() => {
                onSuccess?.();
                onClose();
              }}
              onFailure={onFailure}
            />
          </DialogContent>
        </Dialog>
      );
    case TimelineNodeType.CareerTransition:
      return (
        <Dialog open={isOpen} onOpenChange={onClose}>
          <DialogOverlay />
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border-gray-200 bg-white text-gray-900 shadow-2xl">
            <CareerTransitionForm
              parentId={context.parentId}
              onSuccess={() => {
                onSuccess?.();
                onClose();
              }}
              onFailure={onFailure}
            />
          </DialogContent>
        </Dialog>
      );
    default:
      return null;
  }
};
