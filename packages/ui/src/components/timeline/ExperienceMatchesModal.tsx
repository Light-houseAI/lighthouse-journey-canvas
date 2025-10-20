/**
 * ExperienceMatchesModal Component (LIG-206 Phase 6)
 *
 * Professional 3-column modal for displaying network insights and matches
 * Based on Figma design: node-id=6239-15402
 */

import { Badge, Dialog, DialogContent } from '@journey/components';
import { MapPin } from 'lucide-react';
import { useState } from 'react';

import type { GraphRAGSearchResponse } from '../search/types/search.types';
import { UserProfileCard } from '../user/UserProfileCard';

interface ExperienceMatchesModalProps {
  isOpen: boolean;
  onClose: () => void;
  data?: GraphRAGSearchResponse;
  isLoading: boolean;
}

export function ExperienceMatchesModal({
  isOpen,
  onClose,
  data,
  isLoading,
}: ExperienceMatchesModalProps) {
  const [selectedProfileIndex, setSelectedProfileIndex] = useState(0);

  if (isLoading || !data) {
    return null;
  }

  const profiles = data.results || [];
  const selectedProfile = profiles[selectedProfileIndex];

  if (!selectedProfile || profiles.length === 0) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="h-[85vh] max-w-[1100px] gap-0 bg-neutral-100 p-0"
        aria-describedby="Network insights modal"
      >
        {/* 2-Column Layout */}
        <div className="flex h-full overflow-hidden rounded-lg border border-[#e9eaeb] bg-white">
          {/* Left Column - Matches List */}
          <div className="flex w-[349px] shrink-0 flex-col border-r border-[#e9eaeb]">
            {/* Header */}
            <div className="border-b border-[#e9eaeb] p-6">
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-semibold tracking-[-0.05px] text-black">
                  Matches
                </h2>
                <Badge className="bg-[#f6f7f9] px-2 py-0.5 text-sm font-medium text-[#24292e]">
                  {profiles.length}
                </Badge>
              </div>
            </div>

            {/* Profiles List */}
            <div className="flex-1 overflow-y-auto px-4 py-6">
              <div className="space-y-2">
                {profiles.map((profile, index) => (
                  <button
                    key={profile.id}
                    onClick={() => setSelectedProfileIndex(index)}
                    className={`w-full rounded-xl p-3 transition-colors ${
                      selectedProfileIndex === index
                        ? 'bg-[#9ac6b5]'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <UserProfileCard
                      name={profile.name}
                      currentRole={profile.currentRole}
                      company={profile.company}
                      size="sm"
                      avatarSize="sm"
                      showTitle={true}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column - Profile Details */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Profile Header */}
            <div className="border-b border-[#e9eaeb] p-6">
              <div className="space-y-3">
                <UserProfileCard
                  name={selectedProfile.name}
                  currentRole={selectedProfile.currentRole}
                  company={selectedProfile.company}
                  size="2xl"
                  showTitle={true}
                  showViewProfile={true}
                  onViewProfile={() => {
                    if (selectedProfile.username) {
                      window.location.href = `/profile/${selectedProfile.username}`;
                    }
                  }}
                />

                {/* Meta Info */}
                <div className="ml-[136px] flex items-center gap-3 text-sm text-[#4a4f4e]">
                  {selectedProfile.location && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="size-4" />
                      <span>{selectedProfile.location}</span>
                    </div>
                  )}
                  {selectedProfile.company && selectedProfile.location && (
                    <span className="text-black">·</span>
                  )}
                </div>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 space-y-8 overflow-y-auto p-6">
              {/* Why Matched Section */}
              {selectedProfile.whyMatched &&
                selectedProfile.whyMatched.length > 0 && (
                  <div className="space-y-4 rounded-lg bg-white p-6 shadow-[0px_2px_4px_0px_rgba(96,97,112,0.16),0px_-1px_1px_0px_rgba(40,41,61,0.04)]">
                    <h3 className="text-xl font-semibold leading-[30px] tracking-[-0.05px] text-[#2e2e2e]">
                      Why matched
                    </h3>

                    <ul className="space-y-2 text-base leading-6 text-[#2e2e2e]">
                      {selectedProfile.whyMatched.map((reason, index) => (
                        <li key={index} className="flex gap-2">
                          <span>•</span>
                          <span>{reason}</span>
                        </li>
                      ))}
                    </ul>

                    {/* Skills */}
                    {selectedProfile.skills &&
                      selectedProfile.skills.length > 0 && (
                        <div className="space-y-3 pt-2">
                          <p className="text-base font-semibold tracking-[-0.05px] text-[#2e2e2e]">
                            Relevant skills:
                          </p>
                          <div className="flex flex-wrap gap-2.5">
                            {selectedProfile.skills.map((skill, index) => (
                              <Badge
                                key={index}
                                className="bg-[#f6f7f9] px-2 py-0.5 text-sm font-medium text-[#24292e]"
                              >
                                {skill}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>
                )}

              {/* Career Insights Section (LIG-207) */}
              {selectedProfile.careerInsights &&
                selectedProfile.careerInsights.length > 0 && (
                  <div className="space-y-4 rounded-lg bg-white p-6 shadow-[0px_2px_4px_0px_rgba(96,97,112,0.16),0px_-1px_1px_0px_rgba(40,41,61,0.04)]">
                    <h3 className="text-xl font-semibold leading-[30px] tracking-[-0.05px] text-[#2e2e2e]">
                      Career Insights
                    </h3>

                    <ul className="space-y-3 text-base leading-6 text-[#2e2e2e]">
                      {selectedProfile.careerInsights.map((insight, index) => (
                        <li key={index} className="flex gap-2">
                          <span>•</span>
                          <div className="flex-1">
                            <span>{insight.text}</span>
                            {insight.relevance === 'high' && (
                              <Badge className="ml-2 bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                                High relevance
                              </Badge>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
