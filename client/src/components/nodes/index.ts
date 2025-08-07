// Individual node components (legacy - being removed)

// New node components for React Flow with Zustand store integration
export { default as JobNode } from './JobNode';
export { default as EducationNode } from './EducationNode';
export { default as ProjectNode } from './ProjectNode';
export { default as EventNode } from './EventNode';
export { default as ActionNode } from './ActionNode';
export { default as CareerTransitionNode } from './CareerTransitionNode';
export { default as HelperNode } from './HelperNode';
export { default as TimelinePlusButton } from './TimelinePlusButton';
export { default as PlusNode } from './PlusNode';

// Shared components
export { default as STARModal } from './shared/STARModal';
export { default as ProjectUpdatesModal } from './shared/ProjectUpdatesModal';

// Utilities and types
export * from './shared/nodeUtils';

// React Flow node types configuration
import JobNode from './JobNode';
import EducationNode from './EducationNode';
import ProjectNode from './ProjectNode';
import EventNode from './EventNode';
import ActionNode from './ActionNode';
import CareerTransitionNode from './CareerTransitionNode';
import HelperNode from './HelperNode';
import TimelinePlusButton from './TimelinePlusButton';
import PlusNode from './PlusNode';

export const nodeTypes = {
  job: JobNode,
  education: EducationNode,
  project: ProjectNode,
  event: EventNode,
  action: ActionNode,
  careerTransition: CareerTransitionNode,
  helper: HelperNode,
  timelinePlusButton: TimelinePlusButton,
  plusNode: PlusNode,
};