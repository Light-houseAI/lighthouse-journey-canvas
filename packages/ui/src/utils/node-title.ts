/**
 * Utility functions for extracting titles from Timeline nodes and sessions
 */

import { generateNodeTitle } from '../components/timeline/ProfileListView';

/**
 * Get display title for a session, handling "Untitled Session" as a missing title
 * Priority: user-defined workflowName > LLM-generated title > fallback
 */
export function getSessionDisplayTitle(
  session: { workflowName?: string | null; generatedTitle?: string | null } | null | undefined,
  fallback: string = 'Work Session'
): string {
  if (!session) return fallback;

  // Check if workflowName exists and is not "Untitled Session" or similar
  const workflowName = session.workflowName;
  const isUntitled = !workflowName ||
                     workflowName === 'Untitled Session' ||
                     workflowName.toLowerCase().includes('untitled');

  if (!isUntitled && workflowName) {
    return workflowName;
  }

  // Fall back to LLM-generated title
  if (session.generatedTitle) {
    return session.generatedTitle;
  }

  return fallback;
}

/**
 * Get a display label for selected nodes
 */
export function getSelectedNodesLabel(
  shareAllNodes: boolean,
  selectedNodes: string[],
  userNodes: any[]
): string {
  if (shareAllNodes) {
    return 'All journeys';
  }

  if (selectedNodes.length === 0) {
    return 'No journeys selected';
  }

  if (selectedNodes.length === 1 && userNodes.length > 0) {
    const selectedNode = userNodes.find((node) => node.id === selectedNodes[0]);
    if (selectedNode) {
      return generateNodeTitle(selectedNode);
    }
  }

  if (selectedNodes.length > 1) {
    return `${selectedNodes.length} selected journeys`;
  }

  return 'Selected journeys';
}
