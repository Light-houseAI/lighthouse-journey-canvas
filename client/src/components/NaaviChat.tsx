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
import { useAuth } from '@/hooks/useAuth';
import { useDataStore } from '@/stores/data-store';

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
}

export const NaaviChat: React.FC<NaaviChatProps> = ({
  onMilestoneAdded,
  onMilestoneUpdated,
  onNodeDeleted,
  onAddMilestone
}) => {
  // Chat state
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [threadId, setThreadId] = useState<string | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Store access
  const { user } = useAuth();
  const { refreshProfileData } = useDataStore();

  // Refs for scrolling
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);

  // Initialize chat when opened
  useEffect(() => {
    if (isOpen && !hasInitialized && user?.id) {
      initializeChat();
    }
  }, [isOpen, user?.id]);

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

  const handleSendMessage = async () => {
    if (!textInput.trim() || isProcessing) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      type: 'user',
      content: textInput,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setTextInput('');
    setIsProcessing(true);

    try {
      const response = await fetch('/api/ai/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: textInput,
          threadId,
          userId: user?.id?.toString() || '',
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

        // Handle any milestone updates
        if (data.milestoneAdded && onMilestoneAdded) {
          onMilestoneAdded(data.milestoneAdded);
          refreshProfileData();
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
            className="fixed bottom-4 right-4 z-50"
          >
            <motion.button
              whileHover={{ scale: 1.1, boxShadow: "0 0 50px rgba(168, 85, 247, 0.8)" }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsOpen(true)}
              className="w-14 h-14 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 shadow-xl hover:shadow-2xl flex items-center justify-center transition-all duration-300 ease-in-out"
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
            className="fixed bottom-4 right-4 z-50 bg-slate-900/95 backdrop-blur-sm border border-purple-500/30 rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-purple-500/20">
              <div className="flex items-center gap-2">
                <FaComment className="w-4 h-4 text-purple-400" />
                <span className="text-white font-medium">Career Assistant</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setIsMinimized(!isMinimized)}
                  variant="ghost"
                  size="sm"
                  className="w-8 h-8 p-0 text-purple-300 hover:text-white hover:bg-purple-500/20"
                >
                  {isMinimized ? '□' : '−'}
                </Button>
                <Button
                  onClick={() => setIsOpen(false)}
                  variant="ghost"
                  size="sm"
                  className="w-8 h-8 p-0 text-purple-300 hover:text-white hover:bg-purple-500/20"
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
                          : 'bg-slate-700'
                      }`}>
                        {message.type === 'user' ? (
                          <FaUser className="w-3 h-3 text-white" />
                        ) : (
                          <FaRobot className="w-3 h-3 text-purple-300" />
                        )}
                      </div>
                      <div className={`max-w-[280px] p-3 rounded-lg ${
                        message.type === 'user'
                          ? 'bg-purple-600 text-white'
                          : 'bg-slate-800 text-purple-100'
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
                      <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                        <FaRobot className="w-3 h-3 text-purple-300" />
                      </div>
                      <div className="bg-slate-800 p-3 rounded-lg">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                          <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                          <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-4 border-t border-purple-500/20">
                  <div className="flex gap-2">
                    <textarea
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Ask about your career or add new experiences..."
                      className="flex-1 bg-slate-800 text-white placeholder-purple-300/60 border border-purple-500/30 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-purple-400 transition-colors"
                      rows={1}
                      disabled={isProcessing}
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={!textInput.trim() || isProcessing}
                      className="bg-purple-600 hover:bg-purple-700 text-white p-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
