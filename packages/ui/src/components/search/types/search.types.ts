/**
 * GraphRAG Profile Search Types
 *
 * Type definitions for the profile search functionality
 * Re-exports from @journey/schema for type safety and validation
 */

// Import schema types and validation schemas
import type {
  CareerInsight,
  ExperienceMatch,
  GraphRAGNodeInsight,
  GraphRAGSearchResponse,
  MatchedTimelineNode,
  SearchProfilesRequest,
  TimelineNodeType,
} from '@journey/schema';

export {
  careerInsightSchema,
  searchProfilesRequestSchema as graphRAGSearchRequestSchema,
  graphragSearchResponseSchema,
  matchedTimelineNodeSchema as matchedNodeSchema,
  graphragNodeInsightSchema as nodeInsightSchema,
  experienceMatchSchema as profileResultSchema,
} from '@journey/schema';

// Re-export types with local aliases
export type GraphRAGSearchRequest = SearchProfilesRequest;
export type MatchedNode = MatchedTimelineNode;
export type NodeInsight = GraphRAGNodeInsight;
export type ProfileResult = ExperienceMatch;

// Re-export other types
export type { CareerInsight, GraphRAGSearchResponse, TimelineNodeType };

// Component Props Types (active components only)

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
