import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaRobot,
  FaUser,
  FaPaperPlane,
  FaTimes,
  FaMicrophone,
  FaComment
} from 'react-icons/fa';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth-store';
import { useHierarchyStore } from '@/stores/hierarchy-store';
import { useTheme } from '@/contexts/ThemeContext';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isProcessing?: boolean;
}

interface NaaviChatProps {
  onMilestoneAdded?: (milestone: any) => void;
  onMilestoneUpdated?: (nodeId: string, update: any) => void;
  onNodeDeleted?: (nodeId: string) => void;
  onAddMilestone?: (parentNodeId: string, subMilestone: any) => void;
  isOpen?: boolean;
  onClose?: () => void;
  initialMessage?: string;
  context?: {
    insertionPoint?: string;
    parentNode?: any;
    targetNode?: any;
    availableTypes?: string[];
  };
}

export const NaaviChat: React.FC<NaaviChatProps> = ({
  onMilestoneAdded,
  onMilestoneUpdated,
  onNodeDeleted,
  onAddMilestone,
  isOpen: propIsOpen,
  onClose,
  initialMessage,
  context
}) => {
  // Chat state - use prop isOpen if provided, otherwise internal state
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = propIsOpen !== undefined ? propIsOpen : internalIsOpen;
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [threadId, setThreadId] = useState<string | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Store access
  const { user } = useAuthStore();
  const { loadNodes } = useHierarchyStore();
  const { theme } = useTheme();

  // Refs for scrolling
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);

  // Initialize chat when opened
  useEffect(() => {
    if (isOpen && !hasInitialized && user?.id) {
      initializeChat();
    }
  }, [isOpen, user?.id]);

  // Handle initial message when provided
  useEffect(() => {
    if (initialMessage && isOpen && hasInitialized) {
      const initialMsg: Message = {
        id: `msg-${Date.now()}-initial`,
        type: 'user',
        content: initialMessage,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, initialMsg]);
      
      // Auto-send the initial message
      setTimeout(() => {
        handleSendMessage(initialMessage, true);
      }, 500);
    }
  }, [initialMessage, isOpen, hasInitialized]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (!isUserScrolling) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isUserScrolling]);

  const initializeChat = async () => {
    try {
      setIsProcessing(true);
      const response = await fetch('/api/ai/chat/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setThreadId(data.threadId);
        setHasInitialized(true);

        // Add welcome message
        const welcomeMessage: Message = {
          id: `msg-${Date.now()}`,
          type: 'assistant',
          content: "Hi! I'm here to help you manage your professional journey. Feel free to ask me anything about your experiences, or let me know if you'd like to add new milestones!",
          timestamp: new Date()
        };
        setMessages([welcomeMessage]);
      }
    } catch (error) {
      console.error('Failed to initialize chat:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendMessage = async (messageToSend?: string, skipUserMessage?: boolean) => {
    const messageText = messageToSend || textInput.trim();
    if (!messageText || isProcessing) return;

    // Add user message if not skipped (for initial messages)
    if (!skipUserMessage) {
      const userMessage: Message = {
        id: `msg-${Date.now()}`,
        type: 'user',
        content: messageText,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, userMessage]);
    }
    
    setTextInput('');
    setIsProcessing(true);

    try {
      const response = await fetch('/api/ai/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: messageText,
          threadId,
          userId: user?.id?.toString() || '',
          context: context // Pass timeline context to AI
        })
      });

      if (response.ok) {
        const data = await response.json();

        const assistantMessage: Message = {
          id: `msg-${Date.now()}-assistant`,
          type: 'assistant',
          content: data.message || 'I received your message!',
          timestamp: new Date()
        };

        setMessages(prev => [...prev, assistantMessage]);

        // Handle automatic milestone creation
        if (data.milestoneCreated || data.updatedProfile) {
          console.log('🎯 AI created/updated milestone, refreshing timeline');
          loadNodes();
          
          // If onMilestoneAdded callback is provided, call it
          if (data.milestoneAdded && onMilestoneAdded) {
            onMilestoneAdded(data.milestoneAdded);
          }
          
          // Show success feedback in chat
          if (data.milestoneCreated) {
            setTimeout(() => {
              const successMessage: Message = {
                id: `msg-${Date.now()}-success`,
                type: 'assistant',
                content: '✅ I\'ve automatically added this to your timeline! You can see it updated above.',
                timestamp: new Date()
              };
              setMessages(prev => [...prev, successMessage]);
            }, 1000);
          }
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      const errorMessage: Message = {
        id: `msg-${Date.now()}-error`,
        type: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <>
      {/* Chat Button - Bottom Right */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed bottom-6 right-4 z-50"
          >
            <motion.button
              whileHover={{ scale: 1.1, boxShadow: "0 0 50px rgba(16, 185, 129, 0.4)" }}
              whileTap={{ scale: 0.95 }}
              onClick={() => propIsOpen !== undefined ? onClose?.() : setInternalIsOpen(true)}
              className="w-16 h-16 rounded-full bg-gradient-to-r from-[#10B981] to-[#06b6d4] shadow-xl hover:shadow-2xl flex items-center justify-center transition-all duration-300 ease-in-out"
            >
              <FaMicrophone className="w-5 h-5 text-white" />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Overlay - Bottom Right */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: 400, y: 100 }}
            animate={{
              opacity: 1,
              x: 0,
              y: 0,
              width: isMinimized ? 320 : 400,
              height: isMinimized ? 60 : 500
            }}
            exit={{ opacity: 0, x: 400, y: 100 }}
            className={`fixed bottom-6 right-4 z-50 ${theme.cardBackground} backdrop-blur-sm ${theme.accentBorder} rounded-2xl ${theme.cardShadow} overflow-hidden`}
          >
            {/* Header */}
            <div className={`flex items-center justify-between p-4 border-b ${theme.accentBorder}`}>
              <div className="flex items-center gap-2">
                <FaComment className={`w-4 h-4 ${theme.secondaryText}`} />
                <span className={`${theme.primaryText} font-medium`}>Career Assistant</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setIsMinimized(!isMinimized)}
                  variant="ghost"
                  size="sm"
                  className={`w-8 h-8 p-0 ${theme.secondaryText} ${theme.hover}`}
                >
                  {isMinimized ? '□' : '−'}
                </Button>
                <Button
                  onClick={() => propIsOpen !== undefined ? onClose?.() : setInternalIsOpen(false)}
                  variant="ghost"
                  size="sm"
                  className={`w-8 h-8 p-0 ${theme.secondaryText} ${theme.hover}`}
                >
                  <FaTimes className="w-3 h-3" />
                </Button>
              </div>
            </div>

            {/* Chat Content */}
            {!isMinimized && (
              <>
                {/* Messages */}
                <div
                  className="flex-1 p-4 overflow-y-auto max-h-80 space-y-3"
                  onScroll={(e) => {
                    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
                    setIsUserScrolling(scrollTop < scrollHeight - clientHeight - 50);
                  }}
                >
                  {messages.map(message => (
                    <div
                      key={message.id}
                      className={`flex items-start gap-3 ${
                        message.type === 'user' ? 'flex-row-reverse' : 'flex-row'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        message.type === 'user'
                          ? 'bg-purple-600'
                          : 'bg-gray-200'
                      }`}>
                        {message.type === 'user' ? (
                          <FaUser className="w-3 h-3 text-white" />
                        ) : (
                          <FaRobot className={`w-3 h-3 ${theme.secondaryText}`} />
                        )}
                      </div>
                      <div className={`max-w-[280px] p-3 rounded-lg ${
                        message.type === 'user'
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {message.content}
                        </p>
                        <p className="text-xs mt-1 opacity-70">
                          {message.timestamp.toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                  ))}

                  {isProcessing && (
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                        <FaRobot className="w-3 h-3 text-purple-600" />
                      </div>
                      <div className="bg-gray-100 p-3 rounded-lg">
                        <div className="flex space-x-1">
                          <div className={`w-2 h-2 ${theme.secondaryText} rounded-full animate-bounce`} style={{ animationDelay: '0ms' }}></div>
                          <div className={`w-2 h-2 ${theme.secondaryText} rounded-full animate-bounce`} style={{ animationDelay: '150ms' }}></div>
                          <div className={`w-2 h-2 ${theme.secondaryText} rounded-full animate-bounce`} style={{ animationDelay: '300ms' }}></div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className={`p-4 border-t ${theme.accentBorder}`}>
                  <div className="flex gap-2">
                    <textarea
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Ask about your career or add new experiences..."
                      className={`flex-1 ${theme.inputBackground} ${theme.primaryText} placeholder:${theme.placeholderText} ${theme.accentBorder} border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-purple-500 transition-colors`}
                      rows={1}
                      disabled={isProcessing}
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={!textInput.trim() || isProcessing}
                      className={`bg-purple-600 hover:bg-purple-700 text-white p-2 disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <FaPaperPlane className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
