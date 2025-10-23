/**
 * ShareMainView Component
 *
 * Main view of the ShareModal showing Networks/People tabs
 * This is the default view before opening any permission settings
 */

import { Button, cn, VStack } from '@journey/components';
import { TimelineNode } from '@journey/schema';
import React from 'react';

import { CurrentPermissions } from '../../hooks/useSharing';
import { NetworksAccessSection } from './NetworksAccessSection';
import { PeopleAccessSection } from './PeopleAccessSection';

interface ShareMainViewProps {
  activeTab: 'networks' | 'people';
  onTabChange: (tab: 'networks' | 'people') => void;
  onPermissionViewChange: (isOpen: boolean) => void;
  currentPermissions?: CurrentPermissions;
  isLoadingPermissions: boolean;
  userNodes: TimelineNode[];
}

export const ShareMainView: React.FC<ShareMainViewProps> = ({
  activeTab,
  onTabChange,
  onPermissionViewChange,
  currentPermissions,
  isLoadingPermissions,
  userNodes,
}) => {
  return (
    <VStack spacing={6}>
      {/* View Tabs */}
      <div className="flex items-center gap-4">
        <span className="text-base font-semibold text-gray-900">View</span>
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5">
          <Button
            onClick={() => onTabChange('networks')}
            variant="ghost"
            className={cn(
              'relative rounded-[7px] px-[18px] py-2 text-sm font-semibold transition-all duration-200',
              activeTab === 'networks'
                ? 'bg-gray-900 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            {activeTab === 'networks' && (
              <div className="absolute inset-0 rounded-[7px] bg-gradient-to-b from-white/10 to-transparent" />
            )}
            <span className="relative">Networks</span>
          </Button>
          <Button
            onClick={() => onTabChange('people')}
            variant="ghost"
            className={cn(
              'relative rounded-[7px] px-[18px] py-2 text-sm font-semibold transition-all duration-200',
              activeTab === 'people'
                ? 'bg-gray-900 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            {activeTab === 'people' && (
              <div className="absolute inset-0 rounded-[7px] bg-gradient-to-b from-white/10 to-transparent" />
            )}
            <span className="relative">People</span>
          </Button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'networks' ? (
        <NetworksAccessSection
          onViewChange={onPermissionViewChange}
          currentPermissions={currentPermissions}
          isLoadingPermissions={isLoadingPermissions}
          userNodes={userNodes}
        />
      ) : (
        <PeopleAccessSection
          onViewChange={onPermissionViewChange}
          currentPermissions={currentPermissions}
          isLoadingPermissions={isLoadingPermissions}
          userNodes={userNodes}
        />
      )}
    </VStack>
  );
};
