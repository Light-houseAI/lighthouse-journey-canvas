/**
 * CurrentAccessSection Component
 * 
 * Displays the current sharing state at the top of the ShareModal,
 * similar to Google Docs sharing interface
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Building,
  Globe,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  MoreHorizontal,
  X,
  Edit3,
  Clock,
  Loader2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { VisibilityLevel } from '@shared/schema';
import {
  CurrentUserPermission,
  CurrentOrgPermission,
  CurrentPublicPermission,
  useShareStore,
} from '@/stores/share-store';

interface CurrentAccessSectionProps {
  className?: string;
}

export const CurrentAccessSection: React.FC<CurrentAccessSectionProps> = ({ className }) => {
  const {
    currentPermissions,
    isLoadingPermissions,
    removePermission,
    updatePermission,
    getUserSubjectKey,
    getOrgSubjectKey,
    getPublicSubjectKey,
  } = useShareStore();

  const [isExpanded, setIsExpanded] = useState(false);
  const [editingPermission, setEditingPermission] = useState<string | null>(null);

  // Calculate summary
  const totalShared = 
    currentPermissions.users.length + 
    currentPermissions.organizations.length + 
    (currentPermissions.public?.enabled ? 1 : 0);

  const handleRemovePermission = async (subjectKey: string) => {
    await removePermission(subjectKey);
  };

  const handleUpdatePermission = async (subjectKey: string, newLevel: VisibilityLevel) => {
    await updatePermission(subjectKey, newLevel);
    setEditingPermission(null);
  };

  const getAccessLevelIcon = (level: VisibilityLevel) => {
    return level === VisibilityLevel.Overview ? Eye : EyeOff;
  };

  const getAccessLevelColor = (level: VisibilityLevel) => {
    return level === VisibilityLevel.Overview 
      ? 'bg-blue-50 text-blue-700 border-blue-200'
      : 'bg-purple-50 text-purple-700 border-purple-200';
  };

  if (isLoadingPermissions) {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm text-muted-foreground">Loading current access...</span>
        </div>
        <Separator />
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Summary Section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {totalShared === 0 ? (
            <Badge variant="outline" className="flex items-center gap-2">
              <Eye className="h-3 w-3" />
              Private
            </Badge>
          ) : currentPermissions.public ? (
            <Badge variant="secondary" className="flex items-center gap-2">
              <Globe className="h-3 w-3" />
              Public
            </Badge>
          ) : (
            <Badge variant="secondary" className="flex items-center gap-2">
              <Users className="h-3 w-3" />
              Shared with {totalShared} {totalShared === 1 ? 'recipient' : 'recipients'}
            </Badge>
          )}
        </div>

        {totalShared > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2"
          >
            <span className="text-sm">
              {isExpanded ? 'Hide' : 'Show'} details
            </span>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>

      {/* Expanded Details */}
      <AnimatePresence>
        {isExpanded && totalShared > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-3"
          >
            {/* User Permissions */}
            {currentPermissions.users.map((user) => (
              <UserAccessItem
                key={user.id}
                user={user}
                editingPermission={editingPermission}
                setEditingPermission={setEditingPermission}
                onRemove={handleRemovePermission}
                onUpdate={handleUpdatePermission}
                getAccessLevelIcon={getAccessLevelIcon}
                getAccessLevelColor={getAccessLevelColor}
                getUserSubjectKey={getUserSubjectKey}
              />
            ))}

            {/* Organization Permissions */}
            {currentPermissions.organizations.map((org) => (
              <OrgAccessItem
                key={org.id}
                org={org}
                editingPermission={editingPermission}
                setEditingPermission={setEditingPermission}
                onRemove={handleRemovePermission}
                onUpdate={handleUpdatePermission}
                getAccessLevelIcon={getAccessLevelIcon}
                getAccessLevelColor={getAccessLevelColor}
                getOrgSubjectKey={getOrgSubjectKey}
              />
            ))}

            {/* Public Permission */}
            {currentPermissions.public?.enabled && (
              <PublicAccessItem
                publicPermission={currentPermissions.public}
                editingPermission={editingPermission}
                setEditingPermission={setEditingPermission}
                onRemove={handleRemovePermission}
                onUpdate={handleUpdatePermission}
                getAccessLevelIcon={getAccessLevelIcon}
                getAccessLevelColor={getAccessLevelColor}
                getPublicSubjectKey={getPublicSubjectKey}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <Separator />
    </div>
  );
};

// User Access Item Component
interface UserAccessItemProps {
  user: CurrentUserPermission;
  editingPermission: string | null;
  setEditingPermission: (id: string | null) => void;
  onRemove: (subjectKey: string) => void;
  onUpdate: (subjectKey: string, level: VisibilityLevel) => void;
  getAccessLevelIcon: (level: VisibilityLevel) => React.ComponentType<{ className?: string }>;
  getAccessLevelColor: (level: VisibilityLevel) => string;
  getUserSubjectKey: (userId: number) => string;
}

const UserAccessItem: React.FC<UserAccessItemProps> = ({
  user,
  editingPermission,
  setEditingPermission,
  onRemove,
  onUpdate,
  getAccessLevelIcon,
  getAccessLevelColor,
  getUserSubjectKey,
}) => {
  const AccessIcon = getAccessLevelIcon(user.accessLevel);
  const subjectKey = getUserSubjectKey(user.id);
  const isEditing = editingPermission === subjectKey;

  return (
    <div className="flex items-center justify-between p-3 bg-blue-50/50 rounded-lg border border-blue-100">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
          <Users className="h-4 w-4 text-blue-600" />
        </div>
        <div>
          <div className="font-medium text-sm">{user.name}</div>
          {user.email && (
            <div className="text-xs text-muted-foreground">{user.email}</div>
          )}
          
          {/* Show nodes this permission applies to, grouped by type */}
          <div className="mt-1 space-y-1">
            {Object.entries(
              user.nodes.reduce((acc, node) => {
                if (!acc[node.nodeType]) {
                  acc[node.nodeType] = [];
                }
                acc[node.nodeType].push(node);
                return acc;
              }, {} as Record<string, typeof user.nodes>)
            ).map(([nodeType, nodes]) => (
              <div key={nodeType} className="text-xs text-muted-foreground">
                <span className="font-medium capitalize">{nodeType}:</span>{' '}
                {nodes.map(node => node.nodeTitle).join(', ')}
                {nodes.length > 3 && (
                  <span className="ml-1">and {nodes.length - 3} more</span>
                )}
              </div>
            ))}
          </div>
          
          {user.expiresAt && (
            <div className="flex items-center gap-1 text-xs text-orange-600 mt-1">
              <Clock className="h-3 w-3" />
              Expires {new Date(user.expiresAt).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {isEditing ? (
          <Select
            value={user.accessLevel}
            onValueChange={(value: VisibilityLevel) => {
              onUpdate(subjectKey, value);
            }}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={VisibilityLevel.Overview}>
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Overview
                </div>
              </SelectItem>
              <SelectItem value={VisibilityLevel.Full}>
                <div className="flex items-center gap-2">
                  <EyeOff className="h-4 w-4" />
                  Full Access
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <Badge className={cn('flex items-center gap-1', getAccessLevelColor(user.accessLevel))}>
            <AccessIcon className="h-3 w-3" />
            {user.accessLevel === VisibilityLevel.Overview ? 'Overview' : 'Full Access'}
          </Badge>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => setEditingPermission(isEditing ? null : subjectKey)}
            >
              <Edit3 className="h-4 w-4 mr-2" />
              {isEditing ? 'Cancel' : 'Change access'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onRemove(subjectKey)}
              className="text-destructive focus:text-destructive"
            >
              <X className="h-4 w-4 mr-2" />
              Remove access
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

// Organization Access Item Component
interface OrgAccessItemProps {
  org: CurrentOrgPermission;
  editingPermission: string | null;
  setEditingPermission: (id: string | null) => void;
  onRemove: (subjectKey: string) => void;
  onUpdate: (subjectKey: string, level: VisibilityLevel) => void;
  getAccessLevelIcon: (level: VisibilityLevel) => React.ComponentType<{ className?: string }>;
  getAccessLevelColor: (level: VisibilityLevel) => string;
  getOrgSubjectKey: (orgId: number) => string;
}

const OrgAccessItem: React.FC<OrgAccessItemProps> = ({
  org,
  editingPermission,
  setEditingPermission,
  onRemove,
  onUpdate,
  getAccessLevelIcon,
  getAccessLevelColor,
  getOrgSubjectKey,
}) => {
  const AccessIcon = getAccessLevelIcon(org.accessLevel);
  const subjectKey = getOrgSubjectKey(org.id);
  const isEditing = editingPermission === subjectKey;

  return (
    <div className="flex items-center justify-between p-3 bg-green-50/50 rounded-lg border border-green-100">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
          <Building className="h-4 w-4 text-green-600" />
        </div>
        <div>
          <div className="font-medium text-sm">{org.name}</div>
          <div className="text-xs text-muted-foreground capitalize">{org.type.toLowerCase()}</div>
          
          {/* Show nodes this permission applies to, grouped by type */}
          <div className="mt-1 space-y-1">
            {Object.entries(
              org.nodes.reduce((acc, node) => {
                if (!acc[node.nodeType]) {
                  acc[node.nodeType] = [];
                }
                acc[node.nodeType].push(node);
                return acc;
              }, {} as Record<string, typeof org.nodes>)
            ).map(([nodeType, nodes]) => (
              <div key={nodeType} className="text-xs text-muted-foreground">
                <span className="font-medium capitalize">{nodeType}:</span>{' '}
                {nodes.map(node => node.nodeTitle).join(', ')}
                {nodes.length > 3 && (
                  <span className="ml-1">and {nodes.length - 3} more</span>
                )}
              </div>
            ))}
          </div>
          
          {org.expiresAt && (
            <div className="flex items-center gap-1 text-xs text-orange-600 mt-1">
              <Clock className="h-3 w-3" />
              Expires {new Date(org.expiresAt).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {isEditing ? (
          <Select
            value={org.accessLevel}
            onValueChange={(value: VisibilityLevel) => {
              onUpdate(subjectKey, value);
            }}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={VisibilityLevel.Overview}>
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Overview
                </div>
              </SelectItem>
              <SelectItem value={VisibilityLevel.Full}>
                <div className="flex items-center gap-2">
                  <EyeOff className="h-4 w-4" />
                  Full Access
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <Badge className={cn('flex items-center gap-1', getAccessLevelColor(org.accessLevel))}>
            <AccessIcon className="h-3 w-3" />
            {org.accessLevel === VisibilityLevel.Overview ? 'Overview' : 'Full Access'}
          </Badge>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => setEditingPermission(isEditing ? null : subjectKey)}
            >
              <Edit3 className="h-4 w-4 mr-2" />
              {isEditing ? 'Cancel' : 'Change access'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onRemove(subjectKey)}
              className="text-destructive focus:text-destructive"
            >
              <X className="h-4 w-4 mr-2" />
              Remove access
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

// Public Access Item Component
interface PublicAccessItemProps {
  publicPermission: CurrentPublicPermission;
  editingPermission: string | null;
  setEditingPermission: (id: string | null) => void;
  onRemove: (subjectKey: string) => void;
  onUpdate: (subjectKey: string, level: VisibilityLevel) => void;
  getAccessLevelIcon: (level: VisibilityLevel) => React.ComponentType<{ className?: string }>;
  getAccessLevelColor: (level: VisibilityLevel) => string;
  getPublicSubjectKey: () => string;
}

const PublicAccessItem: React.FC<PublicAccessItemProps> = ({
  publicPermission,
  editingPermission,
  setEditingPermission,
  onRemove,
  onUpdate,
  getAccessLevelIcon,
  getAccessLevelColor,
  getPublicSubjectKey,
}) => {
  const AccessIcon = getAccessLevelIcon(publicPermission.accessLevel);
  const subjectKey = getPublicSubjectKey();
  const isEditing = editingPermission === subjectKey;

  return (
    <div className="flex items-center justify-between p-3 bg-orange-50/50 rounded-lg border border-orange-100">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
          <Globe className="h-4 w-4 text-orange-600" />
        </div>
        <div>
          <div className="font-medium text-sm">Anyone with the link</div>
          <div className="text-xs text-muted-foreground">Public access</div>
          
          {/* Show nodes this permission applies to, grouped by type */}
          <div className="mt-1 space-y-1">
            {Object.entries(
              publicPermission.nodes.reduce((acc, node) => {
                if (!acc[node.nodeType]) {
                  acc[node.nodeType] = [];
                }
                acc[node.nodeType].push(node);
                return acc;
              }, {} as Record<string, typeof publicPermission.nodes>)
            ).map(([nodeType, nodes]) => (
              <div key={nodeType} className="text-xs text-muted-foreground">
                <span className="font-medium capitalize">{nodeType}:</span>{' '}
                {nodes.map(node => node.nodeTitle).join(', ')}
                {nodes.length > 3 && (
                  <span className="ml-1">and {nodes.length - 3} more</span>
                )}
              </div>
            ))}
          </div>
          
          {publicPermission.expiresAt && (
            <div className="flex items-center gap-1 text-xs text-orange-600 mt-1">
              <Clock className="h-3 w-3" />
              Expires {new Date(publicPermission.expiresAt).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {isEditing ? (
          <Select
            value={publicPermission.accessLevel}
            onValueChange={(value: VisibilityLevel) => {
              onUpdate(subjectKey, value);
            }}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={VisibilityLevel.Overview}>
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Overview
                </div>
              </SelectItem>
              <SelectItem value={VisibilityLevel.Full}>
                <div className="flex items-center gap-2">
                  <EyeOff className="h-4 w-4" />
                  Full Access
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <Badge className={cn('flex items-center gap-1', getAccessLevelColor(publicPermission.accessLevel))}>
            <AccessIcon className="h-3 w-3" />
            {publicPermission.accessLevel === VisibilityLevel.Overview ? 'Overview' : 'Full Access'}
          </Badge>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => setEditingPermission(isEditing ? null : subjectKey)}
            >
              <Edit3 className="h-4 w-4 mr-2" />
              {isEditing ? 'Cancel' : 'Change access'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onRemove(subjectKey)}
              className="text-destructive focus:text-destructive"
            >
              <X className="h-4 w-4 mr-2" />
              Remove access
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};