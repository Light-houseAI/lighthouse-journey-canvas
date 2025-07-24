import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaMicrophone, 
  FaStop,
  FaTrash,
  FaRobot,
  FaUser,
  FaPause,
  FaPlay
} from 'react-icons/fa';
import { Send } from 'lucide-react';

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

interface FloatingVoiceChatProps {
  onMilestoneAdded: (milestone: Milestone) => void;
}

const mockAIResponses = [
  "Tell me about your first significant learning experience or educational milestone.",
  "What was your first job or internship like? How did you get it?",
  "Can you describe a moment when you learned a new skill that changed your career path?",
  "What transition in your career taught you the most about yourself?",
  "Tell me about a challenging project that helped you grow professionally.",
  "What skills do you feel were most crucial in your career development?",
];

let responseIndex = 0;

const FloatingVoiceChat: React.FC<FloatingVoiceChatProps> = ({ onMilestoneAdded }) => {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'assistant',
      content: "Hi! I'm Navi, your AI career guide. Let's explore your professional journey together.",
      timestamp: new Date(),
    }
  ]);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [showAudioWaves, setShowAudioWaves] = useState(false);

  // Keep only the last 6 messages
  const visibleMessages = messages.slice(-6);

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
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const lowerMessage = userMessage.toLowerCase();
    let milestoneType: 'education' | 'job' | 'transition' | 'skill' | 'event' | 'project' = 'job';
    
    if (lowerMessage.includes('school') || lowerMessage.includes('university') || lowerMessage.includes('college') || lowerMessage.includes('degree')) {
      milestoneType = 'education';
    } else if (lowerMessage.includes('skill') || lowerMessage.includes('learned') || lowerMessage.includes('training')) {
      milestoneType = 'skill';
    } else if (lowerMessage.includes('transition') || lowerMessage.includes('changed') || lowerMessage.includes('moved')) {
      milestoneType = 'transition';
    }

    if (userMessage.length > 50 && (lowerMessage.includes('job') || lowerMessage.includes('work') || lowerMessage.includes('company') || lowerMessage.includes('school'))) {
      const milestone: Milestone = {
        id: Date.now().toString(),
        title: `Career Milestone`,
        type: milestoneType,
        date: '2023',
        description: userMessage.substring(0, 100) + '...',
        skills: ['Communication', 'Problem Solving'],
      };
      
      onMilestoneAdded(milestone);
      addMessage('assistant', `Great! I've added that milestone to your career journey. ${mockAIResponses[responseIndex % mockAIResponses.length]}`);
    } else {
      addMessage('assistant', mockAIResponses[responseIndex % mockAIResponses.length]);
    }
    
    responseIndex++;
    setIsProcessing(false);
  };

  const handleStartListening = () => {
    setIsListening(true);
    setShowAudioWaves(true);
    setCurrentTranscript('');
    setIsPaused(false);
    
    // Simulate voice input for demo
    setTimeout(() => {
      const simulatedTranscript = "I graduated from university with a computer science degree in 2022";
      setCurrentTranscript(simulatedTranscript);
    }, 1000);
  };

  const handleStopAndSend = () => {
    setIsListening(false);
    setShowAudioWaves(false);
    setIsPaused(false);
    
    if (currentTranscript) {
      addMessage('user', currentTranscript);
      simulateAIResponse(currentTranscript);
    }
    setCurrentTranscript('');
  };

  const handleStopAndDelete = () => {
    setIsListening(false);
    setShowAudioWaves(false);
    setCurrentTranscript('');
    setIsPaused(false);
  };

  const handleTogglePause = () => {
    setIsPaused(prev => !prev);
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80">
      {/* Floating Messages */}
      <div className="mb-4 space-y-2">
        <AnimatePresence mode="popLayout">
          {visibleMessages.map((message, index) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ 
                opacity: index < visibleMessages.length - 3 ? 0.6 : 1,
                y: 0,
                scale: 1
              }}
              exit={{ 
                opacity: 0, 
                y: -20,
                transition: { duration: 0.3 }
              }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className={`flex gap-2 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.type === 'assistant' && (
                <div className="w-6 h-6 bg-primary/30 rounded-full flex items-center justify-center flex-shrink-0 mt-1 backdrop-blur-sm">
                  <FaRobot className="w-3 h-3 text-primary" />
                </div>
              )}
              <div
                className={`
                  max-w-[75%] p-3 rounded-xl text-sm backdrop-blur-sm shadow-lg
                  ${message.type === 'user' 
                    ? 'bg-emerald-500/20 text-emerald-100 border border-emerald-400/30' 
                    : 'bg-purple-500/20 text-purple-100 border border-purple-400/30'
                  }
                `}
                style={{
                  textShadow: '0 1px 2px rgba(0, 0, 0, 0.8)'
                }}
              >
                {message.content}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Processing indicator */}
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-2 justify-start"
          >
            <div className="w-6 h-6 bg-primary/30 rounded-full flex items-center justify-center flex-shrink-0 mt-1 backdrop-blur-sm">
              <FaRobot className="w-3 h-3 text-primary" />
            </div>
            <div className="bg-purple-500/20 text-purple-100 border border-purple-400/30 p-3 rounded-xl text-sm backdrop-blur-sm shadow-lg">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </motion.div>
        )}

        {/* Current transcript display */}
        {currentTranscript && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-blue-500/20 text-blue-100 border border-blue-400/30 p-3 rounded-xl backdrop-blur-sm shadow-lg"
          >
            <div className="text-xs text-blue-300 mb-1">Listening...</div>
            <div className="text-sm" style={{ textShadow: '0 1px 2px rgba(0, 0, 0, 0.8)' }}>
              {currentTranscript}
            </div>
          </motion.div>
        )}
      </div>

      {/* Control Interface */}
      <div className="flex flex-col items-end gap-2">
        {/* Modern Recording Interface (when listening) */}
        <AnimatePresence>
          {isListening && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="w-80 flex items-center gap-3"
            >
              {/* Delete Button - Outside pill on left */}
              <motion.button
                onClick={handleStopAndDelete}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-all duration-200 backdrop-blur-sm border border-red-400/30"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <FaTrash className="w-4 h-4" />
              </motion.button>

              {/* Main Pill Container */}
              <div className="flex-1 flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-primary/80 to-accent/80 rounded-full backdrop-blur-sm shadow-lg border border-white/10">
                {/* Pause Button - Inside pill on left */}
                <motion.button
                  onClick={handleTogglePause}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-all duration-200"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  {isPaused ? (
                    <FaPlay className="w-3 h-3 ml-0.5" />
                  ) : (
                    <FaPause className="w-3 h-3" />
                  )}
                </motion.button>

                {/* Waveform - Center of pill */}
                <div className="flex-1 flex items-center justify-center gap-1">
                  {[...Array(12)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="w-0.5 bg-white/90 rounded-full"
                      animate={{
                        height: isPaused ? [4] : [4, 16, 4],
                      }}
                      transition={{
                        duration: isPaused ? 0 : 0.6,
                        repeat: isPaused ? 0 : Infinity,
                        delay: i * 0.05,
                        ease: "easeInOut"
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Send Button - Outside pill on right */}
              <motion.button
                onClick={handleStopAndSend}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-emerald-500/20 text-white hover:bg-emerald-500/30 transition-all duration-200 backdrop-blur-sm border border-emerald-400/30"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <Send size={16} strokeWidth={2} />
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Start Talking Button (when not listening) */}
        <AnimatePresence>
          {!isListening && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={handleStartListening}
              disabled={isProcessing}
              className="px-6 py-3 bg-gradient-to-r from-primary/80 to-accent/80 text-white rounded-full backdrop-blur-sm shadow-lg hover:shadow-xl disabled:opacity-50 transition-all duration-200 flex items-center gap-3"
              whileHover={{ scale: 1.05, boxShadow: "0 0 30px hsl(var(--primary) / 0.4)" }}
              whileTap={{ scale: 0.95 }}
              style={{
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.8)'
              }}
            >
              <FaMicrophone className="w-4 h-4" />
              <span className="font-medium">Start talking</span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default FloatingVoiceChat;
