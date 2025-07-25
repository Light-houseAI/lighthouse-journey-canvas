import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isTemporary?: boolean;
}

export type ConversationState = 
  | 'initial' 
  | 'awaiting_update' 
  | 'awaiting_confirmation' 
  | 'confirmed' 
  | 'adding_milestone' 
  | 'confirming_updates' 
  | 'time_selection' 
  | 'quick_update' 
  | 'detailed_star';

export type TimeFrame = 'quick' | 'standard' | 'detailed' | null;

interface MilestoneContext {
  parentNodeId?: string;
  parentTitle?: string;
  parentOrganization?: string;
  step?: 'situation' | 'task' | 'action' | 'result';
  situation?: string;
  task?: string;
  action?: string;
  initialDescription?: string;
}

interface ChatState {
  // Chat state
  messages: ChatMessage[];
  currentMessage: ChatMessage | null;
  isProcessing: boolean;
  textInput: string;
  
  // Conversation flow state
  conversationState: ConversationState;
  selectedTimeFrame: TimeFrame;
  onboardingStep: number;
  isOnboardingComplete: boolean;
  
  // Milestone creation state
  addingMilestoneContext: MilestoneContext | null;
  pendingUpdates: any[];
  
  // UI state
  isOpen: boolean;
  isMinimized: boolean;
  
  // Actions - Message Management
  addMessage: (type: 'user' | 'assistant', content: string, temporary?: boolean) => void;
  setCurrentMessage: (message: ChatMessage | null) => void;
  clearMessages: () => void;
  updateMessageContent: (messageId: string, content: string) => void;
  
  // Actions - Input Management
  setTextInput: (input: string) => void;
  submitMessage: () => Promise<void>;
  
  // Actions - Conversation Flow
  setConversationState: (state: ConversationState) => void;
  setSelectedTimeFrame: (timeFrame: TimeFrame) => void;
  setOnboardingStep: (step: number) => void;
  setIsOnboardingComplete: (complete: boolean) => void;
  
  // Actions - Milestone Creation
  setAddingMilestoneContext: (context: MilestoneContext | null) => void;
  updateMilestoneContext: (updates: Partial<MilestoneContext>) => void;
  setPendingUpdates: (updates: any[]) => void;
  
  // Actions - UI Control
  setIsOpen: (open: boolean) => void;
  setIsMinimized: (minimized: boolean) => void;
  setIsProcessing: (processing: boolean) => void;
  
  // Actions - API Integration
  sendMessageToAI: (message: string) => Promise<void>;
  handleOnboardingWithAI: (message: string) => Promise<void>;
  handleStreamingResponse: (message: string) => Promise<void>;
  
  // Actions - Utilities
  reset: () => void;
  initializeWelcomeMessage: (userData: any, profileData: any) => void;
}

export const useChatStore = create<ChatState>()(
  devtools(
    immer((set, get) => ({
      // Initial state
      messages: [],
      currentMessage: null,
      isProcessing: false,
      textInput: '',
      
      conversationState: 'initial',
      selectedTimeFrame: null,
      onboardingStep: 1,
      isOnboardingComplete: false,
      
      addingMilestoneContext: null,
      pendingUpdates: [],
      
      isOpen: false,
      isMinimized: false,

      // Message Management Actions
      addMessage: (type, content, temporary = false) => set((state) => {
        const message: ChatMessage = {
          id: `${Date.now()}-${Math.random()}`,
          type,
          content,
          timestamp: new Date(),
          isTemporary: temporary
        };
        
        state.messages.push(message);
        state.currentMessage = message;
        
        if (temporary) {
          // Auto-clear current message after 8 seconds
          setTimeout(() => {
            set((state) => {
              state.currentMessage = null;
            });
          }, 8000);
        }
      }),

      setCurrentMessage: (message) => set((state) => {
        state.currentMessage = message;
      }),

      clearMessages: () => set((state) => {
        state.messages = [];
        state.currentMessage = null;
      }),

      updateMessageContent: (messageId, content) => set((state) => {
        const messageIndex = state.messages.findIndex(m => m.id === messageId);
        if (messageIndex !== -1) {
          state.messages[messageIndex].content = content;
        }
        
        if (state.currentMessage?.id === messageId) {
          state.currentMessage.content = content;
        }
      }),

      // Input Management Actions
      setTextInput: (input) => set((state) => {
        state.textInput = input;
      }),

      submitMessage: async () => {
        const { textInput, addMessage, sendMessageToAI } = get();
        
        if (!textInput.trim()) return;
        
        addMessage('user', textInput);
        const messageToSend = textInput;
        
        set((state) => {
          state.textInput = '';
        });
        
        await sendMessageToAI(messageToSend);
      },

      // Conversation Flow Actions
      setConversationState: (state) => set((draft) => {
        draft.conversationState = state;
      }),

      setSelectedTimeFrame: (timeFrame) => set((state) => {
        state.selectedTimeFrame = timeFrame;
      }),

      setOnboardingStep: (step) => set((state) => {
        state.onboardingStep = step;
      }),

      setIsOnboardingComplete: (complete) => set((state) => {
        state.isOnboardingComplete = complete;
      }),

      // Milestone Creation Actions
      setAddingMilestoneContext: (context) => set((state) => {
        state.addingMilestoneContext = context;
      }),

      updateMilestoneContext: (updates) => set((state) => {
        if (state.addingMilestoneContext) {
          state.addingMilestoneContext = { ...state.addingMilestoneContext, ...updates };
        }
      }),

      setPendingUpdates: (updates) => set((state) => {
        state.pendingUpdates = updates;
      }),

      // UI Control Actions
      setIsOpen: (open) => set((state) => {
        state.isOpen = open;
      }),

      setIsMinimized: (minimized) => set((state) => {
        state.isMinimized = minimized;
      }),

      setIsProcessing: (processing) => set((state) => {
        state.isProcessing = processing;
      }),

      // API Integration Actions
      sendMessageToAI: async (message) => {
        const { 
          setIsProcessing, 
          addMessage, 
          conversationState, 
          isOnboardingComplete,
          handleOnboardingWithAI,
          handleStreamingResponse 
        } = get();
        
        try {
          setIsProcessing(true);
          
          if (!isOnboardingComplete) {
            await handleOnboardingWithAI(message);
          } else {
            await handleStreamingResponse(message);
          }
        } catch (error) {
          console.error('AI processing error:', error);
          addMessage('assistant', 'I apologize, but I encountered an error. Please try again.');
        } finally {
          setIsProcessing(false);
        }
      },

      handleOnboardingWithAI: async (message) => {
        const { onboardingStep, setOnboardingStep, setIsOnboardingComplete, addMessage } = get();
        
        try {
          const response = await fetch('/api/ai/onboard', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              step: onboardingStep,
              message,
            }),
          });

          if (!response.ok) {
            throw new Error('Onboarding request failed');
          }

          const data = await response.json();
          
          addMessage('assistant', data.message, false);
          setOnboardingStep(data.step);
          setIsOnboardingComplete(data.isComplete);
        } catch (error) {
          console.error('Onboarding error:', error);
          addMessage('assistant', 'I encountered an issue during onboarding. Please try again.');
        }
      },

      handleStreamingResponse: async (message) => {
        const { addMessage, updateMessageContent } = get();
        
        try {
          const response = await fetch('/api/ai/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ message }),
          });

          if (!response.ok) {
            throw new Error('Chat request failed');
          }

          // Handle streaming response
          const reader = response.body?.getReader();
          const decoder = new TextDecoder();
          let assistantMessage = '';
          const assistantMessageId = `assistant-${Date.now()}`;

          // Create initial assistant message
          addMessage('assistant', '', false);
          const messages = get().messages;
          const lastMessage = messages[messages.length - 1];

          while (reader) {
            const { value, done } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  
                  if (data.type === 'text') {
                    assistantMessage += data.content;
                    updateMessageContent(lastMessage.id, assistantMessage);
                  }
                } catch (e) {
                  console.error('Failed to parse SSE data:', e);
                }
              }
            }
          }
        } catch (error) {
          console.error('Streaming response error:', error);
          addMessage('assistant', 'I apologize, but I encountered an error. Please try again.');
        }
      },

      // Utility Actions
      reset: () => set((state) => {
        state.messages = [];
        state.currentMessage = null;
        state.conversationState = 'initial';
        state.selectedTimeFrame = null;
        state.addingMilestoneContext = null;
        state.pendingUpdates = [];
        state.textInput = '';
        state.isProcessing = false;
      }),

      initializeWelcomeMessage: (userData, profileData) => {
        const { addMessage, setIsOnboardingComplete } = get();
        
        const isOnboardingCompleted = userData?.hasCompletedOnboarding === true;
        setIsOnboardingComplete(isOnboardingCompleted);
        
        if (!isOnboardingCompleted) {
          const welcomeMessage = `Welcome! I can see you're currently a **${profileData?.experiences?.[0]?.title}** at **${profileData?.experiences?.[0]?.company}** - is that correct?

I'm here to help you track your career progress and capture your achievements. Let's get started!`;
          
          addMessage('assistant', welcomeMessage, false);
        } else {
          // Generate contextual welcome for returning users
          const name = profileData?.filteredData?.name || '';
          const welcomeMessage = `Welcome back${name ? `, ${name}` : ''}! Ready for a career check-in?

How much time do you have today?
• **Quick** (2-3 minutes) - Share a brief update
• **Standard** (5-7 minutes) - Discuss recent progress  
• **Detailed** (10+ minutes) - Build comprehensive STAR stories

Or tell me directly what you'd like to update me on!`;
          
          addMessage('assistant', welcomeMessage, false);
        }
      },
    })),
    { name: 'chat-store' }
  )
);