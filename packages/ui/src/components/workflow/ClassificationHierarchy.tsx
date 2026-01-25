/**
 * ClassificationHierarchy Component
 *
 * Displays the 4-tier workflow classification hierarchy:
 * - Level 1: INTENT (The "Why") - Universal objective
 * - Level 2: PROBLEM (The "What") - Domain specific challenge
 * - Level 3: APPROACH (The "How") - Methodology pattern
 * - Level 4: TOOLS (The "Where") - Specific applications
 */

import { Target, Puzzle, Route, Wrench, ChevronRight } from 'lucide-react';
import { Badge } from '@journey/components';
import type { WorkflowClassification } from '@journey/schema';

interface ClassificationHierarchyProps {
  classification: WorkflowClassification;
  variant?: 'full' | 'compact' | 'inline';
  showLabels?: boolean;
}

interface TierConfig {
  level: number;
  key: keyof WorkflowClassification;
  label: string;
  description: string;
  icon: typeof Target;
  color: string;
  bgColor: string;
}

const TIER_CONFIG: TierConfig[] = [
  {
    level: 1,
    key: 'level_1_intent',
    label: 'Intent',
    description: 'The "Why"',
    icon: Target,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  {
    level: 2,
    key: 'level_2_problem',
    label: 'Problem',
    description: 'The "What"',
    icon: Puzzle,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
  },
  {
    level: 3,
    key: 'level_3_approach',
    label: 'Approach',
    description: 'The "How"',
    icon: Route,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
  },
  {
    level: 4,
    key: 'level_4_tools',
    label: 'Tools',
    description: 'The "Where"',
    icon: Wrench,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
  },
];

/**
 * Full hierarchy display with vertical layout
 */
function FullHierarchy({
  classification,
  showLabels,
}: {
  classification: WorkflowClassification;
  showLabels: boolean;
}) {
  return (
    <div className="space-y-3">
      {TIER_CONFIG.map((tier, index) => {
        const value = classification[tier.key];
        if (!value) return null;

        const Icon = tier.icon;

        return (
          <div key={tier.key} className="relative">
            {/* Connector line */}
            {index > 0 && (
              <div className="absolute left-4 -top-3 w-0.5 h-3 bg-gray-200" />
            )}

            <div
              className={`flex items-start gap-3 p-3 rounded-lg border ${tier.bgColor} border-gray-200`}
            >
              {/* Icon and level indicator */}
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full ${tier.bgColor} ${tier.color} flex-shrink-0`}
              >
                <Icon size={16} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {showLabels && (
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-medium ${tier.color}`}>
                      Level {tier.level}: {tier.label}
                    </span>
                    <span className="text-xs text-gray-400">{tier.description}</span>
                  </div>
                )}
                <p className="text-sm font-medium text-gray-900 break-words">
                  {value}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Compact hierarchy display with horizontal badges
 */
function CompactHierarchy({
  classification,
}: {
  classification: WorkflowClassification;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {TIER_CONFIG.map((tier, index) => {
        const value = classification[tier.key];
        if (!value) return null;

        const Icon = tier.icon;
        const isLast = index === TIER_CONFIG.length - 1 || !classification[TIER_CONFIG[index + 1]?.key];

        return (
          <div key={tier.key} className="flex items-center gap-1">
            <Badge
              variant="secondary"
              className={`${tier.bgColor} ${tier.color} border-0 gap-1`}
            >
              <Icon size={12} />
              <span className="max-w-[120px] truncate">{value}</span>
            </Badge>
            {!isLast && (
              <ChevronRight size={14} className="text-gray-300 flex-shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Inline hierarchy display - single line with abbreviated labels
 */
function InlineHierarchy({
  classification,
}: {
  classification: WorkflowClassification;
}) {
  const parts = TIER_CONFIG.map((tier) => classification[tier.key]).filter(Boolean);

  return (
    <div className="flex items-center gap-1 text-sm text-gray-600">
      {parts.map((part, index) => (
        <span key={index} className="flex items-center gap-1">
          {index > 0 && <span className="text-gray-300">→</span>}
          <span className="max-w-[100px] truncate">{part}</span>
        </span>
      ))}
    </div>
  );
}

/**
 * Main ClassificationHierarchy component
 */
export function ClassificationHierarchy({
  classification,
  variant = 'full',
  showLabels = true,
}: ClassificationHierarchyProps) {
  if (!classification) {
    return null;
  }

  switch (variant) {
    case 'compact':
      return <CompactHierarchy classification={classification} />;
    case 'inline':
      return <InlineHierarchy classification={classification} />;
    case 'full':
    default:
      return <FullHierarchy classification={classification} showLabels={showLabels} />;
  }
}

/**
 * Helper component to display a single tier
 */
export function ClassificationTier({
  level,
  value,
}: {
  level: 1 | 2 | 3 | 4;
  value: string;
}) {
  const tier = TIER_CONFIG.find((t) => t.level === level);
  if (!tier || !value) return null;

  const Icon = tier.icon;

  return (
    <Badge variant="secondary" className={`${tier.bgColor} ${tier.color} border-0 gap-1`}>
      <Icon size={12} />
      <span>{value}</span>
    </Badge>
  );
}

export default ClassificationHierarchy;
