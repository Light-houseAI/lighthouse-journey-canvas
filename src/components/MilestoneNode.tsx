import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { GraduationCap, Briefcase, Calendar, Wrench, ArrowRight, Zap, Target, Star, Activity, GitBranch } from 'lucide-react';
import { motion } from 'framer-motion';

interface MilestoneData {
  title: string;
  type: 'bigEvent' | 'keyActivity' | 'keyDecision' | 'education' | 'job' | 'transition' | 'skill' | 'event' | 'project';
  date: string;
  description: string;
  skills: string[];
  organization?: string;
  tags?: string[];
  isNew?: boolean;
}

const getTypeIcon = (type: string, size: number = 28) => {
  const iconProps = { size, className: "text-white filter drop-shadow-sm" };
  
  switch (type) {
    case 'bigEvent': return <Star {...iconProps} />;
    case 'keyActivity': return <Activity {...iconProps} />;
    case 'keyDecision': return <GitBranch {...iconProps} />;
    case 'education': return <GraduationCap {...iconProps} />;
    case 'job': return <Briefcase {...iconProps} />;
    case 'event': return <Calendar {...iconProps} />;
    case 'project': return <Wrench {...iconProps} />;
    case 'transition': return <ArrowRight {...iconProps} />;
    case 'skill': return <Zap {...iconProps} />;
    default: return <Target {...iconProps} />;
  }
};

const getTypeGradient = (type: string) => {
  switch (type) {
    case 'bigEvent': return 'from-yellow-400 to-orange-500';
    case 'keyActivity': return 'from-green-400 to-emerald-500';
    case 'keyDecision': return 'from-purple-400 to-indigo-500';
    case 'education': return 'from-blue-400 to-blue-600';
    case 'job': return 'from-emerald-400 to-emerald-600';
    case 'event': return 'from-purple-400 to-purple-600';
    case 'project': return 'from-amber-400 to-amber-600';
    case 'transition': return 'from-pink-400 to-pink-600';
    case 'skill': return 'from-cyan-400 to-cyan-600';
    default: return 'from-gray-400 to-gray-600';
  }
};

const getNodeSize = (type: string) => {
  switch (type) {
    case 'bigEvent': return { size: 'w-24 h-24', iconSize: 32 };
    case 'keyActivity': return { size: 'w-18 h-18', iconSize: 24 };
    case 'keyDecision': return { size: 'w-20 h-20', iconSize: 28 };
    default: return { size: 'w-20 h-20', iconSize: 28 };
  }
};

const getNodeShape = (type: string) => {
  switch (type) {
    case 'keyDecision': return 'rotate-45';
    default: return 'rounded-full';
  }
};

const MilestoneNode: React.FC<NodeProps> = ({ data, selected }) => {
  const milestoneData = data as unknown as MilestoneData;
  const gradient = getTypeGradient(milestoneData.type);
  const { size, iconSize } = getNodeSize(milestoneData.type);
  const icon = getTypeIcon(milestoneData.type, iconSize);
  const nodeShape = getNodeShape(milestoneData.type);
  const isNew = data.isNew as boolean;

  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (data.onNodeClick && typeof data.onNodeClick === 'function') {
      data.onNodeClick(milestoneData);
    }
  };

  return (
    <motion.div 
      className="relative"
      initial={isNew ? { scale: 0, opacity: 0 } : undefined}
      animate={isNew ? { scale: 1, opacity: 1 } : undefined}
      transition={isNew ? {
        type: "spring" as const,
        stiffness: 300,
        damping: 20,
        delay: 0.1
      } : undefined}
    >
      {/* Label Card - positioned above the node */}
      <motion.div 
        className="absolute -top-24 left-1/2 transform -translate-x-1/2 z-10"
        initial={isNew ? { opacity: 0, y: 10 } : undefined}
        animate={isNew ? { opacity: 1, y: 0 } : undefined}
        transition={isNew ? { delay: 0.3 } : undefined}
      >
        <div className="bg-gray-900/90 backdrop-blur-sm rounded-2xl px-4 py-3 shadow-xl min-w-[200px] text-center border border-white/10">
          <h3 className="text-white font-bold text-sm leading-tight mb-1">
            {milestoneData.title}
          </h3>
          <p className="text-white/80 text-xs mb-2">
            {milestoneData.date}
          </p>
          {milestoneData.organization && (
            <div className="inline-block bg-white/20 backdrop-blur-sm rounded-full px-3 py-1">
              <span className="text-white text-xs font-medium">
                {milestoneData.organization}
              </span>
            </div>
          )}
          {milestoneData.tags && milestoneData.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2 justify-center">
              {milestoneData.tags.slice(0, 3).map((tag, index) => (
                <span key={index} className="bg-white/10 text-white/80 text-xs px-2 py-0.5 rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        {/* Connector line from label to node */}
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-px h-4 bg-white/30"></div>
      </motion.div>

      {/* Main Node with different shapes */}
      <div 
        onClick={handleClick}
        className={`
          relative ${size} ${milestoneData.type === 'keyDecision' ? 'transform rotate-45' : 'rounded-full'}
          bg-gradient-to-br ${gradient}
          shadow-2xl
          flex items-center justify-center
          transition-all duration-300 ease-out
          cursor-pointer
          ${selected ? 'ring-4 ring-white/50 scale-110' : 'hover:scale-105'}
          ${milestoneData.type === 'bigEvent' ? 'ring-2 ring-yellow-300/50' : ''}
        `}
        style={{
          filter: `drop-shadow(0 0 ${milestoneData.type === 'bigEvent' ? '30' : '20'}px rgba(99, 102, 241, 0.4))`,
        }}
      >
        {/* Glow effect */}
        <div 
          className={`
            absolute inset-0 ${milestoneData.type === 'keyDecision' ? 'transform rotate-0' : 'rounded-full'}
            bg-gradient-to-br ${gradient}
            opacity-60 blur-sm scale-110
          `}
        />
        
        {/* Icon - counter-rotate for diamond shape */}
        <div className={`
          relative z-10 flex items-center justify-center
          ${milestoneData.type === 'keyDecision' ? 'transform -rotate-45' : ''}
        `}>
          {icon}
        </div>

        {/* Connection handles */}
        <Handle
          type="target"
          position={Position.Left}
          className="w-3 h-3 bg-white/80 border-2 border-gray-300 opacity-0 hover:opacity-100 transition-opacity"
        />
        <Handle
          type="source"
          position={Position.Right}
          className="w-3 h-3 bg-white/80 border-2 border-gray-300 opacity-0 hover:opacity-100 transition-opacity"
        />
      </div>
    </motion.div>
  );
};

export default memo(MilestoneNode);