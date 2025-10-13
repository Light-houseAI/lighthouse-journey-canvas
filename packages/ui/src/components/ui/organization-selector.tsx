import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  VStack,
} from '@journey/components';
import { Organization, OrganizationType } from '@journey/schema';
import { Building2, Check, Loader2, Plus, Search, X } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import {
  useCreateOrganization,
  useSearchOrganizations,
  useUserOrganizations,
} from '../../hooks/use-organizations';

interface OrganizationSelectorProps {
  value?: Organization | null;
  onSelect: (organization: Organization) => void;
  onClear?: () => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  error?: string;
  disabled?: boolean;
  orgTypes?: OrganizationType[];
  defaultOrgType?: OrganizationType;
}

export const OrganizationSelector: React.FC<OrganizationSelectorProps> = ({
  value,
  onSelect,
  onClear,
  placeholder = 'Search organizations...',
  className = '',
  required = false,
  error,
  disabled = false,
  orgTypes,
  defaultOrgType = OrganizationType.Company,
}) => {
  // Local UI state
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgType, setNewOrgType] =
    useState<OrganizationType>(defaultOrgType);

  // TanStack Query hooks
  const userOrgsQuery = useUserOrganizations();
  const searchOrgsQuery = useSearchOrganizations(
    debouncedQuery,
    debouncedQuery.trim().length >= 2
  );
  const createOrgMutation = useCreateOrganization();

  // Safely extract data with proper defaults
  const allUserOrganizations = Array.isArray(userOrgsQuery.data)
    ? userOrgsQuery.data
    : [];
  const searchResults = Array.isArray(searchOrgsQuery.data)
    ? searchOrgsQuery.data
    : [];
  const isLoadingUser = userOrgsQuery.isLoading;
  const isSearching = searchOrgsQuery.isLoading;

  // Debug logging
  useEffect(() => {
    console.log('🔍 OrganizationSelector Debug:', {
      allUserOrganizations: allUserOrganizations?.length,
      isLoadingUser,
      searchResults: searchResults?.length,
      isSearching,
      debouncedQuery,
      searchQuery,
      isOpen,
    });
  }, [
    allUserOrganizations,
    isLoadingUser,
    searchResults,
    isSearching,
    debouncedQuery,
    searchQuery,
    isOpen,
  ]);

  // Helper function to get display name for organization type
  const getOrgTypeDisplayName = (type: OrganizationType): string => {
    switch (type) {
      case OrganizationType.Company:
        return 'Company';
      case OrganizationType.EducationalInstitution:
        return 'Educational Institution';
      default:
        return type;
    }
  };

  // Filter organizations by type if specified
  const userOrganizations = useMemo(() => {
    return orgTypes
      ? allUserOrganizations.filter((org) => orgTypes.includes(org.type))
      : allUserOrganizations;
  }, [allUserOrganizations, orgTypes]);

  const filteredSearchResults = useMemo(() => {
    return orgTypes
      ? searchResults.filter((org) => orgTypes.includes(org.type))
      : searchResults;
  }, [searchResults, orgTypes]);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const createFormRef = useRef<HTMLDivElement>(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

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

  // Handle organization selection
  const handleSelectOrganization = (org: Organization) => {
    onSelect(org);
    setIsOpen(false);
    setSearchQuery('');
    setShowCreateForm(false);
  };

  // Handle creating new organization
  const handleCreateOrganization = async () => {
    if (!newOrgName.trim()) return;

    try {
      const newOrg = await createOrgMutation.mutateAsync({
        name: newOrgName.trim(),
        type: newOrgType,
      });

      // Select the newly created organization
      handleSelectOrganization(newOrg);

      // Reset form
      setNewOrgName('');
      setNewOrgType(defaultOrgType);
      setShowCreateForm(false);
    } catch (error) {
      console.error('Failed to create organization:', error);
    }
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

  // Determine which results to show
  const isLoading = isLoadingUser || isSearching;

  // Show create option when search doesn't match existing organizations
  const showCreateOption =
    searchQuery.length >= 2 &&
    !isLoading &&
    filteredSearchResults.length === 0 &&
    !filteredSearchResults.some(
      (org) => org.name.toLowerCase() === searchQuery.toLowerCase()
    );

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Main Input */}
      <div className="relative">
        <Input
          ref={inputRef}
          value={value ? value.name : searchQuery}
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
            {/* Loading State */}
            {isLoading && (
              <div className="p-3 text-center text-gray-500">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                Searching...
              </div>
            )}

            {/* Create New Form */}
            {showCreateForm && (
              <div
                ref={createFormRef}
                className="border-b border-gray-200 bg-gray-50 p-3"
              >
                <VStack spacing={3}>
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                    <Plus className="h-4 w-4" />
                    Create New Organization
                  </div>

                  <Input
                    value={newOrgName}
                    onChange={(e) => setNewOrgName(e.target.value)}
                    placeholder="Organization name"
                    className="text-sm"
                    autoFocus
                  />

                  <Select
                    value={newOrgType}
                    onValueChange={(value) =>
                      setNewOrgType(value as OrganizationType)
                    }
                  >
                    <SelectTrigger className="w-full text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(orgTypes || Object.values(OrganizationType)).map(
                        (type) => (
                          <SelectItem key={type} value={type}>
                            {getOrgTypeDisplayName(type)}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleCreateOrganization}
                      disabled={
                        !newOrgName.trim() || createOrgMutation.isPending
                      }
                      className="flex-1 bg-purple-600 text-white hover:bg-purple-700"
                    >
                      {createOrgMutation.isPending ? (
                        <>
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Check className="mr-1 h-3 w-3" />
                          Create
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowCreateForm(false)}
                      disabled={createOrgMutation.isPending}
                    >
                      Cancel
                    </Button>
                  </div>
                </VStack>
              </div>
            )}

            {/* Create Option */}
            {showCreateOption && !showCreateForm && (
              <Button
                type="button"
                onClick={() => {
                  setShowCreateForm(true);
                  setNewOrgName(searchQuery);
                }}
                variant="ghost"
                className="w-full justify-start border-b border-gray-200 px-3 py-2 text-left"
              >
                <div className="flex items-center gap-2">
                  <Plus className="h-4 w-4 text-purple-600" />
                  <span className="text-sm">
                    Create "
                    <span className="font-semibold text-purple-600">
                      {searchQuery}
                    </span>
                    "
                  </span>
                </div>
              </Button>
            )}

            {/* User Organizations */}
            {!isLoading && userOrganizations.length > 0 && !searchQuery && (
              <>
                <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Your Organizations
                </div>
                {userOrganizations.map((org) => (
                  <Button
                    key={`user-${org.id}`}
                    type="button"
                    onClick={() => handleSelectOrganization(org)}
                    variant="ghost"
                    className="group flex w-full items-center justify-start gap-3 px-3 py-3 text-left hover:bg-purple-50"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 text-white transition-all group-hover:from-purple-600 group-hover:to-purple-700">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-gray-900">
                        {org.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {getOrgTypeDisplayName(org.type as OrganizationType)}
                      </div>
                    </div>
                    {value?.id === org.id && (
                      <Check className="h-4 w-4 text-purple-600" />
                    )}
                  </Button>
                ))}
              </>
            )}

            {/* Search Results */}
            {!isLoading && searchQuery && filteredSearchResults.length > 0 && (
              <>
                {userOrganizations.length > 0 && (
                  <div className="border-t border-gray-200" />
                )}
                <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Search Results
                </div>
                {filteredSearchResults.map((org) => (
                  <Button
                    key={`search-${org.id}`}
                    type="button"
                    onClick={() => handleSelectOrganization(org)}
                    variant="ghost"
                    className="group flex w-full items-center justify-start gap-3 px-3 py-3 text-left hover:bg-purple-50"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-gray-500 to-gray-600 text-white transition-all group-hover:from-gray-600 group-hover:to-gray-700">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-gray-900">
                        {org.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {getOrgTypeDisplayName(org.type as OrganizationType)}
                      </div>
                    </div>
                    {value?.id === org.id && (
                      <Check className="h-4 w-4 text-purple-600" />
                    )}
                  </Button>
                ))}
              </>
            )}

            {/* No Results */}
            {!isLoading &&
              searchQuery.length >= 2 &&
              filteredSearchResults.length === 0 &&
              !showCreateOption && (
                <div className="p-3 text-center text-gray-500">
                  <Building2 className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                  <div className="text-sm">No organizations found</div>
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
