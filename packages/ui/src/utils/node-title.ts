/**
 * Utility functions for extracting titles from Timeline nodes and sessions
 */

import { generateNodeTitle } from '../components/timeline/ProfileListView';

/**
 * Get display title for a session
 * Priority: generatedTitle (summarized session name from AI) > workflowName > fallback
 *
 * Note: workflowName is the TRACK name (e.g., "NV" for a company),
 * while generatedTitle is the SESSION-specific summarized name (e.g., "Building Dashboard UI")
 * For session cards, we want to show the session-specific title, not the track name.
 */
export function getSessionDisplayTitle(
  session: { workflowName?: string | null; generatedTitle?: string | null } | null | undefined,
  fallback: string = 'Work Session'
): string {
  if (!session) return fallback;

  // Prefer generatedTitle - this is the summarized session name from desktop AI or LLM
  if (session.generatedTitle) {
    return session.generatedTitle;
  }

  // Fall back to workflowName if it's not "Untitled Session"
  const workflowName = session.workflowName;
  const isUntitled = !workflowName ||
                     workflowName === 'Untitled Session' ||
                     workflowName.toLowerCase().includes('untitled');

  if (!isUntitled && workflowName) {
    return workflowName;
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
