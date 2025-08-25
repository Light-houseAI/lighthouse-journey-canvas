import { EdgeTypes } from '@xyflow/react';
import StraightTimelineEdge from './StraightTimelineEdge';
import StraightProjectEdge from './StraightProjectEdge';
import LBranchEdge from './LBranchEdge';
import SecondaryTimelineEdge from './SecondaryTimelineEdge';
import DottedTimelineEdge from './DottedTimelineEdge';

/**
 * Edge types configuration for React Flow
 * Maps edge type names to their corresponding components
 */
export const edgeTypes: EdgeTypes = {
  straightTimeline: StraightTimelineEdge,
  straightProject: StraightProjectEdge,
  lBranch: LBranchEdge,
  secondaryTimeline: SecondaryTimelineEdge,
  dottedTimeline: DottedTimelineEdge,
};

// Export individual components
export { StraightTimelineEdge, StraightProjectEdge, LBranchEdge, SecondaryTimelineEdge, DottedTimelineEdge };

// Export utilities
export * from './edgeUtils';