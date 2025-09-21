/**
 * Search Components Export
 * 
 * Centralized exports for all search-related components and hooks
 */

// Main Components
export { ProfileSearch } from './ProfileSearch';
export { SearchDropdown } from './SearchDropdown';
export { SearchInput } from './SearchInput';
export { SearchResult } from './SearchResult';
export { SearchStates } from './SearchStates';

// Hooks
export { useProfileSearch } from './hooks/useProfileSearch';
export { useClickOutside,useSearchDropdown } from './hooks/useSearchDropdown';
export { useSearchKeyboard } from './hooks/useSearchKeyboard';

// Types
export type * from './types/search.types';