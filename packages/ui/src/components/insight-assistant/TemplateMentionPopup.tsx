/**
 * Template Mention Popup Component
 *
 * Appears when user types "/" in the chat input.
 * Shows template buttons (Weekly Progress Update, Blog Creation).
 * Each template has an expandable chevron to preview the prompt with a copy button.
 * Clicking the template name immediately sends the corresponding query.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Zap, FileText, BookOpen, ChevronRight, Copy, Check, Rocket } from 'lucide-react';

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
  onSelectTemplate: (templateQuery: string, templateName: string) => void;
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
    promptPreview: `Prompt: Weekly Progress Update

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
    promptPreview: `Prompt: Blog Creation

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
  {
    id: 'founders',
    name: 'Founders',
    description: 'Analyze a session for a founder — predict outcomes, assess optimality, rank opportunities',
    icon: Rocket,
    query: `Analyze this Krama session for a Founder. For each captured step: (1) Predict the likely outcome user is trying to achieve in this session (2) assess if steps taken by the user were done optimally, (3) identify what could be better (4) Only state an observation to do something better if you can point to a page + timestamp segment in the session (5) The suggested improvement should create meaningful difference to get user a better outcome. Ignore the PDF filename; it's a screen-capture timeline. Then provide the top 3-5 opportunities ranked by effort vs. impact, formatted as a priority matrix.`,
    promptPreview: `Prompt: Founders Session Analysis

Analyzes your Krama session from a Founder's perspective:
- Predicts the likely outcome you're trying to achieve
- Assesses if steps were done optimally
- Identifies what could be better (with page + timestamp evidence)
- Only suggests improvements that create meaningful difference
- Provides top 3-5 opportunities as an effort vs. impact priority matrix

Output: Priority matrix with evidence-backed recommendations`,
    colors: {
      bg: 'hover:bg-orange-50',
      text: 'text-orange-700',
      iconBg: 'bg-orange-100',
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
          setSelectedIndex((prev) => (prev < SLASH_TEMPLATES.length - 1 ? prev + 1 : prev));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (SLASH_TEMPLATES[selectedIndex] && !disabled) {
            onSelectTemplate(SLASH_TEMPLATES[selectedIndex].query, SLASH_TEMPLATES[selectedIndex].name);
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
    [isOpen, selectedIndex, expandedId, onSelectTemplate, onClose, disabled]
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

  const handleCopyPrompt = useCallback((e: React.MouseEvent, template: SlashTemplate) => {
    e.stopPropagation();
    navigator.clipboard.writeText(template.promptPreview);
    setCopiedId(template.id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

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
      <div className="max-h-[400px] overflow-y-auto py-1">
        {SLASH_TEMPLATES.map((template, index) => {
          const Icon = template.icon;
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
                  className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${template.colors.iconBg}`}
                >
                  <Icon className={`h-4 w-4 ${template.colors.text}`} />
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
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">{template.description}</p>
                </button>
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
