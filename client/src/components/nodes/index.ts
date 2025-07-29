// Individual node components (legacy - being removed)

// New node components for React Flow with Zustand store integration
export { default as WorkExperienceNode } from './WorkExperienceNode';
export { default as EducationNode } from './EducationNode';
export { default as ProjectNode } from './ProjectNode';

// Shared components
export { default as STARModal } from './shared/STARModal';
export { default as ProjectUpdatesModal } from './shared/ProjectUpdatesModal';

// Utilities and types
export * from './shared/nodeUtils';

// React Flow node types configuration
import WorkExperienceNode from './WorkExperienceNode';
import EducationNode from './EducationNode';
import ProjectNode from './ProjectNode';

export const nodeTypes = {
  workExperience: WorkExperienceNode,
  education: EducationNode,
  project: ProjectNode,
};