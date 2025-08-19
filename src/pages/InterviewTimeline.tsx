import React, { useEffect, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
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
  illustration: string;
  date?: string;
}

const timelineEvents: TimelineEvent[] = [
  {
    id: 1,
    title: "Round 1: Alumni referral outreach",
    description: "User messaged a Maryland alum at Walmart to inquire about a referral opportunity.",
    illustration: handshakeIcon,
  },
  {
    id: 2,
    title: "Round 2: Recruiter screen",
    description: "Received a callback from a Walmart recruiter for a screening discussion.",
    illustration: phoneCallIcon,
  },
  {
    id: 3,
    title: "Round 3: Analytics challenge",
    description: "Took a timed online challenge to assess analytical thinking and SQL proficiency.",
    illustration: laptopAnalyticsIcon,
  },
  {
    id: 4,
    title: "Round 4: Behavioral interview",
    description: "Virtual 1:1 interview with hiring manager and peer analyst to assess communication, teamwork, and problem-solving.",
    illustration: interviewIcon,
  },
];

const InterviewTimeline: React.FC = () => {
  const navigate = useNavigate();
  const observerRef = useRef<IntersectionObserver | null>(null);

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
            <span className="text-sm font-medium">Back to Journey</span>
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
                  <div className="absolute left-1/2 transform -translate-x-1/2 w-4 h-4 bg-primary rounded-full border-4 border-background shadow-lg z-10"></div>
                  
                  {/* Content container */}
                  <div className={`flex items-center gap-8 ${isEven ? 'flex-row' : 'flex-row-reverse'}`}>
                    {/* Text content */}
                    <div className={`flex-1 ${isEven ? 'text-right pr-8' : 'text-left pl-8'}`}>
                      <div className="glass rounded-2xl p-6 shadow-lg">
                        <h3 className="text-lg font-semibold text-foreground mb-3">
                          {event.title}
                        </h3>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                          {event.description}
                        </p>
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