import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaMicrophone,
  FaMicrophoneSlash,
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
  isTemporary?: boolean;
}

interface OverlayChatProps {
  isOpen: boolean;
  isMinimized?: boolean;
  onClose: () => void;
  onMinimize?: () => void;
  onMilestoneAdded: (milestone: any) => void;
  existingNodes?: any[];
  onMilestoneUpdated?: (nodeId: string, update: string) => void;
  onSubMilestoneAdded?: (parentNodeId: string, subMilestone: any) => void;
  onAddMilestone?: (parentNodeId: string, subMilestone: any) => void;
  profileData?: any;
  userInterest?: string;
  userData?: any;
}

const OverlayChat: React.FC<OverlayChatProps> = ({
  isOpen,
  isMinimized = false,
  onClose,
  onMinimize,
  onMilestoneAdded,
  existingNodes = [],
  onMilestoneUpdated,
  onSubMilestoneAdded,
  onAddMilestone,
  profileData,
  userInterest,
  userData
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMessage, setCurrentMessage] = useState<Message | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [textInput, setTextInput] = useState('');
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [pendingUpdates, setPendingUpdates] = useState<any[]>([]);
  const [conversationState, setConversationState] = useState<'initial' | 'awaiting_update' | 'awaiting_confirmation' | 'confirmed' | 'adding_milestone' | 'confirming_updates'>('initial');
  const [addingMilestoneContext, setAddingMilestoneContext] = useState<any>(null);

  // Conversation state for onboarding
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(false);

  // Initialize chat when component mounts
  useEffect(() => {
    if (isOpen && messages.length === 0 && profileData && userData) {
      console.log('Initializing chat with userData:', userData);
      console.log('hasCompletedOnboarding:', userData.hasCompletedOnboarding);
      
      const isOnboardingCompleted = userData.hasCompletedOnboarding === true;
      setIsOnboardingComplete(isOnboardingCompleted);
      
      if (!isOnboardingCompleted) {
        // Step 1: The Automated Welcome (The Hook) - following PDF guide
        const welcomeMessage = `Welcome! I can see you're currently a **${profileData?.experiences?.[0]?.title}** at **${profileData?.experiences?.[0]?.company}** - is that correct?

I'm here to help you track your career progress and capture your achievements. Let's get started!`;
        
        showMessage('assistant', welcomeMessage, false);
      }
    }
  }, [isOpen, profileData, userData]);

  // Handle milestone addition from external trigger (+ button)
  useEffect(() => {
    const handleAddMilestone = (event: CustomEvent) => {
      console.log('OverlayChat received addMilestone event:', event.detail);
      const { parentNodeId, parentTitle, parentOrganization } = event.detail;
      
      console.log('Setting up milestone context:', { parentNodeId, parentTitle, parentOrganization });
      
      setAddingMilestoneContext({
        parentNodeId,
        parentTitle,
        parentOrganization,
        step: 'situation'
      });
      setConversationState('adding_milestone');
      
      // Clear any existing messages and start fresh for milestone creation
      setMessages([]);
      setCurrentMessage(null);
      
      // Start the conversation with proper context for the organization  
      const contextMessage = `What would you like to add about your experience at **${parentOrganization}** as a ${parentTitle}?

I'll help you build a STAR story. Let's start with:

**Situation:** What specific challenge or opportunity did you encounter at ${parentOrganization}? What was the business context or problem you needed to address?`;
      
      console.log('Showing context message:', contextMessage);
      showMessage('assistant', contextMessage, false); // Keep this message visible
    };

    window.addEventListener('addMilestone', handleAddMilestone as EventListener);
    return () => window.removeEventListener('addMilestone', handleAddMilestone as EventListener);
  }, []);

  // Show message with fade and scroll management (messages stay visible)
  const showMessage = (type: 'user' | 'assistant', content: string, temporary: boolean = true) => {
    console.log('showMessage called with:', { type, content, temporary });
    const message: Message = {
      id: `${Date.now()}-${Math.random()}`,
      type,
      content,
      timestamp: new Date(),
      isTemporary: temporary
    };

    setCurrentMessage(message);
    setMessages(prev => {
      const newMessages = [...prev, message];
      console.log('Updated messages array:', newMessages);
      return newMessages;
    });

    if (temporary) {
      // Auto-fade current message after 8 seconds but keep it in history
      setTimeout(() => {
        setCurrentMessage(null);
      }, 8000);
    }
  };

  // Voice recording functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      
      recorder.ondataavailable = (event) => {
        setAudioChunks(prev => [...prev, event.data]);
      };
      
      recorder.onstop = () => {
        processAudioRecording();
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsListening(true);
      setCurrentTranscript('');
    } catch (error) {
      console.error('Error accessing microphone:', error);
      showMessage('assistant', 'Unable to access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      setIsListening(false);
    }
  };

  const processAudioRecording = async () => {
    if (audioChunks.length === 0) return;

    const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
    const audioFile = new File([audioBlob], 'recording.wav', { type: 'audio/wav' });

    setAudioChunks([]);
    setIsProcessing(true);

    try {
      const formData = new FormData();
      formData.append('audio', audioFile);

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const { text } = await response.json();
        if (text && text.trim()) {
          setCurrentTranscript('');
          showMessage('user', text);
          await simulateAIResponse(text);
        }
      } else {
        showMessage('assistant', 'Sorry, I had trouble processing your audio. Could you try again?');
      }
    } catch (error) {
      console.error('Error processing audio:', error);
      showMessage('assistant', 'Sorry, there was an error processing your audio.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle text input
  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (textInput.trim()) {
      showMessage('user', textInput);
      simulateAIResponse(textInput);
      setTextInput('');
    }
  };

  // Real AI Response processing with OpenAI integration
  const simulateAIResponse = async (userMessage: string) => {
    console.log('simulateAIResponse called with:', { userMessage, isOnboardingComplete, onboardingStep, conversationState, addingMilestoneContext });
    setIsProcessing(true);

    try {
      // For milestone creation, use local STAR logic
      if (conversationState === 'adding_milestone') {
        console.log('Handling manual milestone creation');
        await handleManualMilestoneCreation(userMessage);
        setIsProcessing(false);
        return;
      }

      // For confirmation, use local logic
      if (conversationState === 'confirming_updates') {
        console.log('Handling confirmation');
        await handleConfirmation(userMessage);
        setIsProcessing(false);
        return;
      }

      // For all other interactions, use OpenAI
      const response = await fetch('/api/process-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          conversationContext: {
            isOnboardingComplete,
            onboardingStep,
            profileData,
            userInterest,
            addingMilestoneContext
          },
          conversationState
        })
      });

      if (response.ok) {
        const { response: aiResponse } = await response.json();
        
        // Handle onboarding flow
        if (!isOnboardingComplete) {
          await handleOnboardingWithAI(userMessage, aiResponse);
        } else {
          // Handle regular project updates
          await handleProjectUpdateWithAI(userMessage, aiResponse);
        }
      } else {
        // Fallback to local processing
        if (!isOnboardingComplete) {
          await handleOnboardingResponse(userMessage);
        } else {
          await handleProjectUpdate(userMessage);
        }
      }
    } catch (error) {
      console.error('AI processing error:', error);
      // Fallback to local processing
      if (!isOnboardingComplete) {
        await handleOnboardingResponse(userMessage);
      } else {
        await handleProjectUpdate(userMessage);
      }
    }
    
    setIsProcessing(false);
  };

  // Handle manual milestone creation with progressive STAR format
  const handleManualMilestoneCreation = async (userInput: string) => {
    if (!addingMilestoneContext) return;

    const currentStep = addingMilestoneContext.step || 'situation';
    
    switch (currentStep) {
      case 'situation':
        // First response - collect situation
        setAddingMilestoneContext({
          ...addingMilestoneContext,
          situation: userInput,
          step: 'task'
        });
        
        showMessage('assistant', `Perfect! I understand the situation at ${addingMilestoneContext.parentOrganization}.

**Task:** What specific objective or goal were you responsible for achieving? What was your role in addressing this challenge?`);
        break;
        
      case 'task':
        // Second response - collect task
        setAddingMilestoneContext({
          ...addingMilestoneContext,
          task: userInput,
          step: 'action'
        });
        
        showMessage('assistant', `Excellent! Now I understand your responsibility.

**Action:** What specific actions did you take? What was your approach or strategy to tackle this challenge?`);
        break;
        
      case 'action':
        // Third response - collect actions  
        setAddingMilestoneContext({
          ...addingMilestoneContext,
          action: userInput,
          step: 'result'
        });
        
        showMessage('assistant', `Great work! I can see the actions you took.

**Result:** What was the outcome? What impact did your work have? Include any metrics, improvements, or business results if available.`);
        break;
        
      case 'result':
        // Final response - create the milestone with all STAR details
        const projectTitle = extractProjectTitle(addingMilestoneContext.situation || '', addingMilestoneContext.task || '');
        
        const newMilestone = {
          id: `milestone-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'sub-milestone',
          parentId: addingMilestoneContext.parentNodeId,
          parentOrganization: addingMilestoneContext.parentOrganization,
          title: projectTitle,
          description: `${addingMilestoneContext.situation?.substring(0, 100) || ''}...`,
          dateRange: 'Recently completed',
          location: addingMilestoneContext.parentOrganization,
          starDetails: {
            situation: addingMilestoneContext.situation,
            task: addingMilestoneContext.task,
            action: addingMilestoneContext.action,
            result: userInput
          }
        };

        // Add to journey visualization
        console.log('Calling onAddMilestone with:', addingMilestoneContext.parentNodeId, newMilestone);
        if (onAddMilestone) {
          onAddMilestone(addingMilestoneContext.parentNodeId, newMilestone);
        } else if (onSubMilestoneAdded) {
          console.log('Using onSubMilestoneAdded fallback');
          onSubMilestoneAdded(addingMilestoneContext.parentNodeId, newMilestone);
        } else {
          console.error('No milestone callback available');
        }

        // Show confirmation
        showMessage('assistant', `🎉 **Milestone Created Successfully!**

"**${projectTitle}**" has been added to your ${addingMilestoneContext.parentOrganization} experience.

The milestone includes all your STAR details:
- **Situation:** ${addingMilestoneContext.situation?.substring(0, 50) || ''}...
- **Task:** ${addingMilestoneContext.task?.substring(0, 50) || ''}...  
- **Action:** ${addingMilestoneContext.action?.substring(0, 50) || ''}...
- **Result:** ${userInput.substring(0, 50)}...

Click on the new milestone node to view the complete STAR story anytime!`);

        // Reset context
        setAddingMilestoneContext(null);
        setConversationState('awaiting_update');
        break;
    }
  };

  // Extract a meaningful project title from situation and task
  const extractProjectTitle = (situation: string, task: string): string => {
    const text = `${situation} ${task}`.toLowerCase();
    
    // Look for key project indicators
    if (text.includes('delivery') && text.includes('experience')) return 'Delivery Experience Enhancement';
    if (text.includes('checkout') && text.includes('flow')) return 'Checkout Flow Optimization';
    if (text.includes('user') && text.includes('interface')) return 'User Interface Redesign';
    if (text.includes('system') && text.includes('performance')) return 'System Performance Improvement';
    if (text.includes('customer') && text.includes('satisfaction')) return 'Customer Satisfaction Initiative';
    if (text.includes('process') && text.includes('optimization')) return 'Process Optimization Project';
    if (text.includes('feature') && text.includes('development')) return 'Feature Development Project';
    
    // Fallback: use first few words of task
    const words = task.split(' ').slice(0, 4).join(' ');
    return words.charAt(0).toUpperCase() + words.slice(1);
  };

  // Handle confirmation of updates
  const handleConfirmation = async (userMessage: string) => {
    const lowerMessage = userMessage.toLowerCase();
    
    if (lowerMessage.includes('confirm') || lowerMessage.includes('yes') || lowerMessage.includes('save')) {
      await savePendingUpdates();
    } else {
      showMessage('assistant', 'Got it! What would you like me to edit about this milestone?');
      setConversationState('adding_milestone');
    }
  };

  const savePendingUpdates = async () => {
    showMessage('assistant', 'Updates saved successfully!');
    setPendingUpdates([]);
    setConversationState('awaiting_update');
  };

  const handleVoiceToggle = () => {
    if (isListening) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Save onboarding projects to database
  const saveOnboardingProjects = async (projectsText: string) => {
    try {
      const response = await fetch('/api/save-projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projects: projectsText })
      });

      if (response.ok) {
        // Mark onboarding as complete
        await fetch('/api/onboarding/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        console.log('Onboarding marked as complete after chat completion');
      }
    } catch (error) {
      console.error('Error saving onboarding projects:', error);
    }
  };

  // Handle onboarding with AI assistance
  const handleOnboardingWithAI = async (userMessage: string, aiResponse: string) => {
    showMessage('assistant', aiResponse);
    
    // Progress onboarding steps based on user input
    const lowerMessage = userMessage.toLowerCase();
    
    if (onboardingStep === 1 && (lowerMessage.includes('yes') || lowerMessage.includes('correct'))) {
      setOnboardingStep(2);
    } else if (onboardingStep === 2 && userMessage.trim().length > 10) {
      setOnboardingStep(3);
    } else if (onboardingStep === 3 && userMessage.trim().length > 10) {
      await saveOnboardingProjects(userMessage);
      setIsOnboardingComplete(true);
      setConversationState('awaiting_update');
    }
  };

  // Handle project updates with AI assistance  
  const handleProjectUpdateWithAI = async (userMessage: string, aiResponse: string) => {
    showMessage('assistant', aiResponse);
    setConversationState('awaiting_update');
  };

  const handleOnboardingResponse = async (userMessage: string) => {
    const lowerMessage = userMessage.toLowerCase();

    switch (onboardingStep) {
      case 1:
        // Step 1: Confirm current role
        if (lowerMessage.includes('yes') || lowerMessage.includes('correct') || lowerMessage.includes('that\'s right')) {
          // Step 2: Frame the Goal & Capture "The What" (Journeys) - following PDF guide
          showMessage('assistant', `Perfect. Now, to make our future check-ins fast and effective, it helps to know what you're working on. What are the 1-3 main projects or initiatives you're focused on right now? You can think of these as your major 'Journeys'.`);
          setOnboardingStep(2);
        } else {
          showMessage('assistant', `No problem! What's your current role and company?`);
        }
        break;

      case 2:
        // Step 2: Collect main projects/initiatives
        if (userMessage.trim().length > 10) {
          // Step 3: Capture "The Why" (Goals) - following PDF guide
          showMessage('assistant', `Great! Those sound like important initiatives. For each of these projects, what are you hoping to achieve? What would success look like for you personally and professionally?`);
          setOnboardingStep(3);
        } else {
          showMessage('assistant', `Could you tell me a bit more about what you're working on? I'd love to understand your main projects or focus areas.`);
        }
        break;

      case 3:
        // Step 3: Collect goals and complete onboarding
        if (userMessage.trim().length > 10) {
          await saveOnboardingProjects(userMessage);
          showMessage('assistant', `Perfect! I now understand your current focus areas and goals. I'm here whenever you want to share updates on your progress. Just tell me what you've been working on, and I'll help you capture and organize your achievements!`);
          setIsOnboardingComplete(true);
          setConversationState('awaiting_update');
        } else {
          showMessage('assistant', `I'd love to hear more about what success looks like for you with these projects. What are your goals?`);
        }
        break;
    }
  };

  const handleProjectUpdate = async (userMessage: string) => {
    showMessage('assistant', `That sounds like great progress! I'd love to help you structure this as a milestone. Can you tell me more about the specific challenge you addressed and the impact you created?`);
    setConversationState('awaiting_update');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* Chat Messages Overlay - Properly stacked like GitHub project */}
      <AnimatePresence>
        {!isMinimized && (
          <div className="absolute top-20 right-8 bottom-32 w-80 pointer-events-auto">
            <div className="h-full overflow-y-auto space-y-4 pr-2">
              {messages.map((message, index) => {
                // Calculate opacity - newer messages are more visible, older fade
                const isRecent = index >= messages.length - 2;
                const baseOpacity = isRecent ? 1 : 0.4;
                
                return (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, x: 50, scale: 0.9 }}
                    animate={{ opacity: baseOpacity, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 50, scale: 0.9 }}
                    transition={{ 
                      duration: 0.4, 
                      ease: "easeOut",
                      delay: index * 0.1 
                    }}
                    className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'} transition-opacity duration-500`}
                  >
                    <div className={`max-w-xs px-4 py-3 rounded-2xl backdrop-blur-xl border shadow-xl ${
                      message.type === 'user'
                        ? 'bg-gradient-to-br from-green-500/90 to-emerald-600/90 text-white border-green-400/50'
                        : 'bg-gradient-to-br from-purple-600/90 to-indigo-700/90 text-white border-purple-400/50'
                    }`}>
                      <div className="flex items-start gap-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                          message.type === 'user' 
                            ? 'bg-white/30' 
                            : 'bg-white/30'
                        }`}>
                          {message.type === 'user' ? (
                            <FaUser className="w-3 h-3" />
                          ) : (
                            <FaRobot className="w-3 h-3" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="text-xs leading-relaxed whitespace-pre-line">
                            {message.content}
                          </p>
                          {!isRecent && (
                            <div className="text-xs opacity-50 mt-1">
                              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Voice Recording Indicator */}
      <AnimatePresence>
        {isListening && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute bottom-32 left-1/2 transform -translate-x-1/2"
          >
            <div className="bg-red-500/90 backdrop-blur-sm px-4 py-2 rounded-full text-white text-sm border border-red-400/30">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                Listening...
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Current Transcript Display */}
      <AnimatePresence>
        {currentTranscript && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-40 left-1/2 transform -translate-x-1/2 max-w-md mx-4"
          >
            <div className="bg-slate-800/90 backdrop-blur-sm px-4 py-3 rounded-xl text-purple-100 text-sm border border-purple-500/20">
              {currentTranscript}
            </div>
          </motion.div>
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
            <div className="flex gap-2">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleTextSubmit(e);
                  }
                }}
                placeholder="Type your response..."
                className="px-4 py-3 bg-slate-800/90 backdrop-blur-xl border border-purple-500/30 rounded-2xl text-white placeholder-purple-300/70 focus:outline-none focus:border-purple-400 w-64"
                disabled={isProcessing}
              />
              <button
                type="button"
                onClick={handleTextSubmit}
                className="px-4 py-3 bg-purple-600/90 hover:bg-purple-700/90 backdrop-blur-xl rounded-2xl text-white transition-colors disabled:opacity-50 border border-purple-500/30"
                disabled={!textInput.trim() || isProcessing}
              >
                <FaPaperPlane className="w-4 h-4" />
              </button>
              <button
                onClick={handleVoiceToggle}
                className={`px-4 py-3 rounded-2xl text-white transition-colors backdrop-blur-xl border disabled:opacity-50 ${
                  isListening
                    ? 'bg-red-500/90 hover:bg-red-600/90 border-red-400/30'
                    : 'bg-purple-600/90 hover:bg-purple-700/90 border-purple-500/30'
                }`}
                disabled={isProcessing}
              >
                {isListening ? <FaMicrophoneSlash className="w-4 h-4" /> : <FaMicrophone className="w-4 h-4" />}
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

      {/* Processing Indicator */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-20 left-1/2 transform -translate-x-1/2"
          >
            <div className="bg-purple-600/90 backdrop-blur-sm px-4 py-2 rounded-full text-white text-sm border border-purple-400/30">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                Processing...
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default OverlayChat;