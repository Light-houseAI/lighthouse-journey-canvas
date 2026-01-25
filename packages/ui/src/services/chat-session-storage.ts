/**
 * Chat Session Storage Service
 *
 * Persists chat sessions to localStorage for conversation history
 * Generates summarized titles for chat sessions (3-5 words) using LLM
 */

import type { RetrievedSource } from './workflow-api';
import { generateChatTitle as generateChatTitleAPI } from './workflow-api';

export interface ChatMessage {
  id: string;
  type: 'ai' | 'user';
  content: string;
  timestamp: string;
  sources?: RetrievedSource[];
  confidence?: number;
  suggestedFollowUps?: string[];
}

export interface ChatSession {
  id: string;
  title: string;
  nodeId: string;
  chatType: 'weekly-progress' | 'workflow-analysis' | 'track-analysis' | 'insight-assistant';
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY_PREFIX = 'lighthouse-chat-sessions';

/**
 * Generate a storage key for a specific user/node
 */
function getStorageKey(nodeId: string, chatType: string): string {
  return `${STORAGE_KEY_PREFIX}-${chatType}-${nodeId}`;
}

/**
 * Generate a summarized title (3-5 words) from the first user message
 * Uses simple extraction of key topics from the message
 */
export function generateSessionTitle(messages: ChatMessage[]): string {
  // Find first user message
  const firstUserMessage = messages.find((m) => m.type === 'user');
  if (!firstUserMessage) {
    return 'New conversation';
  }

  const content = firstUserMessage.content.trim();

  // Remove common question words and clean up
  const cleanedContent = content
    .replace(/^(what|how|why|when|where|who|which|can you|could you|please|help me|show me|tell me|i want to|i need to|i'd like to|are my|is my|do i|did i|have i)\s+/gi, '')
    .replace(/[?!.,;:'"]+$/g, '')
    .trim();

  // Split into words and take first 3-6 meaningful words
  const words = cleanedContent.split(/\s+/).filter((word) => word.length > 0);
  const titleWords = words.slice(0, 6);

  if (titleWords.length === 0) {
    return 'New conversation';
  }

  // Capitalize first letter
  let title = titleWords.join(' ');
  title = title.charAt(0).toUpperCase() + title.slice(1);

  return title;
}

/**
 * Get all chat sessions for a specific node and chat type
 */
export function getChatSessions(nodeId: string, chatType: 'weekly-progress' | 'workflow-analysis' | 'track-analysis' | 'insight-assistant'): ChatSession[] {
  try {
    const key = getStorageKey(nodeId, chatType);
    const stored = localStorage.getItem(key);
    if (!stored) {
      return [];
    }
    const sessions: ChatSession[] = JSON.parse(stored);
    // Sort by updatedAt descending (most recent first)
    return sessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  } catch (error) {
    console.error('[ChatSessionStorage] Failed to get sessions:', error);
    return [];
  }
}

/**
 * Get a specific chat session by ID
 */
export function getChatSession(
  nodeId: string,
  chatType: 'weekly-progress' | 'workflow-analysis' | 'track-analysis' | 'insight-assistant',
  sessionId: string
): ChatSession | null {
  const sessions = getChatSessions(nodeId, chatType);
  return sessions.find((s) => s.id === sessionId) || null;
}

/**
 * Create a new chat session
 */
export function createChatSession(
  nodeId: string,
  chatType: 'weekly-progress' | 'workflow-analysis' | 'track-analysis' | 'insight-assistant',
  initialMessages: ChatMessage[] = []
): ChatSession {
  const now = new Date().toISOString();
  const session: ChatSession = {
    id: `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    title: 'New conversation',
    nodeId,
    chatType,
    messages: initialMessages,
    createdAt: now,
    updatedAt: now,
  };

  // Save immediately
  saveChatSession(session);

  return session;
}

/**
 * Save/update a chat session
 */
export function saveChatSession(session: ChatSession): void {
  try {
    const key = getStorageKey(session.nodeId, session.chatType);
    const sessions = getChatSessions(session.nodeId, session.chatType);

    // Update timestamp
    session.updatedAt = new Date().toISOString();

    // Update title if we have user messages and title is still default
    const userMessages = session.messages.filter((m) => m.type === 'user');
    if (userMessages.length > 0 && session.title === 'New conversation') {
      session.title = generateSessionTitle(session.messages);
    }

    // Find and update existing or add new
    const existingIndex = sessions.findIndex((s) => s.id === session.id);
    if (existingIndex >= 0) {
      sessions[existingIndex] = session;
    } else {
      sessions.unshift(session);
    }

    // Keep only last 50 sessions
    const trimmedSessions = sessions.slice(0, 50);

    localStorage.setItem(key, JSON.stringify(trimmedSessions));
  } catch (error) {
    console.error('[ChatSessionStorage] Failed to save session:', error);
  }
}

/**
 * Delete a chat session
 */
export function deleteChatSession(
  nodeId: string,
  chatType: 'weekly-progress' | 'workflow-analysis' | 'track-analysis' | 'insight-assistant',
  sessionId: string
): void {
  try {
    const key = getStorageKey(nodeId, chatType);
    const sessions = getChatSessions(nodeId, chatType);
    const filtered = sessions.filter((s) => s.id !== sessionId);
    localStorage.setItem(key, JSON.stringify(filtered));
  } catch (error) {
    console.error('[ChatSessionStorage] Failed to delete session:', error);
  }
}

/**
 * Add a message to a chat session
 */
export function addMessageToSession(
  session: ChatSession,
  message: Omit<ChatMessage, 'id' | 'timestamp'>
): ChatSession {
  const newMessage: ChatMessage = {
    ...message,
    id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    timestamp: new Date().toISOString(),
  };

  session.messages.push(newMessage);

  // Update title after first user message
  const userMessages = session.messages.filter((m) => m.type === 'user');
  if (userMessages.length === 1 && message.type === 'user') {
    session.title = generateSessionTitle(session.messages);
  }

  saveChatSession(session);

  return session;
}

/**
 * Clear all chat sessions for a node/type
 */
export function clearAllChatSessions(nodeId: string, chatType: 'weekly-progress' | 'workflow-analysis' | 'track-analysis' | 'insight-assistant'): void {
  try {
    const key = getStorageKey(nodeId, chatType);
    localStorage.removeItem(key);
  } catch (error) {
    console.error('[ChatSessionStorage] Failed to clear sessions:', error);
  }
}

/**
 * Generate a chat session title using LLM (Gemini)
 * This is async and should be called after the session has user messages
 * Returns the generated title and updates the session in storage
 */
export async function generateSessionTitleWithLLM(
  session: ChatSession
): Promise<string> {
  const userMessages = session.messages.filter((m) => m.type === 'user');

  // Only generate if we have user messages and title is still default
  if (userMessages.length === 0 || session.title !== 'New conversation') {
    return session.title;
  }

  try {
    // Call the LLM API to generate title
    const title = await generateChatTitleAPI({
      messages: session.messages.map((m) => ({
        type: m.type,
        content: m.content,
      })),
      chatType: session.chatType,
    });

    // Update session with new title
    session.title = title;
    saveChatSession(session);

    return title;
  } catch (error) {
    console.error('[ChatSessionStorage] Failed to generate LLM title:', error);
    // Fall back to simple extraction
    const fallbackTitle = generateSessionTitle(session.messages);
    session.title = fallbackTitle;
    saveChatSession(session);
    return fallbackTitle;
  }
}

/**
 * Update session title using LLM if it's still the default
 * This is a fire-and-forget function that updates the title in the background
 */
export function updateSessionTitleAsync(
  session: ChatSession,
  onTitleUpdated?: (title: string) => void
): void {
  const userMessages = session.messages.filter((m) => m.type === 'user');

  // Only generate if we have user messages and title is still default
  if (userMessages.length === 0 || session.title !== 'New conversation') {
    return;
  }

  // Fire and forget - generate title in background
  generateSessionTitleWithLLM(session)
    .then((title) => {
      if (onTitleUpdated) {
        onTitleUpdated(title);
      }
    })
    .catch((error) => {
      console.error('[ChatSessionStorage] Background title generation failed:', error);
    });
}
