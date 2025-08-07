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
    const nodeId = job.id ? `job-${job.id}` : `job-${index}`;

    // Transform projects into child timeline nodes
    const children: TimelineNode[] = [];
    if (job.projects && job.projects.length > 0) {
      job.projects.forEach((project: any, projectIndex: number) => {
        const projectNodeId = `${nodeId}-project-${projectIndex}`;
        children.push({
          id: projectNodeId,
          parentId: nodeId,
          data: project,
        });
      });
    }

    // Create job timeline node
    const jobNode: TimelineNode = {
      id: nodeId,
      children: children.length > 0 ? children : undefined,
      data: job
    };

    timelineNodes.push(jobNode);
  });

  // Transform education into timeline nodes
  education.forEach((edu: any, index: number) => {
    // Use the education's actual ID if available, fallback to index-based ID
    const nodeId = edu.id ? `education-${edu.id}` : `education-${index}`;
    
    // Debug: Creating education node

    const educationNode: TimelineNode = {
      id: nodeId,
      data: edu,
    };

    timelineNodes.push(educationNode);
  });

  // Transform events into timeline nodes
  events.forEach((event: any, index: number) => {
    const nodeId = `event-${index}`;

    const eventNode: TimelineNode = {
      id: nodeId,
      data: event,
    };

    timelineNodes.push(eventNode);
  });

  // Transform actions into timeline nodes
  actions.forEach((action: any, index: number) => {
    const nodeId = `action-${index}`;

    const actionNode: TimelineNode = {
      id: nodeId,
      data: action,
    };

    timelineNodes.push(actionNode);
  });

  // Transform standalone projects into timeline nodes
  projects.forEach((project: any, index: number) => {
    const nodeId = `project-${index}`;

    const projectNode: TimelineNode = {
      id: nodeId,
      data: project,
    };

    timelineNodes.push(projectNode);
  });

  // Transform career transitions into timeline nodes
  careerTransitions.forEach((transition: any, index: number) => {
    const nodeId = `career-transition-${index}`;

    const transitionNode: TimelineNode = {
      id: nodeId,
      data: transition,
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
