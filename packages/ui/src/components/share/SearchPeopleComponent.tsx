/**
 * SearchPeopleComponent
 *
 * Standalone search component for finding people to share with.
 * Based on Figma design node 5696-15873 showing search with dropdown results.
 */

import { Input } from '@journey/components';
import { cn } from '@journey/components';
import { Button } from '@journey/components';
import type { UserSearchResult } from '@journey/schema';
import { Check, Search, Users, X } from 'lucide-react';
import React, { useState } from 'react';

import { useUserSearch } from '../../hooks/use-user-search';

interface SearchPeopleComponentProps {
  onPersonSelect?: (person: UserSearchResult) => void;
  onMultipleSelect?: (people: UserSearchResult[]) => void;
  multiSelect?: boolean;
  placeholder?: string;
  className?: string;
  excludeUserIds?: number[];
}

export const SearchPeopleComponent: React.FC<SearchPeopleComponentProps> = ({
  onPersonSelect,
  onMultipleSelect,
  multiSelect = false,
  placeholder = 'Search by name',
  className,
  excludeUserIds = [],
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPeople, setSelectedPeople] = useState<UserSearchResult[]>([]);

  // Use TanStack Query for search with debouncing
  const { data: searchResults = [], isLoading } = useUserSearch(searchQuery);

  // Filter out users who already have access
  const filteredResults = searchResults.filter(
    (user: UserSearchResult) => !excludeUserIds.includes(user.id)
  );

  // Determine if dropdown should be open
  const isOpen = searchQuery.trim().length > 0;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
  };

  const handlePersonClick = (person: UserSearchResult) => {
    if (multiSelect) {
      const isSelected = selectedPeople.some((p) => p.id === person.id);
      if (isSelected) {
        setSelectedPeople(selectedPeople.filter((p) => p.id !== person.id));
      } else {
        setSelectedPeople([...selectedPeople, person]);
      }
    } else {
      onPersonSelect?.(person);
      setSearchQuery('');
    }
  };

  const handleApplySelection = () => {
    if (selectedPeople.length > 0) {
      onMultipleSelect?.(selectedPeople);
      setSelectedPeople([]);
      setSearchQuery('');
    }
  };

  const handleClearSelection = () => {
    setSelectedPeople([]);
  };

  const isPersonSelected = (person: UserSearchResult) => {
    return selectedPeople.some((p) => p.id === person.id);
  };

  return (
    <div className={cn('relative w-full', className)}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
        <Input
          type="text"
          placeholder={placeholder}
          value={searchQuery}
          onChange={handleInputChange}
          className="rounded-t-lg border border-gray-300 py-2 pl-10 pr-4 text-gray-900 placeholder-gray-500 focus:border-gray-400 focus:ring-0"
          style={{
            borderBottomLeftRadius: isOpen ? 0 : '0.5rem',
            borderBottomRightRadius: isOpen ? 0 : '0.5rem',
          }}
        />
      </div>

      {/* Selected People Pills (for multi-select) */}
      {multiSelect && selectedPeople.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {selectedPeople.map((person) => (
            <div
              key={person.id}
              className="flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-sm"
            >
              <span className="text-blue-700">
                {person.firstName?.trim() && person.lastName?.trim()
                  ? `${person.firstName} ${person.lastName}`.trim()
                  : person.firstName?.trim() ||
                    person.lastName?.trim() ||
                    person.userName?.trim() ||
                    `User ${person.id}`}
              </span>
              <Button
                onClick={() => handlePersonClick(person)}
                variant="ghost"
                size="icon"
                className="h-auto w-auto rounded-full p-0.5 hover:bg-blue-100"
              >
                <X className="h-3 w-3 text-blue-600" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Search Results Dropdown */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-50 max-h-64 overflow-y-auto rounded-b-lg border border-t-0 border-gray-300 bg-white shadow-lg">
          {isLoading ? (
            <div className="px-4 py-3 text-center text-gray-500">
              Searching...
            </div>
          ) : filteredResults.length > 0 ? (
            <>
              <div className="max-h-48 overflow-y-auto">
                {filteredResults.map((person: UserSearchResult) => {
                  const isSelected = isPersonSelected(person);
                  return (
                    <Button
                      key={person.id}
                      onClick={() => handlePersonClick(person)}
                      variant="ghost"
                      className={cn(
                        'flex h-auto w-full items-center justify-start gap-3 px-3 py-2.5 text-left transition-colors',
                        isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
                      )}
                    >
                      {/* Checkbox for multi-select */}
                      {multiSelect && (
                        <div className="flex-shrink-0">
                          <div
                            className={cn(
                              'flex h-5 w-5 items-center justify-center rounded border-2',
                              isSelected
                                ? 'border-blue-600 bg-blue-600'
                                : 'border-gray-300'
                            )}
                          >
                            {isSelected && (
                              <Check className="h-3 w-3 text-white" />
                            )}
                          </div>
                        </div>
                      )}

                      {/* Avatar */}
                      <div className="flex-shrink-0">
                        {person.avatarUrl ? (
                          <img
                            src={person.avatarUrl}
                            alt={person.firstName || person.userName}
                            className="h-10 w-10 rounded-full border border-white"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white bg-blue-100">
                            <Users className="h-4 w-4 text-blue-600" />
                          </div>
                        )}
                      </div>

                      {/* Person Details */}
                      <div className="min-w-0 flex-1">
                        <div className="text-base font-semibold leading-6 text-gray-900">
                          {person.firstName?.trim() && person.lastName?.trim()
                            ? `${person.firstName} ${person.lastName}`.trim()
                            : person.firstName?.trim() ||
                              person.lastName?.trim() ||
                              person.userName?.trim() ||
                              `User ${person.id}`}
                        </div>
                        {person.experienceLine && (
                          <div className="leading-5.5 text-sm text-gray-600">
                            {person.experienceLine}
                          </div>
                        )}
                      </div>
                    </Button>
                  );
                })}
              </div>

              {/* Multi-select Action Buttons */}
              {multiSelect && (
                <div className="flex items-center justify-between border-t border-gray-200 p-3">
                  <span className="text-sm text-gray-600">
                    {selectedPeople.length} selected
                  </span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleClearSelection}
                      disabled={selectedPeople.length === 0}
                    >
                      Clear
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleApplySelection}
                      disabled={selectedPeople.length === 0}
                      className="bg-black text-white hover:bg-gray-800"
                    >
                      Set permissions
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="px-4 py-3 text-center text-gray-500">
              {searchResults.length > 0 && filteredResults.length === 0
                ? 'All matching users already have access'
                : `No people found matching "${searchQuery}"`}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
