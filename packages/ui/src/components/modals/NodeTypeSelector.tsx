import React from 'react';

import { Button, VStack } from '@journey/components';
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
  color: string;
  bgColor: string;
  hoverColor: string;
}

// Helper function to get proper Tailwind classes for selected state
const getBorderAndBgClasses = (type: NodeType, isSelected: boolean): string => {
  if (!isSelected) return '';

  const colorMap: Record<NodeType, string> = {
    education: 'border-emerald-500 bg-emerald-50',
    job: 'border-cyan-500 bg-cyan-50',
    careerTransition: 'border-violet-500 bg-violet-50',
    project: 'border-amber-500 bg-amber-50',
    event: 'border-orange-500 bg-orange-50',
    action: 'border-pink-500 bg-pink-50',
  };

  return colorMap[type] || 'border-gray-500 bg-gray-50';
};

const nodeTypeOptions: NodeTypeOption[] = [
  {
    type: 'education',
    title: 'Education',
    description: 'Formal education, courses, certifications',
    icon: NODE_ICONS.education,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-500',
    hoverColor: 'hover:bg-emerald-50 hover:border-emerald-300',
  },
  {
    type: 'job',
    title: 'Employment',
    description: 'Full-time employment positions',
    icon: NODE_ICONS.job,
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-500',
    hoverColor: 'hover:bg-cyan-50 hover:border-cyan-300',
  },
  {
    type: 'careerTransition',
    title: 'Career Transition',
    description: 'Career changes, job searches, transitions',
    icon: NODE_ICONS.careerTransition,
    color: 'text-violet-600',
    bgColor: 'bg-violet-500',
    hoverColor: 'hover:bg-violet-50 hover:border-violet-300',
  },
  {
    type: 'project',
    title: 'Project',
    description: 'Personal projects, side projects, portfolio work',
    icon: NODE_ICONS.project,
    color: 'text-amber-600',
    bgColor: 'bg-amber-500',
    hoverColor: 'hover:bg-amber-50 hover:border-amber-300',
  },
  {
    type: 'event',
    title: 'Event',
    description: 'Conferences, networking events, presentations',
    icon: NODE_ICONS.event,
    color: 'text-orange-600',
    bgColor: 'bg-orange-500',
    hoverColor: 'hover:bg-orange-50 hover:border-orange-300',
  },
  {
    type: 'action',
    title: 'Action',
    description: 'Personal achievements, milestones, actions',
    icon: NODE_ICONS.action,
    color: 'text-pink-600',
    bgColor: 'bg-pink-500',
    hoverColor: 'hover:bg-pink-50 hover:border-pink-300',
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredOptions.map((option) => {
          const Icon = option.icon;
          const isSelected = selectedType === option.type;

          return (
            <Button
              key={option.type}
              onClick={() => onSelect(option.type)}
              variant="ghost"
              className={`relative rounded-xl border-2 p-6 text-left transition-all duration-200 ${
                isSelected
                  ? getBorderAndBgClasses(option.type, true)
                  : `border-gray-200 ${option.hoverColor}`
              } group focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2`}
              data-testid={`node-type-${option.type}`}
              aria-label={`Select ${option.title}: ${option.description}`}
            >
              {/* Selection indicator */}
              {isSelected && (
                <div className="absolute right-3 top-3">
                  <div
                    className={`h-6 w-6 rounded-full ${option.bgColor} flex items-center justify-center`}
                  >
                    <svg
                      className="h-4 w-4 text-white"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                </div>
              )}

              {/* Icon */}
              <div
                className={`h-16 w-16 rounded-full ${option.bgColor} mb-4 flex items-center justify-center transition-transform duration-200 group-hover:scale-105`}
              >
                <Icon className="h-8 w-8 text-white" />
              </div>

              {/* Content */}
              <VStack spacing={2}>
                <h3
                  className={`text-lg font-semibold ${option.color} group-hover:${option.color.replace('600', '700')}`}
                >
                  {option.title}
                </h3>
                <p className="text-sm leading-relaxed text-gray-600">
                  {option.description}
                </p>
              </VStack>
            </Button>
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
