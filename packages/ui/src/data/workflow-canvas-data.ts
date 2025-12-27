/**
 * Workflow Canvas Data Generation
 * Converts real session chapter data into interactive workflow diagrams
 */

import type { SessionChapter } from '@journey/schema';
import { FullWorkflow, WorkflowNode, WorkflowConnection } from '../types/workflow-canvas';

/**
 * Generate workflow from real session chapter data
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
  const VERTICAL_SPACING = 200;
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
 * Generate empty/fallback workflow when no chapters available
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
 * @deprecated Use generateWorkflowFromSessionChapters instead
 */
export function generateWorkflowFromSessions(): FullWorkflow {
  return generateEmptyWorkflow('Work Journey Workflow');
}
