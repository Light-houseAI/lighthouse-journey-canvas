import React from 'react';
import JobModal from './JobModal';
import EducationModal from './EducationModal';
import ProjectModal from './ProjectModal';
import EventModal from './EventModal';
import ActionModal from './ActionModal';
import CareerTransitionModal from './CareerTransitionModal';

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
  nodeType: 'job' | 'education' | 'project' | 'event' | 'action' | 'careerTransition';
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
    case 'job':
      return (
        <JobModal
          isOpen={isOpen}
          onClose={onClose}
          onSubmit={onSubmit}
          context={context}
        />
      );
    case 'education':
      return (
        <EducationModal
          isOpen={isOpen}
          onClose={onClose}
          onSubmit={onSubmit}
          context={context}
        />
      );
    case 'project':
      return (
        <ProjectModal
          isOpen={isOpen}
          onClose={onClose}
          onSubmit={onSubmit}
          context={context}
        />
      );
    case 'event':
      return (
        <EventModal
          isOpen={isOpen}
          onClose={onClose}
          onSubmit={onSubmit}
          context={context}
        />
      );
    case 'action':
      return (
        <ActionModal
          isOpen={isOpen}
          onClose={onClose}
          onSubmit={onSubmit}
          context={context}
        />
      );
    case 'careerTransition':
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