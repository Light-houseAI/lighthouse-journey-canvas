/**
 * WorkflowCanvas Page
 * Full-screen interactive workflow diagram view using real session data
 */

import { useState, useMemo } from 'react';
import { useParams, useLocation } from 'wouter';
import { ArrowLeft, Download } from 'lucide-react';
import { Button } from '@journey/components';
import { WorkflowCanvas } from '../components/timeline/WorkflowCanvas';
import { WorkflowStepPanel } from '../components/timeline/WorkflowStepPanel';
import { generateWorkflowFromSessionChapters } from '../data/workflow-canvas-data';
import { useNodeSessions } from '../hooks/useNodeSessions';
import type { WorkflowNode } from '../types/workflow-canvas';

export default function WorkflowCanvasPage() {
  const { workflowId } = useParams<{ workflowId: string }>();
  const [, setLocation] = useLocation();
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  // Fetch session data for this workflow (workflowId is actually the session mapping ID)
  const { data, isLoading } = useNodeSessions(workflowId || '', { page: 1, limit: 1 });

  // Generate workflow from real session chapter data
  const workflow = useMemo(() => {
    const session = data?.sessions?.[0];
    if (!session?.chapters || session.chapters.length === 0) {
      return generateWorkflowFromSessionChapters([], session?.workflowName || 'Work Session');
    }
    return generateWorkflowFromSessionChapters(session.chapters, session.workflowName || 'Work Session');
  }, [data]);

  const handleNodeSelect = (node: WorkflowNode | null) => {
    setSelectedNode(node);
    setIsPanelOpen(!!node);
  };

  const handlePanelClose = () => {
    setSelectedNode(null);
    setIsPanelOpen(false);
  };

  const handleBackClick = () => {
    setLocation(-1); // Go back to previous page
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Fixed Header */}
      <header className="h-16 border-b border-gray-200 bg-white flex items-center justify-between px-6 flex-shrink-0 z-10">
        <Button
          variant="ghost"
          className="gap-2 text-gray-600 hover:text-gray-900"
          onClick={handleBackClick}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        <h1 className="text-xl font-semibold text-gray-900 absolute left-1/2 -translate-x-1/2">
          {workflow.title}
        </h1>

        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Download PDF
        </Button>
      </header>

      {/* Canvas Area */}
      <div className="flex-1 overflow-hidden p-6">
        <WorkflowCanvas workflow={workflow} onNodeSelect={handleNodeSelect} />
      </div>

      {/* Step Detail Panel */}
      <WorkflowStepPanel node={selectedNode} isOpen={isPanelOpen} onClose={handlePanelClose} />
    </div>
  );
}
