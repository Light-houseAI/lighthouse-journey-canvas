/**
 * HierarchyNodePanel - Simple Router for Node Panels
 *
 * Routes to the appropriate node panel component.
 * Each node panel handles its own side panel styling and behavior.
 */

import React from 'react';
import { useTimelineStore } from '../../hooks/useTimelineStore';
import { TimelineNodeType } from '@shared/enums';

// Import node panel components
import { JobNodePanel } from '../nodes/job';
import { EducationNodePanel } from '../nodes/education';
import { ProjectNodePanel } from '../nodes/project';
import { EventNodePanel } from '../nodes/event';
import { ActionNodePanel } from '../nodes/action';
import { CareerTransitionNodePanel } from '../nodes/career-transition';

export const HierarchyNodePanel: React.FC = () => {
  const { selectedNodeId, getNodeById } = useTimelineStore();

  const selectedNode = selectedNodeId ? getNodeById(selectedNodeId) : null;

  if (!selectedNode) return null;

  switch (selectedNode.type) {
    case TimelineNodeType.Job:
      return <JobNodePanel node={selectedNode} />;
    case TimelineNodeType.Education:
      return <EducationNodePanel node={selectedNode} />;
    case TimelineNodeType.Project:
      return <ProjectNodePanel node={selectedNode} />;
    case TimelineNodeType.Event:
      return <EventNodePanel node={selectedNode} />;
    case TimelineNodeType.Action:
      return <ActionNodePanel node={selectedNode} />;
    case TimelineNodeType.CareerTransition:
      return <CareerTransitionNodePanel node={selectedNode} />;
    default:
      return <div>Panel for {selectedNode.type} not supported...</div>;
  }
};
