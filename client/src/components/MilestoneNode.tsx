import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { GraduationCap, Briefcase, Calendar, Wrench, ArrowRight, Zap, Target } from 'lucide-react';

interface MilestoneData {
  title: string;
  type: 'education' | 'job' | 'transition' | 'skill' | 'event' | 'project';
  date: string;
  description: string;
  skills: string[];
  organization?: string;
}

const getTypeIcon = (type: string) => {
  const iconProps = { size: 28, className: "text-white filter drop-shadow-sm" };
  switch (type) {
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
    case 'education': return 'from-blue-400 to-blue-600';
    case 'job': return 'from-emerald-400 to-emerald-600';
    case 'event': return 'from-purple-400 to-purple-600';
    case 'project': return 'from-amber-400 to-amber-600';
    case 'transition': return 'from-pink-400 to-pink-600';
    case 'skill': return 'from-cyan-400 to-cyan-600';
    default: return 'from-gray-400 to-gray-600';
  }
};

const MilestoneNode: React.FC<NodeProps> = ({ data, selected }) => {
  const milestoneData = data as unknown as MilestoneData;
  const gradient = getTypeGradient(milestoneData.type);
  const icon = getTypeIcon(milestoneData.type);
  const isUpdated = (data as any).isUpdated;
  const isSubMilestone = (data as any).isSubMilestone;
  const hasSubMilestones = (data as any).hasSubMilestones;

  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (data.onNodeClick && typeof data.onNodeClick === 'function') {
      data.onNodeClick(milestoneData);
    }
  };

  return (
    <div className="relative">
      {/* Label Card - positioned above the node */}
      <div className="absolute -top-24 left-1/2 transform -translate-x-1/2 z-10">
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
      </div>

      {/* Main Circular Node */}
      <div
        onClick={handleClick}
        className={`
          relative w-20 h-20 rounded-full
          bg-gradient-to-br ${gradient}
          shadow-2xl
          flex items-center justify-center
          transition-all duration-300 ease-out
          cursor-pointer
          ${selected ? 'ring-4 ring-white/50 scale-110' : 'hover:scale-105'}
          ${isUpdated ? 'ring-2 ring-yellow-400 animate-pulse' : ''}
        `}
        style={{
          filter: 'drop-shadow(0 0 20px rgba(99, 102, 241, 0.4))',
        }}
      >
        {/* Glow effect */}
        <div
          className={`
            absolute inset-0 rounded-full
            bg-gradient-to-br ${gradient}
            opacity-60 blur-sm scale-110
          `}
        />

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
    </div>
  );
};

export default memo(MilestoneNode);