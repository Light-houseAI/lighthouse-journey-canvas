import { ArrowLeft } from 'lucide-react';
import React from 'react';
import { useLocation, useRoute } from 'wouter';

import { WeeklyProgressChatModal } from '../components/modals/WeeklyProgressChatModal';
import { WorkflowAnalysisChatModal } from '../components/modals/WorkflowAnalysisChatModal';

export default function BrowseOutputTemplate() {
  const [, params] = useRoute('/work-track/:nodeId/browse-outputs/:templateKey');
  const nodeId = params?.nodeId || '';
  const templateKey = params?.templateKey || '';
  const [, setLocation] = useLocation();

  const handleClose = () => {
    setLocation(`/work-track/${nodeId}/browse-outputs`);
  };

  if (templateKey === 'weekly-progress') {
    return (
      <WeeklyProgressChatModal
        isOpen={true}
        onClose={handleClose}
        nodeId={nodeId}
      />
    );
  }

  if (templateKey === 'workflow-analysis') {
    return (
      <WorkflowAnalysisChatModal
        isOpen={true}
        onClose={handleClose}
        nodeId={nodeId}
      />
    );
  }

  // Unknown template key — redirect back
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-white">
      <h1 className="text-2xl font-bold text-gray-900">Template Not Found</h1>
      <p className="text-gray-600">The template "{templateKey}" doesn't exist.</p>
      <button
        onClick={handleClose}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to browse outputs
      </button>
    </div>
  );
}
