import { TimelineNode } from './Timeline';

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
  const experiences = profileData.experiences || profileData.filteredData?.experiences || [];
  const education = profileData.education || profileData.filteredData?.education || [];
  
  // Transform work experiences into timeline nodes
  experiences.forEach((exp: any, index: number) => {
    const nodeId = `experience-${index}`;
    
    // Transform projects into child timeline nodes
    const children: TimelineNode[] = [];
    if (exp.projects && exp.projects.length > 0) {
      exp.projects.forEach((project: any, projectIndex: number) => {
        const projectNodeId = `${nodeId}-project-${projectIndex}`;
        children.push({
          id: projectNodeId,
          type: 'project',
          start: project.start || '',
          end: project.end || '',
          parentId: nodeId,
          data: {
            id: projectNodeId,
            title: extractString(project.title || project.name) || '',
            description: extractString(project.description) || '',
            start: project.start || '',
            end: project.end || '',
            technologies: project.technologies || [],
            experienceId: nodeId,
            parentExperienceId: nodeId,
            type: 'project',
            originalProject: project,
          },
        });
      });
    }
    
    // Create work experience timeline node
    const experienceNode: TimelineNode = {
      id: nodeId,
      type: 'workExperience',
      start: exp.start || '',
      end: exp.end || '',
      children: children.length > 0 ? children : undefined,
      data: {
        id: nodeId,
        title: extractString(exp.title || exp.position) || '',
        company: extractString(exp.company) || '',
        start: exp.start || '',
        end: exp.end || '',
        description: extractString(exp.description) || '',
        location: extractString(exp.location) || '',
        projects: exp.projects || [],
        type: 'workExperience',
        hasExpandableContent: children.length > 0,
      },
    };
    
    timelineNodes.push(experienceNode);
  });
  
  // Transform education into timeline nodes
  education.forEach((edu: any, index: number) => {
    const nodeId = `education-${index}`;
    
    const educationNode: TimelineNode = {
      id: nodeId,
      type: 'education',
      start: edu.start || '',
      end: edu.end || '',
      data: {
        id: nodeId,
        school: extractString(edu.school || edu.institution) || '',
        degree: extractString(edu.degree) || '',
        field: extractString(edu.field) || '',
        start: edu.start || '',
        end: edu.end || '',
        description: extractString(edu.description) || '',
        type: 'education',
      },
    };
    
    timelineNodes.push(educationNode);
  });
  
  return timelineNodes;
}

/**
 * Create a timeline configuration for the main career timeline
 */
export function createMainTimelineConfig(onPlusButtonClick?: (edgeData: any) => void) {
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