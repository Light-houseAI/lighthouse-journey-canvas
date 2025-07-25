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

  // Listen for manual milestone addition requests
  useEffect(() => {
    const handleAddMilestone = (event: CustomEvent) => {
      const { parentNodeId, parentTitle, parentType, parentOrganization } = event.detail;
      console.log('Adding milestone for:', { parentNodeId, parentTitle, parentType, parentOrganization });
      
      setAddingMilestoneContext({
        parentNodeId,
        parentTitle,
        parentType,
        parentOrganization
      });
      setConversationState('adding_milestone');
      
      // Clear any existing messages and start fresh for milestone creation
      setMessages([]);
      setCurrentMessage(null);
      
      // Start the conversation for gathering milestone details using STAR format
      const contextMessage = `What would you like to add about your experience at ${parentOrganization || parentTitle}?

I'll help you build a STAR story that showcases your achievement. Let's start with:

**What was the milestone or achievement you worked on?** (The Situation/Task)
Please describe the specific project, challenge, or goal you tackled.`;
      
      showMessage('assistant', contextMessage);
    };

    window.addEventListener('addMilestone', handleAddMilestone as EventListener);
    return () => window.removeEventListener('addMilestone', handleAddMilestone as EventListener);
  }, []);

  // Show message with auto-fade after 8 seconds
  const showMessage = (type: 'user' | 'assistant', content: string, temporary: boolean = true) => {
    const message: Message = {
      id: Date.now().toString(),
      type,
      content,
      timestamp: new Date(),
      isTemporary: temporary
    };

    setCurrentMessage(message);
    setMessages(prev => [...prev, message]);

    if (temporary) {
      // Auto-fade message after 8 seconds
      setTimeout(() => {
        setCurrentMessage(null);
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

  // AI Response processing (simplified version of the original logic)
  const simulateAIResponse = async (userMessage: string) => {
    console.log('simulateAIResponse called with:', { userMessage, isOnboardingComplete, onboardingStep, conversationState, addingMilestoneContext });
    setIsProcessing(true);
    await new Promise(resolve => setTimeout(resolve, 1500));

    if (conversationState === 'adding_milestone') {
      console.log('Handling manual milestone creation');
      await handleManualMilestoneCreation(userMessage);
    } else if (conversationState === 'confirming_updates') {
      console.log('Handling confirmation');
      await handleConfirmation(userMessage);
    } else if (!isOnboardingComplete) {
      console.log('Handling onboarding response');
      await handleOnboardingResponse(userMessage);
    } else {
      console.log('Handling project update for returning user');
      await handleProjectUpdate(userMessage);
    }
    
    setIsProcessing(false);
  };

  // Handle manual milestone creation with STAR format
  const handleManualMilestoneCreation = async (userInput: string) => {
    if (!addingMilestoneContext) return;

    // Check if we're in the middle of collecting STAR story details
    if (!addingMilestoneContext.situation) {
      // First response - situation/task
      setAddingMilestoneContext({
        ...addingMilestoneContext,
        situation: userInput
      });
      
      showMessage('assistant', `Great! Now tell me:

**Why were you working on this milestone?** (The context/background)
What led to this project or challenge? What was the business need or problem you were solving?`);
      return;
    } else if (!addingMilestoneContext.actions) {
      // Second response - actions
      setAddingMilestoneContext({
        ...addingMilestoneContext,
        actions: userInput
      });
      
      showMessage('assistant', `Excellent! Now tell me:

**What specific actions did you take?** (Your approach)
What steps did you personally take to tackle this challenge? What was your methodology or strategy?`);
      return;
    } else if (!addingMilestoneContext.results) {
      // Third response - results
      setAddingMilestoneContext({
        ...addingMilestoneContext,
        results: userInput
      });
      
      showMessage('assistant', `Perfect! Finally:

**What was the result or impact?** (The outcome)
What did you achieve? Include any metrics, improvements, or positive outcomes from your work.`);
      return;
    } else {
      // Final response - create the complete STAR milestone
      const fullStory = `**Situation:** ${addingMilestoneContext.situation}

**Task:** ${addingMilestoneContext.actions}

**Action:** ${addingMilestoneContext.results}

**Result:** ${userInput}`;
      
      const milestoneData = {
        id: `milestone-${Date.now()}-${Math.random()}`,
        title: addingMilestoneContext.situation.slice(0, 50),
        type: 'project' as const,
        date: new Date().toISOString().split('T')[0],
        description: fullStory,
        skills: [],
        organization: addingMilestoneContext.parentOrganization,
        targetNodeId: addingMilestoneContext.parentNodeId
      };
      
      setPendingUpdates([milestoneData]);
      setConversationState('confirming_updates');
      
      const previewMessage = `Perfect! I'll add this STAR story to "${addingMilestoneContext.parentTitle}" at ${addingMilestoneContext.parentOrganization}:

**Title:** ${milestoneData.title}
**Full STAR Story:**
${fullStory}

Say 'confirm' to save, or tell me what to edit.`;
      
      showMessage('assistant', previewMessage);
      return;
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

  // Remove the duplicate savePendingUpdates function to avoid conflicts
  // The one defined earlier in the component (around line 435) will be used

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