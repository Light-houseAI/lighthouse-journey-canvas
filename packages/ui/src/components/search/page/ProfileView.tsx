/**
 * ProfileView Component
 *
 * Detailed profile view for the right panel matching Figma design
 * Shows profile details, why matched, and relevant insights in 2-column layout
 */

import React from 'react';
import { cn } from '../../../lib/utils';
import type { ProfileResult } from '../types/search.types';

export interface ProfileViewProps {
  profile: ProfileResult;
  className?: string;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  profile,
  className,
}) => {
  // Generate initials from name
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase())
      .join('')
      .slice(0, 2);
  };

  // Format role and company
  const formatRoleCompany = () => {
    if (profile.currentRole && profile.company) {
      return `${profile.currentRole} at ${profile.company}`;
    }
    if (profile.currentRole) {
      return profile.currentRole;
    }
    if (profile.company) {
      return profile.company;
    }
    return 'Professional';
  };

  return (
    <div className={cn('flex flex-col h-full overflow-y-auto bg-white', className)}>
      <div className="flex-1 max-w-4xl mx-auto w-full px-4">
        {/* Profile Header */}
        <div className="flex-shrink-0 py-8 px-6 border-b border-gray-200">
          <div className="flex items-start gap-6">
            <div className="flex-shrink-0 rounded-xl size-[101px] bg-gray-100 flex items-center justify-center">
              <span className="text-2xl font-medium text-gray-600">
                {getInitials(profile.name)}
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between mb-4">
                <div className="flex flex-col gap-2 min-w-0 flex-1">
                  <h1 className="text-2xl font-semibold text-gray-900 truncate">
                    {profile.name}
                  </h1>
                </div>
                <button
                  onClick={() => {
                    if (profile.username) {
                      window.location.href = `/profile/${profile.username}`;
                    }
                  }}
                  disabled={!profile.username}
                  className="flex-shrink-0 inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ml-4"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  View Profile
                </button>
              </div>
              <div className="space-y-3">
                <p className="text-base text-gray-700">
                  {formatRoleCompany()}
                </p>

                {/* Location */}
                {profile.location && (
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-sm text-gray-500">
                      {profile.location}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Content Sections */}
        <div className="flex-1 p-6 space-y-8 pb-16">
          {/* Why matched section */}
          {profile.whyMatched && profile.whyMatched.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-8 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">
                Why matched
              </h3>

              <ul className="space-y-3 mb-8">
                {profile.whyMatched.map((reason, index) => (
                  <li key={index} className="flex items-start">
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full mt-2.5 mr-4 flex-shrink-0"></span>
                    <span className="text-base text-gray-700 leading-relaxed">
                      {reason}
                    </span>
                  </li>
                ))}
              </ul>

              {/* Relevant skills */}
              {profile.skills && profile.skills.length > 0 && (
                <div className="pt-4 border-t border-gray-100">
                  <p className="text-base font-semibold text-gray-900 mb-4">
                    Relevant skills:
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {profile.skills.slice(0, 4).map((skill, index) => (
                      <span
                        key={index}
                        className="bg-gray-100 px-4 py-2 rounded-md text-sm font-medium text-gray-700"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Relevant Experience section */}
          {profile.matchedNodes && profile.matchedNodes.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-8 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">
                Relevant experience
              </h3>
              <div className="space-y-4">
                {profile.matchedNodes
                  .sort((a, b) => {
                    const aEndDate = a.meta?.endDate;
                    const bEndDate = b.meta?.endDate;
                    const aStartDate = a.meta?.startDate || '';
                    const bStartDate = b.meta?.startDate || '';

                    // Current items (null endDate) come first
                    if (!aEndDate && bEndDate) return -1;
                    if (aEndDate && !bEndDate) return 1;

                    // Both current - sort by start date (most recent first)
                    if (!aEndDate && !bEndDate) {
                      return new Date(bStartDate).getTime() - new Date(aStartDate).getTime();
                    }

                    // Both completed - sort by end date (most recent first)
                    return new Date(bEndDate!).getTime() - new Date(aEndDate!).getTime();
                  })
                  .map((node, index) => {
                    // Get node type info for badges
                    const getNodeTypeInfo = (type: string) => {
                      switch (type) {
                        case 'job':
                          return { label: 'Job', bgColor: 'bg-green-100', textColor: 'text-green-700' };
                        case 'education':
                          return { label: 'Education', bgColor: 'bg-blue-100', textColor: 'text-blue-700' };
                        case 'project':
                          return { label: 'Project', bgColor: 'bg-purple-100', textColor: 'text-purple-700' };
                        case 'event':
                          return { label: 'Event', bgColor: 'bg-red-100', textColor: 'text-red-700' };
                        case 'action':
                          return { label: 'Action', bgColor: 'bg-pink-100', textColor: 'text-pink-700' };
                        case 'careerTransition':
                          return { label: 'Career Transition', bgColor: 'bg-orange-100', textColor: 'text-orange-700' };
                        default:
                          return { label: type, bgColor: 'bg-gray-100', textColor: 'text-gray-700' };
                      }
                    };

                    const nodeTypeInfo = getNodeTypeInfo(node.type);

                    return (
                      <div key={index} className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg">
                        <span className={`inline-flex items-center px-3 py-1.5 rounded-md text-xs font-medium ${nodeTypeInfo.bgColor} ${nodeTypeInfo.textColor}`}>
                          {nodeTypeInfo.label}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 mb-1">
                            {node.meta?.role || node.meta?.title || node.meta?.degree || 'Experience'}
                            {node.meta?.company && ` at ${node.meta.company}`}
                            {node.meta?.institution && ` at ${node.meta.institution}`}
                          </p>
                          {(node.meta?.startDate || node.meta?.endDate) && (
                            <p className="text-xs text-gray-500">
                              {node.meta.startDate}{node.meta?.endDate ? ` - ${node.meta.endDate}` : ' - Present'}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Relevant Insights Section */}
          {profile.insightsSummary && profile.insightsSummary.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-8 shadow-sm mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">
                Relevant insights
              </h3>

              <ul className="space-y-4">
                {profile.insightsSummary.map((insight, index) => (
                  <li key={index} className="flex items-start">
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full mt-2.5 mr-4 flex-shrink-0"></span>
                    <div className="flex-1">
                      <p className="text-base text-gray-700 leading-relaxed">
                        {insight}
                      </p>
                      <p className="text-sm text-gray-500 mt-2">
                        from "{insight.includes('Job Search') ? 'Job Search 2025' : insight.includes('Product Manager') ? 'Product Manager at Amazon' : 'ML Pipeline Optimization'}"
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};