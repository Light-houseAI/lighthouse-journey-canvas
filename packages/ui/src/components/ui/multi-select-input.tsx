/**
 * MultiSelectInput Component
 * 
 * A reusable multi-select component with search functionality and inline tag display
 */

import { AnimatePresence,motion } from 'framer-motion';
import { Check, Loader2,Search, X } from 'lucide-react';
import React, { useCallback,useEffect, useRef, useState } from 'react';

import { Badge } from './badge';
import { Button } from './button';
import { Input } from './input';
import { ScrollArea } from './scroll-area';
import { cn } from '../../lib/utils';

export interface MultiSelectInputProps<T> {
  value: T[];
  onChange: (value: T[]) => void;
  onSearch: (query: string) => Promise<T[]>;
  renderItem: (item: T, isSelected: boolean) => React.ReactNode;
  renderTag: (item: T, onRemove: () => void) => React.ReactNode;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  getItemKey: (item: T) => string | number;
  emptyMessage?: string;
  loadingMessage?: string;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export function MultiSelectInput<T>({
  value,
  onChange,
  onSearch,
  renderItem,
  renderTag,
  placeholder = "Search...",
  className,
  disabled = false,
  getItemKey,
  emptyMessage = "No items found",
  loadingMessage = "Searching...",
}: MultiSelectInputProps<T>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<T[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Perform search when debounced query changes
  useEffect(() => {
    if (debouncedSearchQuery.trim().length > 0) {
      setIsSearching(true);
      onSearch(debouncedSearchQuery)
        .then((results) => {
          setSearchResults(results);
          setFocusedIndex(-1);
        })
        .catch((error) => {
          console.error('Search failed:', error);
          setSearchResults([]);
        })
        .finally(() => {
          setIsSearching(false);
        });
    } else {
      setSearchResults([]);
      setIsSearching(false);
    }
  }, [debouncedSearchQuery, onSearch]);

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    setIsDropdownOpen(query.length > 0);
  };

  const handleInputFocus = () => {
    if (searchQuery.length > 0) {
      setIsDropdownOpen(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex((prev) => 
          prev < searchResults.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex((prev) => 
          prev > 0 ? prev - 1 : searchResults.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < searchResults.length) {
          handleSelectItem(searchResults[focusedIndex]);
        }
        break;
      case 'Escape':
        setIsDropdownOpen(false);
        setFocusedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  const handleSelectItem = useCallback((item: T) => {
    const itemKey = getItemKey(item);
    const isAlreadySelected = value.some(v => getItemKey(v) === itemKey);
    
    if (!isAlreadySelected) {
      onChange([...value, item]);
    }
    
    setSearchQuery('');
    setIsDropdownOpen(false);
    setFocusedIndex(-1);
  }, [value, onChange, getItemKey]);

  const handleRemoveItem = useCallback((item: T) => {
    const itemKey = getItemKey(item);
    onChange(value.filter(v => getItemKey(v) !== itemKey));
  }, [value, onChange, getItemKey]);

  const isItemSelected = (item: T) => {
    const itemKey = getItemKey(item);
    return value.some(v => getItemKey(v) === itemKey);
  };

  return (
    <div ref={containerRef} className={cn("space-y-2", className)}>
      {/* Selected Items Display */}
      {value.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="flex flex-wrap gap-1"
        >
          <AnimatePresence>
            {value.map((item) => (
              <motion.div
                key={getItemKey(item)}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2 }}
              >
                {renderTag(item, () => handleRemoveItem(item))}
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Search Input */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="text"
            placeholder={placeholder}
            value={searchQuery}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            className={cn(
              "pl-10 pr-10",
              isDropdownOpen && "border-border/50"
            )}
          />
          {isSearching && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* Dropdown Results */}
        <AnimatePresence>
          {isDropdownOpen && searchQuery.length > 0 && (
            <motion.div
              ref={dropdownRef}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="absolute top-full left-0 right-0 z-50 mt-1 rounded-md border bg-popover shadow-md"
            >
              <ScrollArea className="max-h-48">
                {isSearching ? (
                  <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {loadingMessage}
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    {emptyMessage}
                  </div>
                ) : (
                  <div className="p-1">
                    {searchResults.map((item, index) => {
                      const isSelected = isItemSelected(item);
                      const isFocused = index === focusedIndex;
                      
                      return (
                        <div
                          key={getItemKey(item)}
                          className={cn(
                            "flex items-center justify-between rounded-sm px-2 py-2 text-sm cursor-pointer transition-colors",
                            isFocused && "bg-accent text-accent-foreground",
                            !isFocused && "hover:bg-muted/50"
                          )}
                          onClick={() => handleSelectItem(item)}
                          onMouseEnter={() => setFocusedIndex(index)}
                        >
                          <div className="flex-1">
                            {renderItem(item, isSelected)}
                          </div>
                          {isSelected && (
                            <Check className="h-4 w-4 text-primary" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Default tag renderer component
export function DefaultTag({ 
  children, 
  onRemove, 
  className 
}: { 
  children: React.ReactNode;
  onRemove: () => void;
  className?: string;
}) {
  return (
    <Badge
      variant="secondary"
      className={cn("flex items-center gap-1 px-2 py-1", className)}
    >
      {children}
      <Button
        size="sm"
        variant="ghost"
        className="h-auto p-0 ml-1 hover:bg-transparent"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onRemove();
        }}
      >
        <X className="h-3 w-3" />
      </Button>
    </Badge>
  );
}