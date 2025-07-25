import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaMicrophone,
  FaMicrophoneSlash,
  FaTimes,
  FaVolumeUp,
  FaUser,
  FaRobot,
  FaPaperPlane
} from 'react-icons/fa';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  followUpQuestions?: string[];
}

interface Milestone {
  id: string;
  title: string;
  type: 'education' | 'job' | 'transition' | 'skill' | 'event' | 'project';
  date: string;
  description: string;
  skills: string[];
  organization?: string;
}

interface VoiceChatPanelAIProps {
  isOpen: boolean;
  onClose: () => void;
  onMilestoneAdded: (milestone: Milestone) => void;
  existingNodes?: any[];
  onMilestoneUpdated?: (nodeId: string, update: string) => void;
  onSubMilestoneAdded?: (parentNodeId: string, subMilestone: Milestone) => void;
  profileData?: any;
  userInterest?: string;
}

const VoiceChatPanelAI: React.FC<VoiceChatPanelAIProps> = ({
  isOpen,
  onClose,
  onMilestoneAdded,
  existingNodes = [],
  onMilestoneUpdated,
  onSubMilestoneAdded,
  profileData,
  userInterest
}) => {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [textInput, setTextInput] = useState('');
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get current user
  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const response = await fetch('/api/me');
      return response.json();
    },
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize conversation when panel opens
  useEffect(() => {
    if (isOpen && messages.length === 0 && user && profileData) {
      initializeConversation();
    }
  }, [isOpen, user, profileData]);

  const initializeConversation = async () => {
    try {
      const response = await fetch('/api/ai/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          step: 1,
          profileData,
          userInterest,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data || !data.message) {
        console.error('Invalid response structure:', data);
        throw new Error('Invalid response structure from server');
      }
      
      setMessages([{
        id: Date.now().toString(),
        type: 'assistant',
        content: data.message,
        timestamp: new Date(),
      }]);

      setOnboardingStep(data.step || 1);
      setIsOnboardingComplete(data.isComplete || false);
    } catch (error) {
      console.error('Failed to initialize conversation:', error);
      setMessages([{
        id: Date.now().toString(),
        type: 'assistant',
        content: "Hello! I'm having trouble connecting. Please try refreshing the page.",
        timestamp: new Date(),
      }]);
    }
  };

  const sendMessage = async (message: string) => {
    if (!user) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: message,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setIsProcessing(true);

    try {
      if (!isOnboardingComplete) {
        // Handle onboarding flow
        const response = await fetch('/api/ai/onboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            step: onboardingStep,
            message,
            profileData,
            userInterest,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          type: 'assistant',
          content: data.message,
          timestamp: new Date(),
        }]);

        setOnboardingStep(data.step);
        setIsOnboardingComplete(data.isComplete);

        // If onboarding is complete and there are projects, add them as sub-milestones
        if (data.isComplete && data.state?.projects && onSubMilestoneAdded) {
          handleOnboardingProjectsAsMilestones(data.state);
        }
      } else {
        // Regular chat with AI
        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message,
            userId: user.id,
            threadId,
            existingNodes,
            userInterest,
            profileData,
          }),
        });

        if (!response.ok) throw new Error('Failed to send message');

        // Handle streaming response
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let assistantMessage = '';
        const assistantMessageId = Date.now().toString();

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
                  // Update the message in real-time
                  setMessages(prev => {
                    const newMessages = [...prev];
                    const lastMessage = newMessages[newMessages.length - 1];
                    if (lastMessage?.id === assistantMessageId) {
                      lastMessage.content = assistantMessage;
                    } else {
                      newMessages.push({
                        id: assistantMessageId,
                        type: 'assistant',
                        content: assistantMessage,
                        timestamp: new Date(),
                      });
                    }
                    return newMessages;
                  });
                } else if (data.type === 'milestone') {
                  handleMilestoneData(data.data);
                } else if (data.type === 'followup') {
                  // Append follow-up questions to the assistant message
                  assistantMessage += data.content;
                  setMessages(prev => {
                    const newMessages = [...prev];
                    const lastMessage = newMessages[newMessages.length - 1];
                    if (lastMessage?.id === assistantMessageId) {
                      lastMessage.content = assistantMessage;
                      // Store follow-up questions for potential highlighting
                      lastMessage.followUpQuestions = data.questions;
                    }
                    return newMessages;
                  });
                } else if (data.type === 'done') {
                  setThreadId(data.threadId);
                }
              } catch (e) {
                console.error('Failed to parse SSE data:', e);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        type: 'assistant',
        content: "I'm having trouble processing your message. Please try again.",
        timestamp: new Date(),
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOnboardingProjectsAsMilestones = (state: any) => {
    if (!state.projects || !existingNodes.length) return;

    // Find the current job node
    const currentJobNode = existingNodes.find(node => 
      node.data.organization && 
      state.currentRole?.includes(node.data.organization)
    );

    if (currentJobNode && onSubMilestoneAdded) {
      state.projects.forEach((project: string, index: number) => {
        setTimeout(() => {
          const subMilestone: Milestone = {
            id: `onboarding-project-${Date.now()}-${index}`,
            title: project,
            type: 'project',
            date: new Date().getFullYear().toString(),
            description: state.projectContexts?.[project] || `Working on ${project}`,
            skills: ['Project Management'],
            organization: currentJobNode.data.organization,
          };
          onSubMilestoneAdded(currentJobNode.id, subMilestone);
        }, (index + 1) * 1000);
      });
    }
  };

  const handleMilestoneData = (milestoneData: any) => {
    if (!milestoneData.milestone) return;

    if (milestoneData.isUpdate && milestoneData.parentNodeId && onSubMilestoneAdded) {
      onSubMilestoneAdded(milestoneData.parentNodeId, milestoneData.milestone);
    } else if (!milestoneData.isUpdate) {
      onMilestoneAdded(milestoneData.milestone);
    }

    // Show clarifying questions if any
    if (milestoneData.clarifyingQuestions?.length > 0) {
      const questionsMessage = milestoneData.clarifyingQuestions.join('\n• ');
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        type: 'assistant',
        content: `I've added that to your journey! To enrich this milestone:\n• ${questionsMessage}`,
        timestamp: new Date(),
      }]);
    }
  };

  const handleVoiceToggle = async () => {
    if (isListening) {
      // Stop recording
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      }
      setIsListening(false);
      setCurrentTranscript('');
    } else {
      // Start recording
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            setAudioChunks(prev => [...prev, event.data]);
          }
        };

        recorder.onstop = async () => {
          try {
            // Create audio blob from chunks
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            
            // TODO: Send to speech-to-text service
            // For now, we'll use a placeholder
            const simulatedTranscript = "This is where the transcribed audio would appear.";
            
            setCurrentTranscript(simulatedTranscript);
            
            setTimeout(() => {
              sendMessage(simulatedTranscript);
              setCurrentTranscript('');
              setAudioChunks([]);
            }, 1000);
          } catch (error) {
            console.error('Error processing audio:', error);
            setCurrentTranscript('');
            setAudioChunks([]);
          }
        };

        recorder.start();
        setMediaRecorder(recorder);
        setIsListening(true);
      } catch (error) {
        console.error('Error accessing microphone:', error);
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          type: 'assistant',
          content: 'Unable to access microphone. Please allow microphone permissions or use text input instead.',
          timestamp: new Date(),
        }]);
      }
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (textInput.trim() && !isProcessing) {
      sendMessage(textInput);
      setTextInput('');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 100 }}
          transition={{ duration: 0.3 }}
          className="fixed bottom-4 right-4 z-50 w-96 h-[500px]"
        >
          <div className="glass w-full h-full flex flex-col rounded-2xl border border-purple-500/20 shadow-xl bg-slate-900/90 backdrop-blur-sm">
            {/* Header */}
            <div className="p-4 border-b border-purple-500/20 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <FaRobot className="text-purple-400" />
                Career AI Guide
              </h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8 text-purple-200 hover:text-white hover:bg-purple-500/20"
              >
                <FaTimes />
              </Button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-purple-500 scrollbar-track-slate-800">
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-2 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.type === 'assistant' && (
                    <div className="w-6 h-6 bg-purple-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                      <FaRobot className="w-3 h-3 text-purple-400" />
                    </div>
                  )}

                  <div
                    className={`
                      max-w-[80%] p-3 rounded-xl text-sm whitespace-pre-wrap
                      ${message.type === 'user'
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-800/80 text-purple-100 border border-purple-500/20'
                      }
                    `}
                  >
                    {message.content}
                  </div>

                  {message.type === 'user' && (
                    <div className="w-6 h-6 bg-purple-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                      <FaUser className="w-3 h-3 text-purple-400" />
                    </div>
                  )}
                </motion.div>
              ))}

              {isProcessing && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-2 justify-start"
                >
                  <div className="w-6 h-6 bg-purple-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <FaRobot className="w-3 h-3 text-purple-400" />
                  </div>
                  <div className="bg-slate-800/80 text-purple-100 p-3 rounded-xl text-sm border border-purple-500/20">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Current transcript display */}
            {currentTranscript && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mx-4 mb-4 p-3 bg-purple-500/10 rounded-lg border border-purple-500/20"
              >
                <div className="text-xs text-purple-400 mb-1">Listening...</div>
                <div className="text-sm text-purple-100">{currentTranscript}</div>
              </motion.div>
            )}

            {/* Input Section */}
            <div className="p-4 border-t border-purple-500/20 space-y-3">
              <form onSubmit={handleTextSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Type your career update..."
                  className="flex-1 px-3 py-2 bg-slate-800/50 border border-purple-500/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:border-purple-400"
                  disabled={isProcessing}
                />
                <Button
                  type="submit"
                  size="icon"
                  className="bg-purple-600 hover:bg-purple-700"
                  disabled={!textInput.trim() || isProcessing}
                >
                  <FaPaperPlane className="w-3 h-3" />
                </Button>
              </form>

              <Button
                onClick={handleVoiceToggle}
                className={`w-full py-3 ${
                  isListening
                    ? 'bg-red-500 hover:bg-red-600'
                    : 'bg-purple-600 hover:bg-purple-700'
                }`}
                disabled={isProcessing}
              >
                {isListening ? <FaMicrophoneSlash className="mr-2" /> : <FaMicrophone className="mr-2" />}
                {isListening ? 'Stop Recording' : 'Start Voice Update'}
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default VoiceChatPanelAI;