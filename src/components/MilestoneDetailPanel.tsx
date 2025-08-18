import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowLeft, Lightbulb, Target, Users, TrendingUp, Plus, User, Bot, Edit, Trash2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import AddInsightForm from './AddInsightForm';

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
  type: 'skill' | 'opportunity' | 'connection' | 'growth' | 'user';
  isUserCreated?: boolean;
  createdAt?: string;
  visibility?: 'private' | 'connections' | 'public';
}

interface MilestoneDetailPanelProps {
  isOpen: boolean;
  onClose: () => void;
  milestone: MilestoneData | null;
  isActive?: boolean; // Add prop to indicate if this milestone is currently active
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
    case 'user': return User;
    default: return Target;
  }
};

const MilestoneDetailPanel: React.FC<MilestoneDetailPanelProps> = ({
  isOpen,
  onClose,
  milestone,
  isActive = false,
}) => {
  const [currentView, setCurrentView] = useState<'main' | 'insight' | 'add-insight' | 'edit-insight'>('main');
  const [selectedInsight, setSelectedInsight] = useState<Insight | null>(null);
  const [userInsights, setUserInsights] = useState<Insight[]>([]);
  const [editingInsight, setEditingInsight] = useState<Insight | null>(null);

  const insights = milestone ? generateInsights(milestone) : [];
  const allInsights = [...userInsights, ...insights];

  const openInsight = (insight: Insight) => {
    setSelectedInsight(insight);
    setCurrentView('insight');
  };

  const goBack = () => {
    if (currentView === 'insight' || currentView === 'add-insight' || currentView === 'edit-insight') {
      setCurrentView('main');
      setSelectedInsight(null);
      setEditingInsight(null);
    } else {
      onClose();
    }
  };

  const handleAddInsight = (newInsight: { title: string; content: string; visibility: 'private' | 'connections' | 'public' }) => {
    const insight: Insight = {
      id: `user-${Date.now()}`,
      title: newInsight.title,
      teaser: newInsight.content.slice(0, 120) + (newInsight.content.length > 120 ? '...' : ''),
      content: newInsight.content,
      type: 'user',
      isUserCreated: true,
      visibility: newInsight.visibility,
      createdAt: new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      })
    };
    
    setUserInsights(prev => [insight, ...prev]);
    setCurrentView('main');
  };

  const handleEditInsight = (updatedInsight: { title: string; content: string; visibility: 'private' | 'connections' | 'public' }) => {
    if (!editingInsight) return;
    
    const updated: Insight = {
      ...editingInsight,
      title: updatedInsight.title,
      teaser: updatedInsight.content.slice(0, 120) + (updatedInsight.content.length > 120 ? '...' : ''),
      content: updatedInsight.content,
      visibility: updatedInsight.visibility,
    };
    
    setUserInsights(prev => prev.map(insight => 
      insight.id === editingInsight.id ? updated : insight
    ));
    setCurrentView('main');
    setEditingInsight(null);
  };

  const handleDeleteInsight = (insightId: string) => {
    setUserInsights(prev => prev.filter(insight => insight.id !== insightId));
    setCurrentView('main');
    setSelectedInsight(null);
  };

  const getVisibilityLabel = (visibility?: string) => {
    switch (visibility) {
      case 'private': return 'Only Me';
      case 'connections': return 'Connections';
      case 'public': return 'Public';
      default: return '';
    }
  };

  const getVisibilityIcon = (visibility?: string) => {
    switch (visibility) {
      case 'private': return EyeOff;
      case 'connections': return Users;
      case 'public': return Eye;
      default: return EyeOff;
    }
  };

  React.useEffect(() => {
    if (!isOpen) {
      setCurrentView('main');
      setSelectedInsight(null);
      setEditingInsight(null);
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
                        {isActive && (
                          <motion.span 
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: "spring", stiffness: 300, damping: 20 }}
                            className="px-3 py-1 bg-gradient-to-r from-primary to-accent rounded-full text-sm text-white font-medium flex items-center gap-2"
                          >
                            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                            Currently Active
                          </motion.span>
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
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-white">
                          Insights
                        </h3>
                        <Button
                          onClick={() => setCurrentView('add-insight')}
                          variant="outline"
                          size="sm"
                          className="border-primary/30 text-primary hover:bg-primary/10"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add My Insight
                        </Button>
                      </div>
                      <div className="space-y-3">
                        {allInsights.map((insight) => {
                          const VisibilityIcon = getVisibilityIcon(insight.visibility);
                          return (
                            <motion.div
                              key={insight.id}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => openInsight(insight)}
                              className="p-4 bg-white/5 border border-white/10 rounded-xl cursor-pointer hover:bg-white/10 transition-colors group"
                            >
                              <div className="flex items-start gap-3">
                                {/* Avatar */}
                                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0">
                                  {insight.isUserCreated ? (
                                    <div className="w-full h-full bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center">
                                      <span className="text-white font-semibold text-sm">JD</span>
                                    </div>
                                  ) : (
                                    <div className="w-full h-full bg-primary/20 rounded-full flex items-center justify-center group-hover:bg-primary/30 transition-colors">
                                      <Bot className="w-5 h-5 text-primary" />
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h4 className="font-semibold text-white">
                                      {insight.title}
                                    </h4>
                                    {insight.isUserCreated && (
                                      <span className="px-2 py-0.5 bg-accent/20 text-accent text-xs rounded-md">
                                        Created by You
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-white/70 text-sm line-clamp-2 mb-2">
                                    {insight.teaser}
                                  </p>
                                  <div className="flex items-center gap-3 text-xs text-white/50">
                                    {insight.createdAt && (
                                      <span>Added on {insight.createdAt}</span>
                                    )}
                                    {insight.visibility && (
                                      <div className="flex items-center gap-1">
                                        <VisibilityIcon className="w-3 h-3" />
                                        <span>{getVisibilityLabel(insight.visibility)}</span>
                                      </div>
                                    )}
                                  </div>
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
                      {/* Avatar */}
                      <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0">
                        {selectedInsight.isUserCreated ? (
                          <div className="w-full h-full bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center">
                            <span className="text-white font-semibold">JD</span>
                          </div>
                        ) : (
                          <div className="w-full h-full bg-primary/20 rounded-full flex items-center justify-center">
                            <Bot className="w-6 h-6 text-primary" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <h1 className="text-2xl font-bold text-white mb-2">
                          {selectedInsight.title}
                        </h1>
                        <div className="flex items-center gap-3 text-sm text-white/60 mb-2">
                          {selectedInsight.createdAt && (
                            <span>Added on {selectedInsight.createdAt}</span>
                          )}
                          {selectedInsight.visibility && (
                            <div className="flex items-center gap-1">
                              {React.createElement(getVisibilityIcon(selectedInsight.visibility), {
                                className: "w-4 h-4"
                              })}
                              <span>{getVisibilityLabel(selectedInsight.visibility)}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1 bg-white/10 rounded-full text-sm text-white/80 capitalize">
                            {selectedInsight.type}
                          </span>
                          {selectedInsight.isUserCreated && (
                            <span className="px-2 py-0.5 bg-accent/20 text-accent text-xs rounded-md">
                              Created by You
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="prose prose-invert max-w-none mb-8">
                      <p className="text-white/80 leading-relaxed text-lg">
                        {selectedInsight.content}
                      </p>
                    </div>

                    {/* Edit/Delete Actions for User Insights */}
                    {selectedInsight.isUserCreated && (
                      <div className="border-t border-white/10 pt-6">
                        <div className="flex gap-3">
                          <Button
                            onClick={() => {
                              setEditingInsight(selectedInsight);
                              setCurrentView('edit-insight');
                            }}
                            variant="outline"
                            className="flex-1 border-white/20 text-white hover:bg-white/10"
                          >
                            <Edit className="w-4 h-4 mr-2" />
                            Edit
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="outline"
                                className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-gray-900 border-white/20">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-white">
                                  Are you sure you want to delete this insight?
                                </AlertDialogTitle>
                                <AlertDialogDescription className="text-white/70">
                                  This action cannot be undone. This will permanently delete your insight.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                                  Cancel
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteInsight(selectedInsight.id)}
                                  className="bg-red-600 hover:bg-red-700 text-white"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Add insight form view */}
              {currentView === 'add-insight' && (
                <AddInsightForm
                  onBack={goBack}
                  onSave={handleAddInsight}
                />
              )}

              {/* Edit insight form view */}
              {currentView === 'edit-insight' && editingInsight && (
                <AddInsightForm
                  onBack={goBack}
                  onSave={handleEditInsight}
                  initialData={{
                    title: editingInsight.title,
                    content: editingInsight.content,
                    visibility: editingInsight.visibility || 'private'
                  }}
                  isEditing={true}
                />
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default MilestoneDetailPanel;