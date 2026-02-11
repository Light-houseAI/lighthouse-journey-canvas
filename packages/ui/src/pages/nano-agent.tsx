/**
 * Nano Agent Page
 *
 * Main page for creating, managing, and executing automation flows.
 * Three tabs: Builder (create/edit), Library (browse/manage), Monitor (track execution)
 */

import { Zap, Wrench, BookOpen, Activity, X } from 'lucide-react';
import React, { useState, useCallback } from 'react';
import { useLocation, useSearch } from 'wouter';

import { CompactSidebar } from '../components/layout/CompactSidebar';
import { FlowBuilder } from '../components/nano-agent/FlowBuilder';
import { FlowLibrary } from '../components/nano-agent/FlowLibrary';
import { ExecutionMonitor } from '../components/nano-agent/ExecutionMonitor';
import type { NanoAgentFlow, ExecutableAction } from '../services/nano-agent-api';
import * as nanoAgentApi from '../services/nano-agent-api';

type Tab = 'builder' | 'library' | 'monitor';

export default function NanoAgentPage() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const importWorkflowId = params.get('importWorkflow');

  // Tab state
  const [activeTab, setActiveTab] = useState<Tab>(
    importWorkflowId ? 'builder' : 'library'
  );

  // Flow editing state
  const [editingFlow, setEditingFlow] = useState<NanoAgentFlow | null>(null);

  // Execution state
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [executionFlowName, setExecutionFlowName] = useState('');
  const [executionActions, setExecutionActions] = useState<ExecutableAction[]>([]);

  /**
   * Handle flow saved from builder
   */
  const handleFlowSaved = useCallback((flow: NanoAgentFlow) => {
    setEditingFlow(flow);
    // Optionally switch to library
  }, []);

  /**
   * Handle edit flow from library
   */
  const handleEditFlow = useCallback((flow: NanoAgentFlow) => {
    setEditingFlow(flow);
    setActiveTab('builder');
  }, []);

  /**
   * Handle run flow
   */
  const handleRunFlow = useCallback(async (flow: NanoAgentFlow) => {
    try {
      const { executionId: newExecId } = await nanoAgentApi.startExecution(flow.id);
      setExecutionId(newExecId);
      setExecutionFlowName(flow.name);
      setExecutionActions(flow.actions as ExecutableAction[]);
      setActiveTab('monitor');
    } catch (err: any) {
      alert(`Failed to start execution: ${err.message}`);
    }
  }, []);

  /**
   * Close execution monitor
   */
  const handleCloseMonitor = useCallback(() => {
    setExecutionId(null);
    setActiveTab('library');
  }, []);

  const tabs: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
    { id: 'builder', label: 'Builder', icon: <Wrench className="h-4 w-4" /> },
    { id: 'library', label: 'Library', icon: <BookOpen className="h-4 w-4" /> },
    ...(executionId
      ? [
          {
            id: 'monitor' as Tab,
            label: 'Monitor',
            icon: <Activity className="h-4 w-4" />,
          },
        ]
      : []),
  ];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <CompactSidebar />

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-3"
          style={{ borderBottom: '1px solid #E2E8F0', background: '#FFFFFF' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ background: '#EEF2FF' }}
            >
              <Zap className="h-4 w-4" style={{ color: '#4F46E5' }} />
            </div>
            <div>
              <h1 className="text-sm font-semibold" style={{ color: '#1E293B' }}>
                Nano Agent
              </h1>
              <p className="text-xs" style={{ color: '#94A3B8' }}>
                Build and run browser automation flows
              </p>
            </div>
          </div>

          <button
            onClick={() => setLocation('/')}
            className="rounded-lg p-2 transition-colors hover:bg-gray-100"
          >
            <X className="h-4 w-4 text-gray-400" />
          </button>
        </div>

        {/* Tab navigation */}
        <div
          className="flex gap-1 px-4 pt-2"
          style={{ borderBottom: '1px solid #E2E8F0', background: '#FFFFFF' }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-b-2 text-indigo-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              style={
                activeTab === tab.id
                  ? { borderBottomColor: '#4F46E5' }
                  : {}
              }
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'builder' && (
            <FlowBuilder
              editingFlow={editingFlow}
              onFlowSaved={handleFlowSaved}
              onRunFlow={handleRunFlow}
              importWorkflowId={importWorkflowId}
            />
          )}

          {activeTab === 'library' && (
            <FlowLibrary
              onEditFlow={handleEditFlow}
              onRunFlow={handleRunFlow}
            />
          )}

          {activeTab === 'monitor' && executionId && (
            <ExecutionMonitor
              executionId={executionId}
              flowName={executionFlowName}
              actions={executionActions}
              onClose={handleCloseMonitor}
            />
          )}
        </div>
      </div>
    </div>
  );
}
