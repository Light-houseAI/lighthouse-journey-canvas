/**
 * Workflow Analysis Chat Modal
 * Interactive chat interface for creating/refining workflow analysis with AI
 *
 * Integrates with the RAG (Retrieval-Augmented Generation) pipeline:
 * 1. User query is embedded using OpenAI embeddings
 * 2. Relevant context retrieved from Vector DB (pgvector) and Graph DB (ArangoDB)
 * 3. Context is passed to Gemini for generating contextual responses
 */

import {
  AlertCircle,
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  MessageSquare,
  Mic,
  Paperclip,
  RefreshCcw,
  Search,
  Send,
  Settings,
  Trash2,
} from 'lucide-react';
import React, { useState, useRef, useEffect, useCallback, Component, ErrorInfo, ReactNode } from 'react';

import { useNaturalLanguageQuery } from '../../hooks/useNaturalLanguageQuery';
import {
  getChatSessions,
  getChatSession,
  createChatSession,
  saveChatSession,
  deleteChatSession,
  updateSessionTitleAsync,
  generateSessionTitleWithLLM,
  type ChatSession,
} from '../../services/chat-session-storage';
import type { NaturalLanguageQueryResult, RetrievedSource } from '../../services/workflow-api';

// Helper function to remove citation markers like [1], [2, 3], etc. from text
function removeCitations(text: string): string {
  // Match patterns like [1], [2], [1, 2], [1, 2, 3], etc.
  return text.replace(/\s*\[\d+(?:,\s*\d+)*\]/g, '');
}

// Error boundary for catching errors within the modal
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  onReset: () => void;
}

class ChatModalErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[WorkflowAnalysisChatModal] Error caught:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[300px] items-center justify-center p-8">
          <div className="max-w-md rounded-lg border border-red-200 bg-red-50 p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-500" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-red-800">
                  Error loading workflow analysis
                </h3>
                <p className="mt-1 text-sm text-red-700">
                  {this.state.error?.message || 'An unexpected error occurred'}
                </p>
                <button
                  onClick={this.handleReset}
                  className="mt-3 flex items-center gap-2 rounded-md bg-red-100 px-3 py-1.5 text-sm font-medium text-red-800 hover:bg-red-200"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Try again
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

interface Message {
  id: string;
  type: 'ai' | 'user';
  content: string;
  timestamp: Date;
  sources?: RetrievedSource[];
  confidence?: number;
  suggestedFollowUps?: string[];
}

interface WorkflowAnalysisChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodeId: string;
}

function WorkflowAnalysisChatModalContent({
  onClose,
  nodeId,
}: Omit<WorkflowAnalysisChatModalProps, 'isOpen'>) {
  // Initialize with welcome message
  const getInitialMessage = (): Message => ({
    id: '1',
    type: 'ai',
    content: `Let's analyze your **workflow patterns**. I'll review your recent work sessions to identify patterns, bottlenecks, and opportunities for improvement.\n\nYou can ask me questions like:\n- "What are my most common work patterns?"\n- "How much time do I spend on coding vs meetings?"\n- "What tools do I use most frequently?"\n- "Show me my productivity patterns"`,
    timestamp: new Date(),
  });

  const [messages, setMessages] = useState<Message[]>([getInitialMessage()]);
  const [inputValue, setInputValue] = useState('');
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [pastSessions, setPastSessions] = useState<ChatSession[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load past sessions on mount
  useEffect(() => {
    const sessions = getChatSessions(nodeId, 'workflow-analysis');
    setPastSessions(sessions);
  }, [nodeId]);

  // Generate title when modal closes (cleanup effect)
  useEffect(() => {
    return () => {
      // On unmount, generate title for current session if it has user messages
      if (currentSession && currentSession.title === 'New conversation') {
        const userMessages = currentSession.messages.filter((m) => m.type === 'user');
        if (userMessages.length > 0) {
          // Fire and forget - generate title in background
          generateSessionTitleWithLLM(currentSession).catch((error) => {
            console.error('[WorkflowAnalysisChatModal] Failed to generate title on close:', error);
          });
        }
      }
    };
  }, [currentSession]);

  // Create or load a session when starting a new conversation
  const initializeSession = useCallback(() => {
    const initialMsg = getInitialMessage();
    const session = createChatSession(nodeId, 'workflow-analysis', [
      {
        id: initialMsg.id,
        type: initialMsg.type,
        content: initialMsg.content,
        timestamp: initialMsg.timestamp.toISOString(),
      },
    ]);
    setCurrentSession(session);
    setMessages([initialMsg]);
    // Refresh past sessions list
    setPastSessions(getChatSessions(nodeId, 'workflow-analysis'));
  }, [nodeId]);

  // Use the natural language query hook for RAG-powered responses
  // Queries are scoped to: User (via auth) -> Track (nodeId) -> Vector DB + Graph DB
  const {
    executeQuery,
    isLoading,
  } = useNaturalLanguageQuery({
    nodeId,
    lookbackDays: 30,
    maxResults: 15,
    includeGraph: true,
    includeVectors: true,
    onSuccess: (result: NaturalLanguageQueryResult) => {
      // Create AI response message from the RAG result
      const aiMessage: Message = {
        id: Date.now().toString(),
        type: 'ai',
        content: result.answer,
        timestamp: new Date(),
        sources: result.sources,
        confidence: result.confidence,
        suggestedFollowUps: result.suggestedFollowUps,
      };
      setMessages((prev) => [...prev, aiMessage]);

      // Save AI message to session
      if (currentSession) {
        currentSession.messages.push({
          id: aiMessage.id,
          type: 'ai',
          content: aiMessage.content,
          timestamp: aiMessage.timestamp.toISOString(),
          sources: aiMessage.sources,
          confidence: aiMessage.confidence,
          suggestedFollowUps: aiMessage.suggestedFollowUps,
        });
        saveChatSession(currentSession);

        // Generate LLM-based title after first complete exchange (user + AI)
        updateSessionTitleAsync(currentSession, () => {
          // Refresh past sessions to show updated title
          setPastSessions(getChatSessions(nodeId, 'workflow-analysis'));
        });

        setPastSessions(getChatSessions(nodeId, 'workflow-analysis'));
      }
    },
    onError: (err: Error) => {
      const errorMessage: Message = {
        id: Date.now().toString(),
        type: 'ai',
        content: `I encountered an issue while analyzing your workflow: ${err.message}. Please try again or rephrase your question.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    },
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle loading a past session
  const handleLoadPastSession = (sessionId: string) => {
    const session = getChatSession(nodeId, 'workflow-analysis', sessionId);
    if (session) {
      setCurrentSession(session);
      // Convert stored messages to Message format
      const loadedMessages: Message[] = session.messages.map((m) => ({
        id: m.id,
        type: m.type,
        content: m.content,
        timestamp: new Date(m.timestamp),
        sources: m.sources,
        confidence: m.confidence,
        suggestedFollowUps: m.suggestedFollowUps,
      }));
      setMessages(loadedMessages);
    }
  };

  // Handle deleting a past session
  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteChatSession(nodeId, 'workflow-analysis', sessionId);
    setPastSessions(getChatSessions(nodeId, 'workflow-analysis'));
    // If we deleted the current session, start a new one
    if (currentSession?.id === sessionId) {
      initializeSession();
    }
  };

  // Start a new conversation
  const handleNewConversation = useCallback(() => {
    initializeSession();
  }, [initializeSession]);

  // Handle sending a message and executing RAG query
  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim() || isLoading) return;

    // Create a new session if we don't have one
    let session = currentSession;
    if (!session) {
      const initialMsg = getInitialMessage();
      session = createChatSession(nodeId, 'workflow-analysis', [
        {
          id: initialMsg.id,
          type: initialMsg.type,
          content: initialMsg.content,
          timestamp: initialMsg.timestamp.toISOString(),
        },
      ]);
      setCurrentSession(session);
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);

    // Save user message to session
    session.messages.push({
      id: userMessage.id,
      type: 'user',
      content: userMessage.content,
      timestamp: userMessage.timestamp.toISOString(),
    });
    saveChatSession(session);
    setPastSessions(getChatSessions(nodeId, 'workflow-analysis'));

    const query = inputValue;
    setInputValue('');

    // Execute the RAG query - the hook's onSuccess/onError callbacks handle the response
    try {
      await executeQuery(query);
    } catch (err) {
      // Error is already handled by onError callback
      console.error('Query execution failed:', err);
    }
  }, [inputValue, isLoading, executeQuery, currentSession, nodeId]);

  // Handle clicking on a suggested follow-up question
  const handleFollowUpClick = useCallback((followUp: string) => {
    setInputValue(followUp);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Backdrop - higher z-index to overlay parent modal */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Modal - same size as Browse work session outputs */}
      <div
        className="relative flex h-[90vh] w-full max-w-[1138px] flex-col overflow-hidden rounded-xl bg-white"
        style={{
          boxShadow: '0px 25px 50px -12px rgba(0, 0, 0, 0.25)',
        }}
      >
        {/* Main content with Collapsible Left Sidebar */}
        <div className="flex flex-1 overflow-hidden">
          {/* Collapsible Left Sidebar */}
          <div
            className="flex flex-shrink-0 flex-col border-r transition-all duration-300"
            style={{
              width: isSidebarExpanded ? '240px' : '48px',
              borderColor: '#E2E8F0',
              background: '#FAFAFA',
            }}
          >
            {/* Sidebar Toggle Button */}
            <button
              onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
              className="flex items-center gap-2 px-3 py-3 hover:bg-gray-100"
              style={{ borderBottom: '1px solid #E2E8F0' }}
              title={isSidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              {isSidebarExpanded ? (
                <ChevronLeft className="h-5 w-5 flex-shrink-0" style={{ color: '#64748B' }} />
              ) : (
                <ChevronRight className="h-5 w-5 flex-shrink-0" style={{ color: '#64748B' }} />
              )}
              {isSidebarExpanded && (
                <>
                  <MessageSquare className="h-4 w-4 flex-shrink-0" style={{ color: '#64748B' }} />
                  <span
                    className="truncate text-sm font-medium"
                    style={{ color: '#1E293B' }}
                  >
                    Past conversations
                  </span>
                </>
              )}
            </button>

            {/* Expanded Sidebar Content - List of past conversations */}
            {isSidebarExpanded && (
              <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
                {/* New Chat button */}
                <button
                  onClick={handleNewConversation}
                  className="mb-2 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-indigo-50"
                  style={{
                    color: '#4F46E5',
                    border: '1px solid #C7D2FE',
                    background: '#EEF2FF',
                  }}
                >
                  <span>+ New Chat</span>
                </button>

                {pastSessions.length === 0 && (
                  <p className="px-3 py-2 text-xs" style={{ color: '#64748B' }}>
                    Your past conversations will appear here
                  </p>
                )}

                {pastSessions.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => handleLoadPastSession(session.id)}
                    className="group flex cursor-pointer items-start justify-between gap-1 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-gray-100"
                    style={{
                      background: currentSession?.id === session.id ? '#EEF2FF' : 'transparent',
                      border: currentSession?.id === session.id ? '1px solid #C7D2FE' : '1px solid transparent',
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <span
                        className="block truncate text-sm font-medium"
                        style={{
                          color: currentSession?.id === session.id ? '#4F46E5' : '#1E293B',
                        }}
                      >
                        {session.title}
                      </span>
                      <span className="text-xs" style={{ color: '#64748B' }}>
                        {new Date(session.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                    <button
                      onClick={(e) => handleDeleteSession(session.id, e)}
                      className="flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                      title="Delete conversation"
                    >
                      <Trash2 className="h-4 w-4" style={{ color: '#94A3B8' }} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Collapsed state - just show icon */}
            {!isSidebarExpanded && (
              <div className="flex flex-1 items-start justify-center pt-3">
                <MessageSquare className="h-5 w-5" style={{ color: '#94A3B8' }} />
              </div>
            )}
          </div>

          {/* Main Chat Area */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Header */}
            <div
              className="flex items-center justify-between px-6 py-6"
              style={{ borderBottom: '1px solid #E2E8F0' }}
            >
              <h2
                className="text-xl font-semibold"
                style={{
                  color: '#1E293B',
                  letterSpacing: '-0.05px',
                  lineHeight: '30px',
                }}
              >
                My workflow analysis
              </h2>

              <div className="flex items-center gap-2">
                {/* Search button */}
                <button
                  className="flex h-10 w-10 items-center justify-center rounded-full"
                  style={{ border: '1px solid #CBD5E1' }}
                >
                  <Search className="h-6 w-6" style={{ color: '#475569' }} />
                </button>

                {/* Settings button */}
                <button
                  className="flex h-10 w-10 items-center justify-center rounded-full"
                  style={{ border: '1px solid #CBD5E1' }}
                >
                  <Settings className="h-6 w-6" style={{ color: '#475569' }} />
                </button>

                {/* Download App button */}
                <button
                  className="flex items-center gap-2 rounded-full px-4 py-2.5"
                  style={{ border: '1px solid #CBD5E1' }}
                >
                  <Download className="h-5 w-5" style={{ color: '#475569' }} />
                  <span
                    className="text-sm font-bold"
                    style={{ color: '#475569', letterSpacing: '-0.006em' }}
                  >
                    Download App
                  </span>
                </button>
              </div>
            </div>

            {/* Chat Content */}
            <div
              className="flex flex-1 flex-col gap-3 overflow-y-auto px-12 py-8"
              style={{ maxHeight: 'calc(90vh - 88px - 194px)' }}
            >
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex flex-col ${message.type === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className="max-w-[600px] rounded-2xl px-4 py-3"
                    style={{
                      background: message.type === 'user' ? '#4F46E5' : '#FAFAF9',
                      border: message.type === 'ai' ? '1px solid #E2E8F0' : 'none',
                    }}
                  >
                    <p
                      className="whitespace-pre-line text-base"
                      style={{
                        color: message.type === 'user' ? '#FFFFFF' : '#1E293B',
                        letterSpacing: '-0.05px',
                        lineHeight: '24px',
                      }}
                      dangerouslySetInnerHTML={{
                        __html: removeCitations(message.content).replace(
                          /\*\*(.*?)\*\*/g,
                          '<strong>$1</strong>'
                        ),
                      }}
                    />

                    {/* Show confidence and sources count for AI messages */}
                    {message.type === 'ai' && message.confidence !== undefined && (
                      <div className="mt-2 border-t border-gray-200 pt-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="rounded-full px-2 py-0.5 text-xs font-medium"
                            style={{
                              background: message.confidence > 0.7 ? '#DCFCE7' : message.confidence > 0.4 ? '#FEF9C3' : '#FEE2E2',
                              color: message.confidence > 0.7 ? '#166534' : message.confidence > 0.4 ? '#854D0E' : '#991B1B',
                            }}
                          >
                            {Math.round(message.confidence * 100)}% confidence
                          </span>
                          {message.sources && message.sources.length > 0 && (
                            <button
                              onClick={() => {
                                const newExpanded = new Set(expandedSources);
                                if (newExpanded.has(message.id)) {
                                  newExpanded.delete(message.id);
                                } else {
                                  newExpanded.add(message.id);
                                }
                                setExpandedSources(newExpanded);
                              }}
                              className="flex items-center gap-1 text-xs transition-colors hover:text-indigo-600"
                              style={{ color: '#4F46E5' }}
                            >
                              Based on {message.sources.length} sources
                              {expandedSources.has(message.id) ? (
                                <ChevronUp className="h-3 w-3" />
                              ) : (
                                <ChevronDown className="h-3 w-3" />
                              )}
                            </button>
                          )}
                        </div>

                        {/* Expandable source citations */}
                        {message.sources && message.sources.length > 0 && expandedSources.has(message.id) && (
                          <div className="mt-2 space-y-2 rounded-lg bg-gray-50 p-3">
                            <p className="text-xs font-medium" style={{ color: '#64748B' }}>Sources:</p>
                            {message.sources.map((source, idx) => (
                              <div
                                key={source.id || idx}
                                className="rounded border border-gray-200 bg-white p-2"
                              >
                                <div className="flex items-start gap-2">
                                  <span
                                    className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-xs font-medium"
                                    style={{ background: '#EEF2FF', color: '#4F46E5' }}
                                  >
                                    {idx + 1}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium" style={{ color: '#1E293B' }}>
                                      {source.title}
                                    </p>
                                    <p className="text-xs" style={{ color: '#64748B' }}>
                                      {source.type} • {Math.round((source.relevanceScore || 0) * 100)}% relevance
                                    </p>
                                    {source.description && (
                                      <p className="mt-1 text-xs" style={{ color: '#475569' }}>
                                        {source.description.length > 150
                                          ? `${source.description.slice(0, 150)}...`
                                          : source.description}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Suggested follow-up questions */}
                  {message.type === 'ai' && message.suggestedFollowUps && message.suggestedFollowUps.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {message.suggestedFollowUps.map((followUp, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleFollowUpClick(followUp)}
                          className="rounded-full px-3 py-1.5 text-sm transition-colors hover:bg-indigo-100"
                          style={{
                            background: '#EEF2FF',
                            color: '#4F46E5',
                            border: '1px solid #C7D2FE',
                          }}
                        >
                          {followUp}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* Loading indicator */}
              {isLoading && (
                <div className="flex justify-start">
                  <div
                    className="max-w-[500px] rounded-2xl px-3 py-3"
                    style={{ background: '#FAFAF9', border: '1px solid #E2E8F0' }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400" />
                      <div
                        className="h-2 w-2 animate-bounce rounded-full bg-gray-400"
                        style={{ animationDelay: '0.1s' }}
                      />
                      <div
                        className="h-2 w-2 animate-bounce rounded-full bg-gray-400"
                        style={{ animationDelay: '0.2s' }}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Area with Back Button */}
            <div className="px-6 py-6">
              <div className="flex items-end gap-4">
                {/* Back Button */}
                <button
                  onClick={onClose}
                  className="flex items-center gap-2 rounded-lg px-4 py-2.5 transition-colors hover:bg-gray-100"
                  style={{
                    border: '1px solid #E2E8F0',
                    background: '#FFFFFF',
                  }}
                >
                  <ArrowLeft className="h-5 w-5" style={{ color: '#64748B' }} />
                  <span
                    className="text-sm font-medium"
                    style={{ color: '#64748B' }}
                  >
                    Back
                  </span>
                </button>

                {/* Input Container */}
                <div
                  className="flex flex-1 flex-col gap-2.5 rounded-3xl p-4"
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    boxShadow:
                      '0px 12px 16px -4px rgba(16, 24, 40, 0.08), 0px 4px 6px -2px rgba(16, 24, 40, 0.03)',
                  }}
                >
                  {/* Input row */}
                  <div className="flex items-center gap-2">
                    <Paperclip className="h-6 w-6" style={{ color: '#94A3B8' }} />
                    <input
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Message to Lighthouse AI ..."
                      className="flex-1 text-base outline-none"
                      style={{
                        color: '#1E293B',
                        letterSpacing: '-0.05px',
                        lineHeight: '24px',
                      }}
                    />
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center justify-end gap-4">
                    {/* Mic button */}
                    <button
                      className="flex h-[42px] w-[42px] items-center justify-center rounded-lg"
                      style={{
                        background: '#FFFFFF',
                        boxShadow:
                          '0px 2px 5px rgba(103, 110, 118, 0.08), 0px 0px 0px 1px rgba(103, 110, 118, 0.16), 0px 1px 1px rgba(0, 0, 0, 0.12)',
                      }}
                    >
                      <Mic className="h-[18px] w-[18px]" />
                    </button>

                    {/* Send button */}
                    <button
                      onClick={handleSendMessage}
                      disabled={!inputValue.trim() || isLoading}
                      className="flex items-center gap-2 rounded-lg px-4 py-2.5"
                      style={{
                        background: inputValue.trim() && !isLoading ? '#4F46E5' : '#A5B4FC',
                      }}
                    >
                      <span
                        className="text-base"
                        style={{
                          color: '#FFFFFF',
                          letterSpacing: '-0.05px',
                          lineHeight: '24px',
                        }}
                      >
                        Send
                      </span>
                      <Send className="h-5 w-5" style={{ color: '#FFFFFF' }} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Exported wrapper component with error boundary
export function WorkflowAnalysisChatModal(props: WorkflowAnalysisChatModalProps) {
  // Don't render anything if not open - prevents unnecessary hook calls
  if (!props.isOpen) return null;

  return (
    <ChatModalErrorBoundary onReset={props.onClose}>
      <WorkflowAnalysisChatModalContent {...props} />
    </ChatModalErrorBoundary>
  );
}
