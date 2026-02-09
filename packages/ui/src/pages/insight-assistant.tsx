/**
 * Insight Assistant Page
 *
 * AI-powered workflow analysis chat interface with strategy proposals.
 */

import {
  Activity,
  ArrowLeft,
  FolderOpen,
  Mic,
  Paperclip,
  Send,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';

import { CompactSidebar } from '../components/layout/CompactSidebar';
import { InteractiveMessage } from '../components/insight-assistant/InteractiveMessage';
import { PastConversationsPanel } from '../components/insight-assistant/PastConversationsPanel';
import { PersonaSuggestions } from '../components/insight-assistant/PersonaSuggestions';
import { SessionMentionPopup } from '../components/insight-assistant/SessionMentionPopup';
import { TemplateMentionPopup } from '../components/insight-assistant/TemplateMentionPopup';
import { SessionDetailsModal } from '../components/insight-assistant/SessionDetailsModal';
import { StrategyProposalDetailsModal } from '../components/insight-assistant/StrategyProposalDetailsModal';
import type { SessionMappingItem } from '@journey/schema';
import { useAnalytics, AnalyticsEvents } from '../hooks/useAnalytics';
import {
  getChatSessions,
  getChatSession,
  createChatSession,
  saveChatSession,
  deleteChatSession,
  type ChatSession,
} from '../services/chat-session-storage';
import {
  startInsightGeneration,
  pollForJobCompletion,
  type InsightGenerationResult,
  type JobProgress,
  type AttachedSessionContext,
  type AttachedSlashContext,
  type OptimizationBlock,
} from '../services/insight-assistant-api';
import type { RetrievedSource } from '../services/workflow-api';
import type { SessionWorkflow, SessionWorkflowStep } from '../components/insight-assistant/SessionMentionPopup';
import type { StrategyProposal, InsightMessage } from '../types/insight-assistant.types';

/**
 * Generate contextual follow-up suggestions based on query and response
 */
function generateFollowUpSuggestions(
  query: string,
  result?: InsightGenerationResult | null
): string[] {
  const followUps: string[] = [];

  // Add context-specific follow-ups based on what was analyzed
  if ((result?.executiveSummary?.topInefficiencies?.length ?? 0) > 0) {
    followUps.push('What causes these inefficiencies?');
    followUps.push('How can I fix these issues?');
  }

  if ((result?.executiveSummary?.claudeCodeInsertionPoints?.length ?? 0) > 0) {
    followUps.push('Help me automate these tasks');
  }

  // Add general follow-ups if we don't have enough
  const generalFollowUps = [
    'Compare my workflow to best practices',
    'What other patterns should I look at?',
    'How has my productivity changed over time?',
    'What tools could help me be more efficient?',
  ];

  while (followUps.length < 3) {
    const nextFollowUp = generalFollowUps.shift();
    if (nextFollowUp && !followUps.includes(nextFollowUp)) {
      followUps.push(nextFollowUp);
    } else {
      break;
    }
  }

  return followUps.slice(0, 3);
}

export default function InsightAssistant() {
  const [, setLocation] = useLocation();
  const { track } = useAnalytics();

  // Chat state
  const [messages, setMessages] = useState<InsightMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // Loading state
  const [isGeneratingProposals, setIsGeneratingProposals] = useState(false);

  // Past conversations state
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isConversationsPanelOpen, setIsConversationsPanelOpen] = useState(true);

  // Multi-agent insight generation state
  const [insightProgress, setInsightProgress] = useState<JobProgress | null>(null);
  const [insightResult, setInsightResult] = useState<InsightGenerationResult | null>(null);

  // Proposal details modal state
  const [selectedProposal, setSelectedProposal] = useState<StrategyProposal | null>(null);
  const [selectedOptimizationBlock, setSelectedOptimizationBlock] = useState<OptimizationBlock | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  // Session mention popup state
  const [isMentionPopupOpen, setIsMentionPopupOpen] = useState(false);
  const [mentionSearchQuery, setMentionSearchQuery] = useState('');
  const [mentionStartIndex, setMentionStartIndex] = useState<number | null>(null);

  // Template slash popup state
  const [isTemplatePopupOpen, setIsTemplatePopupOpen] = useState(false);
  const [slashStartIndex, setSlashStartIndex] = useState<number | null>(null);

  // Selected work sessions (displayed as tags in input area)
  const [selectedWorkSessions, setSelectedWorkSessions] = useState<SessionMappingItem[]>([]);
  const [viewingWorkSession, setViewingWorkSession] = useState<SessionMappingItem | null>(null);

  // Selected workflows and blocks (displayed as tags in input area)
  const [selectedWorkflows, setSelectedWorkflows] = useState<SessionWorkflow[]>([]);
  const [selectedBlocks, setSelectedBlocks] = useState<Array<{ block: SessionWorkflowStep; parentWorkflow: SessionWorkflow }>>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize with welcome message
  const getInitialMessage = useCallback((): InsightMessage => ({
    id: '1',
    type: 'ai',
    content: `Welcome to **Insight Assistant**! I'm here to analyze your workflows and provide AI-powered strategy recommendations.`,
    timestamp: new Date(),
  }), []);

  // Helper function to load a session by ID
  const loadSession = useCallback((sessionId: string) => {
    const session = getChatSession('global', 'insight-assistant', sessionId);
    if (!session) return;

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
    setInsightResult(null);
  }, []);

  // Handle session selection
  const handleSelectSession = useCallback((sessionId: string) => {
    if (sessionId === currentSessionId) return;
    loadSession(sessionId);
    track(AnalyticsEvents.BUTTON_CLICKED, {
      button_name: 'select_conversation',
      session_id: sessionId,
    });
  }, [currentSessionId, loadSession, track]);

  // Handle new conversation
  const handleNewConversation = useCallback(() => {
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
    setInsightResult(null);
    // Refresh sessions list
    setSessions(getChatSessions('global', 'insight-assistant'));
    track(AnalyticsEvents.BUTTON_CLICKED, { button_name: 'new_conversation' });
  }, [getInitialMessage, track]);

  // Handle delete session
  const handleDeleteSession = useCallback((sessionId: string) => {
    deleteChatSession('global', 'insight-assistant', sessionId);
    // Refresh sessions list
    const updatedSessions = getChatSessions('global', 'insight-assistant');
    setSessions(updatedSessions);
    track(AnalyticsEvents.BUTTON_CLICKED, {
      button_name: 'delete_conversation',
      session_id: sessionId,
    });
  }, [track]);

  // Initialize chat session
  useEffect(() => {
    const allSessions = getChatSessions('global', 'insight-assistant');
    setSessions(allSessions);

    if (allSessions.length > 0) {
      // Load most recent session
      loadSession(allSessions[0].id);
    } else {
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
      // Refresh sessions list after creating new session
      setSessions(getChatSessions('global', 'insight-assistant'));
    }

    track(AnalyticsEvents.PAGE_VIEWED, { page_name: 'insight_assistant' });
  }, [getInitialMessage, loadSession, track]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle sending a message
  const handleSendMessage = useCallback(async () => {
    const hasContext = selectedWorkSessions.length > 0 || selectedWorkflows.length > 0 || selectedBlocks.length > 0;
    if ((!inputValue.trim() && !hasContext) || isGeneratingProposals) return;

    // Build query with selected session context
    let query = inputValue.trim();
    let displayContent = inputValue;

    // Build session context data for API (full workflow/step data)
    let sessionContextData: AttachedSessionContext[] | undefined;

    if (selectedWorkSessions.length > 0) {
      const sessionNames = selectedWorkSessions.map((s) =>
        s.generatedTitle || s.workflows?.[0]?.workflow_summary || s.chapters?.[0]?.title || 'Session'
      );

      // Build full session context for backend (A1 will use this instead of NLQ retrieval)
      sessionContextData = selectedWorkSessions.map((s) => ({
        sessionId: s.id,
        title: s.generatedTitle || s.workflows?.[0]?.workflow_summary || s.chapters?.[0]?.title || 'Session',
        highLevelSummary: s.highLevelSummary ?? undefined,
        workflows: (s.workflows || []).map(w => ({
          workflow_summary: w.workflow_summary,
          semantic_steps: w.semantic_steps || [],
          classification: w.classification,
          timestamps: w.timestamps,
        })),
        totalDurationSeconds: s.durationSeconds ?? 0,
        appsUsed: [...new Set(
          (s.workflows || []).flatMap(w =>
            w.classification?.level_4_tools || []
          )
        )],
      }));

      // Add session context to the query for display and fallback
      const sessionContext = `[Analyzing sessions: ${sessionNames.join(', ')}]`;
      query = query ? `${sessionContext} ${query}` : `${sessionContext} Analyze these work sessions and provide insights.`;

      // Display content shows the session tags
      displayContent = query ? `${sessionNames.map(n => `@${n}`).join(' ')} ${inputValue}`.trim() : sessionNames.map(n => `@${n}`).join(' ');
    }

    // Build workflow/block context data for API
    let workflowContextData: AttachedSlashContext[] | undefined;

    if (selectedWorkflows.length > 0 || selectedBlocks.length > 0) {
      workflowContextData = [];

      // Add full workflows from sessions
      for (const w of selectedWorkflows) {
        workflowContextData.push({
          type: 'workflow',
          workflowId: w.id,
          canonicalName: w.workflowSummary,
          intentCategory: w.intentCategory,
          description: w.approach,
          occurrenceCount: 1,
          sessionCount: 1,
          avgDurationSeconds: Math.round(w.durationMs / 1000),
          blocks: w.steps.map(s => ({
            canonicalName: s.stepName,
            intent: w.intentCategory,
            primaryTool: s.toolsInvolved[0] || '',
            avgDurationSeconds: s.durationSeconds,
          })),
          tools: w.tools,
        });
      }

      // Add individual steps (skip if parent workflow already selected)
      const selectedWorkflowIds = new Set(selectedWorkflows.map(w => w.id));
      for (const { block, parentWorkflow } of selectedBlocks) {
        if (!selectedWorkflowIds.has(parentWorkflow.id)) {
          workflowContextData.push({
            type: 'block',
            blockId: `${block.parentWorkflowId}-${block.stepName}`,
            canonicalName: block.stepName,
            intent: parentWorkflow.intentCategory,
            primaryTool: block.toolsInvolved[0] || '',
            avgDurationSeconds: block.durationSeconds,
            parentWorkflowId: parentWorkflow.id,
            parentWorkflowName: parentWorkflow.workflowSummary,
          });
        }
      }

      // Build display names
      const contextNames = [
        ...selectedWorkflows.map(w => `@${w.workflowSummary}`),
        ...selectedBlocks
          .filter(({ parentWorkflow }) => !selectedWorkflowIds.has(parentWorkflow.id))
          .map(({ block }) => `@${block.stepName}`),
      ];

      const workflowContext = `[Analyzing workflows: ${contextNames.join(', ')}]`;
      query = query
        ? `${workflowContext} ${query}`
        : `${workflowContext} Analyze these workflow patterns and provide insights.`;

      displayContent = `${contextNames.join(' ')} ${displayContent}`.trim();
    }

    const userMessage: InsightMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: displayContent,
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

    setInputValue('');
    setSelectedWorkSessions([]); // Clear selected sessions after sending
    setSelectedWorkflows([]); // Clear selected workflows after sending
    setSelectedBlocks([]); // Clear selected blocks after sending

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
        sessionContext: sessionContextData,
        workflowContext: workflowContextData,
        options: {
          lookbackDays: 90,
          includeWebSearch: true,
          includePeerComparison: true,
          maxOptimizationBlocks: 5,
        },
      });

      console.log('[InsightAssistant] Started insight job:', startResponse.jobId);

      // Poll for completion with progress updates
      // Timeout: 2000 polls × 2 seconds = ~67 minutes max
      // This accommodates long-running multi-agent pipelines
      const job = await pollForJobCompletion(
        startResponse.jobId,
        (progress) => {
          setInsightProgress(progress);
          console.log('[InsightAssistant] Progress:', progress.currentStage, `${progress.progress}%`);
        },
        2000, // Poll every 2 seconds
        2000  // Max ~67 minutes (2000 × 2s)
      );

      if (job.status === 'completed' && job.result) {
        setInsightResult(job.result);
        console.log('[InsightAssistant] Insight generation completed:', job.result);
        console.log(`[InsightAssistant] Optimization blocks: ${job.result.optimizationPlan?.blocks?.length ?? 0}`);
        if (job.result.optimizationPlan?.blocks?.length) {
          console.log('[InsightAssistant] Block details:', JSON.stringify(job.result.optimizationPlan.blocks.map(b => ({ id: b.blockId, whyThisMatters: b.whyThisMatters, timeSaved: b.timeSaved, transformations: b.stepTransformations?.length ?? 0 })), null, 2));
        }

        // Add the direct answer message to chat with full insight result for interactive display
        const answerContent = job.result.userQueryAnswer;
        // Prefer server-generated follow-ups (LLM-based), fall back to client-side generation
        const followUps = (job.result.suggestedFollowUps && job.result.suggestedFollowUps.length > 0)
          ? job.result.suggestedFollowUps
          : generateFollowUpSuggestions(job.result.query, job.result);

        const answerMessage: InsightMessage = {
          id: `insight-${Date.now()}`,
          type: 'ai',
          content: answerContent,
          timestamp: new Date(),
          insightResult: job.result,
          suggestedFollowUps: followUps,
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
              suggestedFollowUps: followUps,
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
      // Refresh sessions list to update title in sidebar
      setSessions(getChatSessions('global', 'insight-assistant'));
    }
  }, [inputValue, isGeneratingProposals, currentSessionId, track, selectedWorkSessions, selectedWorkflows, selectedBlocks]);

  // Handle follow-up question click
  const handleFollowUpClick = useCallback((followUp: string) => {
    setInputValue(followUp);
  }, []);

  const handleCloseDetailsModal = useCallback(() => {
    setIsDetailsModalOpen(false);
    setSelectedProposal(null);
    setSelectedOptimizationBlock(null);
  }, []);

  // Handle viewing proposal details with optional optimization block
  const handleViewProposalDetails = useCallback((
    proposal: StrategyProposal,
    optimizationBlock?: OptimizationBlock | null
  ) => {
    setSelectedProposal(proposal);
    setSelectedOptimizationBlock(optimizationBlock ?? null);
    setIsDetailsModalOpen(true);
  }, []);


  // Handle input change with @ mention and / template detection
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const cursorPosition = e.target.selectionStart || 0;

    setInputValue(value);

    const textBeforeCursor = value.slice(0, cursorPosition);

    // Check for "/" trigger (slash template popup) — checked first
    const slashIndex = textBeforeCursor.lastIndexOf('/');
    if (slashIndex !== -1) {
      const charBefore = slashIndex > 0 ? value[slashIndex - 1] : ' ';
      const searchText = textBeforeCursor.slice(slashIndex + 1);
      if ((charBefore === ' ' || slashIndex === 0) && !searchText.includes(' ')) {
        setSlashStartIndex(slashIndex);
        setIsTemplatePopupOpen(true);
        // Close @ popup if open
        setIsMentionPopupOpen(false);
        setMentionStartIndex(null);
        setMentionSearchQuery('');
        return;
      }
    }

    // Check if @ trigger is valid (at start or after space, no spaces after it)
    const atIndex = textBeforeCursor.lastIndexOf('@');
    if (atIndex !== -1) {
      const charBefore = atIndex > 0 ? value[atIndex - 1] : ' ';
      const searchText = textBeforeCursor.slice(atIndex + 1);
      if ((charBefore === ' ' || atIndex === 0) && !searchText.includes(' ')) {
        setMentionStartIndex(atIndex);
        setMentionSearchQuery(searchText);
        setIsMentionPopupOpen(true);
        // Close / popup if open
        setIsTemplatePopupOpen(false);
        setSlashStartIndex(null);
        return;
      }
    }

    // No valid trigger — close both popups
    setIsMentionPopupOpen(false);
    setMentionStartIndex(null);
    setMentionSearchQuery('');
    setIsTemplatePopupOpen(false);
    setSlashStartIndex(null);
  }, []);

  // Handle session selection from mention popup
  const handleSessionSelect = useCallback((session: SessionMappingItem) => {
    // Add session to selected list if not already present
    setSelectedWorkSessions((prev) => {
      if (prev.some((s) => s.id === session.id)) {
        return prev; // Already selected
      }
      return [...prev, session];
    });

    // Remove @ and search text from input if present
    if (mentionStartIndex !== null) {
      const beforeMention = inputValue.slice(0, mentionStartIndex);
      const afterMention = inputValue.slice(mentionStartIndex + 1 + mentionSearchQuery.length);
      setInputValue(`${beforeMention}${afterMention}`.trim());
    }

    setIsMentionPopupOpen(false);
    setMentionStartIndex(null);
    setMentionSearchQuery('');

    // Focus back on input
    inputRef.current?.focus();

    track(AnalyticsEvents.BUTTON_CLICKED, {
      button_name: 'select_session_mention',
      session_id: session.id,
    });
  }, [inputValue, mentionStartIndex, mentionSearchQuery, track]);

  // Handle removing a selected work session
  const handleRemoveWorkSession = useCallback((sessionId: string) => {
    setSelectedWorkSessions((prev) => prev.filter((s) => s.id !== sessionId));
  }, []);

  // Handle viewing work session details
  const handleViewWorkSession = useCallback((session: SessionMappingItem) => {
    setViewingWorkSession(session);
  }, []);

  // Handle closing work session details
  const handleCloseWorkSessionDetails = useCallback(() => {
    setViewingWorkSession(null);
  }, []);

  // Handle closing mention popup
  const handleCloseMentionPopup = useCallback(() => {
    setIsMentionPopupOpen(false);
    setMentionStartIndex(null);
    setMentionSearchQuery('');
  }, []);

  // Handle closing template popup
  const handleCloseTemplatePopup = useCallback(() => {
    setIsTemplatePopupOpen(false);
    setSlashStartIndex(null);
  }, []);

  // Handle template selection from slash popup (auto-submit)
  const handleTemplateSelect = useCallback(async (templateQuery: string, templateName: string) => {
    if (isGeneratingProposals) return;

    // Close popup and clear input
    setIsTemplatePopupOpen(false);
    setSlashStartIndex(null);
    setInputValue('');

    track(AnalyticsEvents.BUTTON_CLICKED, {
      button_name: 'select_slash_template',
      template_name: templateName,
    });

    // Build session context from @-tagged sessions (same as handleSendMessage)
    let sessionContextData: AttachedSessionContext[] | undefined;
    let displayContent = templateName;
    let query = templateQuery;

    if (selectedWorkSessions.length > 0) {
      const sessionNames = selectedWorkSessions.map((s) =>
        s.generatedTitle || s.workflows?.[0]?.workflow_summary || s.chapters?.[0]?.title || 'Session'
      );

      sessionContextData = selectedWorkSessions.map((s) => ({
        sessionId: s.id,
        title: s.generatedTitle || s.workflows?.[0]?.workflow_summary || s.chapters?.[0]?.title || 'Session',
        highLevelSummary: s.highLevelSummary ?? undefined,
        workflows: (s.workflows || []).map(w => ({
          workflow_summary: w.workflow_summary,
          semantic_steps: w.semantic_steps || [],
          classification: w.classification,
          timestamps: w.timestamps,
        })),
        totalDurationSeconds: s.durationSeconds ?? 0,
        appsUsed: [...new Set(
          (s.workflows || []).flatMap(w =>
            w.classification?.level_4_tools || []
          )
        )],
      }));

      const sessionContext = `[Analyzing sessions: ${sessionNames.join(', ')}]`;
      query = `${sessionContext} ${templateQuery}`;
      displayContent = `${sessionNames.map(n => `@${n}`).join(' ')} ${templateName}`.trim();
    }

    // Build workflow/block context from @-tagged workflows (same as handleSendMessage)
    let workflowContextData: AttachedSlashContext[] | undefined;

    if (selectedWorkflows.length > 0 || selectedBlocks.length > 0) {
      workflowContextData = [];

      for (const w of selectedWorkflows) {
        workflowContextData.push({
          type: 'workflow',
          workflowId: w.id,
          canonicalName: w.workflowSummary,
          intentCategory: w.intentCategory,
          description: w.approach,
          occurrenceCount: 1,
          sessionCount: 1,
          avgDurationSeconds: Math.round(w.durationMs / 1000),
          blocks: w.steps.map(s => ({
            canonicalName: s.stepName,
            intent: w.intentCategory,
            primaryTool: s.toolsInvolved[0] || '',
            avgDurationSeconds: s.durationSeconds,
          })),
          tools: w.tools,
        });
      }

      const selectedWorkflowIds = new Set(selectedWorkflows.map(w => w.id));
      for (const { block, parentWorkflow } of selectedBlocks) {
        if (!selectedWorkflowIds.has(parentWorkflow.id)) {
          workflowContextData.push({
            type: 'block',
            blockId: `${block.parentWorkflowId}-${block.stepName}`,
            canonicalName: block.stepName,
            intent: parentWorkflow.intentCategory,
            primaryTool: block.toolsInvolved[0] || '',
            avgDurationSeconds: block.durationSeconds,
            parentWorkflowId: parentWorkflow.id,
            parentWorkflowName: parentWorkflow.workflowSummary,
          });
        }
      }

      const contextNames = [
        ...selectedWorkflows.map(w => `@${w.workflowSummary}`),
        ...selectedBlocks
          .filter(({ parentWorkflow }) => !selectedWorkflowIds.has(parentWorkflow.id))
          .map(({ block }) => `@${block.stepName}`),
      ];

      const workflowContext = `[Analyzing workflows: ${contextNames.join(', ')}]`;
      query = `${workflowContext} ${query}`;
      displayContent = `${contextNames.join(' ')} ${displayContent}`.trim();
    }

    // Add user message to chat showing the template name + any @-tagged context
    const userMessage: InsightMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: displayContent,
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

    // Clear selected sessions/workflows/blocks after sending
    setSelectedWorkSessions([]);
    setSelectedWorkflows([]);
    setSelectedBlocks([]);

    // Generate insights using the template query with attached context
    setIsGeneratingProposals(true);
    setInsightProgress(null);
    setInsightResult(null);

    try {
      const startResponse = await startInsightGeneration({
        query,
        sessionContext: sessionContextData,
        workflowContext: workflowContextData,
        options: {
          lookbackDays: 90,
          includeWebSearch: false,
          includePeerComparison: false,
          maxOptimizationBlocks: 5,
        },
      });

      console.log('[InsightAssistant] Started template job:', startResponse.jobId, 'template:', templateName);

      const job = await pollForJobCompletion(
        startResponse.jobId,
        (progress) => {
          setInsightProgress(progress);
          console.log('[InsightAssistant] Progress:', progress.currentStage, `${progress.progress}%`);
        },
        2000,
        2000
      );

      if (job.status === 'completed' && job.result) {
        setInsightResult(job.result);

        const followUps = (job.result.suggestedFollowUps && job.result.suggestedFollowUps.length > 0)
          ? job.result.suggestedFollowUps
          : generateFollowUpSuggestions(job.result.query, job.result);

        const answerMessage: InsightMessage = {
          id: `insight-${Date.now()}`,
          type: 'ai',
          content: job.result.userQueryAnswer,
          timestamp: new Date(),
          insightResult: job.result,
          suggestedFollowUps: followUps,
        };
        setMessages((prev) => [...prev, answerMessage]);

        if (currentSessionId) {
          const session = getChatSession('global', 'insight-assistant', currentSessionId);
          if (session) {
            session.messages.push({
              id: answerMessage.id,
              type: 'ai',
              content: answerMessage.content,
              timestamp: answerMessage.timestamp.toISOString(),
              insightResult: job.result,
              suggestedFollowUps: followUps,
            });
            saveChatSession(session);
          }
        }
      } else if (job.status === 'failed') {
        console.error('[InsightAssistant] Template job failed:', job.error);
        const errorMessage: InsightMessage = {
          id: `error-${Date.now()}`,
          type: 'ai',
          content: `**Analysis Failed**\n\nI encountered an error while generating your ${templateName.toLowerCase()}. Please try again.`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);

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
      console.error('[InsightAssistant] Template insight generation failed:', errorDetails, err);
      const errorMessage: InsightMessage = {
        id: `error-${Date.now()}`,
        type: 'ai',
        content: `**Analysis Failed**\n\nI encountered an error: ${errorDetails}\n\nPlease try again.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);

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
      setSessions(getChatSessions('global', 'insight-assistant'));
    }
  }, [isGeneratingProposals, currentSessionId, track, selectedWorkSessions, selectedWorkflows, selectedBlocks]);

  // Handle workflow selection from @ popup (Workflows tab)
  const handleWorkflowSelect = useCallback((workflow: SessionWorkflow) => {
    setSelectedWorkflows((prev) => {
      if (prev.some((w) => w.id === workflow.id)) {
        return prev;
      }
      return [...prev, workflow];
    });

    if (mentionStartIndex !== null) {
      const beforeAt = inputValue.slice(0, mentionStartIndex);
      const afterAt = inputValue.slice(mentionStartIndex + 1 + mentionSearchQuery.length);
      setInputValue(`${beforeAt}${afterAt}`.trim());
    }

    setIsMentionPopupOpen(false);
    setMentionStartIndex(null);
    setMentionSearchQuery('');
    inputRef.current?.focus();

    track(AnalyticsEvents.BUTTON_CLICKED, {
      button_name: 'select_workflow_mention',
      workflow_id: workflow.id,
    });
  }, [inputValue, mentionStartIndex, mentionSearchQuery, track]);

  // Handle block/step selection from @ popup (Workflows tab detail view)
  const handleBlockSelect = useCallback((block: SessionWorkflowStep, parentWorkflow: SessionWorkflow) => {
    setSelectedBlocks((prev) => {
      const blockKey = `${block.parentWorkflowId}-${block.stepName}`;
      if (prev.some((b) => `${b.block.parentWorkflowId}-${b.block.stepName}` === blockKey)) {
        return prev;
      }
      return [...prev, { block, parentWorkflow }];
    });

    if (mentionStartIndex !== null) {
      const beforeAt = inputValue.slice(0, mentionStartIndex);
      const afterAt = inputValue.slice(mentionStartIndex + 1 + mentionSearchQuery.length);
      setInputValue(`${beforeAt}${afterAt}`.trim());
    }

    setIsMentionPopupOpen(false);
    setMentionStartIndex(null);
    setMentionSearchQuery('');
    inputRef.current?.focus();

    track(AnalyticsEvents.BUTTON_CLICKED, {
      button_name: 'select_block_mention',
      block_id: `${block.parentWorkflowId}-${block.stepName}`,
    });
  }, [inputValue, mentionStartIndex, mentionSearchQuery, track]);

  // Handle removing a selected workflow
  const handleRemoveWorkflow = useCallback((workflowId: string) => {
    setSelectedWorkflows((prev) => prev.filter((w) => w.id !== workflowId));
  }, []);

  // Handle removing a selected block/step
  const handleRemoveBlock = useCallback((blockKey: string) => {
    setSelectedBlocks((prev) => prev.filter((b) => `${b.block.parentWorkflowId}-${b.block.stepName}` !== blockKey));
  }, []);


  // Handle key press
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Don't submit if either popup is open and user presses enter
    if (e.key === 'Enter' && !e.shiftKey && !isMentionPopupOpen && !isTemplatePopupOpen) {
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

        {/* Content Area with Past Conversations, Chat, and Proposals */}
        <div className="flex flex-1 overflow-hidden">
          {/* Past Conversations Panel (Left Sidebar) */}
          <PastConversationsPanel
            sessions={sessions}
            currentSessionId={currentSessionId}
            isExpanded={isConversationsPanelOpen}
            onToggle={() => setIsConversationsPanelOpen(!isConversationsPanelOpen)}
            onSelectSession={handleSelectSession}
            onNewConversation={handleNewConversation}
            onDeleteSession={handleDeleteSession}
          />

          {/* Chat Area */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Messages */}
            <div
              className="flex-1 overflow-y-auto px-6 py-6"
              style={{ maxHeight: 'calc(100vh - 180px)' }}
            >
              <div className="mx-auto max-w-3xl space-y-4">
                {messages.map((message, index) => {
                  console.log(`[InsightAssistant] Rendering message ${index}: type=${message.type}, hasInsightResult=${!!message.insightResult}, blockCount=${message.insightResult?.optimizationPlan?.blocks?.length ?? 0}`);
                  return (
                  <React.Fragment key={message.id}>
                    <InteractiveMessage
                      content={message.content}
                      type={message.type}
                      confidence={message.confidence}
                      sources={message.sources}
                      suggestedFollowUps={message.suggestedFollowUps}
                      insightResult={message.insightResult}
                      onFollowUpClick={handleFollowUpClick}
                    />
                    {/* Show persona suggestions below the welcome message */}
                    {index === 0 && messages.length === 1 && (
                      <div className="mt-4">
                        <PersonaSuggestions
                          onSelectSuggestion={(query) => {
                            setInputValue(query);
                          }}
                          limit={5}
                          disabled={isGeneratingProposals}
                        />
                      </div>
                    )}
                  </React.Fragment>
                  );
                })}

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
                  className="relative flex flex-1 flex-col gap-2.5 rounded-2xl p-4"
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    boxShadow: '0px 4px 6px -2px rgba(16, 24, 40, 0.03)',
                  }}
                >
                  {/* Session & Workflow Mention Popup (tabbed) */}
                  <SessionMentionPopup
                    isOpen={isMentionPopupOpen}
                    onClose={handleCloseMentionPopup}
                    onSelect={handleSessionSelect}
                    onSelectWorkflow={handleWorkflowSelect}
                    onSelectBlock={handleBlockSelect}
                    searchQuery={mentionSearchQuery}
                  />

                  {/* Template Slash Popup */}
                  <TemplateMentionPopup
                    isOpen={isTemplatePopupOpen}
                    onClose={handleCloseTemplatePopup}
                    onSelectTemplate={handleTemplateSelect}
                    disabled={isGeneratingProposals}
                  />

                  {/* Selected Work Sessions Tags */}
                  {selectedWorkSessions.length > 0 && (
                    <div className="flex flex-wrap gap-2 pb-2">
                      {selectedWorkSessions.map((session) => {
                        const sessionName = session.generatedTitle
                          || session.workflows?.[0]?.workflow_summary
                          || session.chapters?.[0]?.title
                          || 'Session';
                        return (
                          <div
                            key={session.id}
                            className="group flex items-center gap-1 rounded-lg bg-indigo-100 px-2 py-1"
                          >
                            <button
                              onClick={() => handleViewWorkSession(session)}
                              className="flex items-center gap-1.5 text-sm font-medium text-indigo-700 hover:text-indigo-900"
                              title="Click to view session details"
                            >
                              <FolderOpen className="h-3.5 w-3.5" />
                              <span className="max-w-[200px] truncate">{sessionName}</span>
                            </button>
                            <button
                              onClick={() => handleRemoveWorkSession(session.id)}
                              className="ml-1 rounded p-0.5 text-indigo-400 hover:bg-indigo-200 hover:text-indigo-700"
                              title="Remove"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Selected Workflow Tags (emerald) */}
                  {selectedWorkflows.length > 0 && (
                    <div className="flex flex-wrap gap-2 pb-2">
                      {selectedWorkflows.map((workflow) => (
                        <div
                          key={workflow.id}
                          className="group flex items-center gap-1 rounded-lg bg-emerald-100 px-2 py-1"
                        >
                          <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                            <Activity className="h-3.5 w-3.5" />
                            <span className="max-w-[200px] truncate">{workflow.workflowSummary}</span>
                          </span>
                          <button
                            onClick={() => handleRemoveWorkflow(workflow.id)}
                            className="ml-1 rounded p-0.5 text-emerald-400 hover:bg-emerald-200 hover:text-emerald-700"
                            title="Remove"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Selected Block/Step Tags (teal) */}
                  {selectedBlocks.length > 0 && (
                    <div className="flex flex-wrap gap-2 pb-2">
                      {selectedBlocks.map(({ block, parentWorkflow }) => {
                        const blockKey = `${block.parentWorkflowId}-${block.stepName}`;
                        return (
                          <div
                            key={blockKey}
                            className="group flex items-center gap-1 rounded-lg bg-teal-100 px-2 py-1"
                          >
                            <span
                              className="flex items-center gap-1.5 text-sm font-medium text-teal-700"
                              title={`Step from: ${parentWorkflow.workflowSummary}`}
                            >
                              <Zap className="h-3.5 w-3.5" />
                              <span className="max-w-[200px] truncate">{block.stepName}</span>
                            </span>
                            <button
                              onClick={() => handleRemoveBlock(blockKey)}
                              className="ml-1 rounded p-0.5 text-teal-400 hover:bg-teal-200 hover:text-teal-700"
                              title="Remove"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Paperclip className="h-5 w-5" style={{ color: '#94A3B8' }} />
                    <input
                      ref={inputRef}
                      type="text"
                      value={inputValue}
                      onChange={handleInputChange}
                      onKeyDown={handleKeyDown}
                      placeholder={
                        (selectedWorkSessions.length > 0 || selectedWorkflows.length > 0 || selectedBlocks.length > 0)
                          ? "Ask about the selected context..."
                          : "@ add context first, then / to use templates"
                      }
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
                      disabled={(!inputValue.trim() && selectedWorkSessions.length === 0 && selectedWorkflows.length === 0 && selectedBlocks.length === 0) || isGeneratingProposals}
                      className="flex items-center gap-2 rounded-lg px-4 py-2.5"
                      style={{
                        background: (inputValue.trim() || selectedWorkSessions.length > 0 || selectedWorkflows.length > 0 || selectedBlocks.length > 0) && !isGeneratingProposals ? '#4F46E5' : '#A5B4FC',
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
        </div>
      </div>

      {/* Strategy Proposal Details Modal */}
      <StrategyProposalDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={handleCloseDetailsModal}
        proposal={selectedProposal}
        optimizationBlock={selectedOptimizationBlock}
      />

      {/* Work Session Details Modal */}
      <SessionDetailsModal
        isOpen={viewingWorkSession !== null}
        onClose={handleCloseWorkSessionDetails}
        session={viewingWorkSession}
      />
    </div>
  );
}
