import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowLeft, Lightbulb, Target, Users, TrendingUp } from 'lucide-react';

interface MilestoneData {
  title: string;
  type: 'education' | 'job' | 'transition' | 'skill' | 'event' | 'project';
  date: string;
  description: string;
  skills: string[];
  organization?: string;
}

interface Insight {
  id: string;
  title: string;
  teaser: string;
  content: string;
  type: 'skill' | 'opportunity' | 'connection' | 'growth';
}

interface MilestoneDetailPanelProps {
  isOpen: boolean;
  onClose: () => void;
  milestone: MilestoneData | null;
}

// Mock insights for demonstration
const generateInsights = (milestone: MilestoneData): Insight[] => [
  {
    id: '1',
    title: 'Skill Development Opportunity',
    teaser: 'Based on this experience, you could expand into related technologies and frameworks...',
    content: `This milestone shows strong foundation in ${milestone.skills[0] || 'core skills'}. Consider expanding into complementary areas like advanced frameworks, cloud technologies, or leadership skills. The experience you gained here provides an excellent launching pad for more specialized roles.`,
    type: 'skill'
  },
  {
    id: '2',
    title: 'Career Growth Path',
    teaser: 'Your progression from this point suggests exciting opportunities in senior roles...',
    content: `The experience at ${milestone.organization || 'this organization'} demonstrates your ability to adapt and grow. This type of background is highly valued in senior positions where cross-functional knowledge becomes crucial. Consider roles that leverage both technical expertise and strategic thinking.`,
    type: 'growth'
  },
  {
    id: '3',
    title: 'Network Connections',
    teaser: 'This experience likely created valuable professional relationships...',
    content: `The connections you made during this period are valuable assets. Alumni from ${milestone.organization || 'similar programs'} often become key references, collaborators, or even co-founders. Consider reaching out to maintain these relationships and explore collaboration opportunities.`,
    type: 'connection'
  }
];

const getInsightIcon = (type: string) => {
  switch (type) {
    case 'skill': return Lightbulb;
    case 'growth': return TrendingUp;
    case 'connection': return Users;
    default: return Target;
  }
};

const MilestoneDetailPanel: React.FC<MilestoneDetailPanelProps> = ({
  isOpen,
  onClose,
  milestone,
}) => {
  const [currentView, setCurrentView] = useState<'main' | 'insight'>('main');
  const [selectedInsight, setSelectedInsight] = useState<Insight | null>(null);

  const insights = milestone ? generateInsights(milestone) : [];

  const openInsight = (insight: Insight) => {
    setSelectedInsight(insight);
    setCurrentView('insight');
  };

  const goBack = () => {
    if (currentView === 'insight') {
      setCurrentView('main');
      setSelectedInsight(null);
    } else {
      onClose();
    }
  };

  React.useEffect(() => {
    if (!isOpen) {
      setCurrentView('main');
      setSelectedInsight(null);
    }
  }, [isOpen]);

  if (!milestone) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Background overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-full md:w-2/5 bg-gray-900/95 backdrop-blur-md border-l border-white/10 z-50 flex flex-col"
          >
            {/* Main view */}
            <AnimatePresence mode="wait">
              {currentView === 'main' && (
                <motion.div
                  key="main"
                  initial={{ x: 0 }}
                  animate={{ x: 0 }}
                  exit={{ x: 0 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                  className="flex flex-col h-full"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between p-6 border-b border-white/10">
                    <h2 className="text-lg font-medium text-white">
                      {milestone.title}
                    </h2>
                    <button
                      onClick={onClose}
                      className="p-2 rounded-full hover:bg-white/10 transition-colors"
                    >
                      <X className="w-6 h-6 text-white/80" />
                    </button>
                  </div>

                  {/* Content */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Date and organization info */}
                    <div>
                      <div className="flex items-center gap-4 text-white/60 mb-4">
                        <span className="text-lg">{milestone.date}</span>
                        {milestone.organization && (
                          <span className="px-3 py-1 bg-white/10 rounded-full text-sm">
                            {milestone.organization}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Description */}
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-3">
                        Overview
                      </h3>
                      <p className="text-white/80 leading-relaxed">
                        {milestone.description}
                      </p>
                    </div>

                    {/* Skills */}
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-3">
                        Skills & Technologies
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {milestone.skills.map((skill, index) => (
                          <span
                            key={index}
                            className="px-3 py-1 bg-gradient-to-r from-primary/20 to-accent/20 border border-primary/30 rounded-full text-sm text-white font-medium"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* AI Insights */}
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-4">
                        AI Insights
                      </h3>
                      <div className="space-y-3">
                        {insights.map((insight) => {
                          const IconComponent = getInsightIcon(insight.type);
                          return (
                            <motion.div
                              key={insight.id}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => openInsight(insight)}
                              className="p-4 bg-white/5 border border-white/10 rounded-xl cursor-pointer hover:bg-white/10 transition-colors group"
                            >
                              <div className="flex items-start gap-3">
                                <div className="p-2 bg-primary/20 rounded-lg group-hover:bg-primary/30 transition-colors">
                                  <IconComponent className="w-4 h-4 text-primary" />
                                </div>
                                <div className="flex-1">
                                  <h4 className="font-semibold text-white mb-1">
                                    {insight.title}
                                  </h4>
                                  <p className="text-white/70 text-sm line-clamp-2">
                                    {insight.teaser}
                                  </p>
                                </div>
                                <ArrowLeft className="w-4 h-4 text-white/40 transform rotate-180 group-hover:text-white/60 transition-colors" />
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Insight detail view */}
              {currentView === 'insight' && selectedInsight && (
                <motion.div
                  key="insight"
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '100%' }}
                  transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                  className="flex flex-col h-full"
                >
                  {/* Header */}
                  <div className="flex items-center gap-4 p-6 border-b border-white/10">
                    <button
                      onClick={goBack}
                      className="p-2 rounded-full hover:bg-white/10 transition-colors"
                    >
                      <ArrowLeft className="w-6 h-6 text-white/80" />
                    </button>
                    <h2 className="text-xl font-bold text-white">
                      Insight Details
                    </h2>
                  </div>

                  {/* Content */}
                  <div className="flex-1 overflow-y-auto p-6">
                    <div className="flex items-start gap-4 mb-6">
                      <div className="p-3 bg-primary/20 rounded-lg">
                        {React.createElement(getInsightIcon(selectedInsight.type), {
                          className: "w-6 h-6 text-primary"
                        })}
                      </div>
                      <div className="flex-1">
                        <h1 className="text-2xl font-bold text-white mb-2">
                          {selectedInsight.title}
                        </h1>
                        <span className="px-3 py-1 bg-white/10 rounded-full text-sm text-white/80 capitalize">
                          {selectedInsight.type}
                        </span>
                      </div>
                    </div>

                    <div className="prose prose-invert max-w-none">
                      <p className="text-white/80 leading-relaxed text-lg">
                        {selectedInsight.content}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default MilestoneDetailPanel;