import React from 'react';
import { TimelineNode } from '@journey/schema';

// Import all node panel components
import { ActionNodePanel } from '../nodes/action/ActionNodePanel';
import { CareerTransitionNodePanel } from '../nodes/career-transition/CareerTransitionNodePanel';
import { EducationNodePanel } from '../nodes/education/EducationNodePanel';
import { EventNodePanel } from '../nodes/event/EventNodePanel';
import { JobNodePanel } from '../nodes/job/JobNodePanel';
import { ProjectNodePanel } from '../nodes/project/ProjectNodePanel';

interface NodePanelRendererProps {
  node: TimelineNode;
}

/**
 * Universal node panel renderer that displays the appropriate panel based on node type
 * Integrates with existing node panel components from the timeline system
 */
export const NodePanelRenderer: React.FC<NodePanelRendererProps> = ({ node }) => {
  switch (node.type) {
    case 'job':
      return <JobNodePanel node={node} />;
    case 'project':
      return <ProjectNodePanel node={node} />;
    case 'education':
      return <EducationNodePanel node={node} />;
    case 'event':
      return <EventNodePanel node={node} />;
    case 'careerTransition':
      return <CareerTransitionNodePanel node={node} />;
    case 'action':
      return <ActionNodePanel node={node} />;
    default:
      // Fallback for unknown node types - show basic info
      return (
        <div className="fixed right-0 top-0 h-full w-96 z-50 bg-white shadow-lg border-l border-gray-200">
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">
              {node.meta?.title || 'Untitled'}
            </h3>
            <p className="text-sm text-gray-600 mb-2">Type: {node.type}</p>
            {node.meta?.description && (
              <p className="text-gray-700">{node.meta.description}</p>
            )}
          </div>
        </div>
      );
  }
};