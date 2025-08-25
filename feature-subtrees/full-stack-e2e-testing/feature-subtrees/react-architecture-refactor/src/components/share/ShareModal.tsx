/**
 * ShareModal Component
 *
 * Enhanced modal for configuring and executing node sharing permissions
 * with checkbox-based target selection and inline multi-select inputs
 */

import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Share2,
  Users,
  Building,
  Globe,
  X,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  Sparkles
} from 'lucide-react';


import { useShareStore } from '@/stores/share-store';
import { VisibilityLevel } from '@shared/schema';
import { searchUsers, UserSearchResult } from '@/services/user-api';
import { searchOrganizations, getUserOrganizations } from '@/services/organization-api';
import { Organization } from '@shared/schema';
import { cn } from '@/lib/utils';
import { MultiSelectInput, DefaultTag } from '@/components/ui/multi-select-input';
import { CurrentAccessSection } from './CurrentAccessSection';
import { NodeGroupDisplay } from './NodeGroupDisplay';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight } from 'lucide-react';

// Debounce hook for search
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

export const ShareModal: React.FC = () => {
  const {
    isModalOpen,
    isLoading,
    error,
    config,
    userNodes,
    fetchCurrentPermissions,

    closeModal,
    clearError,
    toggleShareAllNodes,
    addNode,
    removeNode,
    setTargetAccessLevel,
    addTarget,
    removeTarget,
    clearTargets,
    executeShare,
  } = useShareStore();

  // Local state for target type selection
  const [enableUsers, setEnableUsers] = useState(false);
  const [enableOrganizations, setEnableOrganizations] = useState(false);
  const [organizationMode, setOrganizationMode] = useState<'search' | 'my-orgs'>('search');
  const [enablePublic, setEnablePublic] = useState(false);

  // Selected items state
  const [selectedUsers, setSelectedUsers] = useState<UserSearchResult[]>([]);
  const [selectedOrganizations, setSelectedOrganizations] = useState<Organization[]>([]);
  const [myOrganizations, setMyOrganizations] = useState<Organization[]>([]);
  const [selectedMyOrganizations, setSelectedMyOrganizations] = useState<Organization[]>([]);
  
  // Collapsible state
  const [isWhatToShareOpen, setIsWhatToShareOpen] = useState(false);

  // Search functions
  const handleSearchUsers = useCallback(async (query: string) => {
    try {
      const results = await searchUsers(query);
      return results;
    } catch (error) {
      console.error('User search failed:', error);
      // Return empty array on error - the UI will show "No users found"
      return [];
    }
  }, []);

  const handleSearchOrganizations = useCallback(async (query: string) => {
    try {
      const results = await searchOrganizations(query);
      return results;
    } catch (error) {
      console.error('Organization search failed:', error);
      // Return empty array on error - the UI will show "No organizations found"
      return [];
    }
  }, []);

  // Load user's organizations when modal opens
  useEffect(() => {
    if (isModalOpen) {
      const loadMyOrganizations = async () => {
        try {
          const userOrgs = await getUserOrganizations();
          setMyOrganizations(userOrgs);
        } catch (error) {
          console.error('Failed to load user organizations:', error);
          setMyOrganizations([]);
        }
      };
      loadMyOrganizations();
    }
  }, [isModalOpen]);



  // Checkbox handlers with mutual exclusivity for Public
  const handleUsersChange = (checked: boolean) => {
    setEnableUsers(checked);
    if (checked && enablePublic) {
      setEnablePublic(false);
    }
    if (!checked) {
      setSelectedUsers([]);
    }
  };

  const handleOrganizationsChange = (checked: boolean) => {
    setEnableOrganizations(checked);
    if (checked && enablePublic) {
      setEnablePublic(false);
    }
    if (!checked) {
      setSelectedOrganizations([]);
      setSelectedMyOrganizations([]);
    }
  };

  const handlePublicChange = (checked: boolean) => {
    setEnablePublic(checked);
    if (checked) {
      setEnableUsers(false);
      setEnableOrganizations(false);
      setSelectedUsers([]);
      setSelectedOrganizations([]);
      setSelectedMyOrganizations([]);
    }
  };

  // Fetch current permissions when modal opens
  useEffect(() => {
    if (isModalOpen && userNodes.length > 0) {
      const nodeIds = config.shareAllNodes 
        ? userNodes.map(n => n.id)
        : config.selectedNodes;
      
      if (nodeIds.length > 0) {
        fetchCurrentPermissions(nodeIds);
      }
    }
  }, [isModalOpen, config.shareAllNodes, config.selectedNodes, userNodes, fetchCurrentPermissions]);

  // Update store targets when selections change
  useEffect(() => {
    const targets = [];

    selectedUsers.forEach(user => {
      targets.push({
        type: 'user' as const,
        id: user.id,
        name: user.userName || user.email,
        email: user.email,
        accessLevel: VisibilityLevel.Overview, // Default access level
      });
    });

    // Add selected organizations (search mode)
    if (organizationMode === 'search') {
      selectedOrganizations.forEach(org => {
        targets.push({
          type: 'organization' as const,
          id: org.id,
          name: org.name,
          accessLevel: VisibilityLevel.Overview, // Default access level
        });
      });
    } else {
      // Add selected my organizations (my-orgs mode)
      selectedMyOrganizations.forEach(org => {
        targets.push({
          type: 'organization' as const,
          id: org.id,
          name: org.name,
          accessLevel: VisibilityLevel.Overview, // Default access level
        });
      });
    }

    if (enablePublic) {
      targets.push({
        type: 'public' as const,
        name: 'Public',
        accessLevel: VisibilityLevel.Overview, // Default access level
      });
    }

    // Clear and re-add all targets
    clearTargets();
    targets.forEach(target => addTarget(target));
  }, [selectedUsers, selectedOrganizations, selectedMyOrganizations, organizationMode, enablePublic, addTarget, clearTargets]);



  const accessLevelOptions = [
    {
      value: VisibilityLevel.Overview,
      label: 'Overview',
      description: 'Basic information and timeline structure',
      icon: Eye,
    },
    {
      value: VisibilityLevel.Full,
      label: 'Full Access',
      description: 'Complete details and full content',
      icon: EyeOff,
    },
  ];

  if (!isModalOpen) return null;

  return (
    <Dialog open={isModalOpen} onOpenChange={closeModal}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            <motion.div
              className="flex items-center gap-2"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
            >
              Share
            </motion.div>
          </DialogTitle>
          <DialogDescription>
            Configure who can access your timeline nodes and what level of access they have.
          </DialogDescription>
        </DialogHeader>

        {/* Current Access Section - Shows existing permissions */}
        <CurrentAccessSection />

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </motion.div>
        )}

        <ScrollArea className="flex-1 px-1 max-h-[60vh]">
          <div className="space-y-4 pb-4">
            {/* What to Share Section - Now First and Collapsible */}
            <Collapsible open={isWhatToShareOpen} onOpenChange={setIsWhatToShareOpen}>
              <CollapsibleTrigger asChild>
                <motion.div
                  className="flex items-center justify-between w-full p-3 rounded-lg border border-border/50 hover:border-border cursor-pointer"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <Label className="text-base font-semibold cursor-pointer">What to share</Label>
                  </div>
                  {isWhatToShareOpen ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </motion.div>
              </CollapsibleTrigger>
              
              <CollapsibleContent className="mt-3">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-3 pl-3"
                >
                  <p className="text-sm text-muted-foreground">
                    {config.shareAllNodes 
                      ? "Entire timeline till now will be shared"
                      : "Only selected nodes will be shared"
                    }
                  </p>
                  
                  <NodeGroupDisplay
                    nodes={config.shareAllNodes 
                      ? userNodes 
                      : userNodes.filter(node => config.selectedNodes.includes(node.id))
                    }
                    title=""
                    subtitle=""
                  />
                </motion.div>
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* Who Can Access Section - Now Second */}
            <motion.div
              className="space-y-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div>
                <Label className="text-base font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Who can access
                </Label>
                <p className="text-sm text-muted-foreground">Choose who can view your shared content</p>
              </div>

              <div className="space-y-4">
                {/* User Search Section */}
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="enable-users"
                      checked={enableUsers}
                      onCheckedChange={handleUsersChange}
                      disabled={enablePublic}
                    />
                    <Label htmlFor="enable-users" className="flex items-center gap-2 cursor-pointer">
                      <Users className="h-4 w-4" />
                      Share with specific users
                    </Label>
                  </div>

                  <AnimatePresence>
                    {enableUsers && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="ml-6"
                      >
                        <MultiSelectInput
                          value={selectedUsers}
                          onChange={setSelectedUsers}
                          onSearch={handleSearchUsers}
                          getItemKey={(user) => user.id}
                          placeholder="Search users by email or name..."
                          renderItem={(user, _isSelected) => (
                            <div>
                              <div className="font-medium">{user.userName}</div>
                              <div className="text-sm text-muted-foreground">{user.email}</div>
                            </div>
                          )}
                          renderTag={(user, onRemove) => (
                            <DefaultTag onRemove={onRemove} className="bg-blue-50 text-blue-700 border-blue-200">
                              <Users className="h-3 w-3" />
                              {user.userName || user.email}
                            </DefaultTag>
                          )}
                          emptyMessage="No users found"
                          loadingMessage="Searching users..."
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Organization Search Section */}
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="enable-organizations"
                      checked={enableOrganizations}
                      onCheckedChange={handleOrganizationsChange}
                      disabled={enablePublic}
                    />
                    <Label htmlFor="enable-organizations" className="flex items-center gap-2 cursor-pointer">
                      <Building className="h-4 w-4" />
                      Share with organizations
                    </Label>
                  </div>

                  <AnimatePresence>
                    {enableOrganizations && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="ml-6 space-y-4"
                      >
                        {/* Organization Mode Selection */}
                        <RadioGroup
                          value={organizationMode}
                          onValueChange={(value) => {
                            setOrganizationMode(value as 'search' | 'my-orgs');
                            // Clear selections when switching modes
                            if (value === 'search') {
                              setSelectedMyOrganizations([]);
                            } else {
                              setSelectedOrganizations([]);
                            }
                          }}
                          className="flex flex-col space-y-2"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="search" id="org-search" />
                            <Label htmlFor="org-search" className="cursor-pointer">
                              Search organizations
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="my-orgs" id="org-my" />
                            <Label htmlFor="org-my" className="cursor-pointer">
                              My organizations
                            </Label>
                          </div>
                        </RadioGroup>

                        {/* Search Organizations */}
                        {organizationMode === 'search' && (
                          <MultiSelectInput
                            value={selectedOrganizations}
                            onChange={setSelectedOrganizations}
                            onSearch={handleSearchOrganizations}
                            getItemKey={(org) => org.id}
                            placeholder="Search organizations..."
                            renderItem={(org, _isSelected) => (
                              <div>
                                <div className="font-medium">{org.name}</div>
                                <div className="text-sm text-muted-foreground">{org.type}</div>
                              </div>
                            )}
                            renderTag={(org, onRemove) => (
                              <DefaultTag onRemove={onRemove} className="bg-green-50 text-green-700 border-green-200">
                                <Building className="h-3 w-3" />
                                {org.name}
                              </DefaultTag>
                            )}
                            emptyMessage="No organizations found"
                            loadingMessage="Searching organizations..."
                          />
                        )}

                        {/* My Organizations */}
                        {organizationMode === 'my-orgs' && (
                          <div className="space-y-2">
                            {myOrganizations.length === 0 ? (
                              <p className="text-sm text-muted-foreground">
                                You are not a member of any organizations yet.
                              </p>
                            ) : (
                              <div className="space-y-2">
                                {myOrganizations.map((org) => (
                                  <div key={org.id} className="flex items-center space-x-2">
                                    <Checkbox
                                      id={`my-org-${org.id}`}
                                      checked={selectedMyOrganizations.some(selected => selected.id === org.id)}
                                      onCheckedChange={(checked) => {
                                        if (checked) {
                                          setSelectedMyOrganizations(prev => [...prev, org]);
                                        } else {
                                          setSelectedMyOrganizations(prev => prev.filter(selected => selected.id !== org.id));
                                        }
                                      }}
                                    />
                                    <Label htmlFor={`my-org-${org.id}`} className="flex items-center gap-2 cursor-pointer">
                                      <Building className="h-4 w-4" />
                                      <div>
                                        <div className="font-medium">{org.name}</div>
                                        <div className="text-sm text-muted-foreground">{org.type}</div>
                                      </div>
                                    </Label>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Public Access Section */}
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="enable-public"
                      checked={enablePublic}
                      onCheckedChange={handlePublicChange}
                    />
                    <Label htmlFor="enable-public" className="flex items-center gap-2 cursor-pointer">
                      <Globe className="h-4 w-4" />
                      Make publicly accessible
                    </Label>
                  </div>

                  <AnimatePresence>
                    {enablePublic && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="ml-6"
                      >
                        <Alert className="border-orange-200 bg-orange-50">
                          <Globe className="h-4 w-4 text-orange-600" />
                          <AlertDescription className="text-orange-800">
                            <strong>Public Access:</strong> Anyone with the link can view the shared nodes according to the access level you set.
                          </AlertDescription>
                        </Alert>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>

            <Separator />

            {/* Access Level Section - Now Per-Target */}
            {config.targets.length > 0 && (
              <motion.div
                className="space-y-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <div>
                  <Label className="text-base font-semibold flex items-center gap-2">
                    <Eye className="h-4 w-4 text-primary" />
                    Access levels
                  </Label>
                  <p className="text-sm text-muted-foreground">Set access level for each recipient</p>
                </div>

                <div className="space-y-3">
                  {config.targets.map((target) => (
                    <div key={`${target.type}-${target.id || 'public'}`} className="p-3 border rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {target.type === 'user' && <Users className="h-4 w-4 text-blue-600" />}
                          {target.type === 'organization' && <Building className="h-4 w-4 text-green-600" />}
                          {target.type === 'public' && <Globe className="h-4 w-4 text-orange-600" />}
                          <div>
                            <div className="font-medium">{target.name}</div>
                            {target.email && <div className="text-sm text-muted-foreground">{target.email}</div>}
                          </div>
                        </div>
                        <Badge variant="secondary" className="capitalize">
                          {target.type}
                        </Badge>
                      </div>
                      
                      <RadioGroup
                        value={target.accessLevel}
                        onValueChange={(value) => setTargetAccessLevel(target, value as VisibilityLevel)}
                      >
                        {accessLevelOptions.map((option) => {
                          const Icon = option.icon;
                          return (
                            <div key={option.value} className="flex items-center space-x-2">
                              <RadioGroupItem value={option.value} id={`${target.type}-${target.id || 'public'}-${option.value}`} />
                              <Label htmlFor={`${target.type}-${target.id || 'public'}-${option.value}`} className="flex items-center gap-2 cursor-pointer">
                                <Icon className="h-4 w-4" />
                                <div>
                                  <div className="font-medium">{option.label}</div>
                                  <div className="text-sm text-muted-foreground">{option.description}</div>
                                </div>
                              </Label>
                            </div>
                          );
                        })}
                      </RadioGroup>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </ScrollArea>

        <Separator />

        {/* Actions */}
        <motion.div
          className="flex items-center justify-between"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Button variant="outline" onClick={closeModal} disabled={isLoading}>
            Cancel
          </Button>

          <Button
            onClick={executeShare}
            disabled={isLoading || config.targets.length === 0}
            className={cn(
              "flex items-center gap-2 transition-all duration-200",
              !isLoading && config.targets.length > 0 && "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            )}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sharing...
              </>
            ) : (
              <>
                <Share2 className="h-4 w-4" />
                <motion.span
                  key={config.targets.length}
                  initial={{ opacity: 0, y: 2 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  Share
                </motion.span>
              </>
            )}
          </Button>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};
