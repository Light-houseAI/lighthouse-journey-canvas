import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaRobot,
  FaUser,
  FaPaperPlane,
  FaTimes
} from 'react-icons/fa';
import { Button } from '@/components/ui/button';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isProcessing?: boolean;
}

interface OverlayChatProps {
  isOpen: boolean;
  isMinimized?: boolean;
  onClose: () => void;
  onMinimize?: () => void;
  onOpen?: () => void; // New prop for opening chat
  onMilestoneAdded: (milestone: any) => void;
  onMilestoneUpdated?: (nodeId: string, update: any) => void;
  onNodeDeleted?: (nodeId: string) => void;
  onAddMilestone?: (parentNodeId: string, subMilestone: any) => void;
  onProfileUpdated?: () => void; // New callback for profile updates
  userId: string;
}

const OverlayChat: React.FC<OverlayChatProps> = ({
  isOpen,
  isMinimized = false,
  onClose,
  onMinimize,
  onOpen,
  onMilestoneAdded,
  onMilestoneUpdated,
  onNodeDeleted,
  onAddMilestone,
  onProfileUpdated,
  userId
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [threadId, setThreadId] = useState<string | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);
  
  // Workflow suspension state
  const [isSuspended, setIsSuspended] = useState(false);
  const [suspensionId, setSuspensionId] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [suspendedStep, setSuspendedStep] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);

  // Initialize chat and fetch context when opened
  useEffect(() => {
    if (isOpen && !hasInitialized && userId) {
      initializeChat();
    }
  }, [isOpen, userId]);

  // Initialize chat with proper backend context
  const initializeChat = async () => {
    try {
      setHasInitialized(true);
      
      // Import profile data to vector storage if needed
      await fetch('/api/ai/import-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      // Get initial context and generate welcome message through AI
      const welcomeMessage = "Hello! I'm your AI career assistant. What would you like to discuss today? I can help you:\n\n• Add new achievements or milestones\n• Update existing career information\n• Track skills and progress\n• Build STAR stories for your experiences\n\nJust tell me what's on your mind!";
      
      showMessage('assistant', welcomeMessage);
    } catch (error) {
      console.error('Error initializing chat:', error);
      showMessage('assistant', "Welcome! I'm here to help track your career journey. What would you like to discuss?");
    }
  };

  // Handle simple chat integration events
  useEffect(() => {
    const handleAddChatMessage = (event: CustomEvent) => {
      const { message } = event.detail;
      showMessage('user', message);
      processUserMessage(message);
    };

    const handleOpenChat = () => {
      if (onOpen) {
        onOpen();
      }
    };

    window.addEventListener('addChatMessage', handleAddChatMessage as EventListener);
    window.addEventListener('openChat', handleOpenChat as EventListener);
    
    return () => {
      window.removeEventListener('addChatMessage', handleAddChatMessage as EventListener);
      window.removeEventListener('openChat', handleOpenChat as EventListener);
    };
  }, []);

  // Handle scroll behavior to detect user scrolling
  const handleScroll = () => {
    if (!messagesContainerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 20; // 20px threshold
    
    setIsUserScrolling(!isAtBottom);
  };

  // Auto-scroll to bottom for new messages if user hasn't scrolled up
  useEffect(() => {
    if (!isUserScrolling) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    }
  }, [messages, isUserScrolling]);

  // Force scroll to bottom on initial load and when chat opens
  useEffect(() => {
    if (isOpen && !isMinimized && messages.length > 0) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
        setIsUserScrolling(false);
      }, 100);
    }
  }, [isOpen, isMinimized]);

  // Add message to chat
  const showMessage = (type: 'user' | 'assistant', content: string) => {
    const message: Message = {
      id: `${Date.now()}-${Math.random()}`,
      type,
      content,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, message]);
  };

  // Handle text input
  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (textInput.trim() && !isProcessing) {
      const message = textInput;
      setTextInput('');
      showMessage('user', message);
      processUserMessage(message);
    }
  };

  // Process user message through AI backend
  const processUserMessage = async (userMessage: string) => {
    setIsProcessing(true);

    // Add processing placeholder bubble immediately
    const processingMessageId = `processing-${Date.now()}`;
    const processingMessage: Message = {
      id: processingMessageId,
      type: 'assistant',
      content: 'Processing...',
      timestamp: new Date(),
      isProcessing: true, // Flag to identify processing messages
    };
    setMessages(prev => [...prev, processingMessage]);

    try {
      if (isSuspended && runId && suspendedStep) {
        // Handle workflow resume - remove processing bubble first
        setMessages(prev => prev.filter(m => m.id !== processingMessageId));
        await handleWorkflowResume(userMessage);
      } else {
        // Handle normal chat - processing bubble will be replaced by streaming response
        await handleStreamingAIResponse(userMessage, processingMessageId);
      }
    } catch (error) {
      console.error('AI processing error:', error);
      // Replace processing bubble with error message
      setMessages(prev => prev.map(m => 
        m.id === processingMessageId 
          ? { ...m, content: "I'm having trouble processing your message. Please try again.", isProcessing: false }
          : m
      ));
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle milestone data from AI response
  const handleMilestoneData = (milestoneData: any) => {
    if (!milestoneData.milestones || milestoneData.milestones.length === 0) return;

    for (const milestone of milestoneData.milestones) {
      if (milestone.suggestedParentId && onAddMilestone) {
        // Add as sub-milestone to existing node
        onAddMilestone(milestone.suggestedParentId, milestone);
      } else if (onMilestoneAdded) {
        // Add as new top-level milestone
        onMilestoneAdded(milestone);
      }
    }
  };

  // Handle node update data from AI response
  const handleNodeUpdate = (updateData: any) => {
    if (!updateData.nodeId || !updateData.updates) return;

    if (onMilestoneUpdated) {
      onMilestoneUpdated(updateData.nodeId, updateData.updates);
    }
  };

  // Handle profile update events from career tools
  const handleProfileUpdate = (profileUpdateData: any) => {
    console.log('Profile update received:', profileUpdateData);
    
    // Show a subtle notification in the chat
    const eventType = profileUpdateData.eventType;
    let message = '';
    
    switch (eventType) {
      case 'experience_added':
        message = `✅ Added experience: ${profileUpdateData.data.experience.title} at ${profileUpdateData.data.experience.company}`;
        break;
      case 'experience_updated':
        message = `✏️ Updated experience: ${profileUpdateData.data.experience.title} at ${profileUpdateData.data.experience.company}`;
        break;
      case 'education_added':
        message = `🎓 Added education: ${profileUpdateData.data.education.degree ? profileUpdateData.data.education.degree + ' at ' : ''}${profileUpdateData.data.education.school}`;
        break;
      case 'education_updated':
        message = `✏️ Updated education: ${profileUpdateData.data.education.degree ? profileUpdateData.data.education.degree + ' at ' : ''}${profileUpdateData.data.education.school}`;
        break;
      case 'project_added':
        message = `🚀 Added project: ${profileUpdateData.data.project.title} at ${profileUpdateData.data.experience.company}`;
        break;
      case 'project_updated':
        message = `✏️ Updated project: ${profileUpdateData.data.project.title} at ${profileUpdateData.data.experience.company}`;
        break;
      case 'project_update_added':
        message = `📝 Added update: ${profileUpdateData.data.update.title} to ${profileUpdateData.data.project.title}`;
        break;
      case 'project_update_updated':
        message = `✏️ Updated project update: ${profileUpdateData.data.update.title} in ${profileUpdateData.data.project.title}`;
        break;
      default:
        message = `✨ Profile updated: ${eventType}`;
    }
    
    // Show a brief system message
    showMessage('assistant', message);
    
    // Trigger UI refresh callback
    if (onProfileUpdated) {
      onProfileUpdated();
    }
  };

  // Handle workflow resume through streaming API
  const handleWorkflowResume = async (userInput: string) => {
    try {
      const response = await fetch('/api/ai/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          runId,
          suspendedStep,
          userInput,
          userId,
        }),
      });

      if (!response.ok) throw new Error('Failed to resume workflow');

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';
      const assistantMessageId = Date.now().toString();

      // Create initial assistant message
      const initialMessage: Message = {
        id: assistantMessageId,
        type: 'assistant',
        content: '',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, initialMessage]);

      let buffer = '';
      while (reader) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'text') {
                assistantMessage += data.content;
                // Update the message in real-time
                setMessages(prev => {
                  const newMessages = [...prev];
                  const messageIndex = newMessages.findIndex(m => m.id === assistantMessageId);
                  if (messageIndex !== -1) {
                    newMessages[messageIndex].content = assistantMessage;
                  }
                  return newMessages;
                });
              } else if (data.type === 'suspended') {
                // Handle workflow suspension again
                console.log('Workflow suspended again:', data.data);
                assistantMessage = data.data.message || 'Please provide additional information to continue.';
                setMessages(prev => {
                  const newMessages = [...prev];
                  const messageIndex = newMessages.findIndex(m => m.id === assistantMessageId);
                  if (messageIndex !== -1) {
                    newMessages[messageIndex].content = assistantMessage;
                  }
                  return newMessages;
                });
                
                // Store new suspension info
                setSuspensionId(data.data.suspensionId);
                setRunId(data.data.runId);
                setSuspendedStep(data.data.suspendedStep);
                setIsSuspended(true);
                return; // Exit early as we're suspended again
              } else if (data.type === 'done') {
                // Handle completion
                if (data.suspended) {
                  console.log('Workflow completed with suspension');
                } else {
                  console.log('Workflow resumed and completed normally');
                  // Clear all suspension state
                  setIsSuspended(false);
                  setSuspensionId(null);
                  setRunId(null);
                  setSuspendedStep(null);
                }
                break;
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', e);
            }
          }
        }
      }
      
      // Scroll to bottom after complete response
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
      console.error('Resume workflow error:', error);
      throw error;
    }
  };

  // Handle streaming AI responses from /api/ai/chat
  const handleStreamingAIResponse = async (userMessage: string, processingMessageId?: string) => {
    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          userId,
          threadId,
        }),
      });

      if (!response.ok) throw new Error('Failed to get AI response');

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';
      const assistantMessageId = processingMessageId || Date.now().toString();

      // If we have a processing message, convert it to streaming message
      if (processingMessageId) {
        setMessages(prev => prev.map(m => 
          m.id === processingMessageId 
            ? { ...m, content: '', isProcessing: false }
            : m
        ));
      } else {
        // Create initial assistant message if no processing message exists
        const initialMessage: Message = {
          id: assistantMessageId,
          type: 'assistant',
          content: '',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, initialMessage]);
      }

      let buffer = '';
      while (reader) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'text') {
                assistantMessage += data.content;
                // Update the message in real-time
                setMessages(prev => {
                  const newMessages = [...prev];
                  const messageIndex = newMessages.findIndex(m => m.id === assistantMessageId);
                  if (messageIndex !== -1) {
                    newMessages[messageIndex].content = assistantMessage;
                  }
                  return newMessages;
                });
              } else if (data.type === 'milestone') {
                handleMilestoneData(data.data);
              } else if (data.type === 'update') {
                handleNodeUpdate(data.data);
              } else if (data.type === 'skills') {
                // Skills were extracted, could show a toast notification
                console.log('Skills extracted:', data.data);
              } else if (data.type === 'profile_update') {
                // Handle real-time profile updates from career tools
                handleProfileUpdate(data);
              } else if (data.type === 'suspended') {
                // Handle workflow suspension
                console.log('Workflow suspended:', data.data);
                assistantMessage = data.data.message || 'Please provide additional information to continue.';
                setMessages(prev => {
                  const newMessages = [...prev];
                  const messageIndex = newMessages.findIndex(m => m.id === assistantMessageId);
                  if (messageIndex !== -1) {
                    newMessages[messageIndex].content = assistantMessage;
                  }
                  return newMessages;
                });
                
                // Store suspension info for potential resume
                setSuspensionId(data.data.suspensionId);
                setRunId(data.data.runId);
                setSuspendedStep(data.data.suspendedStep);
                setIsSuspended(true);
              } else if (data.type === 'followup') {
                // Follow-up questions are included in the text
                assistantMessage += data.content;
                setMessages(prev => {
                  const newMessages = [...prev];
                  const messageIndex = newMessages.findIndex(m => m.id === assistantMessageId);
                  if (messageIndex !== -1) {
                    newMessages[messageIndex].content = assistantMessage;
                  }
                  return newMessages;
                });
              } else if (data.type === 'done') {
                // Update thread ID if provided
                if (data.threadId) {
                  setThreadId(data.threadId);
                }
                
                // Handle workflow completion
                if (data.suspended) {
                  console.log('Workflow completed with suspension');
                } else {
                  console.log('Workflow completed normally');
                  // Clear suspension state for normal completion
                  setIsSuspended(false);
                  setSuspensionId(null);
                  setRunId(null);
                  setSuspendedStep(null);
                }
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', e);
            }
          }
        }
      }
      
      // Scroll to bottom after complete response
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
      console.error('Streaming AI error:', error);
      throw error;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* Chat Messages Overlay - Clean conversation flow */}
      <AnimatePresence>
        {!isMinimized && (
          <div className="absolute top-20 right-8 bottom-32 w-80 pointer-events-auto">
            {/* Messages container with gradient fade mask */}
            <div 
              className="h-full relative"
              style={{
                maskImage: 'linear-gradient(to top, rgba(0,0,0,1) 50%, rgba(0,0,0,0.8) 70%, rgba(0,0,0,0) 85%)',
                WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,1) 50%, rgba(0,0,0,0.8) 70%, rgba(0,0,0,0) 85%)',
              }}
            >
              {/* Scrollable messages container - fixed height for scrolling */}
              <div 
                ref={messagesContainerRef}
                onScroll={handleScroll}
                className="overflow-y-scroll hover:overflow-y-scroll transition-all duration-300 scrollbar-thin scrollbar-thumb-transparent hover:scrollbar-thumb-purple-400/50 scrollbar-track-transparent"
                style={{
                  height: '100%',
                  maxHeight: '100%',
                  background: 'transparent',
                  backdropFilter: 'none',
                  scrollbarWidth: 'thin',
                  scrollbarGutter: 'stable',
                  paddingRight: '16px', // Reserve space for scrollbar
                }}
              >
              {/* Messages container that grows from bottom */}
              <div className="space-y-2 flex flex-col justify-end" style={{ minHeight: '100%' }}>
                {messages.map((message, index) => {
                  // Calculate opacity - all messages visible, slight fade for older ones
                  const isRecent = index >= messages.length - 3;
                  const baseOpacity = isRecent ? 1 : 0.85;
                  
                  return (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 20, scale: 0.95 }}
                      animate={{ opacity: baseOpacity, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -20, scale: 0.95 }}
                      transition={{ 
                        duration: 0.3, 
                        ease: "easeOut"
                      }}
                      className={`w-full flex ${
                        message.type === 'user' 
                          ? 'justify-end items-end mr-2' 
                          : 'justify-start items-start ml-2'
                      } transition-opacity duration-300 mb-2`}
                    >
                      <div 
                        className={`max-w-[22rem] px-4 py-3 rounded-2xl backdrop-blur-md border shadow-lg break-words ${
                          message.type === 'user'
                            ? 'bg-slate-700/80 text-white border-slate-600/50'
                            : message.isProcessing
                            ? 'text-slate-300 border-purple-400/20'
                            : 'text-white border-purple-400/30'
                        }`}
                        style={{
                          backgroundColor: message.type === 'user' 
                            ? undefined // Use CSS class for user messages
                            : message.isProcessing
                            ? 'rgba(255, 255, 255, 0.1)' // Dimmer for processing state
                            : 'rgba(138, 43, 226, 0.25)', // Purple for AI messages
                          backdropFilter: 'blur(8px)',
                          transform: 'translateZ(0)', // GPU acceleration
                          fontStyle: message.isProcessing ? 'italic' : 'normal',
                        }}
                      >
                        {message.type === 'user' ? (
                          // User message - no avatar, simple layout
                          <div className="w-full">
                            <p className="text-sm leading-relaxed whitespace-pre-line text-white/95 font-medium">
                              {message.content}
                            </p>
                            {!isRecent && (
                              <div className="text-xs text-white/60 mt-2">
                                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            )}
                          </div>
                        ) : (
                          // AI message - with avatar but constrained width
                          <div className="w-full flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 bg-white/20">
                              <FaRobot className="w-3 h-3 text-white/90" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm leading-relaxed whitespace-pre-line text-white/95 font-medium">
                                {message.isProcessing ? (
                                  <span className="flex items-center gap-2">
                                    <span className="flex gap-1">
                                      <span className="w-2 h-2 bg-white rounded-full animate-bounce inline-block" style={{ animationDelay: '0ms' }} />
                                      <span className="w-2 h-2 bg-white rounded-full animate-bounce inline-block" style={{ animationDelay: '150ms' }} />
                                      <span className="w-2 h-2 bg-white rounded-full animate-bounce inline-block" style={{ animationDelay: '300ms' }} />
                                    </span>
                                    Processing...
                                  </span>
                                ) : (
                                  message.content
                                )}
                              </p>
                              {!isRecent && !message.isProcessing && (
                                <div className="text-xs text-white/60 mt-2">
                                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
                <div ref={messagesEndRef} className="h-1" />
                </div>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>


      {/* Input Controls - Fixed at bottom right like GitHub project */}
      <AnimatePresence>
        {isOpen && !isMinimized && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="absolute bottom-8 right-8 pointer-events-auto"
          >
            <div className="flex gap-2 items-end">
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleTextSubmit(e);
                  }
                }}
                placeholder="Type your response..."
                rows={1}
                className="px-4 py-3 bg-slate-800/90 backdrop-blur-xl border border-purple-500/30 rounded-2xl text-white placeholder-purple-300/70 focus:outline-none focus:border-purple-400 w-64 resize-none"
                style={{
                  minHeight: '2.5rem',
                  maxHeight: '5rem',
                  lineHeight: '1.5',
                  overflowY: 'hidden',
                }}
                disabled={isProcessing}
                onInput={(e) => {
                  const textarea = e.target as HTMLTextAreaElement;
                  // Reset height to measure content height
                  textarea.style.height = 'auto';
                  const newHeight = Math.min(textarea.scrollHeight, 80); // 80px = 5rem
                  textarea.style.height = newHeight + 'px';
                  
                  // Show scrollbar only when content exceeds 2 lines (5rem = 80px)
                  if (textarea.scrollHeight > 80) {
                    textarea.style.overflowY = 'auto';
                  } else {
                    textarea.style.overflowY = 'hidden';
                  }
                }}
              />
              <button
                type="button"
                onClick={handleTextSubmit}
                className="px-4 py-3 bg-purple-600/90 hover:bg-purple-700/90 backdrop-blur-xl rounded-2xl text-white transition-colors disabled:opacity-50 border border-purple-500/30 flex-shrink-0"
                disabled={!textInput.trim() || isProcessing}
              >
                <FaPaperPlane className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Minimized Chat Indicator */}
      <AnimatePresence>
        {isOpen && isMinimized && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="absolute bottom-8 right-8 pointer-events-auto"
          >
            <button
              onClick={onMinimize}
              className="w-12 h-12 bg-purple-600/90 hover:bg-purple-700/90 backdrop-blur-xl rounded-full flex items-center justify-center text-white border border-purple-500/20 transition-colors"
            >
              <FaRobot className="w-5 h-5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>


    </div>
  );
};

export default OverlayChat;