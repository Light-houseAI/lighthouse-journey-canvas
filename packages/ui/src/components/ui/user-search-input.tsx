/**
 * UserSearchInput Component
 *
 * A secure user search component that requires complete username/email
 * and uses explicit search button to prevent user enumeration
 */

import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, Search, X } from 'lucide-react';
import React, { useState } from 'react';

import { Button } from './button';
import { Input } from './input';
import { cn } from '../../lib/utils';
import { useShareStore } from '../../stores/share-store';

export interface UserSearchInputProps<T> {
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

export function UserSearchInput<T>({
  value,
  onChange,
  onSearch,
  renderTag,
  placeholder = 'Enter complete username or email...',
  className,
  disabled = false,
  getItemKey,
  emptyMessage = 'No users found',
}: UserSearchInputProps<T>) {
  const { currentPermissions } = useShareStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchMessage, setSearchMessage] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setShowResults(false);
    setHasSearched(false);
    setSearchMessage('');
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setHasSearched(true);

    try {
      const results = await onSearch(searchQuery.trim());

      console.log('UserSearchInput: Search results', {
        query: searchQuery.trim(),
        resultsLength: results.length,
        results: results,
      });

      if (results.length === 1) {
        // User found - check if already selected
        const user = results[0];
        const itemKey = getItemKey(user);

        // Check both current selections and existing permissions
        const isInCurrentSelection = value.some(
          (v) => getItemKey(v) === itemKey
        );
        const isInCurrentPermissions =
          currentPermissions?.users?.some((u) => u.id === itemKey) || false;
        const isAlreadySelected =
          isInCurrentSelection || isInCurrentPermissions;

        console.log('UserSearchInput: Selection check', {
          foundUser: user,
          foundUserKey: itemKey,
          currentSelectedUsers: value,
          currentSelectedKeys: value.map((v) => getItemKey(v)),
          existingPermissionUserIds:
            currentPermissions?.users?.map((u) => u.id) || [],
          isInCurrentSelection,
          isInCurrentPermissions,
          isAlreadySelected,
        });

        if (!isAlreadySelected) {
          // Add the user and show success message
          onChange([...value, user]);
          setSearchMessage('✓ User added successfully');

          // Clear search
          setSearchQuery('');
          setShowResults(true);
        } else {
          // User found but already selected
          setSearchMessage('⚠️ User already added to the list');
          setShowResults(true);
        }
      } else {
        // No users found with exact username/email match
        setSearchMessage(`❌ ${emptyMessage}`);
        setShowResults(true);
      }
    } catch (error) {
      console.error('User search failed:', error);
      setSearchMessage('❌ Search failed. Please try again.');
      setShowResults(true);
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  const handleRemoveItem = (item: T) => {
    const itemKey = getItemKey(item);
    onChange(value.filter((v) => getItemKey(v) !== itemKey));
  };

  return (
    <div className={cn('space-y-3', className)}>
      {/* Selected Items Display */}
      {value.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="flex flex-wrap gap-2"
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

      {/* Search Input with Button */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder={placeholder}
            value={searchQuery}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={disabled || isSearching}
            className="pl-10"
          />
        </div>
        <Button
          onClick={handleSearch}
          disabled={!searchQuery.trim() || isSearching}
          variant="default"
          size="default"
          className="px-4"
        >
          {isSearching ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Searching...
            </>
          ) : (
            <>
              <Search className="mr-2 h-4 w-4" />
              Search
            </>
          )}
        </Button>
      </div>

      {/* Search Message */}
      <AnimatePresence>
        {showResults && hasSearched && searchMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="rounded-md border bg-card shadow-sm"
          >
            <div className="p-3">
              <div className="flex items-center justify-between">
                <div
                  className={cn(
                    'text-sm font-medium',
                    searchMessage.startsWith('✓') && 'text-green-700',
                    searchMessage.startsWith('⚠️') && 'text-orange-700',
                    searchMessage.startsWith('❌') && 'text-red-700'
                  )}
                >
                  {searchMessage}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowResults(false);
                    setSearchMessage('');
                  }}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
