import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { motion } from 'framer-motion';
import { 
  FaGraduationCap, 
  FaBriefcase, 
  FaArrowRight, 
  FaCog,
  FaCalendarAlt,
  FaTags 
} from 'react-icons/fa';

interface MilestoneData {
  title: string;
  type: 'education' | 'job' | 'transition' | 'skill';
  date: string;
  description: string;
  skills: string[];
}

interface MilestoneNodeProps {
  data: MilestoneData;
  selected?: boolean;
}

const getIconForType = (type: string) => {
  switch (type) {
    case 'education': return <FaGraduationCap className="text-education-node" />;
    case 'job': return <FaBriefcase className="text-job-node" />;
    case 'transition': return <FaArrowRight className="text-transition-node" />;
    case 'skill': return <FaCog className="text-skill-node" />;
    default: return <FaBriefcase className="text-primary" />;
  }
};

const getGlowColor = (type: string) => {
  switch (type) {
    case 'education': return 'shadow-[0_0_20px_hsl(var(--education-node)_/_0.3)]';
    case 'job': return 'shadow-[0_0_20px_hsl(var(--job-node)_/_0.3)]';
    case 'transition': return 'shadow-[0_0_20px_hsl(var(--transition-node)_/_0.3)]';
    case 'skill': return 'shadow-[0_0_20px_hsl(var(--skill-node)_/_0.3)]';
    default: return 'shadow-[0_0_20px_hsl(var(--primary)_/_0.3)]';
  }
};

const MilestoneNode: React.FC<MilestoneNodeProps> = ({ data, selected }) => {
  return (
    <>
      <Handle 
        type="target" 
        position={Position.Left} 
        className="w-3 h-3 border-2 border-primary bg-primary/20"
      />
      
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.05 }}
        className={`
          milestone-node ${data.type}
          ${selected ? 'ring-2 ring-primary' : ''}
          ${getGlowColor(data.type)}
          hover:${getGlowColor(data.type)}
          w-64 min-h-32
        `}
      >
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-card/50">
            {getIconForType(data.type)}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground text-sm leading-tight">
              {data.title}
            </h3>
            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
              <FaCalendarAlt className="w-3 h-3" />
              <span>{data.date}</span>
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
          {data.description}
        </p>

        {/* Skills */}
        {data.skills && data.skills.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <FaTags className="w-3 h-3" />
              <span>Skills</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {data.skills.map((skill, index) => (
                <motion.span
                  key={index}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                  className="px-2 py-1 text-xs bg-primary/10 text-primary rounded-md border border-primary/20"
                >
                  {skill}
                </motion.span>
              ))}
            </div>
          </div>
        )}

        {/* Subtle background pattern */}
        <div className="absolute inset-0 rounded-xl opacity-5 pointer-events-none">
          <div className="w-full h-full bg-gradient-to-br from-primary to-transparent" />
        </div>
      </motion.div>

      <Handle 
        type="source" 
        position={Position.Right} 
        className="w-3 h-3 border-2 border-primary bg-primary/20"
      />
    </>
  );
};

export default memo(MilestoneNode);