/**
 * WorkTrackLeftNav Component
 * Left sidebar navigation for work track detail page
 * Matches journey-workflows left nav structure
 */

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

// Navigation data structure - will be generated from actual session data in production
const navigationData = [
  {
    id: 'discovery',
    label: 'Discovery and research',
    children: [
      { id: 'conduct-research', label: 'Conduct research' },
      { id: 'gather-requirements', label: 'Gather requirements' },
      { id: 'analyze-data', label: 'Analyze data' },
    ],
  },
  {
    id: 'documentation',
    label: 'Documentation',
    children: [
      { id: 'write-docs', label: 'Write documentation' },
      { id: 'create-reports', label: 'Create reports' },
    ],
  },
  {
    id: 'strategy',
    label: 'Strategy and direction setting',
    children: [
      { id: 'define-goals', label: 'Define goals' },
      { id: 'plan-approach', label: 'Plan approach' },
    ],
  },
  {
    id: 'execution',
    label: 'Execution and delivery',
    children: [
      { id: 'implement-solution', label: 'Implement solution' },
      { id: 'test-validate', label: 'Test and validate' },
    ],
  },
];

const timeframeOptions = [
  { id: 'all-time', label: 'All time' },
  { id: 'past-7-days', label: 'Past 7 days' },
  { id: 'past-month', label: 'Past month' },
  { id: 'custom', label: 'Custom timeframe' },
];

interface WorkTrackLeftNavProps {
  activeCategoryId?: string;
}

export function WorkTrackLeftNav({ activeCategoryId }: WorkTrackLeftNavProps) {
  const [selectedNavItem, setSelectedNavItem] = useState(activeCategoryId || 'discovery');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['discovery'])
  );
  const [timeframeSelection, setTimeframeSelection] = useState('all-time');
  const [workflowsOpen, setWorkflowsOpen] = useState(false);
  const [timeframeOpen, setTimeframeOpen] = useState(false);

  useEffect(() => {
    if (activeCategoryId) {
      setSelectedNavItem(activeCategoryId);
      setExpandedCategories((prev) => new Set([...prev, activeCategoryId]));
    }
  }, [activeCategoryId]);

  const toggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const handleNavItemClick = (itemId: string) => {
    setSelectedNavItem(itemId);
    const element = document.getElementById(`category-${itemId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <aside className="w-full lg:w-72 shrink-0 p-4 lg:p-6 border-r border-gray-200 bg-white overflow-auto">
      {/* Filter Controls */}
      <div className="space-y-3 mb-6">
        {/* Workflows Filter */}
        <div className="relative">
          <button
            onClick={() => setWorkflowsOpen(!workflowsOpen)}
            className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg bg-gray-100 text-gray-900 text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            <span>Workflows: All</span>
            <ChevronDown className="h-4 w-4 text-gray-600" />
          </button>
        </div>

        {/* Timeframe Filter */}
        <div className="relative">
          <button
            onClick={() => setTimeframeOpen(!timeframeOpen)}
            className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg bg-gray-100 text-gray-900 text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            <span>
              Timeframe: {timeframeOptions.find((o) => o.id === timeframeSelection)?.label}
            </span>
            <ChevronDown className="h-4 w-4 text-gray-600" />
          </button>

          {timeframeOpen && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
              {timeframeOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => {
                    setTimeframeSelection(option.id);
                    setTimeframeOpen(false);
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
                >
                  <span className="text-sm text-gray-700">{option.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Navigation Tree */}
      <nav>
        {navigationData.map((category) => {
          const isExpanded = expandedCategories.has(category.id);
          const isActive = selectedNavItem === category.id;

          return (
            <div key={category.id} className="mb-1">
              {/* Category */}
              <div
                className={`
                  flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors
                  ${isActive ? 'bg-green-50 text-green-900' : 'hover:bg-gray-50'}
                `}
                onClick={() => {
                  toggleCategory(category.id);
                  handleNavItemClick(category.id);
                }}
              >
                <span className="text-sm font-medium">{category.label}</span>
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-gray-500" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                )}
              </div>

              {/* Children */}
              {isExpanded && (
                <div className="ml-4 mt-1 space-y-1">
                  {category.children.map((child) => {
                    const isChildActive = selectedNavItem === child.id;

                    return (
                      <div
                        key={child.id}
                        className={`
                          px-3 py-2 rounded-lg cursor-pointer transition-colors text-sm
                          ${isChildActive ? 'bg-green-50 text-green-900' : 'hover:bg-gray-50 text-gray-700'}
                        `}
                        onClick={() => handleNavItemClick(child.id)}
                      >
                        {child.label}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
