/**
 * Chat UI Store
 *
 * Manages UI state ONLY for the chat interface.
 * Server state (messages, workflow state) is managed by TanStack Query hooks in useChat.ts
 *
 * UI State includes:
 * - Input: textInput, isTyping
 * - Panel: isOpen, isMinimized
 * - Display: currentMessage (for temporary UI feedback)
 *
 * Pattern:
 * - Use this store for UI interactions (typing indicators, panel state, input)
 * - Use useChat hooks for data operations (send messages, onboarding, resume workflow)
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// ============================================================================
// Types
// ============================================================================

export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isTemporary?: boolean;
}

export interface ChatUIState {
  // Input state
  textInput: string;
  isTyping: boolean;

  // Panel state
  isOpen: boolean;
  isMinimized: boolean;

  // Current message (for temporary UI feedback)
  currentMessage: ChatMessage | null;

  // Input actions
  setTextInput: (input: string) => void;
  setIsTyping: (typing: boolean) => void;
  clearInput: () => void;

  // Panel actions
  setIsOpen: (open: boolean) => void;
  setIsMinimized: (minimized: boolean) => void;
  togglePanel: () => void;
  openPanel: () => void;
  closePanel: () => void;

  // Current message actions
  setCurrentMessage: (message: ChatMessage | null) => void;
  showTemporaryMessage: (
    type: 'user' | 'assistant',
    content: string,
    duration?: number
  ) => void;
  clearCurrentMessage: () => void;

  // Reset
  reset: () => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState = {
  textInput: '',
  isTyping: false,
  isOpen: false,
  isMinimized: false,
  currentMessage: null,
};

// ============================================================================
// Store
// ============================================================================

export const useChatStore = create<ChatUIState>()(
  devtools(
    immer((set, get) => ({
      // Initial state
      ...initialState,

      // ========================================================================
      // Input Actions
      // ========================================================================

      setTextInput: (input: string) => {
        set({ textInput: input });
      },

      setIsTyping: (typing: boolean) => {
        set({ isTyping: typing });
      },

      clearInput: () => {
        set({ textInput: '' });
        console.log('🧹 Input cleared');
      },

      // ========================================================================
      // Panel Actions
      // ========================================================================

      setIsOpen: (open: boolean) => {
        set({ isOpen: open });
        console.log(open ? '💬 Chat opened' : '💬 Chat closed');
      },

      setIsMinimized: (minimized: boolean) => {
        set({ isMinimized: minimized });
        console.log(minimized ? '📉 Chat minimized' : '📈 Chat restored');
      },

      togglePanel: () => {
        const { isOpen } = get();
        set({ isOpen: !isOpen });
        console.log(isOpen ? '💬 Chat closed' : '💬 Chat opened');
      },

      openPanel: () => {
        set({ isOpen: true, isMinimized: false });
        console.log('💬 Chat opened');
      },

      closePanel: () => {
        set({ isOpen: false });
        console.log('💬 Chat closed');
      },

      // ========================================================================
      // Current Message Actions
      // ========================================================================

      setCurrentMessage: (message: ChatMessage | null) => {
        set({ currentMessage: message });
      },

      showTemporaryMessage: (
        type: 'user' | 'assistant',
        content: string,
        duration = 8000
      ) => {
        const message: ChatMessage = {
          id: `${Date.now()}-${Math.random()}`,
          type,
          content,
          timestamp: new Date(),
          isTemporary: true,
        };

        set({ currentMessage: message });
        console.log('💬 Temporary message shown:', content.substring(0, 50));

        // Auto-clear after duration
        setTimeout(() => {
          const current = get().currentMessage;
          if (current?.id === message.id) {
            set({ currentMessage: null });
            console.log('🧹 Temporary message cleared');
          }
        }, duration);
      },

      clearCurrentMessage: () => {
        set({ currentMessage: null });
        console.log('🧹 Current message cleared');
      },

      // ========================================================================
      // Reset
      // ========================================================================

      reset: () => {
        set(initialState);
        console.log('🔄 Chat UI state reset');
      },
    })),
    {
      name: 'chat-ui-store',
    }
  )
);
