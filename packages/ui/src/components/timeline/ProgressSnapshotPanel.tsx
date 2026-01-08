/**
 * Progress Snapshot Panel
 * Wrapper component for displaying Progress Snapshot in a panel with close functionality.
 */

import { X } from 'lucide-react';
import { Button } from '@journey/components';
import { useNodeSessions } from '../../hooks/useNodeSessions';
import { ProgressSnapshotView } from './ProgressSnapshotView';

interface ProgressSnapshotPanelProps {
  nodeId: string;
  nodeTitle?: string;
  onClose: () => void;
}

export function ProgressSnapshotPanel({ nodeId, nodeTitle, onClose }: ProgressSnapshotPanelProps) {
  // Fetch all sessions (up to 50) for the snapshot
  const { data, isLoading } = useNodeSessions(nodeId, { limit: 50 }, true);

  const sessions = data?.sessions || [];
  const totalDuration = data?.totalDurationSeconds || 0;

  return (
    <div className="space-y-4">
      {/* Panel Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Progress Snapshot</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700"
        >
          <X size={18} />
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      ) : (
        <ProgressSnapshotView
          sessions={sessions}
          totalDuration={totalDuration}
          nodeTitle={nodeTitle}
          nodeId={nodeId}
        />
      )}
    </div>
  );
}

