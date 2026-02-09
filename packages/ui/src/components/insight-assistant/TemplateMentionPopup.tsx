/**
 * Template Mention Popup Component
 *
 * Appears when user types "/" in the chat input.
 * Shows template buttons from the template store (editable, persisted).
 * Each template has an expandable chevron to preview the prompt with a copy button.
 * Clicking the template name immediately sends the corresponding query.
 * Users can edit, create, and delete templates via a modal.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  X, Zap, FileText, BookOpen, ChevronRight, Copy, Check, Rocket,
  Sparkles, Brain, Target, Lightbulb, Pencil, Trash2, Plus, RotateCcw,
} from 'lucide-react';
import { useTemplateStore, COLOR_PRESETS, type StoredTemplate, type TemplateIconKey } from '../../stores/template-store';

// ============================================================================
// ICON MAP
// ============================================================================

const ICON_MAP: Record<TemplateIconKey, typeof FileText> = {
  FileText,
  BookOpen,
  Rocket,
  Sparkles,
  Zap,
  Brain,
  Target,
  Lightbulb,
};

export function getTemplateIcon(key: TemplateIconKey) {
  return ICON_MAP[key] ?? FileText;
}

// ============================================================================
// TYPES
// ============================================================================

export interface TemplateMentionPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (templateQuery: string, templateName: string) => void;
  onEditTemplate?: (template: StoredTemplate) => void;
  onCreateTemplate?: () => void;
  disabled?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function TemplateMentionPopup({
  isOpen,
  onClose,
  onSelectTemplate,
  onEditTemplate,
  onCreateTemplate,
  disabled = false,
}: TemplateMentionPopupProps) {
  const { templates, deleteTemplate, resetTemplate } = useTemplateStore();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // Reset state when popup opens
  useEffect(() => {
    if (isOpen) {
      setSelectedIndex(0);
      setExpandedId(null);
      setCopiedId(null);
    }
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev < templates.length - 1 ? prev + 1 : prev));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (templates[selectedIndex] && !disabled) {
            onSelectTemplate(templates[selectedIndex].query, templates[selectedIndex].name);
          }
          break;
        case 'Escape':
          e.preventDefault();
          if (expandedId) {
            setExpandedId(null);
          } else {
            onClose();
          }
          break;
      }
    },
    [isOpen, selectedIndex, expandedId, onSelectTemplate, onClose, disabled, templates]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  const handleToggleExpand = useCallback((e: React.MouseEvent, templateId: string) => {
    e.stopPropagation();
    setExpandedId((prev) => (prev === templateId ? null : templateId));
  }, []);

  const handleCopyPrompt = useCallback((e: React.MouseEvent, template: StoredTemplate) => {
    e.stopPropagation();
    navigator.clipboard.writeText(template.promptPreview);
    setCopiedId(template.id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const handleEdit = useCallback((e: React.MouseEvent, template: StoredTemplate) => {
    e.stopPropagation();
    onEditTemplate?.(template);
  }, [onEditTemplate]);

  const handleDelete = useCallback((e: React.MouseEvent, template: StoredTemplate) => {
    e.stopPropagation();
    if (!template.isBuiltIn) {
      deleteTemplate(template.id);
    }
  }, [deleteTemplate]);

  const handleReset = useCallback((e: React.MouseEvent, template: StoredTemplate) => {
    e.stopPropagation();
    if (template.isBuiltIn) {
      resetTemplate(template.id);
    }
  }, [resetTemplate]);

  if (!isOpen) return null;

  return (
    <div
      ref={popupRef}
      className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-3 py-2">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">Templates</span>
        </div>
        <div className="flex items-center gap-1">
          {onCreateTemplate && (
            <button
              onClick={onCreateTemplate}
              className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
              title="Create new template"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Template List */}
      <div className="max-h-[400px] overflow-y-auto py-1">
        {templates.map((template, index) => {
          const Icon = getTemplateIcon(template.iconKey);
          const colors = COLOR_PRESETS[template.colorPreset] ?? COLOR_PRESETS.blue;
          const isExpanded = expandedId === template.id;
          const isCopied = copiedId === template.id;

          return (
            <div key={template.id}>
              {/* Template Row */}
              <div
                className={`flex w-full items-center gap-3 px-3 py-2.5 transition-colors ${
                  index === selectedIndex ? 'bg-gray-100' : 'hover:bg-gray-50'
                } ${disabled ? 'opacity-50' : ''}`}
              >
                {/* Expand chevron */}
                <button
                  onClick={(e) => handleToggleExpand(e, template.id)}
                  className="flex-shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                  title="View prompt"
                >
                  <ChevronRight
                    className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                  />
                </button>

                {/* Icon */}
                <div
                  className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${colors.iconBg}`}
                >
                  <Icon className={`h-4 w-4 ${colors.text}`} />
                </div>

                {/* Name + description — clickable to select */}
                <button
                  onClick={() => onSelectTemplate(template.query, template.name)}
                  disabled={disabled}
                  className={`min-w-0 flex-1 text-left ${disabled ? 'cursor-not-allowed' : ''}`}
                >
                  <p
                    className={`text-sm font-medium ${
                      index === selectedIndex ? 'text-gray-900' : 'text-gray-800'
                    }`}
                  >
                    {template.name}
                    {!template.isBuiltIn && (
                      <span className="ml-1.5 text-[10px] font-normal text-gray-400">custom</span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">{template.description}</p>
                </button>

                {/* Action buttons */}
                <div className="flex flex-shrink-0 items-center gap-0.5">
                  {onEditTemplate && (
                    <button
                      onClick={(e) => handleEdit(e, template)}
                      className="rounded p-1 text-gray-300 hover:bg-gray-200 hover:text-gray-600"
                      title="Edit template"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {template.isBuiltIn ? (
                    <button
                      onClick={(e) => handleReset(e, template)}
                      className="rounded p-1 text-gray-300 hover:bg-gray-200 hover:text-gray-600"
                      title="Reset to default"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <button
                      onClick={(e) => handleDelete(e, template)}
                      className="rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-500"
                      title="Delete template"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded Prompt Preview */}
              {isExpanded && (
                <div className="mx-3 mb-2 rounded-lg border border-gray-200 bg-gray-50">
                  <div className="flex items-center justify-between border-b border-gray-200 px-3 py-1.5">
                    <span className="text-xs font-medium text-gray-500">Prompt Template</span>
                    <button
                      onClick={(e) => handleCopyPrompt(e, template)}
                      className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-200 hover:text-gray-700"
                      title="Copy prompt"
                    >
                      {isCopied ? (
                        <>
                          <Check className="h-3 w-3 text-green-500" />
                          <span className="text-green-600">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="whitespace-pre-wrap px-3 py-2 text-xs leading-relaxed text-gray-700">
                    {template.promptPreview}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer hint */}
      <div className="border-t border-gray-100 bg-gray-50 px-3 py-1.5">
        <span className="text-xs text-gray-400">
          <kbd className="rounded bg-gray-200 px-1 font-mono text-gray-500">Enter</kbd> to select
          {' \u00B7 '}
          <kbd className="rounded bg-gray-200 px-1 font-mono text-gray-500">Esc</kbd> to close
        </span>
      </div>
    </div>
  );
}

export default TemplateMentionPopup;
