/**
 * ProfileView Component
 *
 * Detailed profile view for the right panel matching Figma design
 * Shows profile details, why matched, and relevant insights in 2-column layout
 */

import { Button, cn, VStack } from '@journey/components';
import React from 'react';

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
    <div
      className={cn('flex h-full flex-col overflow-hidden bg-white', className)}
    >
      {/* Profile Header - Fixed at top */}
      <div className="flex-shrink-0 border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-start gap-4">
          <div className="flex size-16 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-100 to-indigo-100">
            <span className="text-lg font-semibold text-blue-700">
              {getInitials(profile.name)}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-start justify-between">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <h1 className="truncate text-xl font-semibold text-gray-900">
                  {profile.name}
                </h1>
              </div>
              <Button
                onClick={() => {
                  if (profile.username) {
                    window.location.href = `/app/profile/${profile.username}`;
                  }
                }}
                disabled={!profile.username}
                variant="outline"
                className="ml-4 flex-shrink-0"
              >
                <svg
                  className="mr-2 h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                View Profile
              </Button>
            </div>
            <VStack spacing={2}>
              <p className="text-sm font-medium text-gray-700">
                {formatRoleCompany()}
              </p>

              {/* Location */}
              {profile.location && (
                <div className="flex items-center gap-2">
                  <svg
                    className="h-4 w-4 flex-shrink-0 text-gray-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  <span className="text-sm text-gray-500">
                    {profile.location}
                  </span>
                </div>
              )}
            </VStack>
          </div>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-400 hover:[&::-webkit-scrollbar-thumb]:bg-gray-500 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar]:w-2">
        {/* Content Sections */}
        <VStack spacing={4} className="px-6 py-4">
          {/* Why matched section */}
          {profile.whyMatched && profile.whyMatched.length > 0 && (
            <div className="rounded-lg border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-5">
              <h3 className="mb-3 flex items-center text-base font-semibold text-gray-900">
                <svg
                  className="mr-2 h-4 w-4 text-blue-600"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                Why matched
              </h3>

              <ul className="mb-4 flex flex-col gap-2">
                {profile.whyMatched.map((reason, index) => (
                  <li key={index} className="flex items-start">
                    <span className="mr-3 mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-blue-500"></span>
                    <span className="text-sm text-gray-700">{reason}</span>
                  </li>
                ))}
              </ul>

              {/* Relevant skills */}
              {profile.skills && profile.skills.length > 0 && (
                <div className="border-t border-blue-100 pt-3">
                  <p className="mb-2 text-sm font-medium text-gray-700">
                    Relevant skills:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {profile.skills.slice(0, 6).map((skill, index) => (
                      <span
                        key={index}
                        className="rounded border border-blue-200 bg-white/70 px-2.5 py-1 text-xs font-medium text-gray-700"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Relevant Experience section with insights */}
          {profile.matchedNodes && profile.matchedNodes.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white p-5">
              <h3 className="mb-3 flex items-center text-base font-semibold text-gray-900">
                <svg
                  className="mr-2 h-4 w-4 text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
                Relevant experience
              </h3>
              <VStack spacing={3}>
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
                      return (
                        new Date(bStartDate).getTime() -
                        new Date(aStartDate).getTime()
                      );
                    }

                    // Both completed - sort by end date (most recent first)
                    return (
                      new Date(bEndDate!).getTime() -
                      new Date(aEndDate!).getTime()
                    );
                  })
                  .map((node, index) => {
                    // Get node type info for badges
                    const getNodeTypeInfo = (type: string) => {
                      switch (type) {
                        case 'job':
                          return {
                            label: 'Job',
                            bgColor: 'bg-green-100',
                            textColor: 'text-green-700',
                          };
                        case 'education':
                          return {
                            label: 'Education',
                            bgColor: 'bg-blue-100',
                            textColor: 'text-blue-700',
                          };
                        case 'project':
                          return {
                            label: 'Project',
                            bgColor: 'bg-purple-100',
                            textColor: 'text-purple-700',
                          };
                        case 'event':
                          return {
                            label: 'Event',
                            bgColor: 'bg-red-100',
                            textColor: 'text-red-700',
                          };
                        case 'action':
                          return {
                            label: 'Action',
                            bgColor: 'bg-pink-100',
                            textColor: 'text-pink-700',
                          };
                        case 'careerTransition':
                          return {
                            label: 'Career Transition',
                            bgColor: 'bg-orange-100',
                            textColor: 'text-orange-700',
                          };
                        default:
                          return {
                            label: type,
                            bgColor: 'bg-gray-100',
                            textColor: 'text-gray-700',
                          };
                      }
                    };

                    const nodeTypeInfo = getNodeTypeInfo(node.type);

                    return (
                      <div
                        key={index}
                        className="rounded-md border border-gray-100 bg-gray-50 p-3"
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold ${nodeTypeInfo.bgColor} ${nodeTypeInfo.textColor}`}
                          >
                            {nodeTypeInfo.label}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium leading-tight text-gray-900">
                              {node.meta?.role ||
                                node.meta?.title ||
                                node.meta?.degree ||
                                'Experience'}
                              {node.meta?.company && ` at ${node.meta.company}`}
                              {node.meta?.institution &&
                                ` at ${node.meta.institution}`}
                            </p>
                            {(node.meta?.startDate || node.meta?.endDate) && (
                              <p className="mt-0.5 text-[11px] text-gray-500">
                                {node.meta.startDate}
                                {node.meta?.endDate
                                  ? ` - ${node.meta.endDate}`
                                  : ' - Present'}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Display insights for this experience if available */}
                        {node.insights && node.insights.length > 0 && (
                          <div className="ml-4 mt-2.5 border-l-2 border-blue-200/50 pl-3">
                            <p className="mb-1 text-[11px] font-medium text-gray-600">
                              Key Insights:
                            </p>
                            <ul className="flex flex-col gap-1">
                              {node.insights.map((insight, insightIdx) => (
                                <li
                                  key={insightIdx}
                                  className="flex items-start"
                                >
                                  <span className="mr-2 mt-1 h-0.5 w-0.5 flex-shrink-0 rounded-full bg-blue-400"></span>
                                  <span className="flex-1 text-[11px] leading-relaxed text-gray-600">
                                    {insight.text}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </VStack>
            </div>
          )}
        </VStack>
      </div>
    </div>
  );
};
