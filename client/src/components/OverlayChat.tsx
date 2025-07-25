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
  // Remove showInputBar state - always show input
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
        const latestExperience = profileData.filteredData?.experiences?.[0];
        const userName = profileData.filteredData?.name || 'there';
        
        let welcomeMessage;
        if (latestExperience && latestExperience.title && latestExperience.company) {
          welcomeMessage = `Welcome, ${userName}! I see you're a ${latestExperience.title} at ${latestExperience.company}. Is that correct?`;
        } else {
          welcomeMessage = `Welcome, ${userName}! To get started, could you tell me your current role and company?`;
        }
        
        setOnboardingStep(1);
        setConversationState('initial');
        showMessage('assistant', welcomeMessage);
      } else {
        // Returning user - ask about project updates
        showMessage('assistant', `Welcome back! Good to see you again. Do you have time to talk about your current projects?`);
        setConversationState('awaiting_update');
      }
    }
  }, [isOpen, profileData, userData]);

  // Listen for manual milestone addition requests with proper context
  useEffect(() => {
    const handleAddMilestone = (event: CustomEvent) => {
      const { parentNodeId, parentTitle, parentType, parentOrganization } = event.detail;
      console.log('Adding milestone for:', { parentNodeId, parentTitle, parentType, parentOrganization });
      
      // Set context with organization information
      setAddingMilestoneContext({
        parentNodeId,
        parentTitle,
        parentType,
        parentOrganization,
        step: 'situation' // Track which STAR step we're on
      });
      setConversationState('adding_milestone');
      
      // Clear any existing messages and start fresh for milestone creation
      setMessages([]);
      setCurrentMessage(null);
      
      // Start the conversation with proper context for the organization
      const contextMessage = `What would you like to add about your experience at **${parentOrganization}** as a ${parentTitle}?

I'll help you build a STAR story. Let's start with:

**Situation:** What specific challenge or opportunity did you encounter at ${parentOrganization}? What was the business context or problem you needed to address?`;
      
      showMessage('assistant', contextMessage, false); // Don't auto-fade this message
    };

    window.addEventListener('addMilestone', handleAddMilestone as EventListener);
    return () => window.removeEventListener('addMilestone', handleAddMilestone as EventListener);
  }, []);

  // Show message with auto-fade and scroll management
  const showMessage = (type: 'user' | 'assistant', content: string, temporary: boolean = true) => {
    const message: Message = {
      id: Date.now().toString(),
      type,
      content,
      timestamp: new Date(),
      isTemporary: temporary
    };

    setCurrentMessage(message);
    setMessages(prev => {
      const newMessages = [...prev, message];
      // Keep only the last 5 messages to prevent overcrowding
      return newMessages.slice(-5);
    });

    if (temporary) {
      // Auto-fade current message after 8 seconds and move older messages up
      setTimeout(() => {
        setCurrentMessage(null);
        // Remove the oldest message when current fades
        setMessages(prev => prev.slice(1));
      }, 8000);
    }
  };

  // Voice recording functionality
  const handleVoiceToggle = async () => {
    if (isListening) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          setAudioChunks(prev => [...prev, event.data]);
        }
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
        
        showMessage('assistant', `Great context! Now tell me:

**Task:** What was your specific responsibility or objective at **${addingMilestoneContext.parentOrganization}**? What did you need to accomplish or deliver?`, false);
        return;

      case 'task':
        // Second response - collect task
        setAddingMilestoneContext({
          ...addingMilestoneContext,
          task: userInput,
          step: 'action'
        });
        
        showMessage('assistant', `Perfect! Now the exciting part:

**Action:** What specific steps did you take? Walk me through your approach, methodology, or strategy to tackle this challenge.`, false);
        return;

      case 'action':
        // Third response - collect actions
        setAddingMilestoneContext({
          ...addingMilestoneContext,
          actions: userInput,
          step: 'result'
        });
        
        showMessage('assistant', `Excellent approach! Finally:

**Result:** What was the outcome? Include any metrics, improvements, or positive impact from your work at **${addingMilestoneContext.parentOrganization}**.`, false);
        return;

      case 'result':
        // Final response - create the complete STAR milestone
        const fullStory = `**Situation:** ${addingMilestoneContext.situation}

**Task:** ${addingMilestoneContext.task}

**Action:** ${addingMilestoneContext.actions}

**Result:** ${userInput}`;

        // Create and add the milestone
        try {
          const response = await fetch('/api/create-milestone', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userInput: fullStory,
              parentContext: addingMilestoneContext
            }),
          });

          if (response.ok) {
            const { milestone } = await response.json();
            
            // Add the milestone as a sub-milestone
            if (onSubMilestoneAdded) {
              onSubMilestoneAdded(addingMilestoneContext.parentNodeId, milestone);
            }
            
            showMessage('assistant', `🎉 Perfect! I've added your milestone about this achievement at **${addingMilestoneContext.parentOrganization}**. That's a great STAR story showcasing your impact!`);
            
            // Reset the milestone creation context
            setAddingMilestoneContext(null);
            setConversationState('awaiting_update');
          } else {
            showMessage('assistant', 'Sorry, there was an error saving your milestone. Please try again.');
          }
        } catch (error) {
          console.error('Error creating milestone:', error);
          showMessage('assistant', 'Sorry, there was an error creating the milestone. Please try again.');
        }
        break;
    }
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
          showMessage('assistant', `No problem! Please tell me your current role and company so I can understand your professional context.`);
          setOnboardingStep(1); // Stay on step 1 until we get current role
        }
        break;
      case 2:
        // Step 3: Add Context to Each Journey - following PDF guide
        if (userMessage.trim().length > 10) {
          showMessage('assistant', `Excellent. This gives us the 'buckets' to track your progress against. To make sure I understand them, could you give me a one-sentence goal for each project you mentioned?`);
          setOnboardingStep(3);
        } else {
          showMessage('assistant', `Could you provide more detail about your main projects or initiatives? What are you currently working on?`);
        }
        break;
      case 3:
        // Step 4: The Payoff and Next Steps - following PDF guide
        if (userMessage.trim().length > 10) {
          const userName = profileData?.filteredData?.name || 'there';
          const role = profileData?.filteredData?.experiences?.[0]?.title || 'your role';
          const company = profileData?.filteredData?.experiences?.[0]?.company || 'your company';
          
          showMessage('assistant', `Thank you, ${userName}. I've got it all. Now I understand that you're a ${role} at ${company}, and I have context on your main projects and goals.

When you tell me next week about your progress, I'll know exactly which project it relates to and can track it properly in your journey.

I'm ready to start capturing your progress. Feel free to share updates anytime!`);
          
          // Save the onboarding projects and mark as complete
          await saveOnboardingProjects(userMessage);
          setIsOnboardingComplete(true);
          setConversationState('awaiting_update');
        } else {
          showMessage('assistant', `Could you provide a bit more detail about the goals for each project you mentioned?`);
        }
        break;
    }
  };

  // Save pending updates
  const savePendingUpdates = async () => {
    if (pendingUpdates.length === 0) return;
    
    for (const update of pendingUpdates) {
      if (onSubMilestoneAdded && addingMilestoneContext) {
        onSubMilestoneAdded(addingMilestoneContext.parentNodeId, update);
        showMessage('assistant', `Perfect! I've added "${update.title}" to your journey at ${addingMilestoneContext.parentOrganization}. Your STAR story has been saved!`);
      } else if (onMilestoneAdded) {
        onMilestoneAdded(update);
        showMessage('assistant', `Great! I've added "${update.title}" to your journey.`);
      }
    }
    
    // Reset state
    setPendingUpdates([]);
    setAddingMilestoneContext(null);
    setConversationState('awaiting_update');
  };

  // Handle regular project updates (when not adding milestones)
  const handleProjectUpdate = async (userMessage: string) => {
    const input = userMessage.trim();
    
    if (input.toLowerCase() === 'confirm') {
      await savePendingUpdates();
      return;
    }
    
    showMessage('assistant', `I'm about to add/update the following:

• Subtask added to "I worked on discussing the plan with eng team": "${input}"

Say 'confirm' to save, or tell me what to edit.`);
    
    const updateData = {
      id: `sub-subtask-${Date.now()}-${Math.random()}`,
      title: input,
      type: 'subtask' as const,
      date: new Date().toISOString().split('T')[0],
      description: input,
      skills: [],
      targetNodeId: existingNodes[existingNodes.length - 1]?.id || null
    };
    
    setPendingUpdates([updateData]);
    setConversationState('confirming_updates');
  };

  const findTargetNode = (statement: string) => {
    const lowerStatement = statement.toLowerCase();
    
    for (const node of existingNodes) {
      if (node.data.organization && 
          lowerStatement.includes(node.data.organization.toLowerCase())) {
        return node;
      }
    }
    
    return existingNodes[existingNodes.length - 1] || null;
  };

  const generatePreviewMessage = (updates: any[]): string => {
    let preview = "I'm about to add/update the following:\n\n";
    
    const milestones = updates.filter(u => u.type === 'milestone');
    const subtasks = updates.filter(u => u.type === 'subtask');
    
    milestones.forEach(milestone => {
      preview += `• Milestone: "${milestone.title}" on ${milestone.date}\n`;
    });
    
    subtasks.forEach(subtask => {
      const parentNode = existingNodes.find(n => n.id === subtask.targetNodeId);
      const parentName = parentNode?.data.title || 'Current Project';
      preview += `• Subtask added to "${parentName}": "${subtask.title}"\n`;
    });
    
    preview += "\nSay 'confirm' to save, or tell me what to edit.";
    return preview;
  };

  // Save onboarding projects to create initial milestones
  const saveOnboardingProjects = async (projectDetails: string) => {
    try {
      // Extract projects from user's response and create initial milestones
      const response = await fetch('/api/save-projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          projects: projectDetails,
          isOnboarding: true 
        })
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* Chat Messages Overlay - Properly stacked like GitHub project */}
      <AnimatePresence>
        {!isMinimized && (
          <div className="absolute top-20 right-8 bottom-32 w-80 pointer-events-auto">
            <div className="h-full overflow-y-auto space-y-4 pr-2">
              {messages.map((message, index) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, x: 50, scale: 0.9 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 50, scale: 0.9 }}
                  transition={{ 
                    duration: 0.4, 
                    ease: "easeOut",
                    delay: index * 0.1 
                  }}
                  className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
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
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
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