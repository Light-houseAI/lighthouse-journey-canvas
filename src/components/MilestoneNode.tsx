import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { GraduationCap, Briefcase, Calendar, Search, Users, FolderOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import UpdateDialog from './UpdateDialog';

interface MilestoneData {
  title: string;
  type: 'education' | 'jobs' | 'projects' | 'jobsearch' | 'interviews' | 'events';
  date: string;
  description: string;
  skills: string[];
  organization?: string;
  tags?: string[];
  isNew?: boolean;
  onNodeClick?: (data: MilestoneData) => void;
  onStartConversation?: () => void;
  onMoveToNext?: () => void;
}

const getTypeIcon = (type: string, size: number = 28) => {
  const iconProps = { size, className: "text-white filter drop-shadow-sm" };
  
  switch (type) {
    case 'education': return <GraduationCap {...iconProps} />;
    case 'jobs': return <Briefcase {...iconProps} />;
    case 'projects': return <FolderOpen {...iconProps} />;
    case 'jobsearch': return <Search {...iconProps} />;
    case 'interviews': return <Users {...iconProps} />;
    case 'events': return <Calendar {...iconProps} />;
    default: return <Briefcase {...iconProps} />;
  }
};

const getTypeGradient = (type: string) => {
  switch (type) {
    case 'education': return 'from-emerald-500 to-emerald-600';
    case 'jobs': return 'from-blue-500 to-blue-600';
    case 'projects': return 'from-orange-500 to-orange-600';
    case 'jobsearch': return 'from-purple-500 to-purple-600';
    case 'interviews': return 'from-red-500 to-red-600';
    case 'events': return 'from-pink-500 to-pink-600';
    default: return 'from-gray-400 to-gray-600';
  }
};

const getNodeSize = (type: string) => {
  // All nodes use the same size for consistency
  return { size: 'w-20 h-20', iconSize: 28 };
};

const getNodeShape = (type: string) => {
  // All nodes use circular shape for consistency
  return 'rounded-full';
};

const MilestoneNode: React.FC<NodeProps> = ({ data, selected }) => {
  const milestoneData = data as unknown as MilestoneData;
  const gradient = getTypeGradient(milestoneData.type);
  const { size, iconSize } = getNodeSize(milestoneData.type);
  const icon = getTypeIcon(milestoneData.type, iconSize);
  const nodeShape = getNodeShape(milestoneData.type);
  const isNew = data.isNew as boolean;
  const isActiveNode = milestoneData.title === 'Full-Stack Developer';

  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (data.onNodeClick && typeof data.onNodeClick === 'function') {
      data.onNodeClick(milestoneData);
    }
  };

  const handleUpdateDialogDismiss = () => {
    // Could add state management here if needed
  };

  const handleUpdateDialogChat = () => {
    if (milestoneData.onStartConversation && typeof milestoneData.onStartConversation === 'function') {
      milestoneData.onStartConversation();
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
        </div>
        {/* Connector line from label to node */}
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-px h-4 bg-white/30"></div>
      </motion.div>

      {/* Main Node with different shapes */}
      <div 
        onClick={handleClick}
        className={`
          relative ${size} rounded-full
          bg-gradient-to-br ${gradient}
          shadow-2xl
          flex items-center justify-center
          transition-all duration-500 ease-out
          cursor-pointer
          ${selected ? 'ring-4 ring-white/90 scale-125 z-20' : 'hover:scale-105 opacity-50 scale-90'}
        `}
        style={{
          filter: selected 
            ? `drop-shadow(0 0 60px rgba(99, 102, 241, 1)) drop-shadow(0 0 120px rgba(99, 102, 241, 0.6)) drop-shadow(0 0 180px rgba(99, 102, 241, 0.3))`
            : `drop-shadow(0 0 8px rgba(99, 102, 241, 0.15))`,
        }}
      >
        {/* Enhanced multiple glow layers for active node */}
        {selected ? (
          <>
            {/* Inner glow */}
            <div 
              className={`
                absolute inset-0 rounded-full
                bg-gradient-to-br ${gradient}
                opacity-90 blur-sm scale-110
                animate-pulse
              `}
              style={{ animationDuration: '2s' }}
            />
            {/* Middle glow */}
            <div 
              className={`
                absolute inset-0 rounded-full
                bg-gradient-to-br ${gradient}
                opacity-60 blur-md scale-125
                animate-pulse
              `}
              style={{ animationDuration: '3s', animationDelay: '0.5s' }}
            />
            {/* Outer glow */}
            <div 
              className={`
                absolute inset-0 rounded-full
                bg-gradient-to-br ${gradient}
                opacity-40 blur-lg scale-150
                animate-pulse
              `}
              style={{ animationDuration: '4s', animationDelay: '1s' }}
            />
          </>
        ) : (
          <div 
            className={`
              absolute inset-0 rounded-full
              bg-gradient-to-br ${gradient}
              opacity-20 blur-sm scale-105
              transition-all duration-500
            `}
          />
        )}
        
        {/* Rotating glow ring for active node */}
        {selected && (
          <>
            <div className="absolute inset-0 rounded-full animate-spin" style={{ animationDuration: '8s' }}>
              <div 
                className="absolute inset-0 rounded-full opacity-50 blur-md scale-140"
                style={{
                  background: `conic-gradient(from 0deg, transparent, rgba(99, 102, 241, 0.6), transparent, transparent, rgba(99, 102, 241, 0.4), transparent)`,
                }}
              />
            </div>
            {/* Counter-rotating ring */}
            <div className="absolute inset-0 rounded-full animate-spin" style={{ animationDuration: '12s', animationDirection: 'reverse' }}>
              <div 
                className="absolute inset-0 rounded-full opacity-30 blur-lg scale-160"
                style={{
                  background: `conic-gradient(from 90deg, transparent, rgba(99, 102, 241, 0.4), transparent)`,
                }}
              />
            </div>
          </>
        )}
        
        {/* Orbiting particles for active node */}
        {selected && (
          <>
            <div 
              className="absolute w-3 h-3 bg-white/80 rounded-full animate-spin shadow-lg"
              style={{ 
                animationDuration: '4s',
                transform: 'translateX(45px)',
                transformOrigin: '-45px 0px'
              }}
            />
            <div 
              className="absolute w-2 h-2 bg-white/60 rounded-full animate-spin shadow-md"
              style={{ 
                animationDuration: '6s',
                animationDirection: 'reverse',
                transform: 'translateX(50px)',
                transformOrigin: '-50px 0px'
              }}
            />
            <div 
              className="absolute w-1.5 h-1.5 bg-white/40 rounded-full animate-spin shadow-sm"
              style={{ 
                animationDuration: '8s',
                transform: 'translateX(55px)',
                transformOrigin: '-55px 0px'
              }}
            />
          </>
        )}
        
        {/* Icon */}
        <div className="relative z-10 flex items-center justify-center">
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

      {/* Update Dialog for Active Node */}
      {selected && isActiveNode && (
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-4 z-30">
          <UpdateDialog
            isVisible={true}
            onDismiss={handleUpdateDialogDismiss}
            onMoveToNext={(data.onMoveToNext as (() => void)) || (() => {})}
            onChat={(data.onStartConversation as (() => void)) || (() => {})}
            nodePosition={{ x: 0, y: 0 }} // Not needed since it's positioned relatively
          />
        </div>
      )}
    </motion.div>
  );
};

export default memo(MilestoneNode);