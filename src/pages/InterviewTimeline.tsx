import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import handshakeIcon from '@/assets/handshake-icon.png';
import phoneCallIcon from '@/assets/phone-call-icon.png';
import laptopAnalyticsIcon from '@/assets/laptop-analytics-icon.png';
import interviewIcon from '@/assets/interview-icon.png';
import walmartLogo from '@/assets/walmart-logo.png';

interface TimelineEvent {
  id: number;
  title: string;
  description: string;
  expandedContent?: string;
  illustration: string;
  date?: string;
}

const timelineEvents: TimelineEvent[] = [
  {
    id: 1,
    title: "Alumni referral outreach",
    description: "Reached out to a University of Maryland alum at Walmart to request an internal referral.",
    illustration: handshakeIcon,
  },
  {
    id: 2,
    title: "Round 1: Recruiter screen",
    description: "Received a callback from a Walmart recruiter for a screening discussion.",
    expandedContent: "The recruiter asked about my fit for the role, why I'm interested in retail analytics, and gave me a chance to walk through a couple of projects. Ahead of time, I practiced three STAR stories—one about impact, one about conflict, and one about a mistake—and tied them back to Walmart's values. That prep helped me keep my answers short, clear, and grounded in what the company cares about.",
    illustration: phoneCallIcon,
  },
  {
    id: 3,
    title: "Round 2: Analytics challenge",
    description: "Took a timed online challenge to assess analytical thinking and SQL proficiency.",
    expandedContent: "The exercise focused on SQL over sales tables, plus a quick task in Excel/Pivot or basic Python, with metrics like in-stock rate and year-over-year sales. To get ready, I practiced joins, window functions, and pivot tables using mock \"store-item-date\" data. During the challenge, I made sure to read each prompt twice, state my assumptions clearly in comments, and keep my approach as straightforward as possible.",
    illustration: laptopAnalyticsIcon,
  },
  {
    id: 4,
    title: "Round 3: Behavioral Interview",
    description: "Virtual 1:1 interview with hiring manager and peer analyst to assess communication, teamwork, and problem-solving.",
    illustration: interviewIcon,
  },
];

const InterviewTimeline: React.FC = () => {
  const navigate = useNavigate();
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [expandedEvents, setExpandedEvents] = useState<Set<number>>(new Set());
  const [showPrepDialog, setShowPrepDialog] = useState(true);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animate-fade-in');
          }
        });
      },
      { threshold: 0.1 }
    );

    const elements = document.querySelectorAll('.timeline-event');
    elements.forEach((el) => observerRef.current?.observe(el));

    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  const handleBackClick = () => {
    navigate('/');
  };

  const toggleEventExpansion = (eventId: number) => {
    setExpandedEvents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(eventId)) {
        newSet.delete(eventId);
      } else {
        newSet.add(eventId);
      }
      return newSet;
    });
  };

  const handleStartChat = () => {
    setShowPrepDialog(false);
    // Add chat functionality here
  };

  const handleDismissDialog = () => {
    setShowPrepDialog(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20">
      {/* Header */}
      <header className="sticky top-0 bg-background/80 backdrop-blur-sm border-b border-border/50 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={handleBackClick}
            className="flex items-center gap-2 text-foreground hover:text-primary transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:translate-x-[-2px] transition-transform" />
            <span className="text-sm font-medium">Back</span>
          </button>
          
          <div className="flex items-center gap-4">
            <h1 className="text-xl md:text-2xl font-bold text-foreground">
              Interview loop: Data Analyst Role at Walmart
            </h1>
            <img 
              src={walmartLogo} 
              alt="Walmart Logo" 
              className="w-8 h-8 md:w-10 md:h-10 object-contain"
            />
          </div>
        </div>
      </header>

      {/* Timeline Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="relative">
          {/* Central timeline line */}
          <div className="absolute left-1/2 transform -translate-x-1/2 h-full w-0.5 bg-gradient-to-b from-primary/60 to-primary/20"></div>
          
          {/* Timeline events */}
          <div className="space-y-16">
            {timelineEvents.map((event, index) => {
              const isEven = index % 2 === 0;
              
              return (
                <motion.div
                  key={event.id}
                  className="timeline-event relative opacity-0"
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.2 }}
                >
                  {/* Timeline dot */}
                  <div className={`absolute left-1/2 transform -translate-x-1/2 ${index === timelineEvents.length - 1 ? 'w-6 h-6 animate-[pulse_3s_ease-in-out_infinite] shadow-primary/50 shadow-2xl' : 'w-4 h-4'} bg-primary rounded-full border-4 border-background shadow-lg z-10`}></div>
                  
                  {/* Content container */}
                  <div className={`flex items-center gap-8 ${isEven ? 'flex-row' : 'flex-row-reverse'}`}>
                    {/* Text content */}
                    <div className={`flex-1 text-left ${isEven ? 'pr-8' : 'pl-8'}`}>
                      <div className={`glass rounded-2xl p-6 shadow-lg relative ${index === timelineEvents.length - 1 ? 'shadow-primary/30 shadow-2xl ring-1 ring-primary/20' : ''}`}>
                        
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-foreground mb-3">
                              {event.title}
                            </h3>
                            {/* Upcoming chip for last event */}
                            {index === timelineEvents.length - 1 && (
                              <div className="mb-3 inline-block px-3 py-1 bg-blue-500/20 text-blue-600 text-xs font-medium rounded-full border border-blue-500/30">
                                Upcoming
                              </div>
                            )}
                            <p className="text-muted-foreground text-sm leading-relaxed">
                              {event.description}
                            </p>
                          </div>
                          
                          {/* Expand/Collapse button */}
                          {event.expandedContent && (
                            <button
                              onClick={() => toggleEventExpansion(event.id)}
                              className="flex-shrink-0 p-2 rounded-lg hover:bg-primary/10 transition-colors group"
                              aria-label={expandedEvents.has(event.id) ? "Collapse details" : "Expand details"}
                            >
                              {expandedEvents.has(event.id) ? (
                                <ChevronUp className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                              )}
                            </button>
                          )}
                        </div>
                        
                        {/* Expanded content */}
                        {event.expandedContent && (
                          <motion.div
                            initial={false}
                            animate={{
                              height: expandedEvents.has(event.id) ? 'auto' : 0,
                              opacity: expandedEvents.has(event.id) ? 1 : 0,
                            }}
                            transition={{
                              duration: 0.3,
                              ease: 'easeInOut'
                            }}
                            className="overflow-hidden"
                          >
                            <div className="pt-4 mt-4 border-t border-border/50">
                              <p className="text-foreground text-sm leading-relaxed">
                                {event.expandedContent}
                              </p>
                            </div>
                          </motion.div>
                        )}
                        
                        {/* Preparation Dialog */}
                        {index === timelineEvents.length - 1 && showPrepDialog && (
                          <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="absolute top-0 left-full ml-6 w-72 glass rounded-xl p-4 shadow-lg border border-border/50 z-20"
                          >
                            <div className="space-y-4">
                              <p className="text-sm text-foreground font-medium">
                                Do you want help preparing for this?
                              </p>
                              <div className="flex gap-2">
                                <button
                                  onClick={handleStartChat}
                                  className="flex-1 px-3 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
                                >
                                  Yes, let's chat
                                </button>
                                <button
                                  onClick={handleDismissDialog}
                                  className="flex-1 px-3 py-2 bg-muted text-muted-foreground text-sm font-medium rounded-lg hover:bg-muted/80 transition-colors"
                                >
                                  No, dismiss
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </div>
                    </div>
                    
                    {/* Illustration */}
                    <div className={`flex-1 ${isEven ? 'pl-8' : 'pr-8'}`}>
                      <div className="flex justify-center">
                        <div className="relative group">
                          <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl group-hover:blur-2xl transition-all duration-300"></div>
                          <div className="relative glass rounded-2xl p-6 hover:scale-105 transition-transform duration-300">
                            <img
                              src={event.illustration}
                              alt={event.title}
                              className="w-24 h-24 object-contain mx-auto"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
};

export default InterviewTimeline;