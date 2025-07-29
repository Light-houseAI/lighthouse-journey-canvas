import { EdgeTypes } from '@xyflow/react';
import StraightTimelineEdge from './StraightTimelineEdge';
import StraightProjectEdge from './StraightProjectEdge';
import LBranchEdge from './LBranchEdge';

/**
 * Edge types configuration for React Flow
 * Maps edge type names to their corresponding components
 */
export const edgeTypes: EdgeTypes = {
  straightTimeline: StraightTimelineEdge,
  straightProject: StraightProjectEdge,
  lBranch: LBranchEdge,
};

// Export individual components
export { StraightTimelineEdge, StraightProjectEdge, LBranchEdge };

// Export utilities
export * from './edgeUtils';