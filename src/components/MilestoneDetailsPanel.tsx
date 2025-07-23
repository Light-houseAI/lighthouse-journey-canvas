import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes, FaEdit, FaCalendarAlt, FaTags } from 'react-icons/fa';
import { Button } from './ui/button';

interface MilestoneData {
  title: string;
  type: 'education' | 'work' | 'event' | 'project';
  date: string;
  description: string;
  skills: string[];
  organization?: string;
}

interface MilestoneDetailsPanelProps {
  isOpen: boolean;
  milestone: MilestoneData | null;
  onClose: () => void;
}

const getTypeLabel = (type: string) => {
  switch (type) {
    case 'education': return 'Education';
    case 'work': return 'Work Experience';
    case 'event': return 'Career Event';
    case 'project': return 'Project';
    default: return 'Milestone';
  }
};

const getTypeColor = (type: string) => {
  switch (type) {
    case 'education': return 'text-education-node';
    case 'work': return 'text-job-node';
    case 'event': return 'text-transition-node';
    case 'project': return 'text-skill-node';
    default: return 'text-primary';
  }
};

const MilestoneDetailsPanel: React.FC<MilestoneDetailsPanelProps> = ({
  isOpen,
  milestone,
  onClose,
}) => {
  return (
    <AnimatePresence>
      {isOpen && milestone && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
          />
          
          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-96 bg-card border-l border-border shadow-2xl z-50 overflow-y-auto"
          >
            <div className="p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-6">
                <div className="flex-1">
                  <div className={`text-xs font-medium uppercase tracking-wide mb-2 ${getTypeColor(milestone.type)}`}>
                    {getTypeLabel(milestone.type)}
                  </div>
                  <h2 className="text-xl font-bold text-foreground mb-1">
                    {milestone.title}
                  </h2>
                  {milestone.organization && (
                    <p className="text-muted-foreground">
                      {milestone.organization}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="p-2 hover:bg-muted rounded-lg"
                >
                  <FaTimes className="w-4 h-4" />
                </Button>
              </div>

              {/* Date */}
              <div className="flex items-center gap-2 mb-6 text-muted-foreground">
                <FaCalendarAlt className="w-4 h-4" />
                <span className="text-sm">{milestone.date}</span>
              </div>

              {/* Description */}
              <div className="mb-6">
                <h3 className="font-semibold text-foreground mb-3">Description</h3>
                <p className="text-muted-foreground leading-relaxed">
                  {milestone.description}
                </p>
              </div>

              {/* Skills */}
              {milestone.skills && milestone.skills.length > 0 && (
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-3">
                    <FaTags className="w-4 h-4 text-muted-foreground" />
                    <h3 className="font-semibold text-foreground">Skills & Technologies</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {milestone.skills.map((skill, index) => (
                      <motion.span
                        key={index}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.05 }}
                        className="px-3 py-1 text-xs bg-primary/10 text-primary rounded-full border border-primary/20"
                      >
                        {skill}
                      </motion.span>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="space-y-3">
                <Button
                  className="w-full flex items-center justify-center gap-2"
                  variant="outline"
                >
                  <FaEdit className="w-4 h-4" />
                  Edit Milestone
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default MilestoneDetailsPanel;