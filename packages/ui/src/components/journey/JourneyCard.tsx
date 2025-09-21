import { Building, ChevronDown, Eye, Plus, Search, Zap } from 'lucide-react';
import React from 'react';

export interface Journey {
  id: string;
  title: string;
  description: string;
  type: 'job' | 'education' | 'project';
  chapters?: number;
  lastUpdated?: string;
  status?: 'active' | 'completed' | 'paused';
}

export interface JourneyCardProps {
  journey: Journey;
  expanded?: boolean;
  onToggleExpanded?: (journeyId: string) => void;
  onAddUpdate?: (journeyId: string) => void;
  onView?: (journeyId: string) => void;
}

export function JourneyCard({
  journey,
  expanded = false,
  onToggleExpanded,
  onAddUpdate,
  onView,
}: JourneyCardProps) {
  const handleExpandClick = () => {
    try {
      if (onToggleExpanded) {
        onToggleExpanded(journey.id);
      }
    } catch (error) {
      console.error('Toggle expanded callback failed:', error);
    }
  };

  const handleAddUpdateClick = () => {
    try {
      if (onAddUpdate) {
        onAddUpdate(journey.id);
      }
    } catch (error) {
      console.error('Add update callback failed:', error);
    }
  };

  const handleViewClick = () => {
    try {
      if (onView) {
        onView(journey.id);
      }
    } catch (error) {
      console.error('View callback failed:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, callback?: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (callback) {
        callback();
      }
    }
  };

  // Color-coded icons based on journey type
  const getJourneyIcon = () => {
    switch (journey.type) {
      case 'job':
        return {
          bgColor: 'bg-[#d56b85]', // Pink for job search
          icon: Search,
          iconName: 'search-pink',
        };
      case 'education':
        return {
          bgColor: 'bg-[#5c9eeb]', // Blue for work experience
          icon: Building,
          iconName: 'building-blue',
        };
      case 'project':
        return {
          bgColor: 'bg-[#6fa497]', // Green for progress/achievements
          icon: Zap,
          iconName: 'zap-green',
        };
      default:
        return {
          bgColor: 'bg-[#d56b85]',
          icon: Search,
          iconName: 'search-pink',
        };
    }
  };

  const { bgColor, icon: IconComponent, iconName } = getJourneyIcon();

  const formatSubtitle = () => {
    const parts = [];
    if (journey.chapters) {
      parts.push(`${journey.chapters} chapters`);
    }
    if (journey.lastUpdated) {
      parts.push(`Last updated ${journey.lastUpdated}`);
    }
    return parts.join(' · ');
  };

  return (
    <article
      className="bg-white rounded-[8px] shadow-[0px_-1px_1px_0px_rgba(40,41,61,0.04),0px_2px_4px_0px_rgba(96,97,112,0.16)] p-[16px] transition-shadow hover:shadow-[0px_4px_8px_0px_rgba(96,97,112,0.20)]"
      data-testid="journey-card"
      role="article"
      aria-label={`Journey: ${journey.title}`}
    >
      {/* Card Header */}
      <div className="flex items-start gap-[16px]">
        {/* Color-coded icon */}
        <div
          className={`${bgColor} size-[48px] rounded-[8px] flex items-center justify-center flex-shrink-0`}
          data-testid="journey-icon-container"
        >
          <IconComponent
            className="size-[32px] text-white"
            data-testid="journey-icon"
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-[16px] text-[#2e2e2e] leading-[24px] mb-[4px] truncate">
            {journey.title}
          </h4>

          {formatSubtitle() && (
            <p className="font-normal text-[14px] text-[#4a4f4e] leading-[22px] mb-[8px]">
              {formatSubtitle()}
            </p>
          )}
        </div>

        {/* Expand Button */}
        <button
          onClick={handleExpandClick}
          onKeyDown={(e) => handleKeyDown(e, handleExpandClick)}
          className="flex items-center justify-center size-[32px] hover:bg-[#f5f5f5] rounded-[4px] transition-colors focus:outline-none focus:ring-2 focus:ring-[#4a4f4e]/20"
          data-testid="expand-button"
          tabIndex={0}
          role="button"
          aria-label={expanded ? 'Collapse journey' : 'Expand journey'}
          aria-expanded={expanded}
        >
          <ChevronDown
            className={`size-[16px] transition-transform duration-200 ${
              expanded ? 'rotate-180' : ''
            }`}
            data-testid="chevron-icon"
          />
        </button>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="mt-[16px]" data-testid="card-content">
          {journey.description && (
            <p className="font-normal text-[14px] text-[#4a4f4e] leading-[22px] mb-[16px]">
              {journey.description}
            </p>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-[12px]" data-testid="action-buttons">
            <button
              onClick={handleAddUpdateClick}
              onKeyDown={(e) => handleKeyDown(e, handleAddUpdateClick)}
              className="flex items-center gap-[8px] px-[16px] py-[8px] bg-[#2e2e2e] hover:bg-[#1a1a1a] rounded-[6px] transition-colors focus:outline-none focus:ring-2 focus:ring-[#4a4f4e]/20 active:scale-95 transform transition-transform"
              tabIndex={0}
              role="button"
              aria-label="Add update to journey"
            >
              <Plus
                className="size-[16px]"
                data-testid="plus-icon"
              />
              <span className="font-medium text-[14px] text-white">
                Add update
              </span>
            </button>

            <button
              onClick={handleViewClick}
              onKeyDown={(e) => handleKeyDown(e, handleViewClick)}
              className="flex items-center gap-[8px] px-[16px] py-[8px] bg-white border border-[#e5e7eb] hover:bg-[#f9fafb] rounded-[6px] transition-colors focus:outline-none focus:ring-2 focus:ring-[#4a4f4e]/20 active:scale-95 transform transition-transform"
              tabIndex={0}
              role="button"
              aria-label="View journey details"
            >
              <Eye
                className="size-[16px]"
                data-testid="eye-icon"
              />
              <span className="font-medium text-[14px] text-black">
                View
              </span>
            </button>
          </div>
        </div>
      )}
    </article>
  );
}