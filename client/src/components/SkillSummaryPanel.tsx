import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, TrendingUp, Award, Target, Clock, Users } from 'lucide-react';

interface Skill {
  name: string;
  category: 'technical' | 'soft' | 'domain' | 'language' | 'certification';
  confidence: number;
  level?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  mentionCount: number;
  lastMentioned: string;
  source: string;
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

interface SkillSummaryPanelProps {
  skills: Skill[];
  analytics?: SkillAnalytics;
  careerGoal?: string;
  className?: string;
}

const categoryIcons = {
  technical: '💻',
  soft: '🤝',
  domain: '🏢',
  language: '🌐',
  certification: '🏆'
};

const levelColors = {
  beginner: 'text-gray-400',
  intermediate: 'text-green-400',
  advanced: 'text-blue-400',
  expert: 'text-purple-400'
};

export default function SkillSummaryPanel({ skills, analytics, careerGoal, className = '' }: SkillSummaryPanelProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'categories' | 'trends' | 'gaps'>('overview');

  const stats = useMemo(() => {
    const categoryDistribution: Record<string, number> = {};
    const levelDistribution: Record<string, number> = {};
    let totalConfidence = 0;
    let recentSkills = 0;
    
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    skills.forEach(skill => {
      categoryDistribution[skill.category] = (categoryDistribution[skill.category] || 0) + 1;
      if (skill.level) {
        levelDistribution[skill.level] = (levelDistribution[skill.level] || 0) + 1;
      }
      totalConfidence += skill.confidence;
      if (new Date(skill.lastMentioned) > oneWeekAgo) {
        recentSkills++;
      }
    });

    return {
      categoryDistribution,
      levelDistribution,
      averageConfidence: skills.length > 0 ? totalConfidence / skills.length : 0,
      recentSkills,
      strongSkills: skills.filter(s => s.confidence >= 0.7).length,
      improvingSkills: skills.filter(s => s.mentionCount >= 3).length
    };
  }, [skills]);

  const topSkillsByCategory = useMemo(() => {
    const categories: Record<string, Skill[]> = {};
    skills.forEach(skill => {
      if (!categories[skill.category]) categories[skill.category] = [];
      categories[skill.category].push(skill);
    });

    Object.keys(categories).forEach(category => {
      categories[category] = categories[category]
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 3);
    });

    return categories;
  }, [skills]);

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Key metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <Award className="w-4 h-4 text-purple-400" />
            <span className="text-xs text-slate-400">Total Skills</span>
          </div>
          <div className="text-2xl font-bold text-white">{skills.length}</div>
        </div>

        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-green-400" />
            <span className="text-xs text-slate-400">Strong Skills</span>
          </div>
          <div className="text-2xl font-bold text-white">{stats.strongSkills}</div>
          <div className="text-xs text-green-400">70%+ confidence</div>
        </div>

        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-slate-400">Recent Activity</span>
          </div>
          <div className="text-2xl font-bold text-white">{stats.recentSkills}</div>
          <div className="text-xs text-blue-400">Last 7 days</div>
        </div>

        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-orange-400" />
            <span className="text-xs text-slate-400">Avg Confidence</span>
          </div>
          <div className="text-2xl font-bold text-white">
            {Math.round(stats.averageConfidence * 100)}%
          </div>
        </div>
      </div>

      {/* Career alignment */}
      {analytics?.careerAlignment && (
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-4 h-4 text-purple-400" />
            <span className="font-medium text-white">Career Alignment</span>
            {careerGoal && (
              <span className="text-xs text-slate-400">for {careerGoal}</span>
            )}
          </div>
          
          <div className="flex items-center gap-4 mb-3">
            <div className="flex-1 bg-slate-700 rounded-full h-2">
              <motion.div
                className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${analytics.careerAlignment.score * 100}%` }}
                transition={{ duration: 1, delay: 0.5 }}
              />
            </div>
            <span className="text-sm font-medium text-white">
              {Math.round(analytics.careerAlignment.score * 100)}%
            </span>
          </div>

          {analytics.careerAlignment.recommendations.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs text-slate-400">Recommendations:</span>
              {analytics.careerAlignment.recommendations.slice(0, 2).map((rec, index) => (
                <div key={index} className="text-xs text-slate-300 bg-slate-700/50 rounded p-2">
                  {rec}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Top skills preview */}
      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
        <h4 className="font-medium text-white mb-3 flex items-center gap-2">
          <Award className="w-4 h-4 text-yellow-400" />
          Top Skills
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {skills
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, 6)
            .map((skill, index) => (
              <div key={skill.name} className="flex items-center justify-between p-2 bg-slate-700/50 rounded">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{categoryIcons[skill.category]}</span>
                  <div>
                    <div className="text-sm font-medium text-white">{skill.name}</div>
                    <div className="text-xs text-slate-400">{skill.category}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-white">
                    {Math.round(skill.confidence * 100)}%
                  </div>
                  {skill.level && (
                    <div className={`text-xs ${levelColors[skill.level]}`}>
                      {skill.level}
                    </div>
                  )}
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );

  const renderCategories = () => (
    <div className="space-y-6">
      {Object.entries(topSkillsByCategory).map(([category, categorySkills]) => (
        <div key={category} className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{categoryIcons[category as keyof typeof categoryIcons]}</span>
              <div>
                <h4 className="font-medium text-white capitalize">{category}</h4>
                <span className="text-xs text-slate-400">
                  {stats.categoryDistribution[category]} skills
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium text-white">
                {Math.round((stats.categoryDistribution[category] / skills.length) * 100)}%
              </div>
              <div className="text-xs text-slate-400">of total</div>
            </div>
          </div>

          <div className="space-y-2">
            {categorySkills.map((skill, index) => (
              <div key={skill.name} className="flex items-center justify-between p-2 bg-slate-700/30 rounded">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-6 bg-gradient-to-b from-purple-500 to-blue-500 rounded-full" />
                  <div>
                    <div className="text-sm font-medium text-white">{skill.name}</div>
                    <div className="text-xs text-slate-400">
                      {skill.mentionCount} mentions • {skill.source}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-sm text-white">{Math.round(skill.confidence * 100)}%</div>
                  {skill.level && (
                    <div className={`text-xs px-2 py-1 rounded ${levelColors[skill.level]} bg-slate-700`}>
                      {skill.level}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  const renderTrends = () => (
    <div className="space-y-6">
      {analytics?.skillTrends && analytics.skillTrends.length > 0 ? (
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
          <h4 className="font-medium text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-400" />
            Skill Usage Trends
          </h4>
          <div className="space-y-3">
            {analytics.skillTrends.slice(0, 10).map((trend, index) => (
              <div key={trend.skill} className="flex items-center justify-between p-2 bg-slate-700/30 rounded">
                <div className="flex items-center gap-3">
                  <div className="text-sm text-slate-400">#{index + 1}</div>
                  <div>
                    <div className="text-sm font-medium text-white">{trend.skill}</div>
                    <div className="text-xs text-slate-400">
                      Last used: {new Date(trend.lastMentioned).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-sm font-medium text-green-400">{trend.frequency}x</div>
                  <div className="w-16 bg-slate-700 rounded-full h-2">
                    <div
                      className="bg-green-400 h-2 rounded-full"
                      style={{ width: `${Math.min(trend.frequency * 10, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-slate-400">
          <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No trend data available yet.</p>
          <p className="text-sm">Keep using skills to see trends!</p>
        </div>
      )}
    </div>
  );

  const renderGaps = () => (
    <div className="space-y-6">
      {analytics?.skillGaps && analytics.skillGaps.length > 0 ? (
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
          <h4 className="font-medium text-white mb-4 flex items-center gap-2">
            <Target className="w-4 h-4 text-orange-400" />
            Skill Gaps & Recommendations
          </h4>
          <div className="space-y-3">
            {analytics.skillGaps.map((gap, index) => (
              <div key={index} className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                <div className="text-sm font-medium text-orange-300">{gap}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-slate-400">
          <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No skill gaps identified.</p>
          <p className="text-sm">Great job on your skill development!</p>
        </div>
      )}

      {/* Level distribution */}
      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
        <h4 className="font-medium text-white mb-4 flex items-center gap-2">
          <BarChart className="w-4 h-4 text-blue-400" />
          Skill Level Distribution
        </h4>
        <div className="space-y-3">
          {Object.entries(stats.levelDistribution).map(([level, count]) => (
            <div key={level} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${
                  level === 'expert' ? 'bg-purple-400' :
                  level === 'advanced' ? 'bg-blue-400' :
                  level === 'intermediate' ? 'bg-green-400' : 'bg-gray-400'
                }`} />
                <span className="text-sm text-white capitalize">{level}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-white">{count}</span>
                <div className="w-20 bg-slate-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      level === 'expert' ? 'bg-purple-400' :
                      level === 'advanced' ? 'bg-blue-400' :
                      level === 'intermediate' ? 'bg-green-400' : 'bg-gray-400'
                    }`}
                    style={{ width: `${(count / skills.length) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className={`skill-summary-panel ${className}`}>
      {/* Tab navigation */}
      <div className="flex flex-wrap gap-1 mb-6 p-1 bg-slate-800/50 rounded-lg border border-slate-700">
        {[
          { id: 'overview', label: 'Overview', icon: BarChart },
          { id: 'categories', label: 'Categories', icon: Users },
          { id: 'trends', label: 'Trends', icon: TrendingUp },
          { id: 'gaps', label: 'Growth', icon: Target }
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as any)}
            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === id
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'categories' && renderCategories()}
          {activeTab === 'trends' && renderTrends()}
          {activeTab === 'gaps' && renderGaps()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}