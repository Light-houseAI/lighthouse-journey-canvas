/**
 * GraphRAG Profile Search Types
 *
 * Type definitions for the profile search functionality
 * Based on OpenAPI schema from /api/v2/graphrag/search
 */

// API Request/Response Types
export interface GraphRAGSearchRequest {
  query: string;
  limit?: number;
  similarityThreshold?: number;
}

export interface GraphRAGSearchResponse {
  query: string;
  totalResults: number;
  profiles: ProfileResult[];
  timestamp: string;
}

export interface ProfileResult {
  id: string;
  name: string;
  email: string;
  username?: string;
  currentRole?: string;
  company?: string;
  matchScore: string; // Hidden from UI but present in API
  whyMatched: string[];
  skills: string[]; // Hidden from UI but present in API
  matchedNodes: MatchedNode[];
  insightsSummary?: string[];
}

export interface MatchedNode {
  id: string;
  type: TimelineNodeType;
  meta: Record<string, any>;
  score: number; // Hidden from UI but present in API
  insights?: NodeInsight[];
}

export interface NodeInsight {
  text: string;
  category: string;
  resources?: string[];
}

// Timeline Node Types
export type TimelineNodeType =
  | 'job'
  | 'education'
  | 'project'
  | 'event'
  | 'action'
  | 'careerTransition';

// Component Props Types
export interface ProfileSearchProps {
  className?: string;
  placeholder?: string;
  maxResults?: number;
  disabled?: boolean;
  onResultSelect?: (result: ProfileResult) => void;
}

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
  isLoading?: boolean;
  className?: string;
}

export interface SearchDropdownProps {
  isOpen: boolean;
  results: ProfileResult[];
  isLoading: boolean;
  error: Error | null;
  highlightedIndex: number;
  onResultSelect: (result: ProfileResult) => void;
  onClose: () => void;
  className?: string;
}

export interface SearchResultProps {
  result: ProfileResult;
  isHighlighted: boolean;
  showInsights?: boolean;
  onSelect: (userId: string) => void;
  onClick: (userId: string) => void;
  className?: string;
}

export interface SearchStatesProps {
  type: 'loading' | 'empty' | 'error';
  message?: string;
  onRetry?: () => void;
  className?: string;
}

// Hook Return Types
export interface UseProfileSearchReturn {
  search: (query: string) => void;
  results: ProfileResult[];
  isLoading: boolean;
  error: Error | null;
  clear: () => void;
  query: string;
}

export interface UseSearchDropdownReturn {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

export interface UseSearchKeyboardReturn {
  highlightedIndex: number;
  onKeyDown: (event: React.KeyboardEvent) => void;
  resetHighlight: () => void;
}

// Search State Types
export type SearchState = 'idle' | 'loading' | 'success' | 'error' | 'empty';

export interface SearchError {
  code: string;
  message: string;
  details?: any;
}

// Badge and UI Types
export interface NodeTypeBadgeProps {
  type: TimelineNodeType;
  size?: 'sm' | 'md';
  variant?: 'default' | 'secondary';
}

export const NODE_TYPE_LABELS: Record<TimelineNodeType, string> = {
  job: 'Job',
  education: 'Education',
  project: 'Project',
  event: 'Event',
  action: 'Action',
  careerTransition: 'Career Transition',
};

// Theme-consistent colors matching the application design system
export const NODE_TYPE_COLORS: Record<TimelineNodeType, string> = {
  job: 'bg-gradient-to-r from-green-100 to-green-200 text-green-700 border-green-300',
  education:
    'bg-gradient-to-r from-blue-100 to-blue-200 text-blue-700 border-blue-300',
  project:
    'bg-gradient-to-r from-purple-100 to-purple-200 text-purple-700 border-purple-300',
  event: 'bg-gradient-to-r from-red-100 to-red-200 text-red-700 border-red-300',
  action:
    'bg-gradient-to-r from-pink-100 to-pink-200 text-pink-700 border-pink-300',
  careerTransition:
    'bg-gradient-to-r from-orange-100 to-orange-200 text-orange-700 border-orange-300',
};
