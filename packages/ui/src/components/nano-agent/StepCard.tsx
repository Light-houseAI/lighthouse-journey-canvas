/**
 * StepCard - Individual executable action display/edit component
 */

import {
  Globe,
  MousePointerClick,
  Keyboard,
  Eye,
  Camera,
  ArrowDown,
  Terminal,
  Rocket,
  List,
  Clock,
  GripVertical,
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import React, { useState } from 'react';

import type { ExecutableAction } from '../../services/nano-agent-api';

const ACTION_ICONS: Record<string, React.ReactNode> = {
  navigate: <Globe className="h-4 w-4" />,
  click: <MousePointerClick className="h-4 w-4" />,
  type: <Keyboard className="h-4 w-4" />,
  press_key: <Keyboard className="h-4 w-4" />,
  select_option: <List className="h-4 w-4" />,
  wait_for: <Clock className="h-4 w-4" />,
  screenshot: <Camera className="h-4 w-4" />,
  scroll: <ArrowDown className="h-4 w-4" />,
  shell_command: <Terminal className="h-4 w-4" />,
  app_launch: <Rocket className="h-4 w-4" />,
};

interface StepCardProps {
  action: ExecutableAction;
  index: number;
  onDelete: (index: number) => void;
  onUpdate: (index: number, action: ExecutableAction) => void;
  draggable?: boolean;
}

export function StepCard({
  action,
  index,
  onDelete,
  onUpdate,
  draggable = true,
}: StepCardProps) {
  const [expanded, setExpanded] = useState(false);

  const confidencePercent = Math.round(action.confidence * 100);
  const confidenceColor =
    confidencePercent >= 80
      ? '#22c55e'
      : confidencePercent >= 50
        ? '#eab308'
        : '#ef4444';

  return (
    <div
      className="group rounded-lg border bg-white transition-all hover:shadow-sm"
      style={{ borderColor: '#E2E8F0' }}
    >
      {/* Main row */}
      <div className="flex items-center gap-3 px-3 py-2.5">
        {draggable && (
          <GripVertical
            className="h-4 w-4 cursor-grab text-gray-300 opacity-0 transition-opacity group-hover:opacity-100"
          />
        )}

        {/* Step number */}
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
          style={{ background: '#4F46E5' }}
        >
          {index + 1}
        </span>

        {/* Action icon */}
        <span className="text-gray-400">
          {ACTION_ICONS[action.playwrightAction] || <Eye className="h-4 w-4" />}
        </span>

        {/* Description */}
        <span className="flex-1 truncate text-sm text-gray-700">
          {action.description}
        </span>

        {/* Confidence badge */}
        <span
          className="rounded-full px-2 py-0.5 text-xs font-medium"
          style={{
            background: `${confidenceColor}20`,
            color: confidenceColor,
          }}
        >
          {confidencePercent}%
        </span>

        {/* Action type badge */}
        <span
          className="rounded px-1.5 py-0.5 text-xs font-medium"
          style={{ background: '#EEF2FF', color: '#4F46E5' }}
        >
          {action.playwrightAction}
        </span>

        {/* Expand/collapse */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          {expanded ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>

        {/* Delete */}
        <button
          onClick={() => onDelete(index)}
          className="rounded p-1 text-gray-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div
          className="border-t px-3 py-2.5 text-xs text-gray-500"
          style={{ borderColor: '#E2E8F0' }}
        >
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="font-medium text-gray-400">Target:</span>{' '}
              {action.targetApp} / {action.appName}
            </div>
            {action.params.url && (
              <div>
                <span className="font-medium text-gray-400">URL:</span>{' '}
                {action.params.url}
              </div>
            )}
            {action.params.selector && (
              <div>
                <span className="font-medium text-gray-400">Selector:</span>{' '}
                {action.params.selector} ({action.params.selectorType || 'auto'})
              </div>
            )}
            {action.params.text && (
              <div>
                <span className="font-medium text-gray-400">Text:</span>{' '}
                {action.params.text}
              </div>
            )}
            {action.params.key && (
              <div>
                <span className="font-medium text-gray-400">Key:</span>{' '}
                {action.params.key}
              </div>
            )}
            <div>
              <span className="font-medium text-gray-400">Delay:</span>{' '}
              {action.postActionDelayMs}ms
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
