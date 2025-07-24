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
  type: 'bigEvent' | 'keyActivity' | 'keyDecision' | 'education' | 'job' | 'transition' | 'skill' | 'event' | 'project';
  date: string;
  description: string;
  skills: string[];
  organization?: string;
  tags?: string[];
}

interface FloatingVoiceChatProps {
  onMilestoneAdded: (milestone: Milestone) => void;
}

const followUpQuestions = [
  "Tell me more about another significant moment in your career journey.",
  "What other projects or goals have you been working on?",
  "Can you describe a key decision you've made recently?",
  "What activities have you been doing to advance your career?",
  "Have there been any major events or milestones lately?",
  "What skills have you been developing or want to develop?",
];

let questionIndex = 0;

const FloatingVoiceChat: React.FC<FloatingVoiceChatProps> = ({ onMilestoneAdded }) => {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'assistant',
      content: "Hi! I'm Navi, your AI career guide. What projects or goals are you currently working on?",
      timestamp: new Date(),
    }
  ]);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [showAudioWaves, setShowAudioWaves] = useState(false);
  const [isAtTop, setIsAtTop] = useState(false);
  const [hasError, setHasError] = useState<string | null>(null);
  
  const recognitionRef = useRef<any>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const isRecognitionActive = useRef(false);
  const finalTranscriptRef = useRef('');

  // Initialize speech recognition
  const initializeRecognition = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      setHasError('Speech recognition is not supported in this browser. Please try Chrome or Edge.');
      return null;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    
    recognition.onstart = () => {
      console.log('Speech recognition started');
      isRecognitionActive.current = true;
      setHasError(null);
    };
    
    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';
      
      // Process all results from the beginning
      for (let i = 0; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }
      
      // Update the final transcript ref with only final results
      if (finalTranscript) {
        finalTranscriptRef.current = finalTranscript.trim();
      }
      
      // Display final + current interim (no accumulation of interim)
      const displayText = (finalTranscriptRef.current + ' ' + interimTranscript).trim();
      setCurrentTranscript(displayText);
    };
    
    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      let errorMessage = 'Speech recognition failed. Please try again.';
      
      switch (event.error) {
        case 'not-allowed':
          errorMessage = 'Microphone access denied. Please enable microphone permissions.';
          break;
        case 'no-speech':
          errorMessage = 'No speech detected. Please try speaking again.';
          break;
        case 'network':
          errorMessage = 'Network error. Please check your connection.';
          break;
      }
      
      setHasError(errorMessage);
      setIsListening(false);
      setShowAudioWaves(false);
      isRecognitionActive.current = false;
      
      // Reinitialize recognition for next use
      setTimeout(() => {
        recognitionRef.current = initializeRecognition();
      }, 100);
    };
    
    recognition.onend = () => {
      console.log('Speech recognition ended');
      isRecognitionActive.current = false;
      
      // Only restart if we're still supposed to be listening and not paused
      if (isListening && !isPaused) {
        try {
          // Reinitialize and start fresh recognition
          recognitionRef.current = initializeRecognition();
          if (recognitionRef.current) {
            recognitionRef.current.start();
          }
        } catch (error) {
          console.error('Error restarting recognition:', error);
          setHasError('Failed to restart speech recognition. Please try again.');
          setIsListening(false);
          setShowAudioWaves(false);
        }
      }
    };
    
    return recognition;
  };

  useEffect(() => {
    recognitionRef.current = initializeRecognition();
    
    return () => {
      if (recognitionRef.current && isRecognitionActive.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // Handle scroll position to adjust fade effect
  useEffect(() => {
    const handleScroll = () => {
      if (chatContainerRef.current) {
        const { scrollTop } = chatContainerRef.current;
        setIsAtTop(scrollTop <= 5); // Consider "at top" if within 5px
      }
    };

    const container = chatContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, []);

  // Keep last 10 messages for scrolling
  const visibleMessages = messages.slice(-10);

  const addMessage = (type: 'user' | 'assistant', content: string) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      type,
      content,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const classifyResponse = (message: string): { type: Milestone['type']; confidence: number; title: string; tags: string[] } => {
    const lowerMessage = message.toLowerCase();
    
    // Extract potential title from first sentence or significant phrases
    const sentences = message.split(/[.!?]/);
    const firstSentence = sentences[0]?.trim() || message.substring(0, 50);
    
    // Extract tags/keywords
    const skillWords = ['skill', 'learn', 'training', 'course', 'certification', 'workshop'];
    const eventWords = ['started', 'launched', 'completed', 'graduated', 'promoted', 'hired', 'interview'];
    const decisionWords = ['decided', 'chose', 'declined', 'accepted', 'changed', 'moved', 'relocated'];
    const activityWords = ['working', 'building', 'networking', 'updating', 'revising', 'attending'];
    
    const extractedTags: string[] = [];
    
    // Simple keyword extraction
    const words = lowerMessage.split(/\s+/);
    words.forEach(word => {
      if (['react', 'javascript', 'python', 'design', 'marketing', 'sales'].includes(word)) {
        extractedTags.push(word);
      }
    });
    
    // Classification logic
    if (eventWords.some(word => lowerMessage.includes(word))) {
      return { 
        type: 'bigEvent', 
        confidence: 0.8, 
        title: firstSentence.length > 60 ? firstSentence.substring(0, 60) + '...' : firstSentence,
        tags: extractedTags
      };
    }
    
    if (decisionWords.some(word => lowerMessage.includes(word))) {
      return { 
        type: 'keyDecision', 
        confidence: 0.7, 
        title: firstSentence.length > 60 ? firstSentence.substring(0, 60) + '...' : firstSentence,
        tags: extractedTags
      };
    }
    
    if (skillWords.some(word => lowerMessage.includes(word))) {
      return { 
        type: 'keyActivity', 
        confidence: 0.6, 
        title: firstSentence.length > 60 ? firstSentence.substring(0, 60) + '...' : firstSentence,
        tags: extractedTags
      };
    }
    
    if (activityWords.some(word => lowerMessage.includes(word))) {
      return { 
        type: 'keyActivity', 
        confidence: 0.5, 
        title: firstSentence.length > 60 ? firstSentence.substring(0, 60) + '...' : firstSentence,
        tags: extractedTags
      };
    }
    
    // Default classification
    return { 
      type: 'keyActivity', 
      confidence: 0.3, 
      title: firstSentence.length > 60 ? firstSentence.substring(0, 60) + '...' : firstSentence,
      tags: extractedTags
    };
  };

  const simulateAIResponse = async (userMessage: string) => {
    setIsProcessing(true);
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const classification = classifyResponse(userMessage);
    
    // Only create milestone if message is substantial enough
    if (userMessage.length > 20) {
      let response = '';
      
      // If confidence is low, ask for clarification
      if (classification.confidence < 0.5) {
        response = "Was this a major event like starting a new job, an activity you did to prepare, or a key decision you made? This will help me categorize it correctly in your journey.";
        addMessage('assistant', response);
      } else {
        // Create milestone with proper classification
        const milestone: Milestone = {
          id: Date.now().toString(),
          title: classification.title,
          type: classification.type,
          date: new Date().getFullYear().toString(),
          description: userMessage,
          skills: ['Communication', 'Problem Solving'],
          tags: classification.tags,
        };
        
        onMilestoneAdded(milestone);
        
        const typeDescriptions = {
          bigEvent: 'major milestone',
          keyActivity: 'important activity',
          keyDecision: 'key decision'
        };
        
        const typeDesc = typeDescriptions[classification.type] || 'milestone';
        response = `Great! I've added that ${typeDesc} to your career journey. ${followUpQuestions[questionIndex % followUpQuestions.length]}`;
        addMessage('assistant', response);
      }
    } else {
      addMessage('assistant', followUpQuestions[questionIndex % followUpQuestions.length]);
    }
    
    questionIndex++;
    setIsProcessing(false);
  };

  const handleStartListening = async () => {
    if (!recognitionRef.current) {
      setHasError('Speech recognition is not available');
      return;
    }

    try {
      // Stop any existing recognition session first
      if (isRecognitionActive.current) {
        recognitionRef.current.stop();
        await new Promise(resolve => setTimeout(resolve, 100)); // Small delay to ensure cleanup
      }

      setIsListening(true);
      setShowAudioWaves(true);
      setCurrentTranscript('');
      finalTranscriptRef.current = ''; // Reset the final transcript
      setIsPaused(false);
      setHasError(null);
      
      // Start speech recognition
      recognitionRef.current.start();
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      setHasError('Failed to start speech recognition. Please try again.');
      setIsListening(false);
      setShowAudioWaves(false);
    }
  };

  const handleStopAndSend = () => {
    if (recognitionRef.current && isRecognitionActive.current) {
      recognitionRef.current.stop();
    }
    
    setIsListening(false);
    setShowAudioWaves(false);
    setIsPaused(false);
    
    if (currentTranscript.trim()) {
      addMessage('user', currentTranscript.trim());
      simulateAIResponse(currentTranscript.trim());
    }
    
    // Reset both transcript states
    setCurrentTranscript('');
    finalTranscriptRef.current = '';
    
    // Reinitialize recognition for next use
    setTimeout(() => {
      recognitionRef.current = initializeRecognition();
    }, 100);
  };

  const handleStopAndDelete = () => {
    if (recognitionRef.current && isRecognitionActive.current) {
      recognitionRef.current.stop();
    }
    
    setIsListening(false);
    setShowAudioWaves(false);
    setIsPaused(false);
    
    // Reset both transcript states
    setCurrentTranscript('');
    finalTranscriptRef.current = '';
    
    // Reinitialize recognition for next use
    setTimeout(() => {
      recognitionRef.current = initializeRecognition();
    }, 100);
  };

  const handleTogglePause = () => {
    const newPausedState = !isPaused;
    setIsPaused(newPausedState);
    
    if (recognitionRef.current) {
      if (newPausedState) {
        // Pause recognition
        if (isRecognitionActive.current) {
          recognitionRef.current.stop();
        }
      } else {
        // Resume recognition
        try {
          recognitionRef.current.start();
        } catch (error) {
          console.error('Error resuming speech recognition:', error);
        }
      }
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80">
      {/* Floating Messages */}
        <div 
          ref={chatContainerRef}
          className="mb-4 space-y-2 max-h-[50vh] relative chat-container overflow-hidden hover:overflow-y-auto transition-all duration-300"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(255, 255, 255, 0.3) transparent',
            scrollbarGutter: 'stable',
            maskImage: isAtTop 
              ? 'none' 
              : 'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 50%, rgba(0,0,0,0.7) 70%, rgba(0,0,0,0.3) 85%, rgba(0,0,0,0) 100%)',
            WebkitMaskImage: isAtTop 
              ? 'none' 
              : 'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 50%, rgba(0,0,0,0.7) 70%, rgba(0,0,0,0.3) 85%, rgba(0,0,0,0) 100%)',
            transition: 'mask-image 0.3s ease, -webkit-mask-image 0.3s ease'
          }}
      >
        {/* Custom scrollbar styles */}
        <style>{`
          .chat-container:hover::-webkit-scrollbar {
            width: 4px;
          }
          .chat-container:hover::-webkit-scrollbar-track {
            background: transparent;
          }
          .chat-container:hover::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.3);
            border-radius: 2px;
          }
          .chat-container:hover::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.5);
          }
        `}</style>
        
        <AnimatePresence mode="popLayout">
          {visibleMessages.map((message, index) => {
            // Calculate position-based opacity for gradient fade
            const totalMessages = visibleMessages.length;
            const positionFromBottom = totalMessages - index;
            let positionOpacity = 1;
            
            // Fade messages that are further from bottom
            if (positionFromBottom > 4) {
              const fadePosition = (positionFromBottom - 4) / (totalMessages - 4);
              positionOpacity = Math.max(0.2, 1 - fadePosition * 0.8);
            }
            
            return (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ 
                  opacity: positionOpacity,
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
            );
          })}
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

        {/* Error message display */}
        {hasError && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-500/20 text-red-100 border border-red-400/30 p-3 rounded-xl backdrop-blur-sm shadow-lg"
          >
            <div className="text-xs text-red-300 mb-1">Error</div>
            <div className="text-sm" style={{ textShadow: '0 1px 2px rgba(0, 0, 0, 0.8)' }}>
              {hasError}
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
