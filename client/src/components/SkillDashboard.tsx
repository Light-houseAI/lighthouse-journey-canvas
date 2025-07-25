import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { X, RefreshCw, Download, Settings, Brain, Target } from 'lucide-react';
import SkillCloud from './SkillCloud';
import SkillSummaryPanel from './SkillSummaryPanel';
import SkillBadges from './SkillBadges';

interface Skill {
  name: string;
  category: 'technical' | 'soft' | 'domain' | 'language' | 'certification';
  confidence: number;
  level?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  mentionCount: number;
  lastMentioned: string;
  source: string;
  context?: string;
  keywords: string[];
}

interface SkillAnalytics {
  totalSkills: number;
  skillsByCategory: Record<string, number>;
  topSkills: Skill[];
  skillGaps: string[];
  careerAlignment: {
    score: number;
    recommendations: string[];
  };
  skillTrends: Array<{
    skill: string;
    frequency: number;
    lastMentioned: string;
  }>;
}

interface SkillDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  careerGoal?: string;
}

export default function SkillDashboard({ isOpen, onClose, userId, careerGoal }: SkillDashboardProps) {
  const [activeView, setActiveView] = useState<'summary' | 'cloud' | 'analytics'>('summary');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);

  // Fetch user skills
  const { data: skillsData, isLoading: skillsLoading, refetch: refetchSkills } = useQuery({
    queryKey: [`/api/ai/skills/${userId}`],
    queryFn: async () => {
      const response = await fetch(`/api/ai/skills/${userId}`);
      if (!response.ok) throw new Error('Failed to fetch skills');
      return response.json();
    },
    enabled: isOpen && !!userId
  });

  // Fetch skill analytics
  const { data: analyticsData, isLoading: analyticsLoading, refetch: refetchAnalytics } = useQuery({
    queryKey: [`/api/ai/analyze-skills`, userId, careerGoal],
    queryFn: async () => {
      const response = await fetch('/api/ai/analyze-skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, careerGoal })
      });
      if (!response.ok) throw new Error('Failed to analyze skills');
      return response.json();
    },
    enabled: isOpen && !!userId && skillsData?.skills?.length > 0
  });

  const skills: Skill[] = skillsData?.skills || [];
  const skillsByCategory = skillsData?.skillsByCategory || {};
  const stats = skillsData?.stats || {};
  const analytics: SkillAnalytics = analyticsData;

  // Manual skill analysis trigger
  const handleAnalyzeSkills = async () => {
    setIsAnalyzing(true);
    try {
      await refetchAnalytics();
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Export skills data
  const handleExportSkills = () => {
    const exportData = {
      skills,
      analytics,
      stats,
      exportDate: new Date().toISOString(),
      userId
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `skills-export-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Extract skills from user input
  const handleExtractSkills = async (text: string) => {
    try {
      const response = await fetch('/api/ai/extract-skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          userId,
          source: 'manual',
          careerGoal
        })
      });

      if (response.ok) {
        await refetchSkills();
      }
    } catch (error) {
      console.error('Failed to extract skills:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Brain className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Skill Dashboard</h2>
                <p className="text-sm text-slate-400">
                  {skills.length} skills tracked • {stats.recentSkills || 0} recent activity
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* View selector */}
              <div className="flex bg-slate-800 rounded-lg p-1">
                {[
                  { id: 'summary', label: 'Summary', icon: Target },
                  { id: 'cloud', label: 'Cloud', icon: Brain },
                  { id: 'analytics', label: 'Analytics', icon: Settings }
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setActiveView(id as any)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                      activeView === id
                        ? 'bg-purple-500/20 text-purple-300'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                ))}
              </div>

              {/* Action buttons */}
              <button
                onClick={handleAnalyzeSkills}
                disabled={isAnalyzing || skillsLoading}
                className="p-2 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
                title="Analyze Skills"
              >
                <RefreshCw className={`w-5 h-5 ${isAnalyzing ? 'animate-spin' : ''}`} />
              </button>

              <button
                onClick={handleExportSkills}
                className="p-2 text-slate-400 hover:text-white transition-colors"
                title="Export Skills"
              >
                <Download className="w-5 h-5" />
              </button>

              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
            {skillsLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <RefreshCw className="w-8 h-8 animate-spin text-purple-400 mx-auto mb-3" />
                  <p className="text-slate-400">Loading your skills...</p>
                </div>
              </div>
            ) : skills.length === 0 ? (
              <div className="text-center py-12">
                <Brain className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">No Skills Tracked Yet</h3>
                <p className="text-slate-400 mb-6 max-w-md mx-auto">
                  Start by having conversations about your work, projects, and experiences. 
                  Skills will be automatically extracted and tracked.
                </p>
                
                {/* Quick skill input */}
                <div className="max-w-md mx-auto">
                  <textarea
                    placeholder="Describe your skills, projects, or experience here..."
                    className="w-full p-3 bg-slate-800 border border-slate-600 rounded-lg text-white resize-none"
                    rows={3}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.ctrlKey) {
                        handleExtractSkills(e.currentTarget.value);
                        e.currentTarget.value = '';
                      }
                    }}
                  />
                  <p className="text-xs text-slate-500 mt-2">Press Ctrl+Enter to extract skills</p>
                </div>
              </div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeView}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  {activeView === 'summary' && (
                    <SkillSummaryPanel
                      skills={skills}
                      analytics={analytics}
                      careerGoal={careerGoal}
                    />
                  )}

                  {activeView === 'cloud' && (
                    <SkillCloud
                      skills={skills}
                      onSkillClick={(skill) => setSelectedSkill(skill)}
                      maxSkills={100}
                    />
                  )}

                  {activeView === 'analytics' && (
                    <div className="space-y-6">
                      {analyticsLoading ? (
                        <div className="text-center py-8">
                          <RefreshCw className="w-8 h-8 animate-spin text-purple-400 mx-auto mb-3" />
                          <p className="text-slate-400">Analyzing your skill profile...</p>
                        </div>
                      ) : analytics ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Quick stats */}
                          <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700">
                            <h3 className="font-medium text-white mb-4">Quick Stats</h3>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <div className="text-2xl font-bold text-purple-400">{analytics.totalSkills}</div>
                                <div className="text-sm text-slate-400">Total Skills</div>
                              </div>
                              <div>
                                <div className="text-2xl font-bold text-green-400">
                                  {Math.round(analytics.careerAlignment.score * 100)}%
                                </div>
                                <div className="text-sm text-slate-400">Career Alignment</div>
                              </div>
                            </div>
                          </div>

                          {/* Category breakdown */}
                          <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700">
                            <h3 className="font-medium text-white mb-4">Category Breakdown</h3>
                            <div className="space-y-2">
                              {Object.entries(analytics.skillsByCategory).map(([category, count]) => (
                                <div key={category} className="flex justify-between items-center">
                                  <span className="text-sm text-slate-300 capitalize">{category}</span>
                                  <span className="text-sm font-medium text-white">{count}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Top skills */}
                          <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700 lg:col-span-2">
                            <h3 className="font-medium text-white mb-4">Top Skills</h3>
                            <div className="flex flex-wrap gap-2">
                              <SkillBadges
                                skills={analytics.topSkills}
                                maxVisible={20}
                                size="medium"
                                onSkillClick={(skill) => setSelectedSkill(skill)}
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <Target className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                          <p className="text-slate-400">No analytics available</p>
                          <button
                            onClick={handleAnalyzeSkills}
                            className="mt-4 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
                          >
                            Generate Analysis
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </motion.div>

        {/* Skill detail modal */}
        <AnimatePresence>
          {selectedSkill && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-60"
              onClick={() => setSelectedSkill(null)}
            >
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.9 }}
                className="bg-slate-900 border border-slate-700 rounded-lg p-6 max-w-md w-full"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white">{selectedSkill.name}</h3>
                  <button
                    onClick={() => setSelectedSkill(null)}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <span className="text-sm text-slate-400">Category:</span>
                    <span className="ml-2 text-sm text-white capitalize">{selectedSkill.category}</span>
                  </div>
                  
                  <div>
                    <span className="text-sm text-slate-400">Confidence:</span>
                    <span className="ml-2 text-sm text-white">
                      {Math.round(selectedSkill.confidence * 100)}%
                    </span>
                  </div>
                  
                  {selectedSkill.level && (
                    <div>
                      <span className="text-sm text-slate-400">Level:</span>
                      <span className="ml-2 text-sm text-white capitalize">{selectedSkill.level}</span>
                    </div>
                  )}
                  
                  <div>
                    <span className="text-sm text-slate-400">Mentions:</span>
                    <span className="ml-2 text-sm text-white">{selectedSkill.mentionCount}</span>
                  </div>
                  
                  <div>
                    <span className="text-sm text-slate-400">Last used:</span>
                    <span className="ml-2 text-sm text-white">
                      {selectedSkill.lastMentioned ? new Date(selectedSkill.lastMentioned).toLocaleDateString() : 'Unknown'}
                    </span>
                  </div>
                  
                  {selectedSkill.context && (
                    <div>
                      <span className="text-sm text-slate-400">Context:</span>
                      <p className="text-sm text-white mt-1 bg-slate-800 p-2 rounded">
                        {selectedSkill.context}
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}