/**
 * Network Insights Side Panel (LIG-206 Phase 6)
 *
 * Side panel component that displays network insights for job applications.
 * Shows match count and collapsible insight sections grouped by interview status.
 * Based on Figma design: node-id=6239-4164
 */

import { ChevronDown, ChevronRight, ChevronUp, X } from 'lucide-react';
import { useState } from 'react';

import type { GraphRAGSearchResponse } from '../search/types/search.types';
import { UserProfileCard } from '../user/UserProfileCard';

interface NetworkInsightsSidePanelProps {
  data: GraphRAGSearchResponse | undefined;
  isLoading: boolean;
  matchCount: number;
  isOpen: boolean;
  onClose: () => void;
  onOpenModal: () => void;
}

export function NetworkInsightsSidePanel({
  data,
  isLoading,
  matchCount,
  isOpen,
  onClose,
  onOpenModal,
}: NetworkInsightsSidePanelProps) {
  const [isInsightsExpanded, setIsInsightsExpanded] = useState(true);

  if (!isOpen) {
    return null;
  }

  const profiles = data?.results || [];

  return (
    <div className="fixed bottom-0 right-0 top-[64px] z-50 w-[380px] overflow-auto px-4 py-6">
      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
            <p className="text-sm text-gray-600">Finding network insights...</p>
          </div>
        </div>
      ) : !data || matchCount === 0 ? (
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <p className="text-gray-600">No network insights found</p>
          </div>
        </div>
      ) : (
        <div className="w-full">
          {/* Match Count Card */}
          <div className="w-full">
            <div className="flex items-start gap-[9px]">
              <div className="h-[92px] w-[4px] shrink-0 rounded-[2px] bg-[#5c9eeb]" />
              <div className="flex grow flex-col gap-[12px] overflow-clip rounded-[8px] bg-[#f3f4f8] p-[12px]">
                {/* Header */}
                <div className="flex w-full items-center justify-between">
                  <div className="flex items-center gap-[7px]">
                    <div className="flex size-[24px] items-center justify-center overflow-clip rounded-[360px] bg-[#5c9eeb] p-[10px]">
                      <p className="text-center text-[14px] font-medium leading-normal text-white">
                        {matchCount}
                      </p>
                    </div>
                    <p className="text-[16px] font-normal leading-[24px] tracking-[-0.05px] text-[#2e2e2e]">
                      Insights
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsInsightsExpanded(!isInsightsExpanded)}
                      className="size-[20px] shrink-0 overflow-clip"
                    >
                      {isInsightsExpanded ? (
                        <ChevronUp className="size-5 text-[#4a4f4e]" />
                      ) : (
                        <ChevronDown className="size-5 text-[#4a4f4e]" />
                      )}
                    </button>
                    <button
                      onClick={onClose}
                      className="size-[20px] shrink-0 overflow-clip rounded hover:bg-gray-200"
                      aria-label="Close side panel"
                    >
                      <X className="size-5 text-[#4a4f4e]" />
                    </button>
                  </div>
                </div>

                {isInsightsExpanded && (
                  <>
                    {/* New Matches Card */}
                    <button
                      onClick={onOpenModal}
                      className="flex w-full cursor-pointer items-start gap-[16px] rounded-[12px] border border-[#e4e6ea] bg-white p-[16px] transition-colors hover:bg-gray-50"
                    >
                      <div className="flex grow items-start justify-between">
                        <div className="flex grow flex-col items-start justify-center gap-[8px]">
                          <p className="text-[14px] font-medium leading-[20px] text-gray-800">
                            {matchCount} new{' '}
                            {matchCount === 1 ? 'match' : 'matches'} found!
                          </p>
                          <p className="text-[12px] font-normal leading-[16px] text-gray-600">
                            They have new or supporting insights.
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="size-5 shrink-0 text-gray-400" />
                    </button>

                    {/* Profile List */}
                    {profiles.length > 0 && (
                      <div className="flex w-full flex-col gap-[16px] rounded-[12px] border border-[#e4e6ea] bg-white p-[16px]">
                        {/* Section Title */}
                        <div className="flex w-full items-start justify-between">
                          <div className="flex grow flex-col items-start justify-center gap-[8px]">
                            <p className="text-[14px] font-medium leading-[20px] text-gray-800">
                              Network connections
                            </p>
                            <p className="text-[12px] font-normal leading-[16px] text-gray-600">
                              Your network has some suggestions to help with
                              preparation.
                            </p>
                          </div>
                        </div>

                        {/* Profile Items */}
                        {profiles.slice(0, 3).map((profile) => (
                          <button
                            key={profile.id}
                            onClick={onOpenModal}
                            className="flex w-full cursor-pointer items-center justify-between rounded-lg p-3 transition-colors hover:bg-gray-50"
                          >
                            <UserProfileCard
                              name={profile.name}
                              currentRole={profile.currentRole}
                              company={profile.company}
                              size="sm"
                              avatarSize="sm"
                              showTitle={true}
                            />
                            <ChevronRight className="size-5 shrink-0 text-gray-400" />
                          </button>
                        ))}

                        {/* "+X more" Badge */}
                        {profiles.length > 3 && (
                          <div className="flex items-center justify-center overflow-clip bg-[#f6f7f9] px-[8px] py-[2px]">
                            <p className="text-center text-[12px] font-medium leading-[18px] text-[#24292e]">
                              +{profiles.length - 3} more
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
