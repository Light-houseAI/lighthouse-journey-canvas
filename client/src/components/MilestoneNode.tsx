import React, { memo, useState } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { GraduationCap, Briefcase, Calendar, Wrench, ArrowRight, Zap, Target, Edit, Trash2, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FaEdit, FaTrash, FaSave, FaTimes, FaPlus } from 'react-icons/fa';
import { motion } from 'framer-motion';

interface MilestoneData {
  title: string;
  type: 'education' | 'job' | 'transition' | 'skill' | 'event' | 'project' | 'update';
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
    case 'update': return <Zap {...iconProps} />;
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
    case 'update': return 'from-green-400 to-green-600';
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
  const onAddSubMilestone = (data as any).onAddSubMilestone;
  const [showAddButton, setShowAddButton] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(milestoneData.title);
  const [editDescription, setEditDescription] = useState(milestoneData.description);

  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (data.onNodeClick && typeof data.onNodeClick === 'function') {
      data.onNodeClick(milestoneData);
    }
  };

  const handleEdit = (event: React.MouseEvent) => {
    event.stopPropagation();
    setIsEditing(true);
  };

  const handleSave = async (event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      // Update milestone in database
      await fetch('/api/update-milestone', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          milestoneId: (data as any).id,
          title: editTitle,
          description: editDescription
        }),
      });
      
      // Update local data
      milestoneData.title = editTitle;
      milestoneData.description = editDescription;
      
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update milestone:', error);
      alert('Failed to update milestone. Please try again.');
    }
  };

  const handleCancel = (event: React.MouseEvent) => {
    event.stopPropagation();
    setEditTitle(milestoneData.title);
    setEditDescription(milestoneData.description);
    setIsEditing(false);
  };

  const handleDelete = async (event: React.MouseEvent) => {
    event.stopPropagation();
    if (confirm('Are you sure you want to delete this milestone?')) {
      try {
        // Delete from database
        await fetch('/api/delete-milestone', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ milestoneId: (data as any).id }),
        });
        
        // Call the onNodeDelete callback if available
        if ((data as any).onNodeDelete && typeof (data as any).onNodeDelete === 'function') {
          (data as any).onNodeDelete((data as any).id);
        }
      } catch (error) {
        console.error('Failed to delete milestone:', error);
        alert('Failed to delete milestone. Please try again.');
      }
    }
  };

  return (
    <div className="relative">
      {/* Label Card - positioned above the node with better spacing to avoid overlap */}
      <div className={`absolute left-1/2 transform -translate-x-1/2 z-10 ${
        isSubMilestone ? '-top-48' : '-top-40'
      }`}>
        <div className={`bg-gray-900/90 backdrop-blur-sm rounded-2xl px-4 py-3 shadow-xl text-center border ${
          isSubMilestone 
            ? 'border-yellow-500/40 bg-slate-700/90 min-w-[180px]' 
            : 'border-white/10 min-w-[200px]'
        }`}>
          {isEditing ? (
            <div className="space-y-2">
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full px-2 py-1 text-xs bg-gray-800 border border-gray-600 rounded text-white"
                onClick={(e) => e.stopPropagation()}
              />
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full px-2 py-1 text-xs bg-gray-800 border border-gray-600 rounded text-white resize-none"
                rows={2}
                onClick={(e) => e.stopPropagation()}
              />
              <div className="flex gap-1 justify-center">
                <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={handleSave}>
                  <FaSave className="w-3 h-3" />
                </Button>
                <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={handleCancel}>
                  <FaTimes className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ) : (
            <>
              <h3 className={`font-bold leading-tight mb-1 ${
                isSubMilestone ? 'text-yellow-100 text-xs' : 'text-white text-sm'
              }`}>
                {milestoneData.title}
              </h3>
              <p className={`text-xs mb-2 ${isSubMilestone ? 'text-yellow-200/80' : 'text-white/80'}`}>
                {milestoneData.date}
              </p>
              {(isSubMilestone || milestoneData.type === 'update') && (
                <div className="flex gap-1 justify-center mt-2">
                  <Button size="sm" variant="outline" className="h-6 px-2 text-xs opacity-70 hover:opacity-100" onClick={handleEdit}>
                    <FaEdit className="w-3 h-3" />
                  </Button>
                  <Button size="sm" variant="outline" className="h-6 px-2 text-xs opacity-70 hover:opacity-100 text-red-400" onClick={handleDelete}>
                    <FaTrash className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </>
          )}
          {milestoneData.organization && !isSubMilestone && (
            <div className="inline-block bg-white/20 backdrop-blur-sm rounded-full px-3 py-1">
              <span className="text-white text-xs font-medium">
                {milestoneData.organization}
              </span>
            </div>
          )}
          {hasSubMilestones && !isSubMilestone && (
            <div className="flex items-center justify-center gap-1 mt-2">
              <div className="w-1 h-1 bg-yellow-400 rounded-full"></div>
              <span className="text-yellow-300 text-xs">Has projects</span>
            </div>
          )}
        </div>
        {/* Connector line from label to node */}
        <div className={`absolute top-full left-1/2 transform -translate-x-1/2 w-px ${
          isSubMilestone ? 'h-8 bg-yellow-400/30' : 'h-10 bg-white/30'
        }`}></div>
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
      
      {/* Add Sub-Milestone Button */}
      {!isSubMilestone && onAddSubMilestone && (
        <div 
          className="absolute -bottom-2 -right-2 z-20"
          onMouseEnter={() => setShowAddButton(true)}
          onMouseLeave={() => setShowAddButton(false)}
        >
          <motion.button
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: showAddButton ? 1 : 0.7, scale: 1 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={(e) => {
              e.stopPropagation();
              onAddSubMilestone();
            }}
            className="w-8 h-8 bg-blue-500/90 hover:bg-blue-600/90 rounded-full flex items-center justify-center text-white border-2 border-blue-400/50 backdrop-blur-sm transition-all"
          >
            <FaPlus className="w-3 h-3" />
          </motion.button>
        </div>
      )}
    </div>
  );
};

export default memo(MilestoneNode);