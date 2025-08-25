import { act } from 'react';
import { TimelineNode } from './Timeline';
import { formatDateRange, parseFlexibleDate } from '@/utils/date-parser';

// Helper function to safely extract string from object
const extractString = (value: any): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null) {
    return value.name || value.role || value.class || value.title || '';
  }
  return '';
};

/**
 * Transform profile data into timeline nodes with tree hierarchy
 */
export function transformProfileToTimelineNodes(profileData: any): TimelineNode[] {
  if (!profileData) return [];

  const timelineNodes: TimelineNode[] = [];

  // Get data from the correct structure
  const jobs = [...(profileData.filteredData?.jobs ?? []),
  ...(profileData.filteredData?.experiences ?? [])];
  const education = profileData.education || profileData.filteredData?.education || [];
  const projects = profileData.filteredData?.projects || [];
  const events = profileData.events || profileData.filteredData?.events || [];
  const actions = profileData.actions || profileData.filteredData?.actions || [];
  const careerTransitions = profileData.careerTransitions || profileData.filteredData?.careerTransitions || [];


  // Transform jobs into timeline nodes
  jobs.forEach((job: any, index: number) => {
    // Use the job's actual ID if available, fallback to index-based ID
    const nodeId = job.id;

    // Transform all child nodes (projects, events, actions) into child timeline nodes
    const children: TimelineNode[] = [];
    
    // Add projects from job.projects array
    if (job.projects && job.projects.length > 0) {
      job.projects.forEach((project: any) => {
        children.push({
          id: project.id,
          parentId: nodeId,
          data: {
            ...project,
            type: 'project',
          },
        });
      });
    }

    // Add events from job.events array  
    if (job.events && job.events.length > 0) {
      job.events.forEach((event: any) => {
        children.push({
          id: event.id,
          parentId: nodeId,
          data: {
            ...event,
            type: 'event',
          },
        });
      });
    }

    // Add actions from job.actions array
    if (job.actions && job.actions.length > 0) {
      job.actions.forEach((action: any) => {
        children.push({
          id: action.id,
          parentId: nodeId,
          data: {
            ...action,
            type: 'action',
          },
        });
      });
    }

    // Create job timeline node
    const jobNode: TimelineNode = {
      id: nodeId,
      children: children.length > 0 ? children : undefined,
      data: {
        ...job,
        type: 'job', // Ensure job nodes have the correct type
      }
    };

    timelineNodes.push(jobNode);
  });

  // Transform education into timeline nodes
  education.forEach((edu: any, index: number) => {
    // Use the education's actual ID if available, fallback to index-based ID
    const nodeId = edu.id;

    // Transform all child nodes (projects, events, actions) into child timeline nodes
    const children: TimelineNode[] = [];
    
    // Add projects from education.projects array
    if (edu.projects && edu.projects.length > 0) {
      edu.projects.forEach((project: any) => {
        children.push({
          id: project.id,
          parentId: nodeId,
          data: {
            ...project,
            type: 'project',
          },
        });
      });
    }

    // Add events from education.events array  
    if (edu.events && edu.events.length > 0) {
      edu.events.forEach((event: any) => {
        children.push({
          id: event.id,
          parentId: nodeId,
          data: {
            ...event,
            type: 'event',
          },
        });
      });
    }

    // Add actions from education.actions array
    if (edu.actions && edu.actions.length > 0) {
      edu.actions.forEach((action: any) => {
        children.push({
          id: action.id,
          parentId: nodeId,
          data: {
            ...action,
            type: 'action',
          },
        });
      });
    }

    const educationNode: TimelineNode = {
      id: nodeId,
      children: children.length > 0 ? children : undefined,
      data: {
        ...edu,
        type: 'education', // Ensure education nodes have the correct type
      },
    };

    timelineNodes.push(educationNode);
  });

  // Transform events into timeline nodes
  events.forEach((event: any, index: number) => {
    const nodeId = event.id;

    const eventNode: TimelineNode = {
      id: nodeId,
      data: {
        ...event,
        type: 'event', // Ensure event nodes have the correct type
      },
    };

    timelineNodes.push(eventNode);
  });

  // Transform actions into timeline nodes
  actions.forEach((action: any, index: number) => {
    const nodeId = action.id;

    const actionNode: TimelineNode = {
      id: nodeId,
      data: {
        ...action,
        type: 'action', // Ensure action nodes have the correct type
      },
    };

    timelineNodes.push(actionNode);
  });

  // Transform standalone projects into timeline nodes
  projects.forEach((project: any, index: number) => {
    const nodeId = project.id;

    const projectNode: TimelineNode = {
      id: nodeId,
      data: {
        ...project,
        type: 'project', // Ensure project nodes have the correct type
      },
    };

    timelineNodes.push(projectNode);
  });

  // Transform career transitions into timeline nodes
  careerTransitions.forEach((transition: any, index: number) => {
    const nodeId = transition.id;

    // Transform all child nodes (projects, events, actions) into child timeline nodes
    const children: TimelineNode[] = [];
    
    // Add projects from careerTransition.projects array
    if (transition.projects && transition.projects.length > 0) {
      transition.projects.forEach((project: any) => {
        children.push({
          id: project.id,
          parentId: nodeId,
          data: {
            ...project,
            type: 'project',
          },
        });
      });
    }

    // Add events from careerTransition.events array  
    if (transition.events && transition.events.length > 0) {
      transition.events.forEach((event: any) => {
        children.push({
          id: event.id,
          parentId: nodeId,
          data: {
            ...event,
            type: 'event',
          },
        });
      });
    }

    // Add actions from careerTransition.actions array
    if (transition.actions && transition.actions.length > 0) {
      transition.actions.forEach((action: any) => {
        children.push({
          id: action.id,
          parentId: nodeId,
          data: {
            ...action,
            type: 'action',
          },
        });
      });
    }

    const transitionNode: TimelineNode = {
      id: nodeId,
      children: children.length > 0 ? children : undefined,
      data: {
        ...transition,
        type: 'careerTransition', // Ensure career transition nodes have the correct type
      },
    };

    timelineNodes.push(transitionNode);
  });



  return timelineNodes;
}

/**
 * Create a timeline configuration for the main career timeline
 */
export function createMainTimelineConfig(
  onPlusButtonClick?: (edgeData: any) => void
) {
  return {
    startX: 300,
    startY: 400,
    horizontalSpacing: 500,
    verticalSpacing: 180, // Increased from 120 to provide more space between parent and child
    orientation: 'horizontal' as const,
    alignment: 'center' as const,
    onPlusButtonClick,
  };
}

/**
 * Extract child nodes from timeline nodes recursively
 */
export function extractChildNodes(nodes: TimelineNode[], parentId: string): TimelineNode[] {
  const children: TimelineNode[] = [];

  for (const node of nodes) {
    if (node.parentId === parentId) {
      children.push(node);
    }
    if (node.children) {
      children.push(...extractChildNodes(node.children, parentId));
    }
  }

  return children;
}

/**
 * Get all descendant node IDs from a timeline node
 */
export function getDescendantNodeIds(node: TimelineNode): string[] {
  const ids: string[] = [];

  if (node.children) {
    for (const child of node.children) {
      ids.push(child.id);
      ids.push(...getDescendantNodeIds(child));
    }
  }

  return ids;
}

/**
 * Find a timeline node by ID recursively
 */
export function findTimelineNode(nodes: TimelineNode[], id: string): TimelineNode | null {
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }
    if (node.children) {
      const found = findTimelineNode(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Get all timeline nodes in a flat array (including children)
 */
export function flattenTimelineNodes(nodes: TimelineNode[]): TimelineNode[] {
  const flattened: TimelineNode[] = [];

  for (const node of nodes) {
    flattened.push(node);
    if (node.children) {
      flattened.push(...flattenTimelineNodes(node.children));
    }
  }

  return flattened;
}
