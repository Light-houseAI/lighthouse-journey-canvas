/**
 * Resume Type Selector Component
 *
 * Searchable dropdown for selecting or creating resume types
 * Pattern based on OrganizationSelector
 */

import { Button, Input } from '@journey/components';
import { LINKEDIN_TYPE } from '@journey/schema';
import { Check, FileText, Plus, Search, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

// Suggested resume types
const SUGGESTED_TYPES = [LINKEDIN_TYPE] as const;

interface ResumeTypeSelectorProps {
  value?: string | null;
  onSelect: (resumeType: string) => void;
  onClear?: () => void;
  existingResumeTypes: string[];
  placeholder?: string;
  className?: string;
  required?: boolean;
  error?: string;
  disabled?: boolean;
}

export const ResumeTypeSelector: React.FC<ResumeTypeSelectorProps> = ({
  value,
  onSelect,
  onClear,
  existingResumeTypes,
  placeholder = 'Search or create resume type...',
  className = '',
  required = false,
  error,
  disabled = false,
}) => {
  // Local UI state
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const createFormRef = useRef<HTMLDivElement>(null);

  // Filter existing types based on search query
  const filteredTypes = existingResumeTypes.filter((type) =>
    type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Show create option when search doesn't match existing types
  const showCreateOption =
    searchQuery.length >= 2 &&
    !filteredTypes.some(
      (type) => type.toLowerCase() === searchQuery.toLowerCase()
    );

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setShowCreateForm(false);
        setSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle type selection
  const handleSelectType = (type: string) => {
    onSelect(type);
    setIsOpen(false);
    setSearchQuery('');
    setShowCreateForm(false);
  };

  // Handle creating new type
  const handleCreateType = () => {
    if (!newTypeName.trim()) return;

    handleSelectType(newTypeName.trim());
    setNewTypeName('');
    setShowCreateForm(false);
  };

  // Handle input focus
  const handleInputFocus = () => {
    setIsOpen(true);
  };

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    setShowCreateForm(false);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Main Input */}
      <div className="relative">
        <Input
          ref={inputRef}
          value={value || searchQuery}
          onChange={handleSearchChange}
          onFocus={handleInputFocus}
          placeholder={placeholder}
          className={`pr-20 ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''} ${
            disabled ? 'cursor-not-allowed opacity-50' : ''
          }`}
          disabled={disabled}
          required={required}
        />

        {/* Icons */}
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 transform items-center gap-1">
          {value && onClear && (
            <Button
              type="button"
              onClick={() => {
                onClear();
                setSearchQuery('');
                inputRef.current?.focus();
              }}
              variant="ghost"
              className="rounded-full p-1"
              disabled={disabled}
            >
              <X className="h-4 w-4 text-gray-400" />
            </Button>
          )}
          <Search className="h-4 w-4 text-gray-400" />
        </div>
      </div>

      {/* Error Message */}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}

      {/* Dropdown */}
      {isOpen && !disabled && (
        <div className="absolute z-[70] mt-1 max-h-80 w-full overflow-hidden rounded-md border border-gray-300 bg-white shadow-lg">
          <div className="max-h-80 overflow-y-auto">
            {/* Create New Form */}
            {showCreateForm && (
              <div
                ref={createFormRef}
                className="border-b border-gray-200 bg-gray-50 p-3"
              >
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                    <Plus className="h-4 w-4" />
                    Create New Resume Type
                  </div>

                  <Input
                    value={newTypeName}
                    onChange={(e) => setNewTypeName(e.target.value)}
                    placeholder="Resume type name"
                    className="text-sm"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleCreateType();
                      }
                    }}
                  />

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleCreateType}
                      disabled={!newTypeName.trim()}
                      className="flex-1 bg-teal-700 text-white hover:bg-teal-800"
                    >
                      <Check className="mr-1 h-3 w-3" />
                      Create
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowCreateForm(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Create Option */}
            {showCreateOption && !showCreateForm && (
              <Button
                type="button"
                onClick={() => {
                  setShowCreateForm(true);
                  setNewTypeName(searchQuery);
                }}
                variant="ghost"
                className="w-full justify-start border-b border-gray-200 px-3 py-2 text-left"
              >
                <div className="flex items-center gap-2">
                  <Plus className="h-4 w-4 text-teal-700" />
                  <span className="text-sm">
                    Create "
                    <span className="font-semibold text-teal-700">
                      {searchQuery}
                    </span>
                    "
                  </span>
                </div>
              </Button>
            )}

            {/* Suggested Types */}
            {!searchQuery && (
              <>
                <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Suggested Types
                </div>
                {SUGGESTED_TYPES.map((type) => (
                  <Button
                    key={type}
                    type="button"
                    onClick={() => handleSelectType(type)}
                    variant="ghost"
                    className="group flex w-full items-center justify-start gap-3 px-3 py-3 text-left hover:bg-teal-50"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 text-white transition-all group-hover:from-blue-700 group-hover:to-blue-800">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-gray-900">
                        {type}
                      </div>
                    </div>
                    {value === type && (
                      <Check className="h-4 w-4 text-teal-700" />
                    )}
                  </Button>
                ))}
              </>
            )}

            {/* Existing Types */}
            {existingResumeTypes.length > 0 && !searchQuery && (
              <>
                <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Your Resume Types
                </div>
                {existingResumeTypes.map((type) => (
                  <Button
                    key={type}
                    type="button"
                    onClick={() => handleSelectType(type)}
                    variant="ghost"
                    className="group flex w-full items-center justify-start gap-3 px-3 py-3 text-left hover:bg-teal-50"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-teal-600 to-teal-700 text-white transition-all group-hover:from-teal-700 group-hover:to-teal-800">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-gray-900">
                        {type}
                      </div>
                    </div>
                    {value === type && (
                      <Check className="h-4 w-4 text-teal-700" />
                    )}
                  </Button>
                ))}
              </>
            )}

            {/* Filtered Search Results */}
            {searchQuery && filteredTypes.length > 0 && (
              <>
                {existingResumeTypes.length > 0 && (
                  <div className="border-t border-gray-200" />
                )}
                <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Matching Types
                </div>
                {filteredTypes.map((type) => (
                  <Button
                    key={type}
                    type="button"
                    onClick={() => handleSelectType(type)}
                    variant="ghost"
                    className="group flex w-full items-center justify-start gap-3 px-3 py-3 text-left hover:bg-teal-50"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-gray-500 to-gray-600 text-white transition-all group-hover:from-gray-600 group-hover:to-gray-700">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-gray-900">
                        {type}
                      </div>
                    </div>
                    {value === type && (
                      <Check className="h-4 w-4 text-teal-700" />
                    )}
                  </Button>
                ))}
              </>
            )}

            {/* Empty State - Prompt to Create First Type */}
            {existingResumeTypes.length === 0 && !searchQuery && (
              <div className="p-4 text-center">
                <FileText className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                <div className="text-sm font-medium text-gray-700">
                  No resume types yet
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  Start typing to create your first resume type
                </div>
              </div>
            )}

            {/* No Results */}
            {searchQuery.length >= 2 &&
              filteredTypes.length === 0 &&
              !showCreateOption && (
                <div className="p-3 text-center text-gray-500">
                  <FileText className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                  <div className="text-sm">No matching types found</div>
                  <div className="text-xs text-gray-400">
                    Try a different search term
                  </div>
                </div>
              )}
          </div>
        </div>
      )}
    </div>
  );
};
