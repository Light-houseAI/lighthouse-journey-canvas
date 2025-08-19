import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trophy, CheckCircle, Flag, Lightbulb, MoreVertical, Plus, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface MilestoneData {
  title: string;
  type: 'education' | 'job' | 'transition' | 'skill' | 'event' | 'project';
  date: string;
  description: string;
  skills: string[];
  organization?: string;
}

interface Achievement {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}

interface MilestoneDetailPanelProps {
  isOpen: boolean;
  onClose: () => void;
  milestone: MilestoneData | null;
  isActive?: boolean;
}

const generateAchievements = (milestone: MilestoneData): Achievement[] => [
  {
    id: '1',
    icon: Trophy,
    title: 'Award Recognition',
    description: `Awarded "Best ${milestone.type === 'job' ? 'Performance' : 'Project'}" for excellence in design and execution.`
  },
  {
    id: '2',
    icon: CheckCircle,
    title: milestone.type === 'job' ? 'Process Optimization' : 'Technical Excellence',
    description: milestone.type === 'job' 
      ? 'Redesigned core workflows, resulting in a 40% increase in efficiency metrics.'
      : 'Implemented best practices and modern technologies with exceptional results.'
  },
  {
    id: '3',
    icon: Flag,
    title: milestone.type === 'job' ? 'Team Leadership' : 'Innovation Achievement',
    description: milestone.type === 'job'
      ? 'Led cross-functional teams to deliver high-impact projects on schedule.'
      : 'Conducted research and implemented innovative solutions to complex challenges.'
  }
];

const MilestoneDetailPanel: React.FC<MilestoneDetailPanelProps> = ({
  isOpen,
  onClose,
  milestone,
  isActive = false,
}) => {
  if (!milestone) return null;

  const achievements = generateAchievements(milestone);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Background overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-full md:w-2/5 bg-background border-l border-border z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-foreground mb-1">
                  {milestone.title}
                </h1>
                {milestone.organization && (
                  <p className="text-muted-foreground">
                    {milestone.organization}
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-8">
                {/* Visibility Chip */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 border border-border rounded-full text-sm text-muted-foreground">
                    <Eye className="w-4 h-4" />
                    <span>Visible to my organizations</span>
                  </div>
                  {isActive && (
                    <span className="text-sm text-green-600">• Open to: Informational call, Mentoring</span>
                  )}
                </div>

                {/* Description */}
                <div>
                  <h2 className="text-lg font-semibold text-foreground mb-3">
                    Description
                  </h2>
                  <p className="text-foreground leading-relaxed">
                    {milestone.description}
                  </p>
                </div>

                {/* Dates */}
                <div>
                  <h2 className="text-lg font-semibold text-foreground mb-3">
                    Dates
                  </h2>
                  <p className="text-foreground">
                    {milestone.date}
                  </p>
                </div>

                {/* Top 3 Achievements */}
                <div>
                  <h2 className="text-lg font-semibold text-foreground mb-4">
                    Top 3 achievements and outcomes
                  </h2>
                  <div className="space-y-4">
                    {achievements.map((achievement) => {
                      const IconComponent = achievement.icon;
                      return (
                        <div key={achievement.id} className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                            <IconComponent className="w-6 h-6 text-primary" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-foreground mb-1">
                              {achievement.title}
                            </h3>
                            <p className="text-muted-foreground leading-relaxed">
                              {achievement.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Skills & Keywords */}
                <div>
                  <h2 className="text-lg font-semibold text-foreground mb-4">
                    Skills & keywords
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {milestone.skills.map((skill, index) => (
                      <span
                        key={index}
                        className="px-3 py-1.5 bg-muted text-foreground rounded-full text-sm font-medium border border-border"
                      >
                        {skill}
                      </span>
                    ))}
                    {milestone.skills.length > 8 && (
                      <span className="px-3 py-1.5 bg-muted text-muted-foreground rounded-full text-sm">
                        +{milestone.skills.length - 8} more
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom padding for sticky action bar */}
                <div className="h-20" />
              </div>
            </div>

            {/* Sticky Action Bar */}
            <div className="border-t border-border bg-background p-4">
              <div className="flex items-center gap-3">
                <Button 
                  className="flex-1 bg-gradient-to-r from-primary to-primary-glow text-primary-foreground hover:shadow-lg hover:shadow-primary/25 transition-all duration-300"
                  size="lg"
                >
                  View Journey
                </Button>
                <Button 
                  variant="outline" 
                  size="lg"
                  className="flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Update
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="lg" className="px-3">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem>
                      Edit details
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      Share experience
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive">
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default MilestoneDetailPanel;