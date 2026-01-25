/**
 * Workflow Canvas Data Generation
 * Converts real session data (V1 chapters or V2 workflows) into interactive workflow diagrams
 */

import type { SessionChapter, WorkflowV2, detectSchemaVersion } from '@journey/schema';
import { FullWorkflow, WorkflowNode, WorkflowConnection } from '../types/workflow-canvas';

/**
 * Detect schema version from session data
 */
function detectVersion(data: unknown): 1 | 2 {
  if (!data || typeof data !== 'object') return 1;
  const obj = data as Record<string, unknown>;
  if (obj.schema_version === 2 || obj.workflows) return 2;
  if (obj.chapters) return 1;
  // Check if it's an array of workflows vs chapters
  if (Array.isArray(data) && data.length > 0) {
    const first = data[0] as Record<string, unknown>;
    if (first.classification || first.semantic_steps) return 2;
    if (first.chapter_id || first.granular_steps) return 1;
  }
  return 1;
}

/**
 * Generate workflow from V2 workflow data (4-tier classification)
 */
export function generateWorkflowFromV2Workflows(
  workflows: WorkflowV2[],
  workflowTitle: string = 'Work Journey Workflow'
): FullWorkflow {
  if (!workflows || workflows.length === 0) {
    return generateEmptyWorkflow(workflowTitle);
  }

  const nodes: WorkflowNode[] = [];
  const connections: WorkflowConnection[] = [];

  // Layout configuration
  const HORIZONTAL_SPACING = 250;
  const START_X = 100;
  const START_Y = 200;

  // Convert each workflow to a workflow node
  workflows.forEach((workflow, index) => {
    const nodeId = workflow.id || `workflow-${index + 1}`;

    // Position nodes horizontally in sequence
    const position = {
      x: START_X + (index * HORIZONTAL_SPACING),
      y: START_Y,
    };

    nodes.push({
      id: nodeId,
      // Use the intent as the title
      title: workflow.classification?.level_1_intent || `Workflow ${index + 1}`,
      type: 'consistent',
      position,
      // Store V2 workflow data for detail panel
      workflowData: workflow,
    });

    // Create connection to next node
    if (index < workflows.length - 1) {
      const nextId = workflows[index + 1].id || `workflow-${index + 2}`;
      connections.push({
        from: nodeId,
        to: nextId,
        type: 'solid',
      });
    }
  });

  return {
    id: 'session-workflow',
    title: workflowTitle,
    nodes,
    connections,
  };
}

/**
 * Generate workflow from V1 session chapter data
 * Converts SessionChapter array into positioned workflow nodes with connections
 */
export function generateWorkflowFromSessionChapters(
  chapters: SessionChapter[],
  workflowTitle: string = 'Work Journey Workflow'
): FullWorkflow {
  if (!chapters || chapters.length === 0) {
    return generateEmptyWorkflow(workflowTitle);
  }

  const nodes: WorkflowNode[] = [];
  const connections: WorkflowConnection[] = [];

  // Layout configuration
  const HORIZONTAL_SPACING = 250;
  const START_X = 100;
  const START_Y = 200;

  // Convert each chapter to a workflow node
  chapters.forEach((chapter, index) => {
    const nodeId = `chapter-${chapter.chapter_id}`;

    // Position nodes horizontally in sequence
    const position = {
      x: START_X + (index * HORIZONTAL_SPACING),
      y: START_Y,
    };

    nodes.push({
      id: nodeId,
      title: chapter.title,
      type: 'consistent', // All real chapters are consistent steps
      position,
      // Store chapter data for detail panel
      chapterData: chapter,
    });

    // Create connection to next node
    if (index < chapters.length - 1) {
      connections.push({
        from: nodeId,
        to: `chapter-${chapters[index + 1].chapter_id}`,
        type: 'solid',
      });
    }
  });

  return {
    id: 'session-workflow',
    title: workflowTitle,
    nodes,
    connections,
  };
}

/**
 * Universal function that handles both V1 and V2 data formats
 */
export function generateWorkflowFromSessionData(
  data: { chapters?: SessionChapter[]; workflows?: WorkflowV2[] } | SessionChapter[] | WorkflowV2[],
  workflowTitle: string = 'Work Journey Workflow'
): FullWorkflow {
  // Handle object with chapters or workflows
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const obj = data as { chapters?: SessionChapter[]; workflows?: WorkflowV2[] };
    if (obj.workflows && obj.workflows.length > 0) {
      return generateWorkflowFromV2Workflows(obj.workflows, workflowTitle);
    }
    if (obj.chapters && obj.chapters.length > 0) {
      return generateWorkflowFromSessionChapters(obj.chapters, workflowTitle);
    }
    return generateEmptyWorkflow(workflowTitle);
  }

  // Handle array directly
  if (Array.isArray(data) && data.length > 0) {
    const version = detectVersion(data);
    if (version === 2) {
      return generateWorkflowFromV2Workflows(data as WorkflowV2[], workflowTitle);
    }
    return generateWorkflowFromSessionChapters(data as SessionChapter[], workflowTitle);
  }

  return generateEmptyWorkflow(workflowTitle);
}

/**
 * Generate empty/fallback workflow when no data available
 */
function generateEmptyWorkflow(title: string): FullWorkflow {
  return {
    id: 'empty-workflow',
    title,
    nodes: [
      {
        id: 'placeholder',
        title: 'No session data available',
        type: 'consistent',
        position: { x: 100, y: 200 },
      },
    ],
    connections: [],
  };
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use generateWorkflowFromSessionData instead
 */
export function generateWorkflowFromSessions(): FullWorkflow {
  return generateEmptyWorkflow('Work Journey Workflow');
}
