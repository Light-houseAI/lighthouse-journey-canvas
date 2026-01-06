/**
 * Natural Language Query Panel Component
 *
 * A text-based query input section that allows users to enter natural language
 * queries related to their work, such as:
 * - "Have I worked on bug LIG-250?"
 * - "Help me find my work with Gemini on attributes."
 * - "Based on the work session named 'Product Attributes Review', give me a short summary."
 *
 * Uses RAG (Retrieval-Augmented Generation) with Graph RAG + Vector Search
 */

import { Badge, Card, Skeleton } from '@journey/components';
import {
  Search,
  Loader2,
  MessageSquare,
  FileText,
  Code,
  Lightbulb,
  Clock,
  ChevronRight,
  AlertCircle,
  Sparkles,
  Send,
  X,
  History,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

import { useNaturalLanguageQuery } from '../../hooks/useNaturalLanguageQuery';
import type {
  NaturalLanguageQueryResult,
  RetrievedSource,
} from '../../services/workflow-api';

interface NaturalLanguageQueryPanelProps {
  nodeId?: string;
  onClose?: () => void;
}

/**
 * Get icon for source type
 */
function getSourceIcon(type: RetrievedSource['type']) {
  switch (type) {
    case 'session':
      return { Icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' };
    case 'screenshot':
      return { Icon: FileText, color: 'text-green-600', bg: 'bg-green-50' };
    case 'entity':
      return { Icon: Code, color: 'text-purple-600', bg: 'bg-purple-50' };
    case 'concept':
      return { Icon: Lightbulb, color: 'text-amber-600', bg: 'bg-amber-50' };
    case 'workflow_pattern':
      return { Icon: Sparkles, color: 'text-pink-600', bg: 'bg-pink-50' };
    default:
      return { Icon: FileText, color: 'text-gray-600', bg: 'bg-gray-50' };
  }
}

/**
 * Source Card Component
 */
function SourceCard({ source }: { source: RetrievedSource }) {
  const { Icon, color, bg } = getSourceIcon(source.type);

  return (
    <div className={`p-3 rounded-lg ${bg} border border-opacity-50`}>
      <div className="flex items-start gap-2">
        <div className={`mt-0.5 ${color}`}>
          <Icon size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-sm text-gray-900 truncate">
              {source.title}
            </span>
            <Badge variant="secondary" className="text-xs">
              {Math.round(source.relevanceScore * 100)}%
            </Badge>
          </div>
          {source.description && (
            <p className="mt-1 text-xs text-gray-600 line-clamp-2">
              {source.description}
            </p>
          )}
          {source.timestamp && (
            <p className="mt-1 text-xs text-gray-400">
              {new Date(source.timestamp).toLocaleString()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Follow-up Suggestion Button
 */
function FollowUpButton({
  suggestion,
  onClick,
}: {
  suggestion: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors text-left"
    >
      <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />
      <span className="line-clamp-1">{suggestion}</span>
    </button>
  );
}

/**
 * Query Result Display
 */
function QueryResult({
  result,
  onFollowUp,
}: {
  result: NaturalLanguageQueryResult;
  onFollowUp: (query: string) => void;
}) {
  const [showAllSources, setShowAllSources] = useState(false);
  const displayedSources = showAllSources ? result.sources : result.sources.slice(0, 3);

  return (
    <div className="space-y-4">
      {/* Answer Section */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg border border-blue-100">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-white rounded-lg shadow-sm">
            <MessageSquare size={20} className="text-blue-600" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-medium text-gray-900">Answer</span>
              <Badge variant="secondary" className="text-xs">
                {Math.round(result.confidence * 100)}% confidence
              </Badge>
            </div>
            <p className="text-gray-700 whitespace-pre-wrap">{result.answer}</p>
          </div>
        </div>
      </div>

      {/* Sources Section */}
      {result.sources.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-700">
              Sources ({result.sources.length})
            </h4>
            {result.sources.length > 3 && (
              <button
                onClick={() => setShowAllSources(!showAllSources)}
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                {showAllSources ? 'Show less' : `Show all ${result.sources.length}`}
              </button>
            )}
          </div>
          <div className="grid gap-2">
            {displayedSources.map((source) => (
              <SourceCard key={source.id} source={source} />
            ))}
          </div>
        </div>
      )}

      {/* Related Work Sessions */}
      {result.relatedWorkSessions && result.relatedWorkSessions.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            Related Work Sessions
          </h4>
          <div className="space-y-2">
            {result.relatedWorkSessions.slice(0, 3).map((session) => (
              <div
                key={session.sessionId}
                className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg"
              >
                <Clock size={14} className="text-gray-400" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-gray-900 truncate block">
                    {session.name}
                  </span>
                  {session.summary && (
                    <span className="text-xs text-gray-500 truncate block">
                      {session.summary}
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(session.timestamp).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Follow-up Suggestions */}
      {result.suggestedFollowUps && result.suggestedFollowUps.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            Suggested Follow-ups
          </h4>
          <div className="flex flex-wrap gap-2">
            {result.suggestedFollowUps.map((suggestion, idx) => (
              <FollowUpButton
                key={idx}
                suggestion={suggestion}
                onClick={() => onFollowUp(suggestion)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Metadata */}
      <div className="flex items-center gap-4 text-xs text-gray-400 pt-2 border-t">
        <span>Graph: {result.retrievalMetadata.graphQueryTimeMs}ms</span>
        <span>Vector: {result.retrievalMetadata.vectorQueryTimeMs}ms</span>
        <span>LLM: {result.retrievalMetadata.llmGenerationTimeMs}ms</span>
        <span>Total: {result.retrievalMetadata.totalTimeMs}ms</span>
      </div>
    </div>
  );
}

/**
 * Example Queries Component
 */
function ExampleQueries({ onSelect }: { onSelect: (query: string) => void }) {
  const examples = [
    "Have I worked on bug LIG-250?",
    "What technologies have I used this week?",
    "Show me work sessions related to API development",
    "What are my most common workflow patterns?",
    "Find work related to database optimization",
  ];

  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-500">Try asking:</p>
      <div className="flex flex-wrap gap-2">
        {examples.map((example, idx) => (
          <button
            key={idx}
            onClick={() => onSelect(example)}
            className="px-3 py-1.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
          >
            {example}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Loading State
 */
function LoadingState() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
        <Loader2 size={20} className="text-blue-600 animate-spin" />
        <div>
          <p className="font-medium text-gray-900">Processing your query...</p>
          <p className="text-sm text-gray-600">
            Searching through Graph RAG and vector embeddings
          </p>
        </div>
      </div>
      <div className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </div>
    </div>
  );
}

/**
 * Error State
 */
function ErrorState({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className="flex items-center gap-3 p-4 bg-red-50 rounded-lg border border-red-200">
      <AlertCircle size={20} className="text-red-600" />
      <div className="flex-1">
        <p className="font-medium text-red-900">Query failed</p>
        <p className="text-sm text-red-700">{error.message}</p>
      </div>
      <button
        onClick={onRetry}
        className="px-3 py-1.5 text-sm text-red-700 bg-red-100 hover:bg-red-200 rounded-lg transition-colors"
      >
        Retry
      </button>
    </div>
  );
}

/**
 * Main Natural Language Query Panel
 */
export function NaturalLanguageQueryPanel({
  nodeId,
  onClose,
}: NaturalLanguageQueryPanelProps) {
  const [inputValue, setInputValue] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastQuery = useRef<string>('');

  const {
    executeQuery,
    executeFollowUp,
    result,
    isLoading,
    error,
    queryHistory,
    clearHistory,
  } = useNaturalLanguageQuery({
    nodeId,
    lookbackDays: 30,
    maxResults: 10,
    includeGraph: true,
    includeVectors: true,
  });

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    lastQuery.current = inputValue;
    await executeQuery(inputValue);
    setInputValue('');
  };

  const handleExampleSelect = async (query: string) => {
    setInputValue(query);
    lastQuery.current = query;
    await executeQuery(query);
    setInputValue('');
  };

  const handleFollowUp = async (query: string) => {
    lastQuery.current = query;
    await executeFollowUp(query);
  };

  const handleRetry = async () => {
    if (lastQuery.current) {
      await executeQuery(lastQuery.current);
    }
  };

  return (
    <Card className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg">
            <Search size={18} className="text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Ask About Your Work</h3>
            <p className="text-xs text-gray-500">
              Search using natural language with Graph RAG + Vector Search
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {queryHistory.length > 0 && (
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`p-2 rounded-lg transition-colors ${
                showHistory ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
              }`}
              title="Query history"
            >
              <History size={18} />
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Query Input */}
      <form onSubmit={handleSubmit} className="mb-4">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask a question about your work..."
            className="w-full px-4 py-3 pr-12 text-gray-900 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            {isLoading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Send size={18} />
            )}
          </button>
        </div>
      </form>

      {/* Query History */}
      {showHistory && queryHistory.length > 0 && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Recent Queries</span>
            <button
              onClick={clearHistory}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Clear
            </button>
          </div>
          <div className="space-y-1">
            {queryHistory.slice(0, 5).map((item, idx) => (
              <button
                key={idx}
                onClick={() => handleExampleSelect(item.query)}
                className="w-full text-left px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors truncate"
              >
                {item.query}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="min-h-[200px]">
        {isLoading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState error={error} onRetry={handleRetry} />
        ) : result ? (
          <QueryResult result={result} onFollowUp={handleFollowUp} />
        ) : (
          <ExampleQueries onSelect={handleExampleSelect} />
        )}
      </div>
    </Card>
  );
}
