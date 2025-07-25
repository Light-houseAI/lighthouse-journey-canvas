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
  const [conversationState, setConversationState] = useState<'initial' | 'awaiting_update' | 'awaiting_confirmation' | 'confirmed' | 'adding_milestone'>('initial');
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
      
      // Start the conversation for gathering milestone details
      const contextMessage = `I see you want to add a project or milestone to "${parentTitle}"${parentOrganization ? ` at ${parentOrganization}` : ''}. Let me help you create this!

Tell me about the project or milestone you'd like to add. What is it called and what does it involve?`;
      
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
    console.log('simulateAIResponse called with:', { userMessage, isOnboardingComplete, onboardingStep, conversationState });
    setIsProcessing(true);
    await new Promise(resolve => setTimeout(resolve, 1500));

    if (conversationState === 'adding_milestone') {
      console.log('Handling manual milestone creation');
      await handleManualMilestoneCreation(userMessage);
    } else if (!isOnboardingComplete) {
      console.log('Handling onboarding response');
      await handleOnboardingResponse(userMessage);
    } else {
      console.log('Handling project update for returning user');
      await handleProjectUpdate(userMessage);
    }
    
    setIsProcessing(false);
  };

  // Handle manual milestone creation
  const handleManualMilestoneCreation = async (userInput: string) => {
    if (!addingMilestoneContext) return;

    // Use AI to parse the user input and create a well-structured milestone
    try {
      const response = await fetch('/api/create-milestone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userInput,
          parentContext: addingMilestoneContext
        })
      });

      if (response.ok) {
        const { milestone } = await response.json();
        
        // Add the milestone as a sub-milestone
        if (onSubMilestoneAdded) {
          onSubMilestoneAdded(addingMilestoneContext.parentNodeId, milestone);
        }

        showMessage('assistant', `Great! I've added "${milestone.title}" as a new project under ${addingMilestoneContext.parentTitle}. You can see it connected to your career journey now.`);
        
        // Reset state
        setAddingMilestoneContext(null);
        setConversationState('awaiting_update');
      } else {
        showMessage('assistant', 'I had trouble creating that milestone. Could you provide a bit more detail about what this project involves?');
      }
    } catch (error) {
      console.error('Error creating milestone:', error);
      showMessage('assistant', 'Something went wrong while creating the milestone. Please try again.');
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

  const handleProjectUpdate = async (userMessage: string) => {
    const lowerMessage = userMessage.toLowerCase();
    
    if (conversationState === 'awaiting_confirmation') {
      if (lowerMessage.includes('confirm') || lowerMessage.includes('yes')) {
        await savePendingUpdates();
        return;
      } else if (lowerMessage.includes('cancel') || lowerMessage.includes('no')) {
        setPendingUpdates([]);
        setConversationState('awaiting_update');
        showMessage('assistant', 'Updates discarded. What would you like to share about your projects?');
        return;
      }
    }

    // Parse and process the update
    const updates = await parseUserUpdate(userMessage);
    if (updates.length > 0) {
      setPendingUpdates(updates);
      setConversationState('awaiting_confirmation');
      
      const preview = generatePreviewMessage(updates);
      showMessage('assistant', preview);
    } else {
      showMessage('assistant', 'Could you provide more specific details about what you\'ve accomplished?');
    }
  };

  const parseUserUpdate = async (userMessage: string): Promise<any[]> => {
    const updates: any[] = [];
    
    const statements = userMessage
      .split(/(?:and|,|;|\.|also|then|plus|additionally)/i)
      .map(s => s.trim())
      .filter(s => s.length > 3);

    for (const statement of statements.length > 0 ? statements : [userMessage]) {
      const trimmed = statement.trim();
      if (trimmed.length < 5) continue;

      const isMilestone = checkMilestoneCriteria(trimmed);
      const targetNode = findTargetNode(trimmed);
      
      const update = {
        id: `${isMilestone ? 'milestone' : 'subtask'}-${Date.now()}-${Math.random()}`,
        title: trimmed.length > 50 ? trimmed.substring(0, 47) + '...' : trimmed,
        type: isMilestone ? 'milestone' : 'subtask',
        date: new Date().toISOString().split('T')[0],
        description: trimmed,
        skills: [],
        organization: targetNode?.data?.organization || 'amazon',
        targetNodeId: targetNode?.id
      };
      
      updates.push(update);
    }
    
    return updates;
  };

  const checkMilestoneCriteria = (statement: string): boolean => {
    const milestoneKeywords = [
      'started', 'completed', 'launched', 'shipped', 'promoted', 'hired', 'certified',
      'graduated', 'finished project', 'interview', 'new job', 'phase completion',
      'released', 'published', 'deployed', 'achieved', 'earned', 'won', 'awarded'
    ];
    
    const subtaskKeywords = [
      'drafted', 'updated', 'ran tests', 'scheduled', 'prepared', 'reviewed',
      'researched', 'analyzed', 'documented', 'met with', 'discussed', 'planning',
      'working on', 'building', 'creating', 'presented'
    ];
    
    const lowerStatement = statement.toLowerCase();
    
    if (subtaskKeywords.some(keyword => lowerStatement.includes(keyword))) {
      return false;
    }
    
    if (milestoneKeywords.some(keyword => lowerStatement.includes(keyword))) {
      return true;
    }
    
    return false;
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

  const savePendingUpdates = async () => {
    for (const update of pendingUpdates) {
      if (conversationState === 'adding_milestone' && addingMilestoneContext && onSubMilestoneAdded) {
        // Use the specific context from the plus button click
        const milestone = {
          id: update.id,
          title: update.title,
          type: update.type,
          date: update.date,
          description: update.description,
          skills: update.skills,
          organization: update.organization
        };
        console.log('Adding milestone to specific parent:', addingMilestoneContext.parentNodeId);
        onSubMilestoneAdded(addingMilestoneContext.parentNodeId, milestone);
      } else if (update.targetNodeId && onSubMilestoneAdded) {
        const milestone = {
          id: update.id,
          title: update.title,
          type: update.type,
          date: update.date,
          description: update.description,
          skills: update.skills,
          organization: update.organization
        };
        onSubMilestoneAdded(update.targetNodeId, milestone);
      } else if (onMilestoneAdded) {
        onMilestoneAdded(update);
      }
    }
    
    setPendingUpdates([]);
    
    // Reset milestone context after adding
    if (conversationState === 'adding_milestone') {
      setAddingMilestoneContext(null);
      setConversationState('awaiting_update');
      showMessage('assistant', `Perfect! I've added the new milestone to "${addingMilestoneContext?.parentTitle}". Click any '+' button to add more projects!`);
    } else {
      setConversationState('awaiting_update');
      showMessage('assistant', `Great! I've added ${pendingUpdates.length} update${pendingUpdates.length > 1 ? 's' : ''} to your journey. What else would you like to share?`);
    }
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