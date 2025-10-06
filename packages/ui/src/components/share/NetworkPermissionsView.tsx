/**
 * NetworkPermissionsView Component
 *
 * Shows detailed permissions assignment for a selected organization/network.
 * Based on PersonPermissionsView but for organizations (subjectType: Organization).
 * Uses the same API structure with different subject type and ID.
 */

import React, { useState } from 'react';
import {
  ArrowLeft,
  Check,
  GraduationCap,
  Building,
  Loader2,
} from 'lucide-react';
import { Button } from '@journey/components';
import { RadioGroup, RadioGroupItem } from '@journey/components';
import { Label } from '@journey/components';
import { Separator } from '@journey/components';
import { cn } from '@journey/components';
import { Organization } from '@journey/schema';
import { OrganizationType } from '@journey/schema';
import { useShareStore } from '../../stores/share-store';
import { getSelectedNodesLabel } from '../../utils/node-title';

interface NetworkPermissionsViewProps {
  organization: Organization;
  currentAccessLevel?: 'overview' | 'full';
  onBack: () => void;
  onSave: (permissions: NetworkPermissions) => void;
  isSaving?: boolean;
  className?: string;
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
}) => {
  const [detailLevel, setDetailLevel] = useState<'overview' | 'full'>(
    currentAccessLevel || 'overview'
  );
  const { config, userNodes } = useShareStore();

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
    <div className={cn('space-y-6', className)}>
      {/* Organization Information */}
      <div className="space-y-4">
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
            <div className="space-y-0.5">
              <div className="text-base font-semibold text-gray-900">
                {organization.name}
              </div>
              <div className="text-xs capitalize text-gray-500">
                {organization.type.toLowerCase().replace(/_/g, ' ')}
              </div>
            </div>
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
          <div className="space-y-6">
            <RadioGroup
              value={detailLevel}
              onValueChange={(value) =>
                setDetailLevel(value as 'overview' | 'full')
              }
              className="space-y-3"
            >
              <div className="flex items-center space-x-3">
                <RadioGroupItem value="overview" id="detail-overview" />
                <Label
                  htmlFor="detail-overview"
                  className="text-base text-gray-700"
                >
                  Limited access
                </Label>
              </div>
              <div className="flex items-center space-x-3">
                <RadioGroupItem value="full" id="detail-full" />
                <Label
                  htmlFor="detail-full"
                  className="text-base text-gray-700"
                >
                  Full access
                </Label>
              </div>
            </RadioGroup>
            <div className="text-sm text-gray-500">
              {detailLevel === 'overview' &&
                'Can view basic information and milestones'}
              {detailLevel === 'full' &&
                'Can view all details including personal notes'}
            </div>
          </div>
        </div>
      </div>

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
    </div>
  );
};
