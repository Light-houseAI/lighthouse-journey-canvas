import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaRobot, FaUser, FaArrowLeft, FaPaperPlane } from 'react-icons/fa';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
import STARDocumentationPanel from './STARDocumentationPanel';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isComplete?: boolean;
}

interface ConversationPageProps {
  selectedCategory: string;
  onBack: () => void;
  onComplete: (data: any) => void;
}

// Scripted conversation messages
const scriptedMessages = [
  "What new updates do you have? Any upcoming interviews or recent developments?",
  "That's fantastic! Great job passing the initial recruiter screen. Can you share the job post link with me so I can help you with interview prep moving forward?",
  "I see you applied for a Data Scientist role on Walmart's Cortex Team building an A.I. conversational platform. Do you know what your upcoming interview round will focus on? Is it a case based interview or a behavioral interview for your past experience?",
  "Got it! Based on the role description, let's prepare a story where you showed end-to-end ownership—from request to dashboard. It'll take 5–10 minutes, and we'll save it to your journey and turn it into STAR format for you to share during your interview. Ready to start?",
  "Awesome, let's capture your story. First, what company and project do you want to talk about?"
];

const ConversationPage: React.FC<ConversationPageProps> = ({ 
  selectedCategory, 
  onBack, 
  onComplete 
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [textInput, setTextInput] = useState('');
  const [currentSpeaker, setCurrentSpeaker] = useState<'user' | 'assistant'>('assistant');
  const [isTyping, setIsTyping] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [userResponses, setUserResponses] = useState<string[]>([]);
  const [showSTARPanel, setShowSTARPanel] = useState(false);
  const [conversationComplete, setConversationComplete] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Start with first scripted message
  useEffect(() => {
    const firstMessage = scriptedMessages[0];
    const naviMessage: Message = {
      id: '1',
      type: 'assistant',
      content: firstMessage,
      timestamp: new Date(),
      isComplete: false,
    };
    
    setMessages([naviMessage]);
    setIsTyping(true);
    setCurrentSpeaker('user'); // Set immediately so input field shows
    
    // Simulate typing effect
    let currentIndex = 0;
    const typingInterval = setInterval(() => {
      currentIndex++;
      if (currentIndex >= firstMessage.length) {
        clearInterval(typingInterval);
        setMessages([{ ...naviMessage, isComplete: true }]);
        setIsTyping(false);
      }
    }, 30);

    return () => clearInterval(typingInterval);
  }, []);

  // Validate if the URL is a job post link
  const validateJobPostLink = (text: string): boolean => {
    const urlPattern = /https?:\/\/[^\s]+/;
    return urlPattern.test(text);
  };

  const handleTextSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!textInput.trim() || isThinking) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: textInput.trim(),
      timestamp: new Date(),
      isComplete: true,
    };
    
    setMessages(prev => [...prev, userMessage]);
    setUserResponses(prev => [...prev, textInput.trim()]);
    setTextInput('');
    
    // Show Navi thinking
    setIsThinking(true);
    setCurrentSpeaker('assistant');
    
    // Process the response and move to next message
    setTimeout(() => {
      setIsThinking(false);
      
      const nextIndex = currentMessageIndex + 1;
      
      if (nextIndex === 4) {
        // Show STAR panel and final message after user responds to "Ready to start?"
        setShowSTARPanel(true);
        setConversationComplete(true);
        
        // Add final Navi message
        const finalMessage: Message = {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: scriptedMessages[nextIndex],
          timestamp: new Date(),
          isComplete: true,
        };
        
        setMessages(prev => [...prev, finalMessage]);
        setCurrentMessageIndex(nextIndex);
        setCurrentSpeaker('user');
      } else if (nextIndex < scriptedMessages.length) {
        // Add next scripted message
        const nextMessage: Message = {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: scriptedMessages[nextIndex],
          timestamp: new Date(),
          isComplete: true,
        };
        
        setMessages(prev => [...prev, nextMessage]);
        setCurrentMessageIndex(nextIndex);
        setCurrentSpeaker('user');
        
        // If user just shared job post link, optionally validate it
        if (nextIndex === 2 && validateJobPostLink(userMessage.content)) {
          console.log('Job post link detected:', userMessage.content);
          // Here you could trigger link parsing/validation
        }
      }
    }, 1500); // 1.5 second thinking delay
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleTextSubmit();
    }
  };

  return (
    <div className="h-screen bg-gradient-to-br from-background via-background to-muted/20 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <FaArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <h1 className="text-lg font-semibold text-foreground">
            Add updates
          </h1>
          <div className="w-16" /> {/* Spacer for center alignment */}
        </div>
      </div>

      {/* Main Content Area - Chat and STAR Panel */}
      <div className="flex-1 flex max-w-none mx-auto w-full min-h-0 overflow-hidden">
        <div className={`${showSTARPanel ? 'w-1/2' : 'w-full max-w-4xl mx-auto'} flex flex-col bg-background/80 transition-all duration-300 min-h-0`}>
          {/* Chat Panel Header */}
          <div className="flex-shrink-0 p-6 border-b border-border/30 bg-background/90">
            <h2 className="text-lg font-semibold text-foreground mb-2">
              Chat with Navi
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Navi will help you prepare for your upcoming interview with guided questions
            </p>
          </div>
          
          {/* Chat Messages - Scrollable Area */}
          <div className="flex-1 overflow-y-auto min-h-0 bg-background/95">
            <div className="p-6">
              <div className="space-y-6 max-w-3xl mx-auto">
                {messages.map((message, index) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={`flex items-start gap-4 ${
                      message.type === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {message.type === 'assistant' && (
                      <div className="flex flex-col items-center gap-1">
                        <Avatar className={`w-12 h-12 transition-all duration-300 ${
                          currentSpeaker === 'assistant' ? 'ring-2 ring-primary' : 'grayscale opacity-70'
                        }`}>
                          <AvatarFallback className="bg-primary text-primary-foreground">
                            <FaRobot className="w-6 h-6" />
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs text-muted-foreground font-medium">Navi</span>
                      </div>
                    )}
                    
                    <div className={`max-w-lg ${
                      message.type === 'user' ? 'order-first' : ''
                    }`}>
                      <div className={`rounded-2xl px-6 py-4 shadow-sm border ${
                        message.type === 'assistant' 
                          ? 'bg-muted/60 border-border/50 text-foreground' 
                          : 'bg-primary text-primary-foreground border-primary/20'
                      }`}>
                        {message.type === 'assistant' && !message.isComplete ? (
                          <div className="flex items-center gap-2">
                            <span className="text-sm leading-relaxed">{message.content.slice(0, Math.floor(message.content.length * 0.7))}</span>
                            <div className="w-1 h-4 bg-primary animate-pulse rounded-sm" />
                          </div>
                        ) : (
                          <p className="text-sm leading-relaxed">{message.content}</p>
                        )}
                      </div>
                    </div>

                    {message.type === 'user' && (
                      <div className="flex flex-col items-center gap-1">
                        <Avatar className={`w-12 h-12 transition-all duration-300 ${
                          currentSpeaker === 'user' ? 'ring-2 ring-primary' : 'grayscale opacity-70'
                        }`}>
                          <AvatarFallback className="bg-secondary text-secondary-foreground">
                            <FaUser className="w-6 h-6" />
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs text-muted-foreground font-medium">You</span>
                      </div>
                    )}
                  </motion.div>
                ))}

                {/* Thinking indicator */}
                {isThinking && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-start gap-4 justify-start"
                  >
                    <div className="flex flex-col items-center gap-1">
                      <Avatar className="w-12 h-12 ring-2 ring-primary">
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          <FaRobot className="w-6 h-6" />
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-muted-foreground font-medium">Navi</span>
                    </div>
                    <div className="bg-muted/60 border-border/50 text-foreground rounded-2xl px-6 py-4 shadow-sm border max-w-lg">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                        <span className="text-sm text-muted-foreground">Thinking...</span>
                      </div>
                    </div>
                  </motion.div>
                )}
                
                <div ref={messagesEndRef} />
              </div>
            </div>
          </div>

          {/* Text Input Section - Fixed at Bottom */}
          {currentSpeaker === 'user' && !isTyping && (
            <div className="flex-shrink-0 p-6 border-t border-border/30 bg-background/95 backdrop-blur-sm">
              <form onSubmit={handleTextSubmit} className="max-w-3xl mx-auto">
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <Input
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Type your response..."
                      disabled={isThinking}
                      className="resize-none min-h-[48px] bg-background/80 backdrop-blur-sm border-border/40 focus:border-primary/50 text-foreground placeholder:text-muted-foreground text-base px-4 py-3"
                    />
                  </div>
                  <Button
                    type="submit"
                    size="icon"
                    disabled={!textInput.trim() || isThinking}
                    className="h-12 w-12 bg-primary hover:bg-primary/80 text-primary-foreground shrink-0"
                  >
                    <FaPaperPlane className="w-5 h-5" />
                  </Button>
                </div>
              </form>
            </div>
          )}
        </div>
        
        {/* STAR Documentation Panel */}
        <STARDocumentationPanel isVisible={showSTARPanel} />
      </div>
    </div>
  );
};

export default ConversationPage;