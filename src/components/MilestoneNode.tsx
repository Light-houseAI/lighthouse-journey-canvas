import React, { memo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { motion, AnimatePresence } from 'framer-motion';

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
    case 'education': return 'bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700';
    case 'work': return 'bg-gradient-to-br from-green-500 via-green-600 to-green-700';
    case 'event': return 'bg-gradient-to-br from-purple-500 via-purple-600 to-purple-700';
    case 'project': return 'bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700';
    default: return 'bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700';
  }
};

const getGlowColor = (type: string) => {
  switch (type) {
    case 'education': return 'shadow-[0_0_30px_rgba(59,130,246,0.5)]';
    case 'work': return 'shadow-[0_0_30px_rgba(34,197,94,0.5)]';
    case 'event': return 'shadow-[0_0_30px_rgba(168,85,247,0.5)]';
    case 'project': return 'shadow-[0_0_30px_rgba(249,115,22,0.5)]';
    default: return 'shadow-[0_0_30px_rgba(59,130,246,0.5)]';
  }
};

const MilestoneNode: React.FC<MilestoneNodeProps> = ({ data, selected, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div className="relative">
      <Handle 
        type="target" 
        position={Position.Left} 
        className="w-2 h-2 border-2 border-white bg-white opacity-0"
      />
      
      {/* Detail Card - appears on hover */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-full mb-4 left-1/2 transform -translate-x-1/2 z-50"
          >
            <div className="bg-gray-900/95 backdrop-blur-sm rounded-2xl p-4 min-w-[280px] border border-white/10">
              <h3 className="text-white font-semibold text-lg mb-1">
                {data.title}
              </h3>
              <p className="text-gray-300 text-sm mb-3">
                {data.date}
              </p>
              {data.organization && (
                <div className="inline-block bg-white/20 text-white text-xs px-3 py-1 rounded-full">
                  {data.organization}
                </div>
              )}
            </div>
            {/* Arrow pointer */}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2">
              <div className="w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-gray-900/95"></div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Circular Node */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`
          relative w-24 h-24 rounded-full cursor-pointer
          ${getGradientForType(data.type)}
          ${selected ? 'ring-4 ring-white/50' : ''}
          ${getGlowColor(data.type)}
          hover:${getGlowColor(data.type)}
          border-3 border-white/30
          backdrop-blur-sm
          flex items-center justify-center
          text-white
          transition-all duration-300
        `}
      >
        {/* Icon */}
        <div className="text-2xl">
          {getEmojiForType(data.type)}
        </div>

        {/* Subtle inner glow */}
        <div className="absolute inset-2 rounded-full bg-white/10 backdrop-blur-sm" />
        
        {/* Shine effect */}
        <div className="absolute top-2 left-2 w-4 h-4 rounded-full bg-white/30 blur-sm" />
      </motion.div>

      <Handle 
        type="source" 
        position={Position.Right} 
        className="w-2 h-2 border-2 border-white bg-white opacity-0"
      />
    </div>
  );
};

export default memo(MilestoneNode);