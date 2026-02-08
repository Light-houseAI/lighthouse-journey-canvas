/**
 * Template Mention Popup Component
 *
 * Appears when user types "/" in the chat input.
 * Shows template buttons (Weekly Progress Update, Blog Creation).
 * Clicking a template immediately sends the corresponding query.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Zap, FileText, BookOpen } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

export interface SlashTemplate {
  id: string;
  name: string;
  description: string;
  icon: typeof FileText;
  /** The query string sent to the server */
  query: string;
  /** User-facing preview of the prompt template */
  promptPreview: string;
  colors: { bg: string; text: string; iconBg: string };
}

export interface TemplateMentionPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (templateQuery: string, templateName: string, promptPreview: string) => void;
  disabled?: boolean;
}

// ============================================================================
// TEMPLATE DEFINITIONS
// ============================================================================

const SLASH_TEMPLATES: SlashTemplate[] = [
  {
    id: 'weekly-progress-update',
    name: 'Weekly Progress Update',
    description: 'Generate a structured progress report from your recent workflows',
    icon: FileText,
    query: 'Create a weekly progress update report from my recent workflows',
    promptPreview: `**Prompt:** Weekly Progress Update

Transforms your workflow session data into a professional weekly progress report covering:
- Key accomplishments and activities
- Tools & platforms utilized
- Collaboration and deliverables
- Upcoming priorities based on observed patterns
- Workflow insights (strengths & areas for improvement)

Output: Downloadable markdown report`,
    colors: {
      bg: 'hover:bg-blue-50',
      text: 'text-blue-700',
      iconBg: 'bg-blue-100',
    },
  },
  {
    id: 'blog-creation',
    name: 'Blog Creation',
    description: 'Transform your workflow insights into an engaging blog post',
    icon: BookOpen,
    query: 'Create a blog post based on my recent workflow patterns and insights',
    promptPreview: `**Prompt:** Blog Creation

Transforms your workflow data into an engaging, publishable blog post featuring:
- Compelling narrative about how you worked
- Tool usage patterns and productivity insights
- AI integration observations (if applicable)
- Key takeaways for readers
- Forward-looking conclusions about modern work practices

Output: Downloadable markdown blog post`,
    colors: {
      bg: 'hover:bg-purple-50',
      text: 'text-purple-700',
      iconBg: 'bg-purple-100',
    },
  },
];

// ============================================================================
// COMPONENT
// ============================================================================

export function TemplateMentionPopup({
  isOpen,
  onClose,
  onSelectTemplate,
  disabled = false,
}: TemplateMentionPopupProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const popupRef = useRef<HTMLDivElement>(null);

  // Reset selected index when popup opens
  useEffect(() => {
    if (isOpen) setSelectedIndex(0);
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev < SLASH_TEMPLATES.length - 1 ? prev + 1 : prev));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (SLASH_TEMPLATES[selectedIndex] && !disabled) {
            onSelectTemplate(SLASH_TEMPLATES[selectedIndex].query, SLASH_TEMPLATES[selectedIndex].name, SLASH_TEMPLATES[selectedIndex].promptPreview);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [isOpen, selectedIndex, onSelectTemplate, onClose, disabled]
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
        <button
          onClick={onClose}
          className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Template List */}
      <div className="py-1">
        {SLASH_TEMPLATES.map((template, index) => {
          const Icon = template.icon;
          return (
            <button
              key={template.id}
              onClick={() => onSelectTemplate(template.query, template.name, template.promptPreview)}
              disabled={disabled}
              className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                index === selectedIndex ? 'bg-gray-100' : template.colors.bg
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div
                className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${template.colors.iconBg}`}
              >
                <Icon className={`h-4 w-4 ${template.colors.text}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm font-medium ${
                    index === selectedIndex ? 'text-gray-900' : 'text-gray-800'
                  }`}
                >
                  {template.name}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">{template.description}</p>
              </div>
            </button>
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
