/**
 * useSearchDropdown Hook
 * 
 * Manages dropdown visibility state for search results
 */

import { useCallback, useEffect,useRef, useState } from 'react';

import type { UseSearchDropdownReturn } from '../types/search.types';

export function useSearchDropdown(): UseSearchDropdownReturn {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  return {
    isOpen,
    open,
    close,
    toggle
  };
}

/**
 * useClickOutside Hook
 * 
 * Closes dropdown when clicking outside the component
 */
export function useClickOutside(
  ref: React.RefObject<HTMLElement>, 
  onClickOutside: () => void
) {
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClickOutside();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [ref, onClickOutside]);
}