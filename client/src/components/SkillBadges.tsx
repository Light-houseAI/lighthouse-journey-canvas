import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, ChevronDown, ChevronUp } from 'lucide-react';

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

interface SkillBadgesProps {
  skills: Skill[];
  maxVisible?: number;
  size?: 'small' | 'medium' | 'large';
  showAddButton?: boolean;
  onAddSkill?: () => void;
  onRemoveSkill?: (skillName: string) => void;
  onSkillClick?: (skill: Skill) => void;
  className?: string;
}

const categoryColors = {
  technical: {
    bg: 'bg-blue-500/20',
    border: 'border-blue-400/60',
    text: 'text-blue-300',
    icon: '💻'
  },
  soft: {
    bg: 'bg-green-500/20',
    border: 'border-green-400/60',
    text: 'text-green-300',
    icon: '🤝'
  },
  domain: {
    bg: 'bg-purple-500/20',
    border: 'border-purple-400/60',
    text: 'text-purple-300',
    icon: '🏢'
  },
  language: {
    bg: 'bg-orange-500/20',
    border: 'border-orange-400/60',
    text: 'text-orange-300',
    icon: '🌐'
  },
  certification: {
    bg: 'bg-yellow-500/20',
    border: 'border-yellow-400/60',
    text: 'text-yellow-300',
    icon: '🏆'
  }
};

const sizeClasses = {
  small: {
    badge: 'text-xs px-2 py-1',
    icon: 'text-xs',
    button: 'w-6 h-6 text-xs'
  },
  medium: {
    badge: 'text-sm px-3 py-1.5',
    icon: 'text-sm',
    button: 'w-8 h-8 text-sm'
  },
  large: {
    badge: 'text-base px-4 py-2',
    icon: 'text-base',
    button: 'w-10 h-10 text-base'
  }
};

const levelIndicators = {
  beginner: '○',
  intermediate: '◐',
  advanced: '●',
  expert: '◆'
};

export default function SkillBadges({
  skills,
  maxVisible = 5,
  size = 'medium',
  showAddButton = false,
  onAddSkill,
  onRemoveSkill,
  onSkillClick,
  className = ''
}: SkillBadgesProps) {
  const [showAll, setShowAll] = useState(false);
  const [hoveredSkill, setHoveredSkill] = useState<string | null>(null);

  const sizeConfig = sizeClasses[size];
  const displaySkills = showAll ? skills : skills.slice(0, maxVisible);
  const hiddenCount = Math.max(0, skills.length - maxVisible);

  const getConfidenceIndicator = (confidence: number) => {
    if (confidence >= 0.8) return { color: 'bg-green-400', label: 'High' };
    if (confidence >= 0.6) return { color: 'bg-yellow-400', label: 'Medium' };
    if (confidence >= 0.4) return { color: 'bg-orange-400', label: 'Low' };
    return { color: 'bg-red-400', label: 'Learning' };
  };

  return (
    <div className={`skill-badges ${className}`}>
      <div className="flex flex-wrap gap-2 items-center">
        <AnimatePresence>
          {displaySkills.map((skill, index) => {
            const colors = categoryColors[skill.category];
            const confidence = getConfidenceIndicator(skill.confidence);
            
            return (
              <motion.div
                key={skill.name}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ 
                  opacity: 1, 
                  scale: 1,
                  transition: { delay: index * 0.05 }
                }}
                exit={{ opacity: 0, scale: 0 }}
                className="relative"
                onMouseEnter={() => setHoveredSkill(skill.name)}
                onMouseLeave={() => setHoveredSkill(null)}
              >
                <motion.div
                  className={`
                    relative cursor-pointer rounded-full border transition-all duration-200
                    ${colors.bg} ${colors.border} ${colors.text}
                    ${sizeConfig.badge}
                    hover:scale-105 hover:shadow-lg
                  `}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onSkillClick?.(skill)}
                >
                  {/* Skill content */}
                  <div className="flex items-center gap-1">
                    <span className={sizeConfig.icon}>{colors.icon}</span>
                    <span className="font-medium">{skill.name}</span>
                    {skill.level && (
                      <span className="opacity-60">
                        {levelIndicators[skill.level]}
                      </span>
                    )}
                  </div>

                  {/* Confidence indicator */}
                  <div className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${confidence.color}`} />

                  {/* Remove button */}
                  {onRemoveSkill && (
                    <motion.button
                      className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveSkill(skill.name);
                      }}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <X className="w-3 h-3" />
                    </motion.button>
                  )}
                </motion.div>

                {/* Tooltip */}
                <AnimatePresence>
                  {hoveredSkill === skill.name && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.9 }}
                      className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50"
                    >
                      <div className="bg-slate-900 border border-slate-600 rounded-lg p-3 shadow-xl min-w-max">
                        <div className="text-sm font-medium text-white">{skill.name}</div>
                        <div className="text-xs text-slate-400 mt-1">
                          {skill.category} • {Math.round(skill.confidence * 100)}% confidence
                        </div>
                        {skill.level && (
                          <div className="text-xs text-slate-300 mt-1">
                            Level: <span className="capitalize">{skill.level}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1 mt-2">
                          <div className={`w-2 h-2 rounded-full ${confidence.color}`} />
                          <span className="text-xs text-slate-400">{confidence.label}</span>
                        </div>
                        {/* Tooltip arrow */}
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Show more/less button */}
        {hiddenCount > 0 && !showAll && (
          <motion.button
            className={`
              rounded-full border border-slate-600 bg-slate-800/50 text-slate-400 
              hover:text-white hover:border-slate-500 transition-all
              ${sizeConfig.badge}
            `}
            onClick={() => setShowAll(true)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <div className="flex items-center gap-1">
              <span>+{hiddenCount}</span>
              <ChevronDown className="w-3 h-3" />
            </div>
          </motion.button>
        )}

        {/* Show less button */}
        {showAll && hiddenCount > 0 && (
          <motion.button
            className={`
              rounded-full border border-slate-600 bg-slate-800/50 text-slate-400 
              hover:text-white hover:border-slate-500 transition-all
              ${sizeConfig.badge}
            `}
            onClick={() => setShowAll(false)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <ChevronUp className="w-3 h-3" />
          </motion.button>
        )}

        {/* Add skill button */}
        {showAddButton && onAddSkill && (
          <motion.button
            className={`
              rounded-full border-2 border-dashed border-slate-600 bg-slate-800/30 
              text-slate-400 hover:text-white hover:border-slate-500 transition-all
              flex items-center justify-center
              ${sizeConfig.button}
            `}
            onClick={onAddSkill}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Plus className="w-4 h-4" />
          </motion.button>
        )}
      </div>

      {/* Summary info */}
      {skills.length > 0 && (
        <div className="mt-2 text-xs text-slate-500">
          {skills.length} skill{skills.length !== 1 ? 's' : ''} • 
          {skills.filter(s => s.confidence >= 0.7).length} strong • 
          {skills.filter(s => s.level === 'expert' || s.level === 'advanced').length} advanced+
        </div>
      )}
    </div>
  );
}

// Individual skill badge component for reuse
export function SkillBadge({ 
  skill, 
  size = 'medium', 
  onClick, 
  showTooltip = true,
  className = '' 
}: { 
  skill: Skill; 
  size?: 'small' | 'medium' | 'large';
  onClick?: (skill: Skill) => void;
  showTooltip?: boolean;
  className?: string;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const colors = categoryColors[skill.category];
  const sizeConfig = sizeClasses[size];
  const confidence = skill.confidence >= 0.8 ? 'bg-green-400' :
                    skill.confidence >= 0.6 ? 'bg-yellow-400' :
                    skill.confidence >= 0.4 ? 'bg-orange-400' : 'bg-red-400';

  return (
    <div 
      className={`relative ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <motion.div
        className={`
          relative cursor-pointer rounded-full border transition-all duration-200
          ${colors.bg} ${colors.border} ${colors.text}
          ${sizeConfig.badge}
          hover:scale-105 hover:shadow-lg
        `}
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => onClick?.(skill)}
      >
        <div className="flex items-center gap-1">
          <span className={sizeConfig.icon}>{colors.icon}</span>
          <span className="font-medium">{skill.name}</span>
          {skill.level && (
            <span className="opacity-60">
              {levelIndicators[skill.level]}
            </span>
          )}
        </div>
        <div className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${confidence}`} />
      </motion.div>

      {/* Tooltip */}
      {showTooltip && (
        <AnimatePresence>
          {isHovered && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.9 }}
              className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50"
            >
              <div className="bg-slate-900 border border-slate-600 rounded-lg p-2 shadow-xl whitespace-nowrap">
                <div className="text-sm font-medium text-white">{skill.name}</div>
                <div className="text-xs text-slate-400">
                  {Math.round(skill.confidence * 100)}% confidence
                  {skill.level && ` • ${skill.level}`}
                </div>
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}