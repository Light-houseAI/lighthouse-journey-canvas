import React from 'react';
import { 
  GraduationCap, 
  Briefcase, 
  ArrowLeftRight, 
  Calendar, 
  Zap,
  Wrench
} from 'lucide-react';

export type NodeType = 'education' | 'workExperience' | 'jobTransition' | 'project' | 'event' | 'action';

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
    education: 'border-blue-500 bg-blue-50',
    workExperience: 'border-green-500 bg-green-50',
    jobTransition: 'border-orange-500 bg-orange-50',
    project: 'border-purple-500 bg-purple-50',
    event: 'border-orange-500 bg-orange-50',
    action: 'border-pink-500 bg-pink-50'
  };
  
  return colorMap[type] || 'border-gray-500 bg-gray-50';
};

const nodeTypeOptions: NodeTypeOption[] = [
  {
    type: 'education',
    title: 'Education',
    description: 'Formal education, courses, certifications',
    icon: GraduationCap,
    color: 'text-blue-600',
    bgColor: 'bg-blue-500',
    hoverColor: 'hover:bg-blue-50 hover:border-blue-300'
  },
  {
    type: 'workExperience',
    title: 'Job',
    description: 'Full-time employment positions',
    icon: Briefcase,
    color: 'text-green-600',
    bgColor: 'bg-green-500',
    hoverColor: 'hover:bg-green-50 hover:border-green-300'
  },
  {
    type: 'jobTransition',
    title: 'Job transition',
    description: 'Career changes, job searches, transitions',
    icon: ArrowLeftRight,
    color: 'text-orange-600',
    bgColor: 'bg-orange-500',
    hoverColor: 'hover:bg-orange-50 hover:border-orange-300'
  },
  {
    type: 'project',
    title: 'Project',
    description: 'Personal projects, side projects, portfolio work',
    icon: Wrench,
    color: 'text-purple-600',
    bgColor: 'bg-purple-500',
    hoverColor: 'hover:bg-purple-50 hover:border-purple-300'
  },
  {
    type: 'event',
    title: 'Event',
    description: 'Conferences, networking events, presentations',
    icon: Calendar,
    color: 'text-orange-600',
    bgColor: 'bg-orange-500',
    hoverColor: 'hover:bg-orange-50 hover:border-orange-300'
  },
  {
    type: 'action',
    title: 'Action',
    description: 'Personal achievements, milestones, actions',
    icon: Zap,
    color: 'text-pink-600',
    bgColor: 'bg-pink-500',
    hoverColor: 'hover:bg-pink-50 hover:border-pink-300'
  }
];

interface NodeTypeSelectorProps {
  onSelect: (type: NodeType) => void;
  selectedType?: NodeType;
  availableTypes?: string[];
}

export const NodeTypeSelector: React.FC<NodeTypeSelectorProps> = ({
  onSelect,
  selectedType,
  availableTypes = []
}) => {
  // Filter options based on available types
  const filteredOptions = nodeTypeOptions.filter(option => 
    availableTypes.length === 0 || availableTypes.includes(option.type)
  );

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          What would you like to add to your journey?
        </h2>
        <p className="text-gray-600">
          Choose the type of milestone you want to add to your professional timeline
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredOptions.map((option) => {
          const Icon = option.icon;
          const isSelected = selectedType === option.type;
          
          return (
            <button
              key={option.type}
              onClick={() => onSelect(option.type)}
              className={`
                relative p-6 rounded-xl border-2 text-left transition-all duration-200
                ${isSelected 
                  ? getBorderAndBgClasses(option.type, true)
                  : `border-gray-200 ${option.hoverColor}`
                }
                focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2
                group
              `}
              data-testid={`node-type-${option.type}`}
              aria-label={`Select ${option.title}: ${option.description}`}
            >
              {/* Selection indicator */}
              {isSelected && (
                <div className="absolute top-3 right-3">
                  <div className={`w-6 h-6 rounded-full ${option.bgColor} flex items-center justify-center`}>
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              )}
              
              {/* Icon */}
              <div className={`w-16 h-16 rounded-full ${option.bgColor} flex items-center justify-center mb-4 group-hover:scale-105 transition-transform duration-200`}>
                <Icon className="w-8 h-8 text-white" />
              </div>
              
              {/* Content */}
              <div className="space-y-2">
                <h3 className={`text-lg font-semibold ${option.color} group-hover:${option.color.replace('600', '700')}`}>
                  {option.title}
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {option.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
      
      {filteredOptions.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-500">
            No milestone types are available for this location.
          </p>
        </div>
      )}
    </div>
  );
};

export default NodeTypeSelector;