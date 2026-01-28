/**
 * PersonaSuggestions Component
 *
 * Displays persona-based query suggestions as clickable buttons.
 * Each button represents a contextual question relevant to the user's active personas.
 */

import { Sparkles, RefreshCw, Lightbulb } from 'lucide-react';
import { usePersonaSuggestions, type PersonaSuggestion, type WorkflowCTA } from '../../hooks/usePersonaSuggestions';

// ============================================================================
// TYPES
// ============================================================================

export interface PersonaSuggestionsProps {
  /** Callback when a suggestion is selected */
  onSelectSuggestion: (query: string) => void;
  /** Maximum number of suggestions to show (default: 5) */
  limit?: number;
  /** Additional CSS classes */
  className?: string;
  /** Whether suggestions are disabled (e.g., while processing) */
  disabled?: boolean;
}

// ============================================================================
// PERSONA TYPE COLORS
// ============================================================================

const PERSONA_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  work: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
  },
  personal_project: {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
  },
  job_search: {
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-200',
  },
  learning: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
  },
};

// ============================================================================
// COMPONENT
// ============================================================================

export function PersonaSuggestions({
  onSelectSuggestion,
  limit = 5,
  className = '',
  disabled = false,
}: PersonaSuggestionsProps) {
  const { suggestions, cta, isLoading, isFetching, error, refetch } = usePersonaSuggestions({
    limit,
  });

  // Don't render anything if there are no suggestions and not loading
  if (!isLoading && suggestions.length === 0) {
    return null;
  }

  return (
    <div className={`${className}`}>
      {/* CTA Prompt */}
      {!isLoading && cta && (
        <CTAPrompt cta={cta} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Suggested questions</span>
        </div>
        {!isLoading && suggestions.length > 0 && (
          <button
            onClick={() => refetch()}
            disabled={isFetching || disabled}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            title="Refresh suggestions"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-8 w-32 bg-gray-100 rounded-full animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Error state */}
      {error && !isLoading && (
        <div className="text-xs text-gray-400 italic">
          Unable to load suggestions
        </div>
      )}

      {/* Suggestions */}
      {!isLoading && suggestions.length > 0 && (
        <div className="flex flex-col gap-2">
          {suggestions.map((suggestion) => (
            <SuggestionButton
              key={suggestion.id}
              suggestion={suggestion}
              onClick={() => onSelectSuggestion(suggestion.suggestedQuery)}
              disabled={disabled}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// CTA PROMPT
// ============================================================================

interface CTAPromptProps {
  cta: WorkflowCTA;
}

function CTAPrompt({ cta }: CTAPromptProps) {
  return (
    <div className="mb-4 p-4 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 p-2 rounded-lg bg-indigo-100">
          <Lightbulb className="h-4 w-4 text-indigo-600" />
        </div>
        <div>
          <p className="text-sm font-medium text-indigo-900 mb-1">
            {cta.label}
          </p>
          <p className="text-sm text-indigo-700">
            {cta.text}
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SUGGESTION BUTTON
// ============================================================================

interface SuggestionButtonProps {
  suggestion: PersonaSuggestion;
  onClick: () => void;
  disabled?: boolean;
}

function SuggestionButton({ suggestion, onClick, disabled }: SuggestionButtonProps) {
  const colors = PERSONA_COLORS[suggestion.personaType] ?? {
    bg: 'bg-gray-50',
    text: 'text-gray-700',
    border: 'border-gray-200',
  };

  // Get the icon from the button label (first character/emoji)
  const icon = suggestion.buttonLabel.match(/^[\p{Emoji}]/u)?.[0] || '';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        flex items-start gap-2 px-3 py-2 text-left
        text-sm rounded-lg
        border transition-all duration-150
        ${colors.bg} ${colors.text} ${colors.border}
        hover:shadow-sm hover:scale-[1.01]
        active:scale-[0.99]
        disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none
        max-w-md
      `}
    >
      {icon && <span className="flex-shrink-0 mt-0.5">{icon}</span>}
      <span>{suggestion.suggestedQuery}</span>
    </button>
  );
}

// ============================================================================
// COMPACT VARIANT
// ============================================================================

export interface CompactPersonaSuggestionsProps {
  /** Callback when a suggestion is selected */
  onSelectSuggestion: (query: string) => void;
  /** Maximum number of suggestions to show (default: 3) */
  limit?: number;
  /** Whether suggestions are disabled */
  disabled?: boolean;
}

/**
 * Compact version of PersonaSuggestions for inline use
 */
export function CompactPersonaSuggestions({
  onSelectSuggestion,
  limit = 3,
  disabled = false,
}: CompactPersonaSuggestionsProps) {
  const { suggestions, isLoading } = usePersonaSuggestions({ limit });

  if (isLoading || suggestions.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {suggestions.slice(0, limit).map((suggestion) => (
        <button
          key={suggestion.id}
          onClick={() => onSelectSuggestion(suggestion.suggestedQuery)}
          disabled={disabled}
          className="
            text-xs px-2 py-1 rounded-md
            bg-gray-100 text-gray-600
            hover:bg-gray-200 hover:text-gray-800
            transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed
          "
          title={suggestion.suggestedQuery}
        >
          {suggestion.buttonLabel}
        </button>
      ))}
    </div>
  );
}

export default PersonaSuggestions;
