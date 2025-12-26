/**
 * Sample Workflow Canvas Data
 * This data will eventually be generated from session mappings
 */

import { FullWorkflow } from '../types/workflow-canvas';

/**
 * Generate a sample workflow from session data
 * This is a placeholder - will be enhanced to convert actual session data into workflow nodes
 */
export function generateWorkflowFromSessions(): FullWorkflow {
  return {
    id: 'sample-workflow',
    title: 'Work Journey Workflow',
    nodes: [
      {
        id: 'research',
        title: 'Research & Planning',
        type: 'consistent',
        position: { x: 100, y: 200 },
      },
      {
        id: 'preparation',
        title: 'Preparation',
        type: 'consistent',
        hasInsight: true,
        position: { x: 300, y: 200 },
      },
      {
        id: 'execution',
        title: 'Execution',
        type: 'consistent',
        position: { x: 500, y: 200 },
      },
      {
        id: 'review',
        title: 'Review & Iterate',
        type: 'consistent',
        hasInsight: true,
        position: { x: 700, y: 200 },
      },
      {
        id: 'completion',
        title: 'Completion',
        type: 'consistent',
        position: { x: 900, y: 200 },
      },
      // Situational branches
      {
        id: 'deep-dive',
        title: 'Deep dive research',
        type: 'situational',
        condition: 'If additional context needed',
        position: { x: 300, y: 380 },
      },
      {
        id: 'revision',
        title: 'Revision cycle',
        type: 'situational',
        condition: 'If feedback requires changes',
        position: { x: 700, y: 380 },
      },
    ],
    connections: [
      // Main flow
      { from: 'research', to: 'preparation', type: 'solid' },
      { from: 'preparation', to: 'execution', type: 'solid' },
      { from: 'execution', to: 'review', type: 'solid' },
      { from: 'review', to: 'completion', type: 'solid' },
      // Situational branches
      { from: 'research', to: 'deep-dive', type: 'dashed' },
      { from: 'deep-dive', to: 'preparation', type: 'dashed' },
      { from: 'review', to: 'revision', type: 'dashed' },
      { from: 'revision', to: 'execution', type: 'dashed' },
    ],
  };
}
