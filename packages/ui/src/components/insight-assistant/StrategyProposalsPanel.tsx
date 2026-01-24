/**
 * Strategy Proposals Panel Component
 *
 * Collapsible right sidebar showing AI-generated strategy proposals.
 */

import { ChevronLeft, ChevronRight, Lightbulb } from 'lucide-react';
import React from 'react';

import type { StrategyProposal } from '../../types/insight-assistant.types';
import { StrategyProposalCard } from './StrategyProposalCard';

interface StrategyProposalsPanelProps {
  proposals: StrategyProposal[];
  isExpanded: boolean;
  onToggle: () => void;
  onViewDetails?: (proposal: StrategyProposal) => void;
  onBookmark?: (proposalId: string, isBookmarked: boolean) => void;
  onFeedback?: (proposalId: string, feedback: 'up' | 'down' | null) => void;
  isLoading?: boolean;
}

export function StrategyProposalsPanel({
  proposals,
  isExpanded,
  onToggle,
  onViewDetails,
  onBookmark,
  onFeedback,
  isLoading = false,
}: StrategyProposalsPanelProps) {
  return (
    <div
      className="flex h-full flex-shrink-0 flex-col border-l transition-all duration-300"
      style={{
        width: isExpanded ? '360px' : '48px',
        borderColor: '#E2E8F0',
        background: '#FAFAFA',
      }}
    >
      {/* Header with Toggle */}
      <div
        className="flex items-center gap-2 px-3 py-4"
        style={{ borderBottom: '1px solid #E2E8F0' }}
      >
        <button
          onClick={onToggle}
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-gray-200"
          title={isExpanded ? 'Hide proposals' : 'Show proposals'}
        >
          {isExpanded ? (
            <ChevronRight className="h-5 w-5" style={{ color: '#64748B' }} />
          ) : (
            <ChevronLeft className="h-5 w-5" style={{ color: '#64748B' }} />
          )}
        </button>

        {isExpanded && (
          <div className="flex flex-1 items-center justify-between">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" style={{ color: '#F59E0B' }} />
              <span
                className="text-sm font-semibold"
                style={{ color: '#1E293B' }}
              >
                Strategy Proposals ({proposals.length})
              </span>
            </div>
            <button
              onClick={onToggle}
              className="text-xs font-medium transition-colors hover:text-indigo-600"
              style={{ color: '#4F46E5' }}
            >
              Hide
            </button>
          </div>
        )}
      </div>

      {/* Collapsed State - Just icon */}
      {!isExpanded && (
        <div className="flex flex-1 flex-col items-center pt-4">
          <Lightbulb className="h-5 w-5" style={{ color: '#F59E0B' }} />
          {proposals.length > 0 && (
            <span
              className="mt-1 flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium"
              style={{ background: '#4F46E5', color: '#FFFFFF' }}
            >
              {proposals.length}
            </span>
          )}
        </div>
      )}

      {/* Expanded Content */}
      {isExpanded && (
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="mb-3 flex gap-1">
                <div className="h-2 w-2 animate-bounce rounded-full bg-indigo-400" />
                <div
                  className="h-2 w-2 animate-bounce rounded-full bg-indigo-400"
                  style={{ animationDelay: '0.1s' }}
                />
                <div
                  className="h-2 w-2 animate-bounce rounded-full bg-indigo-400"
                  style={{ animationDelay: '0.2s' }}
                />
              </div>
              <p className="text-sm" style={{ color: '#64748B' }}>
                Generating proposals...
              </p>
            </div>
          ) : proposals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Lightbulb
                className="mb-3 h-10 w-10"
                style={{ color: '#CBD5E1' }}
              />
              <p
                className="mb-1 text-sm font-medium"
                style={{ color: '#64748B' }}
              >
                No proposals yet
              </p>
              <p className="text-xs" style={{ color: '#94A3B8' }}>
                Ask a question to generate AI-powered strategy proposals
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {proposals.map((proposal) => (
                <StrategyProposalCard
                  key={proposal.id}
                  proposal={proposal}
                  onViewDetails={onViewDetails}
                  onBookmark={onBookmark}
                  onFeedback={onFeedback}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
