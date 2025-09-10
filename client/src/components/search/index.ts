/**
 * Search Components Export
 * 
 * Centralized exports for all search-related components and hooks
 */

// Main Components
export { ProfileSearch } from './ProfileSearch';
export { SearchInput } from './SearchInput';
export { SearchDropdown } from './SearchDropdown';
export { SearchResult } from './SearchResult';
export { SearchStates } from './SearchStates';

// Hooks
export { useProfileSearch } from './hooks/useProfileSearch';
export { useSearchDropdown, useClickOutside } from './hooks/useSearchDropdown';
export { useSearchKeyboard } from './hooks/useSearchKeyboard';

// Types
export type * from './types/search.types';