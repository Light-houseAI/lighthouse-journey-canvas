/**
 * FlowLibrary - Browse, manage, and run saved automation flows
 */

import {
  Search,
  Play,
  Pencil,
  Trash2,
  Share2,
  Copy,
  MoreVertical,
  Loader2,
  Zap,
} from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';

import type { NanoAgentFlow } from '../../services/nano-agent-api';
import * as nanoAgentApi from '../../services/nano-agent-api';

interface FlowLibraryProps {
  onEditFlow: (flow: NanoAgentFlow) => void;
  onRunFlow: (flow: NanoAgentFlow) => void;
}

export function FlowLibrary({ onEditFlow, onRunFlow }: FlowLibraryProps) {
  const [flows, setFlows] = useState<NanoAgentFlow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  const loadFlows = useCallback(async () => {
    setLoading(true);
    try {
      const result = await nanoAgentApi.listFlows({
        search: search || undefined,
        includeShared: true,
      });
      setFlows(result.flows);
      setTotal(result.total);
    } catch (err) {
      console.error('Failed to load flows:', err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    loadFlows();
  }, [loadFlows]);

  const handleDelete = useCallback(
    async (flowId: string) => {
      if (!confirm('Delete this flow?')) return;
      try {
        await nanoAgentApi.deleteFlow(flowId);
        setFlows((prev) => prev.filter((f) => f.id !== flowId));
        setTotal((prev) => prev - 1);
      } catch (err) {
        console.error('Failed to delete flow:', err);
      }
      setActiveMenu(null);
    },
    []
  );

  const handleFork = useCallback(
    async (flowId: string) => {
      try {
        const forked = await nanoAgentApi.forkFlow(flowId);
        setFlows((prev) => [forked, ...prev]);
        setTotal((prev) => prev + 1);
      } catch (err) {
        console.error('Failed to fork flow:', err);
      }
      setActiveMenu(null);
    },
    []
  );

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="flex h-full flex-col">
      {/* Search */}
      <div className="px-4 pt-4">
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Search flows..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-indigo-400"
            style={{ borderColor: '#E2E8F0' }}
          />
        </div>
      </div>

      {/* Flow list */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        )}

        {!loading && flows.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Zap className="mb-3 h-8 w-8 text-gray-300" />
            <p className="text-sm text-gray-400">
              {search ? 'No flows match your search' : 'No flows yet. Create one in the Builder tab!'}
            </p>
          </div>
        )}

        <div className="space-y-2">
          {flows.map((flow) => (
            <div
              key={flow.id}
              className="group relative rounded-lg border bg-white p-3 transition-all hover:shadow-sm"
              style={{ borderColor: '#E2E8F0' }}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-medium text-gray-800">
                      {flow.name}
                    </h4>
                    {flow.isTemplate && (
                      <span
                        className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                        style={{ background: '#DBEAFE', color: '#2563EB' }}
                      >
                        Shared
                      </span>
                    )}
                    <span
                      className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                      style={{ background: '#F1F5F9', color: '#64748B' }}
                    >
                      {(flow.actions as any[])?.length || 0} steps
                    </span>
                  </div>

                  {flow.description && (
                    <p className="mt-1 text-xs text-gray-400 line-clamp-1">
                      {flow.description}
                    </p>
                  )}

                  <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
                    <span>Ran {flow.runCount}x</span>
                    <span>Last: {formatDate(flow.lastRunAt)}</span>
                    {flow.tags.length > 0 && (
                      <span>{flow.tags.slice(0, 2).join(', ')}</span>
                    )}
                  </div>
                </div>

                {/* Quick actions */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onRunFlow(flow)}
                    className="rounded p-1.5 text-gray-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
                    title="Run"
                  >
                    <Play className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => onEditFlow(flow)}
                    className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                    title="Edit"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>

                  {/* More menu */}
                  <div className="relative">
                    <button
                      onClick={() =>
                        setActiveMenu(activeMenu === flow.id ? null : flow.id)
                      }
                      className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                    >
                      <MoreVertical className="h-3.5 w-3.5" />
                    </button>

                    {activeMenu === flow.id && (
                      <div
                        className="absolute right-0 top-8 z-10 w-36 rounded-lg border bg-white py-1 shadow-lg"
                        style={{ borderColor: '#E2E8F0' }}
                      >
                        <button
                          onClick={() => handleFork(flow.id)}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
                        >
                          <Copy className="h-3 w-3" />
                          Fork
                        </button>
                        <button
                          onClick={() => {
                            /* TODO: Share modal */
                            setActiveMenu(null);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
                        >
                          <Share2 className="h-3 w-3" />
                          Share
                        </button>
                        <button
                          onClick={() => handleDelete(flow.id)}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50"
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      {total > flows.length && (
        <div
          className="border-t px-4 py-2 text-center text-xs text-gray-400"
          style={{ borderColor: '#E2E8F0' }}
        >
          Showing {flows.length} of {total} flows
        </div>
      )}
    </div>
  );
}
