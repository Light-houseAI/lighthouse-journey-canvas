/**
 * Strategy Proposal Card Component
 *
 * Displays a single AI-generated strategy proposal with metrics and actions.
 */

import { Bookmark, ThumbsDown, ThumbsUp } from 'lucide-react';
import React from 'react';

import type { StrategyProposal } from '../../types/insight-assistant.types';

interface StrategyProposalCardProps {
  proposal: StrategyProposal;
  onViewDetails?: (proposal: StrategyProposal) => void;
  onBookmark?: (proposalId: string, isBookmarked: boolean) => void;
  onFeedback?: (proposalId: string, feedback: 'up' | 'down' | null) => void;
}

export function StrategyProposalCard({
  proposal,
  onViewDetails,
  onBookmark,
  onFeedback,
}: StrategyProposalCardProps) {
  const handleBookmarkClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onBookmark?.(proposal.id, !proposal.isBookmarked);
  };

  const handleFeedbackClick = (feedback: 'up' | 'down', e: React.MouseEvent) => {
    e.stopPropagation();
    // Toggle off if clicking the same feedback
    const newFeedback = proposal.feedback === feedback ? null : feedback;
    onFeedback?.(proposal.id, newFeedback);
  };

  return (
    <div
      className="rounded-xl border bg-white p-4 transition-shadow hover:shadow-md"
      style={{ borderColor: '#E2E8F0' }}
    >
      {/* Badge and Bookmark Row */}
      <div className="mb-3 flex items-center justify-between">
        <span
          className="rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-wide"
          style={{
            background: '#EEF2FF',
            color: '#4F46E5',
          }}
        >
          Strategy Proposal
        </span>
        <button
          onClick={handleBookmarkClick}
          className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-gray-100"
          title={proposal.isBookmarked ? 'Remove bookmark' : 'Bookmark'}
        >
          <Bookmark
            className="h-5 w-5"
            style={{
              color: proposal.isBookmarked ? '#4F46E5' : '#94A3B8',
              fill: proposal.isBookmarked ? '#4F46E5' : 'none',
            }}
          />
        </button>
      </div>

      {/* Title */}
      <h3
        className="mb-2 text-base font-semibold leading-tight"
        style={{ color: '#1E293B' }}
      >
        {proposal.title}
      </h3>

      {/* Description */}
      <p
        className="mb-4 line-clamp-3 text-sm leading-relaxed"
        style={{ color: '#64748B' }}
      >
        {proposal.description}
      </p>

      {/* Tags */}
      <div className="mb-4 flex flex-wrap gap-2">
        {proposal.tags.costOptimization !== undefined && (
          <span
            className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
            style={{ background: '#FEF3C7', color: '#92400E' }}
          >
            <span className="text-sm">$</span>
            Cost Opt.
          </span>
        )}
        {proposal.tags.efficiency !== undefined && (
          <span
            className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
            style={{ background: '#D1FAE5', color: '#065F46' }}
          >
            <span className="text-sm">%</span>
            {proposal.tags.efficiency}% Efficiency
          </span>
        )}
        {proposal.tags.confidence !== undefined && (
          <span
            className="rounded-full px-2.5 py-1 text-xs font-medium"
            style={{ background: '#F1F5F9', color: '#475569' }}
          >
            {proposal.tags.confidence}% confidence
          </span>
        )}
      </div>

      {/* View Details Button */}
      <button
        onClick={() => onViewDetails?.(proposal)}
        className="mb-4 w-full rounded-lg py-2.5 text-center text-sm font-semibold transition-colors"
        style={{
          background: '#4F46E5',
          color: '#FFFFFF',
        }}
      >
        View Details &gt;
      </button>

      {/* Feedback Row */}
      <div
        className="flex items-center justify-between border-t pt-3"
        style={{ borderColor: '#E2E8F0' }}
      >
        <span className="text-xs" style={{ color: '#94A3B8' }}>
          Source: AI-Powered Analysis
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => handleFeedbackClick('up', e)}
            className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-gray-100"
            title="Helpful"
          >
            <ThumbsUp
              className="h-4 w-4"
              style={{
                color: proposal.feedback === 'up' ? '#16A34A' : '#94A3B8',
                fill: proposal.feedback === 'up' ? '#16A34A' : 'none',
              }}
            />
          </button>
          <button
            onClick={(e) => handleFeedbackClick('down', e)}
            className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-gray-100"
            title="Not helpful"
          >
            <ThumbsDown
              className="h-4 w-4"
              style={{
                color: proposal.feedback === 'down' ? '#DC2626' : '#94A3B8',
                fill: proposal.feedback === 'down' ? '#DC2626' : 'none',
              }}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
