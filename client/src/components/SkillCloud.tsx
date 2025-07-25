import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

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

interface SkillCloudProps {
  skills: Skill[];
  onSkillClick?: (skill: Skill) => void;
  maxSkills?: number;
  className?: string;
}

const categoryColors = {
  technical: {
    bg: 'bg-blue-500/20',
    border: 'border-blue-400/60',
    text: 'text-blue-300',
    hover: 'hover:bg-blue-500/30'
  },
  soft: {
    bg: 'bg-green-500/20',
    border: 'border-green-400/60',
    text: 'text-green-300',
    hover: 'hover:bg-green-500/30'
  },
  domain: {
    bg: 'bg-purple-500/20',
    border: 'border-purple-400/60',
    text: 'text-purple-300',
    hover: 'hover:bg-purple-500/30'
  },
  language: {
    bg: 'bg-orange-500/20',
    border: 'border-orange-400/60',
    text: 'text-orange-300',
    hover: 'hover:bg-orange-500/30'
  },
  certification: {
    bg: 'bg-yellow-500/20',
    border: 'border-yellow-400/60',
    text: 'text-yellow-300',
    hover: 'hover:bg-yellow-500/30'
  }
};

const levelSizes = {
  beginner: 'text-xs px-2 py-1',
  intermediate: 'text-sm px-3 py-1.5',
  advanced: 'text-base px-4 py-2',
  expert: 'text-lg px-5 py-2.5'
};

export default function SkillCloud({ skills, onSkillClick, maxSkills = 50, className = '' }: SkillCloudProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'confidence' | 'recent' | 'mentions'>('confidence');

  // Sort and filter skills
  const processedSkills = useMemo(() => {
    let filtered = skills;
    
    if (selectedCategory) {
      filtered = skills.filter(skill => skill.category === selectedCategory);
    }

    // Sort skills
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'confidence':
          return b.confidence - a.confidence;
        case 'recent':
          return new Date(b.lastMentioned).getTime() - new Date(a.lastMentioned).getTime();
        case 'mentions':
          return b.mentionCount - a.mentionCount;
        default:
          return b.confidence - a.confidence;
      }
    });

    return sorted.slice(0, maxSkills);
  }, [skills, selectedCategory, sortBy, maxSkills]);

  // Calculate skill size based on confidence and mentions
  const getSkillSize = (skill: Skill) => {
    const baseSize = skill.level ? levelSizes[skill.level] : 'text-sm px-3 py-1.5';
    const scale = 0.5 + (skill.confidence * 0.5) + (Math.min(skill.mentionCount, 10) * 0.05);
    return {
      className: baseSize,
      transform: `scale(${scale})`
    };
  };

  // Get category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    skills.forEach(skill => {
      counts[skill.category] = (counts[skill.category] || 0) + 1;
    });
    return counts;
  }, [skills]);

  return (
    <div className={`skill-cloud ${className}`}>
      {/* Header with filters */}
      <div className="flex flex-wrap items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-white">Skills</h3>
          <span className="text-sm text-slate-400">({processedSkills.length} shown)</span>
        </div>

        {/* Sort options */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-slate-800 border border-slate-600 text-white text-xs rounded px-2 py-1"
          >
            <option value="confidence">Confidence</option>
            <option value="recent">Recently Used</option>
            <option value="mentions">Most Mentioned</option>
          </select>
        </div>
      </div>

      {/* Category filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <motion.button
          onClick={() => setSelectedCategory(null)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
            selectedCategory === null
              ? 'bg-slate-600 text-white'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
          }`}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          All ({skills.length})
        </motion.button>
        
        {Object.entries(categoryCounts).map(([category, count]) => {
          const colors = categoryColors[category as keyof typeof categoryColors];
          return (
            <motion.button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all border ${
                selectedCategory === category
                  ? `${colors.bg} ${colors.border} ${colors.text}`
                  : `bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700`
              }`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {category} ({count})
            </motion.button>
          );
        })}
      </div>

      {/* Skills cloud */}
      <div className="flex flex-wrap gap-3 items-center justify-center min-h-[200px] p-4 bg-slate-900/50 rounded-lg border border-slate-700">
        <AnimatePresence mode="popLayout">
          {processedSkills.map((skill, index) => {
            const colors = categoryColors[skill.category];
            const size = getSkillSize(skill);
            const isRecent = new Date(skill.lastMentioned) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            
            return (
              <motion.div
                key={`${skill.name}-${skill.category}`}
                layout
                initial={{ opacity: 0, scale: 0 }}
                animate={{ 
                  opacity: 1, 
                  scale: 1,
                  transition: { delay: index * 0.05 }
                }}
                exit={{ opacity: 0, scale: 0 }}
                whileHover={{ 
                  scale: 1.1,
                  zIndex: 10,
                  transition: { duration: 0.2 }
                }}
                whileTap={{ scale: 0.95 }}
                className={`
                  relative cursor-pointer rounded-full border transition-all duration-200
                  ${colors.bg} ${colors.border} ${colors.text} ${colors.hover}
                  ${size.className}
                  ${isRecent ? 'ring-2 ring-white/20' : ''}
                `}
                style={{ transform: size.transform }}
                onClick={() => onSkillClick?.(skill)}
              >
                {/* Skill name */}
                <span className="font-medium">{skill.name}</span>
                
                {/* Confidence indicator */}
                <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-slate-900 ${
                  skill.confidence >= 0.8 ? 'bg-green-400' :
                  skill.confidence >= 0.6 ? 'bg-yellow-400' :
                  skill.confidence >= 0.4 ? 'bg-orange-400' : 'bg-red-400'
                }`} />
                
                {/* Level indicator */}
                {skill.level && (
                  <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2">
                    <div className={`w-1 h-1 rounded-full ${
                      skill.level === 'expert' ? 'bg-purple-400' :
                      skill.level === 'advanced' ? 'bg-blue-400' :
                      skill.level === 'intermediate' ? 'bg-green-400' : 'bg-gray-400'
                    }`} />
                  </div>
                )}
                
                {/* Recent indicator */}
                {isRecent && (
                  <motion.div
                    className="absolute -top-2 -right-2 w-2 h-2 bg-white rounded-full"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Legend */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
        <div className="space-y-2">
          <h4 className="font-medium text-slate-300">Confidence</h4>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-400 rounded-full" />
            <span className="text-slate-400">High (80%+)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-400 rounded-full" />
            <span className="text-slate-400">Medium (60-80%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-orange-400 rounded-full" />
            <span className="text-slate-400">Low (40-60%)</span>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="font-medium text-slate-300">Proficiency</h4>
          <div className="flex items-center gap-2">
            <div className="w-1 h-1 bg-purple-400 rounded-full" />
            <span className="text-slate-400">Expert</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1 h-1 bg-blue-400 rounded-full" />
            <span className="text-slate-400">Advanced</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1 h-1 bg-green-400 rounded-full" />
            <span className="text-slate-400">Intermediate</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1 h-1 bg-gray-400 rounded-full" />
            <span className="text-slate-400">Beginner</span>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="font-medium text-slate-300">Indicators</h4>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            <span className="text-slate-400">Recently used</span>
          </div>
          <div className="text-slate-400">Size = confidence + usage</div>
        </div>
      </div>
    </div>
  );
}