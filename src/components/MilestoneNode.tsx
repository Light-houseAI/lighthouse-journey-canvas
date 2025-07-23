import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { motion } from 'framer-motion';

interface MilestoneData {
  title: string;
  type: 'education' | 'work' | 'event' | 'project';
  date: string;
  description: string;
  skills: string[];
  organization?: string;
}

interface MilestoneNodeProps {
  data: MilestoneData;
  selected?: boolean;
  onClick?: () => void;
}

const getEmojiForType = (type: string) => {
  switch (type) {
    case 'education': return '🎓';
    case 'work': return '💼';
    case 'event': return '📅';
    case 'project': return '🛠';
    default: return '💼';
  }
};

const getGradientForType = (type: string) => {
  switch (type) {
    case 'education': return 'bg-gradient-to-br from-education-node via-education-node/80 to-education-node/60';
    case 'work': return 'bg-gradient-to-br from-job-node via-job-node/80 to-job-node/60';
    case 'event': return 'bg-gradient-to-br from-transition-node via-transition-node/80 to-transition-node/60';
    case 'project': return 'bg-gradient-to-br from-skill-node via-skill-node/80 to-skill-node/60';
    default: return 'bg-gradient-to-br from-primary via-primary/80 to-primary/60';
  }
};

const getGlowColor = (type: string) => {
  switch (type) {
    case 'education': return 'shadow-[0_0_30px_hsl(var(--education-node)_/_0.4)]';
    case 'work': return 'shadow-[0_0_30px_hsl(var(--job-node)_/_0.4)]';
    case 'event': return 'shadow-[0_0_30px_hsl(var(--transition-node)_/_0.4)]';
    case 'project': return 'shadow-[0_0_30px_hsl(var(--skill-node)_/_0.4)]';
    default: return 'shadow-[0_0_30px_hsl(var(--primary)_/_0.4)]';
  }
};

const MilestoneNode: React.FC<MilestoneNodeProps> = ({ data, selected, onClick }) => {
  return (
    <>
      <Handle 
        type="target" 
        position={Position.Left} 
        className="w-2 h-2 border-2 border-white bg-white opacity-0"
      />
      
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={onClick}
        className={`
          relative w-28 h-28 rounded-full cursor-pointer
          ${getGradientForType(data.type)}
          ${selected ? 'ring-4 ring-white/50' : ''}
          ${getGlowColor(data.type)}
          hover:${getGlowColor(data.type)}
          border-4 border-white/20
          backdrop-blur-sm
          flex flex-col items-center justify-center
          text-white
          transition-all duration-300
        `}
      >
        {/* Icon */}
        <div className="text-2xl mb-1">
          {getEmojiForType(data.type)}
        </div>
        
        {/* Title */}
        <h3 className="font-bold text-xs text-center leading-tight px-2 text-white drop-shadow-lg">
          {data.title}
        </h3>
        
        {/* Organization (if exists) */}
        {data.organization && (
          <p className="text-[10px] text-center text-white/80 mt-1 px-2 leading-tight">
            {data.organization}
          </p>
        )}

        {/* Glow effect overlay */}
        <div className="absolute inset-0 rounded-full bg-white/10 backdrop-blur-sm" />
        
        {/* Subtle shine effect */}
        <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-white/20 blur-sm" />
      </motion.div>

      <Handle 
        type="source" 
        position={Position.Right} 
        className="w-2 h-2 border-2 border-white bg-white opacity-0"
      />
    </>
  );
};

export default memo(MilestoneNode);