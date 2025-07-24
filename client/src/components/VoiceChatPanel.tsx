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

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
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

interface VoiceChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onMilestoneAdded: (milestone: Milestone) => void;
}

// Mock AI responses with career guidance questions
const mockAIResponses = [
  "Tell me about your first significant learning experience or educational milestone.",
  "What was your first job or internship like? How did you get it?",
  "Can you describe a moment when you learned a new skill that changed your career path?",
  "What transition in your career taught you the most about yourself?",
  "Tell me about a challenging project that helped you grow professionally.",
  "What skills do you feel were most crucial in your career development?",
];

let responseIndex = 0;

const VoiceChatPanel: React.FC<VoiceChatPanelProps> = ({
  isOpen,
  onClose,
  onMilestoneAdded
}) => {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'assistant',
      content: "Hi! I'm your AI career guide. I'll help you explore and visualize your professional journey. Let's start by talking about your career milestones. What would you like to share first?",
      timestamp: new Date(),
    }
  ]);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [textInput, setTextInput] = useState('');
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const addMessage = (type: 'user' | 'assistant', content: string) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      type,
      content,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const simulateAIResponse = async (userMessage: string) => {
    setIsProcessing(true);
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Try to extract milestone information from user message (simplified)
    const lowerMessage = userMessage.toLowerCase();
    let milestoneType: 'education' | 'job' | 'transition' | 'skill' | 'event' | 'project' = 'job';

    if (lowerMessage.includes('school') || lowerMessage.includes('university') || lowerMessage.includes('college') || lowerMessage.includes('degree')) {
      milestoneType = 'education';
    } else if (lowerMessage.includes('skill') || lowerMessage.includes('learned') || lowerMessage.includes('training')) {
      milestoneType = 'skill';
    } else if (lowerMessage.includes('transition') || lowerMessage.includes('changed') || lowerMessage.includes('moved')) {
      milestoneType = 'transition';
    } else if (lowerMessage.includes('project') || lowerMessage.includes('built') || lowerMessage.includes('developed')) {
      milestoneType = 'project';
    }

    // Create a mock milestone if the message seems to describe one
    if (userMessage.length > 30 && (lowerMessage.includes('job') || lowerMessage.includes('work') || lowerMessage.includes('company') || lowerMessage.includes('school') || lowerMessage.includes('project') || lowerMessage.includes('learned'))) {
      const milestone: Milestone = {
        id: Date.now().toString(),
        title: `${milestoneType === 'education' ? 'Education' : milestoneType === 'job' ? 'Work Experience' : milestoneType === 'skill' ? 'Skill Development' : milestoneType === 'project' ? 'Project' : 'Career Milestone'}`,
        type: milestoneType,
        date: new Date().getFullYear().toString(),
        description: userMessage.length > 100 ? userMessage.substring(0, 97) + '...' : userMessage,
        skills: ['Communication', 'Problem Solving'], // Would extract from message in real implementation
        organization: extractOrganization(userMessage),
      };

      onMilestoneAdded(milestone);
      addMessage('assistant', `Great! I've added that milestone to your career journey. ${mockAIResponses[responseIndex % mockAIResponses.length]}`);
    } else {
      addMessage('assistant', mockAIResponses[responseIndex % mockAIResponses.length]);
    }

    responseIndex++;
    setIsProcessing(false);
  };

  const extractOrganization = (message: string): string | undefined => {
    const lowerMessage = message.toLowerCase();
    // Simple extraction - would be more sophisticated in real implementation
    const patterns = [
      /at ([A-Z][a-zA-Z\s&]+)/,
      /worked for ([A-Z][a-zA-Z\s&]+)/,
      /joined ([A-Z][a-zA-Z\s&]+)/,
    ];
    
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }
    return undefined;
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

        recorder.onstop = () => {
          // In a real implementation, you would send the audio to a speech-to-text service
          // For now, we'll simulate with a placeholder
          const simulatedTranscript = "I just completed a new project where I learned React and TypeScript";
          setCurrentTranscript(simulatedTranscript);
          
          setTimeout(() => {
            addMessage('user', simulatedTranscript);
            simulateAIResponse(simulatedTranscript);
            setCurrentTranscript('');
            setAudioChunks([]);
          }, 1000);
        };

        recorder.start();
        setMediaRecorder(recorder);
        setIsListening(true);
        
        // Simulate real-time transcription
        setTimeout(() => {
          setCurrentTranscript("I just completed a new project...");
        }, 1000);
        
      } catch (error) {
        console.error('Error accessing microphone:', error);
        // Fallback to text input or show error message
        addMessage('assistant', 'Unable to access microphone. Please use the text input instead.');
      }
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (textInput.trim()) {
      addMessage('user', textInput);
      simulateAIResponse(textInput);
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
                      max-w-[80%] p-3 rounded-xl text-sm
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
                />
                <Button
                  type="submit"
                  size="icon"
                  className="bg-purple-600 hover:bg-purple-700"
                  disabled={!textInput.trim()}
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

export default VoiceChatPanel;