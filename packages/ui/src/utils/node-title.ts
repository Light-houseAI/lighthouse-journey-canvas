/**
 * Utility functions for extracting titles from Timeline nodes
 */

import { generateNodeTitle } from '../components/timeline/ProfileListView';

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
