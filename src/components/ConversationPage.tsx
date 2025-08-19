import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaRobot, FaUser, FaArrowLeft, FaPaperPlane } from 'react-icons/fa';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';

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

const topicQuestions: Record<TopicSection, string> = {
  overview: "Let's start with an overview. Tell me about this project or experience in general - what was it about and what was your role?",
  problem: "Now let's discuss the problem. What specific challenge or issue were you addressing? What made this problem important to solve?",
  objective: "What were your main goals and objectives? What did you hope to achieve with this project or experience?",
  process: "Walk me through your approach and process. What methodology, tools, or steps did you use to tackle this?",
  learnings: "What did you learn from this experience? What skills did you develop or insights did you gain?",
  outcomes: "Finally, let's talk about the results. What were the outcomes and impact of your work? How do you measure success?",
};

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
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Start with Navi's greeting
  useEffect(() => {
    const question = topicQuestions.overview;
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
    setTextInput('');
    
    // Show Navi thinking and card loading
    setIsThinking(true);
    setProcessingTopic(activeTopic);
    setCurrentSpeaker('assistant');
    
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
        
        // Add completion message
        setMessages(prev => [...prev, {
          id: (Date.now() + 2).toString(),
          type: 'assistant',
          content: 'Great! I\'ve captured that information.',
          timestamp: new Date(),
          isComplete: true,
        }]);
        
        // Check if all topics are filled
        const updatedContents = { ...topicContents, [activeTopic]: enhancedResponse };
        const nextTopic = getNextTopic(activeTopic);
        
        if (!nextTopic) {
          // All topics filled, complete the conversation
          setTimeout(() => {
            onComplete({
              category: selectedCategory,
              topicContents: updatedContents,
              timestamp: new Date(),
            });
          }, 1000);
        } else {
          // Move to next topic and ask next question
          setTimeout(() => {
            setActiveTopic(nextTopic);
            const nextQuestion = topicQuestions[nextTopic];
            
            const nextQuestionMessage: Message = {
              id: (Date.now() + 3).toString(),
              type: 'assistant',
              content: nextQuestion,
              timestamp: new Date(),
              isComplete: true,
            };
            
            setMessages(prev => [...prev, nextQuestionMessage]);
            setCurrentSpeaker('user');
          }, 1500);
        }
      }, 2500); // 2.5 second delay
    } catch (error) {
      console.error('Error enhancing response:', error);
      setIsThinking(false);
      setProcessingTopic(null);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleTextSubmit();
    }
  };

  // Get the next topic in sequence
  const getNextTopic = (currentTopic: TopicSection): TopicSection | null => {
    const topicOrder: TopicSection[] = ['overview', 'problem', 'objective', 'process', 'learnings', 'outcomes'];
    const currentIndex = topicOrder.indexOf(currentTopic);
    if (currentIndex < topicOrder.length - 1) {
      return topicOrder[currentIndex + 1];
    }
    return null;
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
      return 'bg-card/80 border-2 border-primary/50 shadow-lg shadow-primary/20 rounded-xl p-6 transition-all duration-300 animate-pulse backdrop-blur-sm';
    }
    
    return isActive 
      ? 'bg-card/80 border-2 border-primary/50 shadow-lg shadow-primary/20 rounded-xl p-6 transition-all duration-300 backdrop-blur-sm'
      : 'bg-card/60 border border-border/40 rounded-xl p-6 transition-all duration-300 hover:border-border/60 hover:bg-card/70 backdrop-blur-sm';
  };

  // Helper function to render topic content with loading state
  const renderTopicContent = (topicId: TopicSection, content: string, placeholder: string) => {
    const isProcessing = processingTopic === topicId;
    
    if (isProcessing) {
      return (
        <div className="space-y-3">
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
        className="text-foreground/90 leading-7 font-medium"
      >
        {content}
      </motion.p>
    ) : (
      <p className="italic text-muted-foreground/70 leading-7">
        {placeholder}
      </p>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex flex-col">
      {/* Header */}
      <div className="border-b border-border/50 bg-background/80 backdrop-blur-sm">
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

      {/* Main Content Area - Split Layout */}
      <div className="flex-1 flex max-w-7xl mx-auto w-full">
        {/* Left Side - Chat Section (40%) */}
        <div className="w-2/5 flex flex-col border-r border-border/30 bg-background/50">
          <div className="p-6 border-b border-border/30">
            <h2 className="text-lg font-semibold text-foreground mb-2">
              AI Assistant
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Navi will guide you through documenting your experience step by step
            </p>
          </div>
          
          {/* Chat Messages */}
          <div className="flex-1 p-6 overflow-y-auto min-h-0">
            <div className="space-y-6">
              {messages.map((message, index) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`flex items-start gap-3 ${
                    message.type === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {message.type === 'assistant' && (
                    <div className="flex flex-col items-center gap-1">
                      <Avatar className={`w-10 h-10 transition-all duration-300 ${
                        currentSpeaker === 'assistant' ? 'ring-2 ring-primary' : 'grayscale opacity-70'
                      }`}>
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          <FaRobot className="w-5 h-5" />
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-[10px] text-muted-foreground font-medium">Navi</span>
                    </div>
                  )}
                  
                  <div className={`max-w-[280px] ${
                    message.type === 'user' ? 'order-first' : ''
                  }`}>
                    <div className={`rounded-2xl px-4 py-3 shadow-sm border ${
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
                      <Avatar className={`w-10 h-10 transition-all duration-300 ${
                        currentSpeaker === 'user' ? 'ring-2 ring-primary' : 'grayscale opacity-70'
                      }`}>
                        <AvatarFallback className="bg-secondary text-secondary-foreground">
                          <FaUser className="w-5 h-5" />
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-[10px] text-muted-foreground font-medium">You</span>
                    </div>
                  )}
                </motion.div>
              ))}

              {/* Thinking indicator */}
              {isThinking && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-3 justify-start"
                >
                  <div className="flex flex-col items-center gap-1">
                    <Avatar className="w-10 h-10 ring-2 ring-primary">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        <FaRobot className="w-5 h-5" />
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-[10px] text-muted-foreground font-medium">Navi</span>
                  </div>
                  <div className="bg-muted/60 border-border/50 text-foreground rounded-2xl px-4 py-3 shadow-sm border max-w-[280px]">
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

          {/* Text Input Section */}
          {currentSpeaker === 'user' && !isTyping && (
            <form onSubmit={handleTextSubmit} className="p-6 border-t border-border/30">
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Input
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type your response..."
                    disabled={isThinking}
                    className="resize-none min-h-[40px] bg-background/80 backdrop-blur-sm border-border/40 focus:border-primary/50 text-foreground placeholder:text-muted-foreground"
                  />
                </div>
                <Button
                  type="submit"
                  size="icon"
                  disabled={!textInput.trim() || isThinking}
                  className="h-10 w-10 bg-primary hover:bg-primary/80 text-primary-foreground shrink-0"
                >
                  <FaPaperPlane className="w-4 h-4" />
                </Button>
              </div>
            </form>
          )}
        </div>

        {/* Right Side - Documentation Cards (60%) */}
        <div className="w-3/5 flex flex-col bg-muted/10">
          <div className="p-6 border-b border-border/30">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-foreground mb-2">
                {formatCategoryTitle(selectedCategory)} Documentation
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Your responses are being organized into a comprehensive case study
              </p>
              
              {/* Visual connection line */}
              <div className="mt-4 flex items-center justify-center">
                <div className="w-16 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>
                <div className="w-2 h-2 rounded-full bg-primary/60 mx-2"></div>
                <div className="w-16 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>
              </div>
            </div>
          </div>
          
          {/* Documentation Cards */}
          <div className="flex-1 p-6 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="space-y-6"
            >
              {/* Project Overview */}
              <div className={getCardStyling('overview')}>
                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-blue-500 shadow-sm"></div>
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
                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-red-500 shadow-sm"></div>
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
                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-green-500 shadow-sm"></div>
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
                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-purple-500 shadow-sm"></div>
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
                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-orange-500 shadow-sm"></div>
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
                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-pink-500 shadow-sm"></div>
                  Outcomes
                </h3>
                <div className="text-sm leading-relaxed">
                  {renderTopicContent('outcomes', topicContents.outcomes, 
                    "Example: Quantifiable results, impact achieved, recognition received, and how this experience contributed to your overall career trajectory."
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConversationPage;