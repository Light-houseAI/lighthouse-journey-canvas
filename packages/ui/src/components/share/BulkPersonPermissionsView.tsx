/**
 * BulkPersonPermissionsView Component
 *
 * Shows permission assignment for multiple selected people at once.
 * Allows setting the same permissions for all selected people.
 */

import React, { useState } from 'react';
import { ArrowLeft, Check, Users, Loader2 } from 'lucide-react';
import { Button, HStack, VStack } from '@journey/components';
import { RadioGroup, RadioGroupItem } from '@journey/components';
import { Label } from '@journey/components';
import { Separator } from '@journey/components';
import { cn } from '@journey/components';
import { UserSearchResult } from '../../services/user-api';
import { useShareStore } from '../../stores/share-store';
import { getSelectedNodesLabel } from '../../utils/node-title';

interface BulkPersonPermissionsViewProps {
  people: UserSearchResult[];
  currentAccessLevel?: 'overview' | 'full';
  onBack: () => void;
  onSave: (permissions: BulkPersonPermissions) => void;
  isSaving?: boolean;
  className?: string;
}

export interface BulkPersonPermissions {
  userIds: number[];
  detailLevel: 'overview' | 'full';
}

export const BulkPersonPermissionsView: React.FC<
  BulkPersonPermissionsViewProps
> = ({
  people,
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
      userIds: people.map((p) => p.id),
      detailLevel,
    });
  };

  const isSinglePerson = people.length === 1;
  const person = isSinglePerson ? people[0] : null;

  const displayName =
    person &&
    (person.firstName && person.lastName
      ? `${person.firstName} ${person.lastName}`
      : person.userName);

  return (
    <VStack spacing={6} className={className}>
      {/* Person/People Information */}
      <VStack spacing={4}>
        <div className="flex items-center gap-8">
          <div className="w-40 text-sm font-medium text-gray-700">
            {isSinglePerson ? 'Person' : 'People'}
          </div>
          {isSinglePerson && person ? (
            /* Single Person Display */
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className="relative">
                {person.avatarUrl ? (
                  <img
                    src={person.avatarUrl}
                    alt={displayName}
                    className="h-12 w-12 rounded-full border border-white"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white bg-blue-100">
                    <Users className="h-6 w-6 text-blue-600" />
                  </div>
                )}
              </div>

              {/* Person Details */}
              <VStack spacing={0.5}>
                <div className="text-base font-semibold text-gray-900">
                  {displayName}
                </div>
                {person.title && person.company && (
                  <div className="text-sm text-gray-600">
                    {person.title} at {person.company}
                  </div>
                )}
              </VStack>
            </div>
          ) : (
            /* Multiple People Display */
            <VStack spacing={2}>
              <div className="text-base font-semibold text-gray-900">
                {people.length} people selected
              </div>
              {/* Show first 3 people as preview */}
              <div className="flex -space-x-2">
                {people.slice(0, 3).map((person) => (
                  <div
                    key={person.id}
                    className="relative"
                    title={
                      person.firstName && person.lastName
                        ? `${person.firstName} ${person.lastName}`
                        : person.userName
                    }
                  >
                    {person.avatarUrl ? (
                      <img
                        src={person.avatarUrl}
                        alt=""
                        className="h-8 w-8 rounded-full border-2 border-white"
                      />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-blue-100">
                        <Users className="h-4 w-4 text-blue-600" />
                      </div>
                    )}
                  </div>
                ))}
                {people.length > 3 && (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-gray-100">
                    <span className="text-xs font-medium text-gray-600">
                      +{people.length - 3}
                    </span>
                  </div>
                )}
              </div>
              {/* List all selected names */}
              <div className="text-sm text-gray-600">
                {people
                  .map((person) =>
                    person.firstName && person.lastName
                      ? `${person.firstName} ${person.lastName}`
                      : person.userName
                  )
                  .join(', ')}
              </div>
            </VStack>
          )}
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
              {isSinglePerson
                ? 'Save access settings'
                : `Save access for ${people.length} people`}
            </>
          )}
        </Button>
      </div>
    </VStack>
  );
};
