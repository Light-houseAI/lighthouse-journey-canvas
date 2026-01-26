/**
 * Insight Assistant Page
 *
 * AI-powered workflow analysis chat interface with strategy proposals.
 */

import {
  ArrowLeft,
  Mic,
  Paperclip,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'wouter';

import { CompactSidebar } from '../components/layout/CompactSidebar';
import { InteractiveMessage } from '../components/insight-assistant/InteractiveMessage';
import { StrategyProposalDetailsModal } from '../components/insight-assistant/StrategyProposalDetailsModal';
import { StrategyProposalsPanel } from '../components/insight-assistant/StrategyProposalsPanel';
import { useAnalytics, AnalyticsEvents } from '../hooks/useAnalytics';
import {
  getChatSessions,
  getChatSession,
  createChatSession,
  saveChatSession,
} from '../services/chat-session-storage';
import {
  submitProposalFeedback,
  startInsightGeneration,
  pollForJobCompletion,
  type InsightGenerationResult,
  type JobProgress,
} from '../services/insight-assistant-api';
import type { RetrievedSource } from '../services/workflow-api';
import type { StrategyProposal, InsightMessage } from '../types/insight-assistant.types';

export default function InsightAssistant() {
  const [, setLocation] = useLocation();
  const { track } = useAnalytics();

  // Chat state
  const [messages, setMessages] = useState<InsightMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // Proposals state
  const [proposals, setProposals] = useState<StrategyProposal[]>([]);
  const [isProposalsPanelOpen, setIsProposalsPanelOpen] = useState(true);
  const [isGeneratingProposals, setIsGeneratingProposals] = useState(false);

  // Multi-agent insight generation state
  const [insightProgress, setInsightProgress] = useState<JobProgress | null>(null);
  const [insightResult, setInsightResult] = useState<InsightGenerationResult | null>(null);

  // Proposal details modal state
  const [selectedProposal, setSelectedProposal] = useState<StrategyProposal | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize with welcome message
  const getInitialMessage = useCallback((): InsightMessage => ({
    id: '1',
    type: 'ai',
    content: `Welcome to **Insight Assistant**! I'm here to analyze your workflows and provide AI-powered strategy recommendations.\n\nYou can ask me questions like:\n- "How can I optimize my development workflow?"\n- "What patterns do you see in my work sessions?"\n- "Suggest ways to improve my productivity"\n- "Analyze my tool usage patterns"`,
    timestamp: new Date(),
    suggestedFollowUps: [
      'Analyze my workflow patterns',
      'How can I be more productive?',
      'What tools am I using most?',
    ],
  }), []);

  // Initialize chat session
  useEffect(() => {
    const sessions = getChatSessions('global', 'insight-assistant');
    if (sessions.length > 0) {
      // Load most recent session
      const session = getChatSession('global', 'insight-assistant', sessions[0].id);
      if (session) {
        setCurrentSessionId(session.id);
        const loadedMessages: InsightMessage[] = session.messages.map((m) => ({
          id: m.id,
          type: m.type,
          content: m.content,
          timestamp: new Date(m.timestamp),
          sources: m.sources as RetrievedSource[] | undefined,
          confidence: m.confidence,
          suggestedFollowUps: m.suggestedFollowUps,
          insightResult: m.insightResult,
        }));
        setMessages(loadedMessages);
        return;
      }
    }

    // Create new session with welcome message
    const initialMsg = getInitialMessage();
    const session = createChatSession('global', 'insight-assistant', [
      {
        id: initialMsg.id,
        type: initialMsg.type,
        content: initialMsg.content,
        timestamp: initialMsg.timestamp.toISOString(),
      },
    ]);
    setCurrentSessionId(session.id);
    setMessages([initialMsg]);

    track(AnalyticsEvents.PAGE_VIEWED, { page_name: 'insight_assistant' });
  }, [getInitialMessage, track]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle sending a message
  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim() || isGeneratingProposals) return;

    const userMessage: InsightMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);

    // Save user message to session
    if (currentSessionId) {
      const session = getChatSession('global', 'insight-assistant', currentSessionId);
      if (session) {
        session.messages.push({
          id: userMessage.id,
          type: 'user',
          content: userMessage.content,
          timestamp: userMessage.timestamp.toISOString(),
        });
        saveChatSession(session);
      }
    }

    const query = inputValue;
    setInputValue('');

    track(AnalyticsEvents.BUTTON_CLICKED, {
      button_name: 'send_insight_query',
      query_length: query.length,
    });

    // Generate multi-agent insights
    setIsGeneratingProposals(true);
    setInsightProgress(null);
    setInsightResult(null);
    try {
      // Start async multi-agent insight generation job
      const startResponse = await startInsightGeneration({
        query,
        options: {
          lookbackDays: 90,
          includeWebSearch: true,
          includePeerComparison: true,
          maxOptimizationBlocks: 5,
        },
      });

      console.log('[InsightAssistant] Started insight job:', startResponse.jobId);

      // Poll for completion with progress updates
      const job = await pollForJobCompletion(
        startResponse.jobId,
        (progress) => {
          setInsightProgress(progress);
          console.log('[InsightAssistant] Progress:', progress.currentStage, `${progress.progress}%`);
        },
        1500, // Poll every 1.5 seconds
        120   // Max 3 minutes
      );

      if (job.status === 'completed' && job.result) {
        setInsightResult(job.result);
        console.log('[InsightAssistant] Insight generation completed:', job.result);

        // Convert optimization blocks to StrategyProposal format for display
        // Use defensive null checks since A4-Web agent may return empty arrays or omit fields
        const blocks = job.result.optimizationPlan?.blocks ?? [];
        const newProposals: StrategyProposal[] = blocks.map((block) => ({
          id: block.blockId,
          title: `Optimize: ${block.workflowName}`,
          description: block.whyThisMatters,
          workflowCount: 1,
          stepCount: (block.stepTransformations ?? []).reduce(
            (acc, t) => acc + (t.currentSteps?.length ?? 0),
            0
          ),
          tags: {
            // relativeImprovement is already a percentage (0-100) from the backend
            efficiency: Math.round(block.relativeImprovement),
            confidence: Math.round(block.confidence * 100),
          },
          isBookmarked: false,
          feedback: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }));

        setProposals((prev) => [...newProposals, ...prev]);

        // Add the direct answer message to chat with full insight result for interactive display
        const answerContent = job.result.userQueryAnswer;

        const answerMessage: InsightMessage = {
          id: `insight-${Date.now()}`,
          type: 'ai',
          content: answerContent,
          timestamp: new Date(),
          insightResult: job.result,
        };
        setMessages((prev) => [...prev, answerMessage]);

        // Save AI answer to session with full insightResult for persistence
        if (currentSessionId) {
          const session = getChatSession('global', 'insight-assistant', currentSessionId);
          if (session) {
            session.messages.push({
              id: answerMessage.id,
              type: 'ai',
              content: answerMessage.content,
              timestamp: answerMessage.timestamp.toISOString(),
              insightResult: job.result,
            });
            saveChatSession(session);
          }
        }
      } else if (job.status === 'failed') {
        console.error('[InsightAssistant] Job failed:', job.error);
        // Show error message to user
        const errorMessage: InsightMessage = {
          id: `error-${Date.now()}`,
          type: 'ai',
          content: `**Analysis Failed**\n\nI encountered an error while analyzing your workflows. Please try again.`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);

        // Save error message to session
        if (currentSessionId) {
          const session = getChatSession('global', 'insight-assistant', currentSessionId);
          if (session) {
            session.messages.push({
              id: errorMessage.id,
              type: 'ai',
              content: errorMessage.content,
              timestamp: errorMessage.timestamp.toISOString(),
            });
            saveChatSession(session);
          }
        }
      }
    } catch (err) {
      const errorDetails = err instanceof Error ? err.message : String(err);
      console.error('[InsightAssistant] Failed to generate insights:', errorDetails, err);
      // Show error message to user
      const errorMessage: InsightMessage = {
        id: `error-${Date.now()}`,
        type: 'ai',
        content: `**Analysis Failed**\n\nI encountered an error while analyzing your workflows: ${errorDetails}\n\nPlease try again.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);

      // Save error message to session
      if (currentSessionId) {
        const session = getChatSession('global', 'insight-assistant', currentSessionId);
        if (session) {
          session.messages.push({
            id: errorMessage.id,
            type: 'ai',
            content: errorMessage.content,
            timestamp: errorMessage.timestamp.toISOString(),
          });
          saveChatSession(session);
        }
      }
    } finally {
      setIsGeneratingProposals(false);
    }
  }, [inputValue, isGeneratingProposals, currentSessionId, track]);

  // Handle follow-up question click
  const handleFollowUpClick = useCallback((followUp: string) => {
    setInputValue(followUp);
  }, []);

  // Handle proposal actions
  const handleProposalBookmark = useCallback(async (proposalId: string, isBookmarked: boolean) => {
    try {
      await submitProposalFeedback(proposalId, { isBookmarked });
      setProposals((prev) =>
        prev.map((p) => (p.id === proposalId ? { ...p, isBookmarked } : p))
      );
    } catch (err) {
      console.error('Failed to update bookmark:', err);
    }
  }, []);

  const handleProposalFeedback = useCallback(async (proposalId: string, feedback: 'up' | 'down' | null) => {
    try {
      await submitProposalFeedback(proposalId, { feedback });
      setProposals((prev) =>
        prev.map((p) => (p.id === proposalId ? { ...p, feedback } : p))
      );
    } catch (err) {
      console.error('Failed to update feedback:', err);
    }
  }, []);

  const handleViewDetails = useCallback((proposal: StrategyProposal) => {
    setSelectedProposal(proposal);
    setIsDetailsModalOpen(true);
    track(AnalyticsEvents.BUTTON_CLICKED, {
      button_name: 'view_proposal_details',
      proposal_id: proposal.id,
    });
  }, [track]);

  const handleCloseDetailsModal = useCallback(() => {
    setIsDetailsModalOpen(false);
    setSelectedProposal(null);
  }, []);

  // Find the corresponding optimization block for detailed data
  const selectedOptimizationBlock = useMemo(() => {
    if (!selectedProposal || !insightResult) return null;
    return insightResult.optimizationPlan.blocks.find(
      (block) => block.blockId === selectedProposal.id
    ) || null;
  }, [selectedProposal, insightResult]);

  // Handle key press
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Handle close
  const handleClose = () => {
    track(AnalyticsEvents.BUTTON_CLICKED, { button_name: 'close_insight_assistant' });
    setLocation('/');
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-50">
      {/* Compact Sidebar */}
      <CompactSidebar />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid #E2E8F0', background: '#FFFFFF' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg"
              style={{ background: '#EEF2FF' }}
            >
              <Sparkles className="h-5 w-5" style={{ color: '#4F46E5' }} />
            </div>
            <div>
              <h1
                className="text-lg font-semibold"
                style={{ color: '#1E293B', lineHeight: '24px' }}
              >
                Insight Assistant
              </h1>
              <p className="text-sm" style={{ color: '#64748B' }}>
                AI-powered workflow analysis
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="flex h-10 w-10 items-center justify-center rounded-lg transition-colors hover:bg-gray-100"
            title="Close"
          >
            <X className="h-5 w-5" style={{ color: '#64748B' }} />
          </button>
        </div>

        {/* Content Area with Chat and Proposals */}
        <div className="flex flex-1 overflow-hidden">
          {/* Chat Area */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Messages */}
            <div
              className="flex-1 overflow-y-auto px-6 py-6"
              style={{ maxHeight: 'calc(100vh - 180px)' }}
            >
              <div className="mx-auto max-w-3xl space-y-4">
                {messages.map((message) => (
                  <InteractiveMessage
                    key={message.id}
                    content={message.content}
                    type={message.type}
                    confidence={message.confidence}
                    sources={message.sources}
                    suggestedFollowUps={message.suggestedFollowUps}
                    insightResult={message.insightResult}
                    onFollowUpClick={handleFollowUpClick}
                    onViewOptimization={(block) => {
                      // Find the corresponding proposal and open details
                      const proposal = proposals.find((p) => p.id === block.blockId);
                      if (proposal) {
                        handleViewDetails(proposal);
                      }
                    }}
                  />
                ))}

                {/* Loading indicator */}
                {isGeneratingProposals && (
                  <div className="flex justify-start">
                    <div
                      className="rounded-2xl px-4 py-3"
                      style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}
                    >
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400" />
                        <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '0.1s' }} />
                        <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '0.2s' }} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Multi-agent progress indicator */}
                {isGeneratingProposals && insightProgress && (
                  <div className="flex justify-start">
                    <div
                      className="rounded-2xl px-4 py-3"
                      style={{ background: '#EEF2FF', border: '1px solid #C7D2FE' }}
                    >
                      <div className="flex items-center gap-3">
                        <Sparkles className="h-4 w-4 animate-pulse" style={{ color: '#4F46E5' }} />
                        <div>
                          <p className="text-sm font-medium" style={{ color: '#4F46E5' }}>
                            {insightProgress.currentStage}
                          </p>
                          <div className="mt-1 h-1.5 w-32 overflow-hidden rounded-full bg-indigo-200">
                            <div
                              className="h-full rounded-full bg-indigo-600 transition-all duration-300"
                              style={{ width: `${insightProgress.progress}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Input Area */}
            <div className="border-t px-6 py-4" style={{ borderColor: '#E2E8F0', background: '#FFFFFF' }}>
              <div className="mx-auto flex max-w-3xl items-end gap-4">
                {/* Back Button */}
                <button
                  onClick={handleClose}
                  className="flex items-center gap-2 rounded-lg px-4 py-2.5 transition-colors hover:bg-gray-100"
                  style={{ border: '1px solid #E2E8F0' }}
                >
                  <ArrowLeft className="h-5 w-5" style={{ color: '#64748B' }} />
                  <span className="text-sm font-medium" style={{ color: '#64748B' }}>
                    Back
                  </span>
                </button>

                {/* Input Container */}
                <div
                  className="flex flex-1 flex-col gap-2.5 rounded-2xl p-4"
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    boxShadow: '0px 4px 6px -2px rgba(16, 24, 40, 0.03)',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Paperclip className="h-5 w-5" style={{ color: '#94A3B8' }} />
                    <input
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Ask about your workflows..."
                      className="flex-1 text-base outline-none"
                      style={{ color: '#1E293B' }}
                    />
                  </div>
                  <div className="flex items-center justify-end gap-3">
                    <button
                      className="flex h-10 w-10 items-center justify-center rounded-lg"
                      style={{
                        background: '#FFFFFF',
                        boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.05), 0px 0px 0px 1px rgba(0, 0, 0, 0.08)',
                      }}
                    >
                      <Mic className="h-5 w-5" style={{ color: '#64748B' }} />
                    </button>
                    <button
                      onClick={handleSendMessage}
                      disabled={!inputValue.trim() || isGeneratingProposals}
                      className="flex items-center gap-2 rounded-lg px-4 py-2.5"
                      style={{
                        background: inputValue.trim() && !isGeneratingProposals ? '#4F46E5' : '#A5B4FC',
                      }}
                    >
                      <span className="text-sm font-medium" style={{ color: '#FFFFFF' }}>
                        Send
                      </span>
                      <Send className="h-4 w-4" style={{ color: '#FFFFFF' }} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Strategy Proposals Panel */}
          <StrategyProposalsPanel
            proposals={proposals}
            isExpanded={isProposalsPanelOpen}
            onToggle={() => setIsProposalsPanelOpen(!isProposalsPanelOpen)}
            onViewDetails={handleViewDetails}
            onBookmark={handleProposalBookmark}
            onFeedback={handleProposalFeedback}
            isLoading={isGeneratingProposals}
          />
        </div>
      </div>

      {/* Strategy Proposal Details Modal */}
      <StrategyProposalDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={handleCloseDetailsModal}
        proposal={selectedProposal}
        optimizationBlock={selectedOptimizationBlock}
      />
    </div>
  );
}
