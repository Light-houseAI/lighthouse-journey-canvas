import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaMicrophone, FaRobot, FaUser, FaArrowLeft } from 'react-icons/fa';
import { Button } from './ui/button';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isComplete?: boolean;
}

// Extend Window interface for speech recognition
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface ConversationPageProps {
  selectedCategory: string;
  onBack: () => void;
  onComplete: (data: any) => void;
}

type TopicSection = 'overview' | 'problem' | 'objective' | 'process' | 'learnings' | 'outcomes';

const categoryQuestions: Record<string, string> = {
  education: "Tell me about your educational experience. What did you study and what made it significant to your journey?",
  job: "What initiated your job search and what kind of position are you looking to get?",
  project: "Tell me about this project. What problem were you solving and what was your role?",
  skill: "What skill did you develop or want to develop? How does it fit into your career goals?",
  event: "Describe this significant event. What happened and how did it impact your career journey?",
  transition: "Tell me about this career transition. What motivated the change and where are you heading?",
  bigEvent: "What was this major milestone? Walk me through what happened and why it was important.",
  keyActivity: "Describe this key activity. What were you doing and what did you accomplish?",
  keyDecision: "Tell me about this important decision. What factors did you consider and what did you choose?",
};

const ConversationPage: React.FC<ConversationPageProps> = ({ 
  selectedCategory, 
  onBack, 
  onComplete 
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [currentSpeaker, setCurrentSpeaker] = useState<'user' | 'assistant'>('assistant');
  const [isTyping, setIsTyping] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [processingTopic, setProcessingTopic] = useState<TopicSection | null>(null);
  const [activeTopic, setActiveTopic] = useState<TopicSection>('overview');
  const [topicContents, setTopicContents] = useState<Record<TopicSection, string>>({
    overview: '',
    problem: '',
    objective: '',
    process: '',
    learnings: '',
    outcomes: '',
  });
  
  const recognitionRef = useRef<any>(null);
  const isRecognitionActive = useRef(false);

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setCurrentTranscript(transcript);
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        isRecognitionActive.current = false;
      };

      recognitionRef.current.onend = () => {
        if (isRecognitionActive.current) {
          recognitionRef.current?.start();
        }
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // Start with Navi's greeting
  useEffect(() => {
    const question = categoryQuestions[selectedCategory] || categoryQuestions.project;
    const naviMessage: Message = {
      id: '1',
      type: 'assistant',
      content: question,
      timestamp: new Date(),
      isComplete: false,
    };
    
    setMessages([naviMessage]);
    setIsTyping(true);
    
    // Simulate typing effect
    let currentIndex = 0;
    const typingInterval = setInterval(() => {
      currentIndex++;
      if (currentIndex >= question.length) {
        clearInterval(typingInterval);
        setMessages([{ ...naviMessage, isComplete: true }]);
        setIsTyping(false);
        setCurrentSpeaker('user');
      }
    }, 30);

    return () => clearInterval(typingInterval);
  }, [selectedCategory]);

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      setIsListening(true);
      setCurrentTranscript('');
      isRecognitionActive.current = true;
      recognitionRef.current.start();
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      setIsListening(false);
      isRecognitionActive.current = false;
      recognitionRef.current.stop();
    }
  };

  const startOver = () => {
    stopListening();
    setCurrentTranscript('');
  };

  // Function to enhance and rephrase user responses with AI
  const enhanceResponse = async (transcript: string, topic: TopicSection): Promise<string> => {
    // Basic cleanup first
    const cleaned = transcript.trim()
      .replace(/\s+/g, ' ')
      .replace(/\b(uh|um|like|you know|so yeah|basically)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    // For now, return enhanced version - in production this would call an AI service
    const topicContext = {
      overview: "Provide a clear overview of the project or experience",
      problem: "Describe the specific problem that needed to be solved",
      objective: "Explain the main goals and desired outcomes",
      process: "Detail the methodology and approach taken",
      learnings: "Highlight key insights and skills developed",
      outcomes: "Describe the results and impact achieved"
    };

    // Enhanced version with better structure and clarity
    const enhanced = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    const withPunctuation = enhanced.endsWith('.') || enhanced.endsWith('!') || enhanced.endsWith('?') 
      ? enhanced 
      : enhanced + '.';
    
    return withPunctuation;
  };

  const sendMessage = async () => {
    if (currentTranscript.trim()) {
      const userMessage: Message = {
        id: Date.now().toString(),
        type: 'user',
        content: currentTranscript.trim(),
        timestamp: new Date(),
        isComplete: true,
      };
      
      setMessages(prev => [...prev, userMessage]);
      setCurrentTranscript('');
      stopListening();
      
      // Show Navi thinking and card loading
      setIsThinking(true);
      setProcessingTopic(activeTopic);
      setCurrentSpeaker('assistant');
      
      // Add Navi's thinking message
      const thinkingMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'Thinking...',
        timestamp: new Date(),
        isComplete: false,
      };
      setMessages(prev => [...prev, thinkingMessage]);
      
      // Process and enhance the response
      try {
        const enhancedResponse = await enhanceResponse(userMessage.content, activeTopic);
        
        // Simulate processing time (2-4 seconds)
        setTimeout(() => {
          // Update topic card with enhanced content
          setTopicContents(prev => ({
            ...prev,
            [activeTopic]: enhancedResponse
          }));
          
          // Clear thinking states
          setIsThinking(false);
          setProcessingTopic(null);
          
          // Remove thinking message and add completion message
          setMessages(prev => {
            const filtered = prev.filter(msg => msg.content !== 'Thinking...');
            return [...filtered, {
              id: (Date.now() + 2).toString(),
              type: 'assistant',
              content: 'Great! I\'ve captured that information.',
              timestamp: new Date(),
              isComplete: true,
            }];
          });
          
          // Check if all topics are filled
          const updatedContents = { ...topicContents, [activeTopic]: enhancedResponse };
          const filledTopics = Object.values(updatedContents).filter(content => content.trim()).length;
          
          if (filledTopics >= 6) {
            // All topics filled, complete the conversation
            setTimeout(() => {
              onComplete({
                category: selectedCategory,
                topicContents: updatedContents,
                timestamp: new Date(),
              });
            }, 1000);
          } else {
            // Set speaker back to user for next topic
            setTimeout(() => {
              setCurrentSpeaker('user');
            }, 1500);
          }
        }, 2500); // 2.5 second delay
      } catch (error) {
        console.error('Error enhancing response:', error);
        setIsThinking(false);
        setProcessingTopic(null);
      }
    }
  };

  const formatCategoryTitle = (category: string): string => {
    const titleMap: Record<string, string> = {
      education: "Education",
      job: "Job Search",
      project: "Project",
      skill: "Skill Development",
      event: "Life Event",
      transition: "Career Transition",
      bigEvent: "Major Milestone",
      keyActivity: "Key Activity",
      keyDecision: "Important Decision",
    };
    return titleMap[category] || category;
  };

  // Helper function to get card styling based on active state
  const getCardStyling = (topicId: TopicSection) => {
    const isActive = activeTopic === topicId;
    const isProcessing = processingTopic === topicId;
    
    if (isProcessing) {
      return 'bg-card border-2 border-primary/50 shadow-lg shadow-primary/20 rounded-xl p-6 transition-all duration-300 animate-pulse';
    }
    
    return isActive 
      ? 'bg-card border-2 border-primary/50 shadow-lg shadow-primary/20 rounded-xl p-6 transition-all duration-300'
      : 'bg-card border border-border rounded-xl p-6 transition-all duration-300 hover:border-border/80';
  };

  // Helper function to render topic content with loading state
  const renderTopicContent = (topicId: TopicSection, content: string, placeholder: string) => {
    const isProcessing = processingTopic === topicId;
    
    if (isProcessing) {
      return (
        <div className="space-y-2">
          <div className="h-4 bg-muted-foreground/20 rounded animate-pulse" />
          <div className="h-4 bg-muted-foreground/20 rounded animate-pulse w-3/4" />
          <div className="h-4 bg-muted-foreground/20 rounded animate-pulse w-1/2" />
        </div>
      );
    }
    
    return content ? (
      <motion.p 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="text-foreground"
      >
        {content}
      </motion.p>
    ) : (
      <p className="italic text-muted-foreground">
        {placeholder}
      </p>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex flex-col">
      {/* Header */}
      <div className="border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
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

      {/* Conversation Area */}
      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full px-6 py-8">
        {/* Chat Messages Section */}
        <div className="flex-1 space-y-6 min-h-0">
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
                <div className="flex flex-col items-center gap-2">
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
              
              <div className={`max-w-2xl ${
                message.type === 'user' ? 'order-first' : ''
              }`}>
                <div className={`rounded-2xl px-6 py-4 shadow-sm ${
                  message.type === 'assistant' 
                    ? 'bg-muted border border-border' 
                    : 'bg-primary text-primary-foreground'
                }`}>
                  {message.type === 'assistant' && !message.isComplete ? (
                    <div className="flex items-center gap-2">
                      <span>{message.content.slice(0, Math.floor(message.content.length * 0.7))}</span>
                      <div className="w-2 h-5 bg-primary animate-pulse" />
                    </div>
                  ) : (
                    <p className="text-sm leading-relaxed">{message.content}</p>
                  )}
                </div>
              </div>

              {message.type === 'user' && (
                <div className="flex flex-col items-center gap-2">
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

          {/* User input area */}
          {currentSpeaker === 'user' && !isTyping && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-4 justify-end"
            >
              <div className="max-w-2xl order-first">
                <div className="rounded-2xl px-6 py-4 bg-primary/10 border-2 border-dashed border-primary/30">
                  {isListening ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-primary">
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-sm font-medium">Listening...</span>
                      </div>
                      
                      {currentTranscript && (
                        <p className="text-sm text-foreground min-h-[1.5rem]">
                          {currentTranscript}
                        </p>
                      )}
                      
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={startOver}
                          className="text-xs"
                        >
                          Start over
                        </Button>
                        <Button
                          size="sm"
                          onClick={sendMessage}
                          disabled={!currentTranscript.trim()}
                          className="text-xs"
                        >
                          Send
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center">
                      <Button
                        onClick={startListening}
                        size="lg"
                        className="w-16 h-16 rounded-full bg-primary hover:bg-primary/90"
                      >
                        <FaMicrophone className="w-6 h-6" />
                      </Button>
                      <p className="text-sm text-muted-foreground mt-2">
                        Tap to speak
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-center gap-2">
                <Avatar className={`w-12 h-12 transition-all duration-300 ${
                  currentSpeaker === 'user' ? 'ring-2 ring-primary' : 'grayscale opacity-70'
                }`}>
                  <AvatarFallback className="bg-secondary text-secondary-foreground">
                    <FaUser className="w-6 h-6" />
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs text-muted-foreground font-medium">You</span>
              </div>
            </motion.div>
          )}
        </div>

        {/* Project Case Study Template Section */}
        <div className="mt-8 border-t border-border/50 pt-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-6"
          >
            <div className="text-center mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-2">
                {formatCategoryTitle(selectedCategory)} Documentation
              </h2>
              <p className="text-sm text-muted-foreground">
                Navi will help you document this experience step by step
              </p>
            </div>

            <div className="space-y-4">
              {/* Project Overview */}
              <div className={getCardStyling('overview')}>
                <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  Project Overview
                </h3>
                <div className="text-sm leading-relaxed">
                  {renderTopicContent('overview', topicContents.overview, 
                    "Example: An employee working from home have to attend numerous meetings and a fast delivery to meet, leading to constant stress and a sedentary lifestyle. Continuing this lifestyle for the long term can have a critical impact on overall health."
                  )}
                </div>
              </div>

              {/* Problem Statement */}
              <div className={getCardStyling('problem')}>
                <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-500"></div>
                  The Problem Statement
                </h3>
                <div className="text-sm leading-relaxed">
                  {renderTopicContent('problem', topicContents.problem, 
                    "Example: An employee working from home have to attend numerous meetings and a fast delivery to meet, leading to constant stress and a sedentary lifestyle. Continuing this lifestyle for the long term can have a critical impact on overall health."
                  )}
                </div>
              </div>

              {/* Objective */}
              <div className={getCardStyling('objective')}>
                <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  Objective
                </h3>
                <div className="text-sm leading-relaxed">
                  {renderTopicContent('objective', topicContents.objective, 
                    "Example: Define clear goals and measurable outcomes that this project or experience aimed to achieve in your career development."
                  )}
                </div>
              </div>

              {/* Process & Strategy */}
              <div className={getCardStyling('process')}>
                <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                  Process & Strategy
                </h3>
                <div className="text-sm leading-relaxed">
                  {renderTopicContent('process', topicContents.process, 
                    "Example: Describe the approach you took, methodologies used, tools employed, and step-by-step process to accomplish your objectives."
                  )}
                </div>
              </div>

              {/* Learnings */}
              <div className={getCardStyling('learnings')}>
                <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                  Learnings
                </h3>
                <div className="text-sm leading-relaxed">
                  {renderTopicContent('learnings', topicContents.learnings, 
                    "Example: Key insights, skills acquired, challenges overcome, and personal or professional growth achieved through this experience."
                  )}
                </div>
              </div>

              {/* Outcomes */}
              <div className={getCardStyling('outcomes')}>
                <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-pink-500"></div>
                  Outcomes
                </h3>
                <div className="text-sm leading-relaxed">
                  {renderTopicContent('outcomes', topicContents.outcomes, 
                    "Example: Quantifiable results, impact achieved, recognition received, and how this experience contributed to your overall career trajectory."
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default ConversationPage;