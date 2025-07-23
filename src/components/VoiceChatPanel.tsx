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
import { Button } from './ui/button';

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
    }

    // Create a mock milestone if the message seems to describe one
    if (userMessage.length > 50 && (lowerMessage.includes('job') || lowerMessage.includes('work') || lowerMessage.includes('company') || lowerMessage.includes('school'))) {
      const milestone: Milestone = {
        id: Date.now().toString(),
        title: `Career Milestone`,
        type: milestoneType,
        date: '2023', // Would extract from message in real implementation
        description: userMessage.substring(0, 100) + '...',
        skills: ['Communication', 'Problem Solving'], // Would extract from message
      };
      
      onMilestoneAdded(milestone);
      addMessage('assistant', `Great! I've added that milestone to your career journey. ${mockAIResponses[responseIndex % mockAIResponses.length]}`);
    } else {
      addMessage('assistant', mockAIResponses[responseIndex % mockAIResponses.length]);
    }
    
    responseIndex++;
    setIsProcessing(false);
  };

  const handleVoiceToggle = () => {
    if (isListening) {
      setIsListening(false);
      setCurrentTranscript('');
      // In real implementation, would stop speech recognition
    } else {
      setIsListening(true);
      // In real implementation, would start speech recognition
      // Simulate voice input for demo
      setTimeout(() => {
        const simulatedTranscript = "I graduated from university with a computer science degree in 2022";
        setCurrentTranscript(simulatedTranscript);
        setTimeout(() => {
          setIsListening(false);
          addMessage('user', simulatedTranscript);
          simulateAIResponse(simulatedTranscript);
          setCurrentTranscript('');
        }, 2000);
      }, 1000);
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
          <div className="glass-morphism w-full h-full flex flex-col rounded-lg border border-border/30 shadow-xl">
            {/* Header */}
            <div className="p-4 border-b border-border/20 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <FaRobot className="text-primary" />
                Chat with Navi
              </h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                <FaTimes />
              </Button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-primary scrollbar-track-muted">
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-2 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.type === 'assistant' && (
                    <div className="w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                      <FaRobot className="w-3 h-3 text-primary" />
                    </div>
                  )}
                  <div
                    className={`
                      max-w-[80%] p-3 rounded-xl text-sm
                      ${message.type === 'user' 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-muted/80 text-foreground'
                      }
                    `}
                  >
                    {message.content}
                  </div>
                  {message.type === 'user' && (
                    <div className="w-6 h-6 bg-accent/20 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                      <FaUser className="w-3 h-3 text-accent" />
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
                  <div className="w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <FaRobot className="w-3 h-3 text-primary" />
                  </div>
                  <div className="bg-muted/80 text-foreground p-3 rounded-xl text-sm">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
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
                className="mx-4 mb-4 p-3 bg-primary/10 rounded-lg border border-primary/20"
              >
                <div className="text-xs text-primary mb-1">Listening...</div>
                <div className="text-sm text-foreground">{currentTranscript}</div>
              </motion.div>
            )}

            {/* Input Section */}
            <div className="p-4 border-t border-border/20">
              <Button
                onClick={handleVoiceToggle}
                className={`w-full py-3 ${
                  isListening 
                    ? 'bg-red-500 hover:bg-red-600' 
                    : 'bg-primary hover:bg-primary/80'
                }`}
                disabled={isProcessing}
              >
                <FaMicrophone className="mr-2" />
                {isListening ? 'Stop Recording' : 'Start talking'}
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default VoiceChatPanel;