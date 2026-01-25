/**
 * Workflow Canvas Types
 * Types for interactive workflow diagram visualization
 */

import type { SessionChapter, WorkflowV2 } from '@journey/schema';

export interface WorkflowNode {
  id: string;
  title: string;
  type: 'consistent' | 'situational';
  hasInsight?: boolean;
  condition?: string; // For situational nodes, e.g., "If DT workshop"
  position: { x: number; y: number };
  // V1: Optional chapter data from real sessions (includes granular_steps, timestamps, etc.)
  chapterData?: SessionChapter;
  // V2: Optional workflow data with 4-tier classification (includes semantic_steps, classification, etc.)
  workflowData?: WorkflowV2;
}

export interface WorkflowConnection {
  from: string;
  to: string;
  type: 'solid' | 'dashed';
}

export interface FullWorkflow {
  id: string;
  title: string;
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
}
