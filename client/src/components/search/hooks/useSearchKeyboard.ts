/**
 * useSearchKeyboard Hook
 * 
 * Handles keyboard navigation through search results
 */

import { useState, useCallback } from 'react';
import type { UseSearchKeyboardReturn, ProfileResult } from '../types/search.types';

export function useSearchKeyboard(
  results: ProfileResult[],
  onSelect: (result: ProfileResult) => void,
  onClose: () => void
): UseSearchKeyboardReturn {
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const resetHighlight = useCallback(() => {
    setHighlightedIndex(-1);
  }, []);

  const onKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (results.length === 0) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setHighlightedIndex(prev => 
          prev < results.length - 1 ? prev + 1 : 0
        );
        break;

      case 'ArrowUp':
        event.preventDefault();
        setHighlightedIndex(prev => 
          prev > 0 ? prev - 1 : results.length - 1
        );
        break;

      case 'Enter':
        event.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < results.length) {
          onSelect(results[highlightedIndex]);
        }
        break;

      case 'Escape':
        event.preventDefault();
        onClose();
        resetHighlight();
        break;

      case 'Tab':
        // Allow tab to work normally for accessibility
        if (!event.shiftKey && highlightedIndex === results.length - 1) {
          onClose();
          resetHighlight();
        } else if (event.shiftKey && highlightedIndex === 0) {
          onClose();
          resetHighlight();
        }
        break;

      default:
        // For other keys, don't interfere
        break;
    }
  }, [results, highlightedIndex, onSelect, onClose, resetHighlight]);

  return {
    highlightedIndex,
    onKeyDown,
    resetHighlight
  };
}