import { EdgeTypes } from '@xyflow/react';

import DottedTimelineEdge from './DottedTimelineEdge';
import LBranchEdge from './LBranchEdge';
import SecondaryTimelineEdge from './SecondaryTimelineEdge';
import StraightProjectEdge from './StraightProjectEdge';
import StraightTimelineEdge from './StraightTimelineEdge';

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
export { DottedTimelineEdge,LBranchEdge, SecondaryTimelineEdge, StraightProjectEdge, StraightTimelineEdge };

// Export utilities
export * from './edgeUtils';