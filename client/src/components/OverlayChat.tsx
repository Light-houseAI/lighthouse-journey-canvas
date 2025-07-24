import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaMicrophone,
  FaMicrophoneSlash,
  FaRobot,
  FaUser,
  FaPaperPlane
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
  onClose: () => void;
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
  onClose,
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
  const [showInputBar, setShowInputBar] = useState(false);
  const [pendingUpdates, setPendingUpdates] = useState<any[]>([]);
  const [conversationState, setConversationState] = useState<'initial' | 'awaiting_update' | 'awaiting_confirmation' | 'confirmed'>('initial');

  // Conversation state for onboarding
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(false);

  // Initialize chat when component mounts
  useEffect(() => {
    if (isOpen && messages.length === 0 && profileData && userData) {
      const isOnboardingCompleted = userData.hasCompletedOnboarding || false;
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
        showMessage('assistant', welcomeMessage);
      } else {
        // Returning user - ask about project updates
        showMessage('assistant', `Welcome back! Good to see you again. Do you have time to talk about your current projects?`);
        setConversationState('awaiting_update');
      }
    }
  }, [isOpen, profileData, userData]);

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
      setShowInputBar(false);
    }
  };

  // AI Response processing (simplified version of the original logic)
  const simulateAIResponse = async (userMessage: string) => {
    setIsProcessing(true);
    await new Promise(resolve => setTimeout(resolve, 1500));

    if (!isOnboardingComplete) {
      await handleOnboardingResponse(userMessage);
    } else {
      await handleProjectUpdate(userMessage);
    }
    
    setIsProcessing(false);
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
      }
    } catch (error) {
      console.error('Error saving onboarding projects:', error);
    }
  };

  const savePendingUpdates = async () => {
    for (const update of pendingUpdates) {
      if (update.targetNodeId && onSubMilestoneAdded) {
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
    setConversationState('awaiting_update');
    showMessage('assistant', `Great! I've added ${pendingUpdates.length} update${pendingUpdates.length > 1 ? 's' : ''} to your journey. What else would you like to share?`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* Current Message Display - Center of screen */}
      <AnimatePresence>
        {currentMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 max-w-md mx-4"
          >
            <div className={`
              px-6 py-4 rounded-2xl shadow-2xl backdrop-blur-xl border
              ${currentMessage.type === 'user' 
                ? 'bg-gradient-to-br from-green-500/90 to-emerald-600/90 text-white border-green-400/30' 
                : 'bg-gradient-to-br from-purple-600/90 to-indigo-700/90 text-white border-purple-400/30'
              }
            `}>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-1">
                  {currentMessage.type === 'user' ? (
                    <FaUser className="w-4 h-4" />
                  ) : (
                    <FaRobot className="w-4 h-4" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm leading-relaxed whitespace-pre-line">
                    {currentMessage.content}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
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

      {/* Input Controls - Bottom of screen */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 pointer-events-auto">
        <div className="flex flex-col items-center gap-3">
          {/* Text Input Bar */}
          <AnimatePresence>
            {showInputBar && (
              <motion.form
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                onSubmit={handleTextSubmit}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Type your career update..."
                  className="px-4 py-2 bg-slate-800/90 backdrop-blur-sm border border-purple-500/20 rounded-xl text-white placeholder-purple-300 focus:outline-none focus:border-purple-400 w-64"
                  autoFocus
                />
                <Button
                  type="submit"
                  size="icon"
                  className="bg-purple-600 hover:bg-purple-700 h-10 w-10"
                  disabled={!textInput.trim()}
                >
                  <FaPaperPlane className="w-4 h-4" />
                </Button>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Control Buttons */}
          <div className="flex gap-3">
            <Button
              onClick={() => setShowInputBar(!showInputBar)}
              className="bg-slate-700/90 hover:bg-slate-600/90 backdrop-blur-sm text-white border border-slate-500/20"
              disabled={isProcessing}
            >
              Type
            </Button>
            
            <Button
              onClick={handleVoiceToggle}
              className={`backdrop-blur-sm border ${
                isListening
                  ? 'bg-red-500/90 hover:bg-red-600/90 border-red-400/30'
                  : 'bg-purple-600/90 hover:bg-purple-700/90 border-purple-500/20'
              } text-white`}
              disabled={isProcessing}
            >
              {isListening ? <FaMicrophoneSlash className="mr-2" /> : <FaMicrophone className="mr-2" />}
              {isListening ? 'Stop' : 'Voice'}
            </Button>
          </div>
        </div>
      </div>

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