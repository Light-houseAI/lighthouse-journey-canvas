import React from 'react';
import { TimelineNodeType } from '@shared/schema';
import { JobModal } from '../nodes/job';
import { EducationModal } from '../nodes/education';
import {ProjectModal} from '../nodes/project';
import {EventModal} from '../nodes/event';
import {ActionModal} from '../nodes/action';
import {CareerTransitionModal} from '../nodes/career-transition';

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
  suggestedData?: any;
}

interface NodeModalRouterProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  context: NodeContext;
}

export const NodeModalRouter: React.FC<NodeModalRouterProps> = ({
  isOpen,
  onClose,
  onSubmit,
  context,
}) => {
  switch (context.nodeType) {
    case TimelineNodeType.Job:
      return (
        <JobModal
          isOpen={isOpen}
          onClose={onClose}
          onSubmit={onSubmit}
          context={context}
        />
      );
    case TimelineNodeType.Education:
      return (
        <EducationModal
          isOpen={isOpen}
          onClose={onClose}
          onSubmit={onSubmit}
          context={context}
        />
      );
    case TimelineNodeType.Project:
      return (
        <ProjectModal
          isOpen={isOpen}
          onClose={onClose}
          onSubmit={onSubmit}
          context={context}
        />
      );
    case TimelineNodeType.Event:
      return (
        <EventModal
          isOpen={isOpen}
          onClose={onClose}
          onSubmit={onSubmit}
          context={context}
        />
      );
    case TimelineNodeType.Action:
      return (
        <ActionModal
          isOpen={isOpen}
          onClose={onClose}
          onSubmit={onSubmit}
          context={context}
        />
      );
    case TimelineNodeType.CareerTransition:
      return (
        <CareerTransitionModal
          isOpen={isOpen}
          onClose={onClose}
          onSubmit={onSubmit}
          context={context}
        />
      );
    default:
      return null;
  }
};

export default NodeModalRouter;
