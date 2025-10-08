import { OrganizationType } from '@journey/schema';
import { Organization } from '@journey/schema';
import { Building2, Check, Loader2, Plus, Search, X } from 'lucide-react';
import React, { useCallback,useEffect, useRef, useState } from 'react';

import { createOrganization,getOrganizationById, getUserOrganizations, searchOrganizations } from '../../services/organization-api';

import { Button, VStack } from '@journey/components';
import { Input } from '@journey/components';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@journey/components';

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
  placeholder = "Search organizations...",
  className = "",
  required = false,
  error,
  disabled = false,
  orgTypes,
  defaultOrgType = OrganizationType.Company,
}) => {
  // State management
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Organization[]>([]);
  const [userOrganizations, setUserOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgType, setNewOrgType] = useState<OrganizationType>(defaultOrgType);

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

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const createFormRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowCreateForm(false);
        setSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load user organizations on mount
  useEffect(() => {
    const loadUserOrganizations = async () => {
      try {
        const orgs = await getUserOrganizations();
        // Filter organizations by allowed types if specified
        const filteredOrgs = orgTypes ? orgs.filter(org => orgTypes.includes(org.type)) : orgs;
        setUserOrganizations(filteredOrgs);
      } catch (error) {
        console.error('Failed to load user organizations:', error);
      }
    };

    loadUserOrganizations();
  }, [orgTypes]);

  // Handle search with debouncing
  const handleSearch = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      setIsLoading(true);
      const results = await searchOrganizations(query);
      // Filter search results by allowed types if specified
      const filteredResults = orgTypes ? results.filter(org => orgTypes.includes(org.type)) : results;
      setSearchResults(filteredResults);
    } catch (error) {
      console.error('Failed to search organizations:', error);
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [orgTypes]);

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

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
      setIsCreating(true);
      const newOrg = await createOrganization({
        name: newOrgName.trim(),
        type: newOrgType,
      });
      
      // Select the newly created organization
      handleSelectOrganization(newOrg);
      
      // Reset form
      setNewOrgName('');
      setNewOrgType('company');
      setShowCreateForm(false);
      
      // Refresh user organizations
      const updatedOrgs = await getUserOrganizations();
      setUserOrganizations(updatedOrgs);
    } catch (error) {
      console.error('Failed to create organization:', error);
    } finally {
      setIsCreating(false);
    }
  };

  // Handle input focus
  const handleInputFocus = () => {
    setIsOpen(true);
    if (!searchQuery && searchResults.length === 0) {
      // Show user organizations when opening dropdown
      setSearchResults(userOrganizations);
    }
  };

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    setShowCreateForm(false);
    
    if (!query) {
      setSearchResults(userOrganizations);
    }
  };

  // Show create option when search doesn't match existing organizations
  const showCreateOption = searchQuery.length >= 2 && 
    !isLoading && 
    searchResults.length === 0 && 
    !searchResults.some(org => org.name.toLowerCase() === searchQuery.toLowerCase());

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
            disabled ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          disabled={disabled}
          required={required}
        />
        
        {/* Icons */}
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
          {value && onClear && (
            <Button
              type="button"
              onClick={() => {
                onClear();
                setSearchQuery('');
                inputRef.current?.focus();
              }}
              variant="ghost"
              className="p-1 rounded-full"
              disabled={disabled}
            >
              <X className="h-4 w-4 text-gray-400" />
            </Button>
          )}
          <Search className="h-4 w-4 text-gray-400" />
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}

      {/* Dropdown */}
      {isOpen && !disabled && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-80 overflow-hidden">
          <div className="max-h-80 overflow-y-auto">
            {/* Loading State */}
            {isLoading && (
              <div className="p-3 text-center text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                Searching...
              </div>
            )}

            {/* Create New Form */}
            {showCreateForm && (
              <div ref={createFormRef} className="p-3 border-b border-gray-200 bg-gray-50">
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
                    onValueChange={(value) => setNewOrgType(value as OrganizationType)}
                  >
                    <SelectTrigger className="w-full text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(orgTypes || Object.values(OrganizationType)).map((type) => (
                        <SelectItem key={type} value={type}>
                          {getOrgTypeDisplayName(type)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleCreateOrganization}
                      disabled={!newOrgName.trim() || isCreating}
                      className="bg-purple-600 hover:bg-purple-700 text-white flex-1"
                    >
                      {isCreating ? (
                        <>
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Check className="w-3 h-3 mr-1" />
                          Create
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowCreateForm(false)}
                      disabled={isCreating}
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
                className="w-full px-3 py-2 text-left border-b border-gray-200 justify-start"
              >
                <div className="flex items-center gap-2">
                  <Plus className="h-4 w-4 text-purple-600" />
                  <span className="text-sm">
                    Create "<span className="font-semibold text-purple-600">{searchQuery}</span>"
                  </span>
                </div>
              </Button>
            )}

            {/* User Organizations */}
            {!isLoading && userOrganizations.length > 0 && (!searchQuery || searchResults === userOrganizations) && (
              <>
                <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50 border-b border-gray-200">
                  Your Organizations
                </div>
                {userOrganizations.map((org) => (
                  <Button
                    key={`user-${org.id}`}
                    type="button"
                    onClick={() => handleSelectOrganization(org)}
                    variant="ghost"
                    className="w-full px-3 py-3 text-left flex items-center gap-3 group justify-start hover:bg-purple-50"
                  >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white group-hover:from-purple-600 group-hover:to-purple-700 transition-all">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">{org.name}</div>
                      <div className="text-xs text-gray-500">{getOrgTypeDisplayName(org.type as OrganizationType)}</div>
                    </div>
                    {value?.id === org.id && (
                      <Check className="h-4 w-4 text-purple-600" />
                    )}
                  </Button>
                ))}
              </>
            )}

            {/* Search Results */}
            {!isLoading && searchQuery && searchResults.length > 0 && searchResults !== userOrganizations && (
              <>
                {userOrganizations.length > 0 && <div className="border-t border-gray-200" />}
                <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50 border-b border-gray-200">
                  Search Results
                </div>
                {searchResults.map((org) => (
                  <Button
                    key={`search-${org.id}`}
                    type="button"
                    onClick={() => handleSelectOrganization(org)}
                    variant="ghost"
                    className="w-full px-3 py-3 text-left flex items-center gap-3 group justify-start hover:bg-purple-50"
                  >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-500 to-gray-600 flex items-center justify-center text-white group-hover:from-gray-600 group-hover:to-gray-700 transition-all">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">{org.name}</div>
                      <div className="text-xs text-gray-500">{getOrgTypeDisplayName(org.type as OrganizationType)}</div>
                    </div>
                    {value?.id === org.id && (
                      <Check className="h-4 w-4 text-purple-600" />
                    )}
                  </Button>
                ))}
              </>
            )}

            {/* No Results */}
            {!isLoading && searchQuery.length >= 2 && searchResults.length === 0 && !showCreateOption && (
              <div className="p-3 text-center text-gray-500">
                <Building2 className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <div className="text-sm">No organizations found</div>
                <div className="text-xs text-gray-400">Try a different search term</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
