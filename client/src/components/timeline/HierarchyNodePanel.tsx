/**
 * HierarchyNodePanel - Simple Router for Node Panels
 *
 * Routes to the appropriate node panel component.
 * Each node panel handles its own side panel styling and behavior.
 */

import { TimelineNodeType } from '@shared/enums';
import React from 'react';

import { useTimelineStore } from '../../hooks/useTimelineStore';
import { ActionNodePanel } from '../nodes/action';
import { CareerTransitionNodePanel } from '../nodes/career-transition';
import { EducationNodePanel } from '../nodes/education';
import { EventNodePanel } from '../nodes/event';
// Import node panel components
import { JobNodePanel } from '../nodes/job';
import { ProjectNodePanel } from '../nodes/project';

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
