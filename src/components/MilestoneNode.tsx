import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { GraduationCap, Briefcase, Calendar, Search, Users, FolderOpen, ChevronDown } from 'lucide-react';
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
  onDismiss?: () => void;
  showDialog?: boolean;
  hasChildren?: boolean;
  isExpanded?: boolean;
  onToggleChildren?: () => void;
}

const formatDateRange = (dateString: string): string => {
  // Handle "present" cases
  if (dateString.toLowerCase().includes('present')) {
    const match = dateString.match(/(\w+\s+)?(\d{4})/);
    if (match) {
      return `${match[2]} to present`;
    }
    return dateString;
  }
  
  // Extract all years from the date string
  const yearMatches = dateString.match(/\d{4}/g);
  
  if (!yearMatches) {
    return dateString;
  }
  
  if (yearMatches.length === 1) {
    // Single year
    return yearMatches[0];
  } else if (yearMatches.length === 2) {
    // Range of years
    const startYear = yearMatches[0];
    const endYear = yearMatches[1];
    
    if (startYear === endYear) {
      return startYear;
    } else {
      return `${startYear} to ${endYear}`;
    }
  }
  
  // Fallback to original string if format is unexpected
  return dateString;
};

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
  // Use isActive from data instead of selected to maintain glow regardless of canvas clicks
  const isActive = (data as any).isActive || selected;

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
      {/* Label Card - positioned above the node with proper spacing */}
      <motion.div 
        className="absolute -top-32 left-1/2 transform -translate-x-1/2 z-10"
        initial={isNew ? { opacity: 0, y: 10 } : undefined}
        animate={isNew ? { opacity: 1, y: 0 } : undefined}
        transition={isNew ? { delay: 0.3 } : undefined}
      >
        <div className="bg-gray-900/90 backdrop-blur-sm rounded-2xl px-3 py-2 shadow-xl min-w-[180px] max-w-[220px] text-center border border-white/10">
          <h3 className="text-white font-bold text-sm leading-tight mb-1.5 truncate">
            {milestoneData.title}
          </h3>
          <p className="text-white/80 text-xs mb-2">
            {formatDateRange(milestoneData.date)}
          </p>
          {milestoneData.organization && (
            <div 
              className="inline-block bg-white/20 backdrop-blur-sm rounded-full px-2 py-0.5 max-w-full group relative"
              title={milestoneData.organization}
            >
              <span className="text-white text-[10px] font-medium leading-tight truncate block">
                {milestoneData.organization}
              </span>
              {/* Tooltip for long organization names */}
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50 pointer-events-none">
                {milestoneData.organization}
              </div>
            </div>
          )}
        </div>
        {/* Extended connector line from label to node with more spacing */}
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-px h-6 bg-white/30"></div>
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
          ${isActive ? 'ring-4 ring-white/90 scale-125 z-20' : 'hover:scale-105 opacity-50 scale-90'}
        `}
        style={{
          filter: isActive 
            ? `drop-shadow(0 0 60px rgba(99, 102, 241, 1)) drop-shadow(0 0 120px rgba(99, 102, 241, 0.6)) drop-shadow(0 0 180px rgba(99, 102, 241, 0.3))`
            : `drop-shadow(0 0 8px rgba(99, 102, 241, 0.15))`,
        }}
      >
        {/* Enhanced multiple glow layers for active node */}
        {isActive ? (
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
        {isActive && (
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
        {isActive && (
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
          id="left"
          className="w-3 h-3 bg-white/80 border-2 border-gray-300 opacity-0 hover:opacity-100 transition-opacity"
        />
        <Handle
          type="source"
          position={Position.Right}
          id="right"
          className="w-3 h-3 bg-white/80 border-2 border-gray-300 opacity-0 hover:opacity-100 transition-opacity"
        />
        <Handle
          type="target"
          position={Position.Top}
          id="top"
          className="w-3 h-3 bg-white/80 border-2 border-gray-300 opacity-0 hover:opacity-100 transition-opacity"
        />
        <Handle
          type="source"
          position={Position.Bottom}
          id="bottom"
          className="w-3 h-3 bg-white/80 border-2 border-gray-300 opacity-0 hover:opacity-100 transition-opacity"
        />
      </div>

      {/* Chevron Button for Parent Nodes */}
      {milestoneData.hasChildren && (
        <motion.div 
          className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 z-20"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (milestoneData.onToggleChildren) {
                milestoneData.onToggleChildren();
              }
            }}
            className="w-8 h-8 bg-white/90 backdrop-blur-sm border border-white/20 rounded-full flex items-center justify-center shadow-lg hover:bg-white hover:scale-110 transition-all duration-300"
          >
            <ChevronDown 
              className={`w-4 h-4 text-gray-700 transition-transform duration-300 ${
                milestoneData.isExpanded ? 'rotate-180' : 'rotate-0'
              }`}
            />
          </button>
        </motion.div>
      )}

      {/* Update Dialog for Active Node */}
      {isActive && data.showDialog && (
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-4 z-30">
          <UpdateDialog
            isVisible={true}
            onDismiss={(data.onDismiss as (() => void)) || (() => {})}
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