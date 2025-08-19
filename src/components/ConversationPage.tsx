import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { FaRobot, FaUser, FaArrowLeft, FaPaperPlane } from 'react-icons/fa';
import { ArrowRight } from 'lucide-react';
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

// Pre-filled conversation messages
const conversationScript = [
  { type: 'assistant', content: "What new updates do you have? Any upcoming interviews or recent developments?" },
  { type: 'user', content: "Yes, I had a recruiter screen with Walmart, and have a round two interview coming up in 3 days." },
  { type: 'assistant', content: "That's fantastic! Great job passing the initial recruiter screen. Can you share the job post link with me so I can help you with interview prep moving forward?" },
  { type: 'user', content: "https://careers.walmart.com/us/jobs/WD2224479-staff-data-scientist" },
  { type: 'assistant', content: "I see you applied for a Data Scientist role on Walmart's Cortex Team building an A.I. conversational platform. Do you know what your upcoming interview round will focus on? Is it a case based interview or a behavioral interview for your past experience?" },
  { type: 'user', content: "It's a behavioral interview for your past experience." },
  { type: 'assistant', content: "Got it! Based on the role description, let's prepare a story where you showed end-to-end ownership—from request to dashboard. It'll take 5–10 minutes, and we'll save it to your journey and turn it into STAR format for you to share during your interview. Ready to start?" },
  { type: 'user', content: "Yes" },
  { type: 'assistant', content: "Awesome, let's capture your story. First, tell me about a project you saw through end to end." },
  { type: 'user', content: "Diagnosing drop-offs in SoFi's loan application funnel." },
  { type: 'assistant', content: "Tell me about the customer pain points in one or two sentences. What was happening to users?" },
  { type: 'user', content: "Thousands of users were starting but abandoning loan applications—72% funnel drop-off. People didn't know what info was required, couldn't save progress, and document upload (especially on mobile) was painful. None of this was visible to the product team because we had no diagnostic tooling." },
  { type: 'assistant', content: "What made this hard internally—systems, alignment, definitions?" },
  { type: 'user', content: "No central dashboard or analytics. Every team had a different definition of \"drop-off,\" data was scattered across tools, and PMs relied on anecdotes. I proposed a real-time dashboard but had to align eng, data infra, and product stakeholders who were skeptical about internal tools without immediate ROI." },
  { type: 'assistant', content: "Walk me through your actions. Start with how you found the friction points." },
  { type: 'user', content: "I ran a mixed-methods analysis—funnel metrics + user research + support tickets. We found: • 38% of drop-offs came from income verification • Mobile users were 2x more likely to abandon the document upload screen • Users without autosave were 40% more likely to abandon entirely" },
  { type: 'assistant', content: "How did you influence people to act?" },
  { type: 'user', content: "I led a product review workshop using real funnel replays and user quotes—showed the exact moments users got stuck. Instead of just charts, I told the user's story: someone gives up because they can't upload a file or lose their place after an interruption." },
  { type: 'assistant', content: "Now the solution & adoption plan—what did you ship and how did you ensure people used it?" },
  { type: 'user', content: "I built a real-time dashboard segmented by device, cohort, and funnel stage. For adoption, I created weekly usage templates for PMs, partnered with product leads to map metrics to roadmap priorities, and delivered custom insight reports with annotated recommendations." },
  { type: 'assistant', content: "Excellent. Can you tell me any results with time bounds?" }
];

const ConversationPage: React.FC<ConversationPageProps> = ({ 
  selectedCategory, 
  onBack, 
  onComplete 
}) => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [textInput, setTextInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [showSTARPanel, setShowSTARPanel] = useState(true);
  const [conversationComplete, setConversationComplete] = useState(false);
  const [starLoading, setStarLoading] = useState(false);
  const [starResultUpdated, setStarResultUpdated] = useState(false);
  const [showFinalMessage, setShowFinalMessage] = useState(false);
  const [showActionBar, setShowActionBar] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Pre-populate all conversation messages on load
  useEffect(() => {
    const prefilledMessages: Message[] = conversationScript.map((msg, index) => ({
      id: (index + 1).toString(),
      type: msg.type as 'user' | 'assistant',
      content: msg.content,
      timestamp: new Date(Date.now() - (conversationScript.length - index) * 60000), // Stagger timestamps
      isComplete: true,
    }));
    
    setMessages(prefilledMessages);
  }, []);

  // Trigger final message immediately when Result card finishes updating
  useEffect(() => {
    if (starResultUpdated && !showFinalMessage) {
      setIsThinking(false);
      setShowFinalMessage(true);
      
      const finalMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: "Your STAR story is ready! Practice presenting it so you can explain it with confidence during your interview.",
        timestamp: new Date(),
        isComplete: true,
      };
      
      setMessages(prev => [...prev, finalMessage]);
      setConversationComplete(true);
    }
  }, [starResultUpdated, showFinalMessage]);

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
    
    // Start STAR loading animation
    setStarLoading(true);
    
    // Show Navi thinking
    setIsThinking(true);
    
    // After 2-3 seconds, update the Result card
    setTimeout(() => {
      setStarLoading(false);
      setStarResultUpdated(true);
    }, 2500);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleTextSubmit();
    }
  };

  return (
    <div className="h-screen bg-gradient-to-br from-background via-background to-muted/20 flex flex-col overflow-hidden transition-all duration-300">
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
          <Button
            size="lg"
            disabled={!showFinalMessage}
            onClick={() => {
              navigate('/network-insights');
            }}
            className={`${showFinalMessage 
              ? 'bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground font-medium animate-fade-in' 
              : 'bg-muted text-muted-foreground cursor-not-allowed opacity-50'} transition-all duration-300`}
          >
            <span>Continue</span>
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
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
                         <Avatar className="w-12 h-12">
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
                         <Avatar className="w-12 h-12">
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
          {!conversationComplete && (
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
        <STARDocumentationPanel 
          isVisible={showSTARPanel} 
          resultLoading={starLoading}
          resultUpdated={starResultUpdated}
        />
      </div>

    </div>
  );
};

export default ConversationPage;