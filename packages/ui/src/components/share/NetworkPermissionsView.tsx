/**
 * NetworkPermissionsView Component
 *
 * Shows detailed permissions assignment for a selected organization/network.
 * Based on PersonPermissionsView but for organizations (subjectType: Organization).
 * Uses the same API structure with different subject type and ID.
 */

import { Button } from '@journey/components';
import { RadioGroup, RadioGroupItem } from '@journey/components';
import { Label } from '@journey/components';
import { Separator } from '@journey/components';
import { HStack, VStack } from '@journey/components';
import { Organization, TimelineNode } from '@journey/schema';
import { OrganizationType } from '@journey/schema';
import {
  ArrowLeft,
  Building,
  Check,
  GraduationCap,
  Loader2,
} from 'lucide-react';
import React, { useState } from 'react';

import { useShareStore } from '../../stores/share-store';
import { getSelectedNodesLabel } from '../../utils/node-title';

interface NetworkPermissionsViewProps {
  organization: Organization;
  currentAccessLevel?: 'overview' | 'full';
  onBack: () => void;
  onSave: (permissions: NetworkPermissions) => void;
  isSaving?: boolean;
  className?: string;
  userNodes: TimelineNode[];
}

export interface NetworkPermissions {
  organizationId: number;
  detailLevel: 'overview' | 'full'; // Maps to VisibilityLevel.Overview and VisibilityLevel.Full
}

export const NetworkPermissionsView: React.FC<NetworkPermissionsViewProps> = ({
  organization,
  currentAccessLevel,
  onBack,
  onSave,
  isSaving = false,
  className,
  userNodes,
}) => {
  const [detailLevel, setDetailLevel] = useState<'overview' | 'full'>(
    currentAccessLevel || 'overview'
  );
  const { config } = useShareStore();

  const handleSave = () => {
    onSave({
      organizationId: organization.id,
      detailLevel,
    });
  };

  const getOrgIcon = (type: OrganizationType) => {
    return type === OrganizationType.EducationalInstitution
      ? GraduationCap
      : Building;
  };

  const OrgIcon = getOrgIcon(organization.type);

  return (
    <VStack spacing={6} className={className}>
      {/* Organization Information */}
      <VStack spacing={4}>
        <div className="flex items-center gap-8">
          <div className="w-40 text-sm font-medium text-gray-700">Network</div>
          <div className="flex items-center gap-4">
            {/* Organization Icon */}
            <div className="relative">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white bg-green-100">
                <OrgIcon className="h-6 w-6 text-green-600" />
              </div>
            </div>

            {/* Organization Details */}
            <VStack spacing={0.5}>
              <div className="text-base font-semibold text-gray-900">
                {organization.name}
              </div>
              <div className="text-xs capitalize text-gray-500">
                {organization.type.toLowerCase().replace(/_/g, ' ')}
              </div>
            </VStack>
          </div>
        </div>

        <Separator />

        {/* Viewable Journeys */}
        <div className="flex items-start gap-8">
          <div className="w-40 text-sm font-medium text-gray-700">
            Viewable journeys
          </div>
          <div className="text-base font-medium text-gray-900">
            {getSelectedNodesLabel(
              config.shareAllNodes,
              config.selectedNodes,
              userNodes
            )}
          </div>
        </div>

        <Separator />

        {/* Access Level */}
        <div className="flex items-start gap-8">
          <div className="w-40 text-sm font-medium text-gray-700">
            Access level
          </div>
          <VStack spacing={6}>
            <VStack spacing={3}>
              <RadioGroup
                value={detailLevel}
                onValueChange={(value) =>
                  setDetailLevel(value as 'overview' | 'full')
                }
              >
                <HStack spacing={3} className="items-center">
                  <RadioGroupItem value="overview" id="detail-overview" />
                  <Label
                    htmlFor="detail-overview"
                    className="text-base text-gray-700"
                  >
                    Limited access
                  </Label>
                </HStack>
                <HStack spacing={3} className="items-center">
                  <RadioGroupItem value="full" id="detail-full" />
                  <Label
                    htmlFor="detail-full"
                    className="text-base text-gray-700"
                  >
                    Full access
                  </Label>
                </HStack>
              </RadioGroup>
            </VStack>
            <div className="text-sm text-gray-500">
              {detailLevel === 'overview' &&
                'Can view basic information and milestones'}
              {detailLevel === 'full' &&
                'Can view all details including personal notes'}
            </div>
          </VStack>
        </div>
      </VStack>

      {/* Actions */}
      <div className="flex items-center justify-between border-t border-gray-200 pt-8">
        <Button
          variant="outline"
          onClick={onBack}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 bg-black text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Check className="h-4 w-4" />
              Save access settings
            </>
          )}
        </Button>
      </div>
    </VStack>
  );
};
