import { OptionTile, VStack } from '@journey/components';
import React from 'react';

import { NODE_ICONS } from '../icons/NodeIcons';

export type NodeType =
  | 'education'
  | 'job'
  | 'careerTransition'
  | 'project'
  | 'event'
  | 'action';

interface NodeTypeOption {
  type: NodeType;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const nodeTypeOptions: NodeTypeOption[] = [
  {
    type: 'education',
    title: 'Education',
    description: 'Formal education, courses, certifications',
    icon: NODE_ICONS.education,
  },
  {
    type: 'job',
    title: 'Employment',
    description: 'Full-time employment positions',
    icon: NODE_ICONS.job,
  },
  {
    type: 'careerTransition',
    title: 'Career Transition',
    description: 'Career changes, job searches, transitions',
    icon: NODE_ICONS.careerTransition,
  },
  {
    type: 'project',
    title: 'Project',
    description: 'Personal projects, side projects, portfolio work',
    icon: NODE_ICONS.project,
  },
  {
    type: 'event',
    title: 'Event',
    description: 'Conferences, networking events, presentations',
    icon: NODE_ICONS.event,
  },
  {
    type: 'action',
    title: 'Action',
    description: 'Personal achievements, milestones, actions',
    icon: NODE_ICONS.action,
  },
];

interface NodeTypeSelectorProps {
  onSelect: (type: NodeType) => void;
  selectedType?: NodeType;
  availableTypes?: string[];
}

export const NodeTypeSelector: React.FC<NodeTypeSelectorProps> = ({
  onSelect,
  selectedType,
  availableTypes = [],
}) => {
  // Filter options based on available types
  const filteredOptions = nodeTypeOptions.filter(
    (option) =>
      availableTypes.length === 0 || availableTypes.includes(option.type)
  );

  return (
    <VStack spacing={6}>
      <div className="text-center">
        <h2 className="mb-2 text-2xl font-semibold text-gray-900">
          What would you like to add to your journey?
        </h2>
        <p className="text-gray-600">
          Choose the type of milestone you want to add to your professional
          timeline
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {filteredOptions.map((option) => {
          const Icon = option.icon;
          const isSelected = selectedType === option.type;

          return (
            <div key={option.type} className="h-36 w-full [&>*]:h-full">
              <OptionTile
                value={option.type}
                title={option.title}
                description={option.description}
                icon={<Icon className="h-5 w-5" />}
                selected={isSelected}
                onSelect={() => onSelect(option.type)}
              />
            </div>
          );
        })}
      </div>

      {filteredOptions.length === 0 && (
        <div className="py-8 text-center">
          <p className="text-gray-500">
            No milestone types are available for this location.
          </p>
        </div>
      )}
    </VStack>
  );
};
