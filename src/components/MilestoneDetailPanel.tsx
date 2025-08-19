import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trophy, CheckCircle, Flag, Lightbulb, MoreVertical, Plus, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface MilestoneData {
  title: string;
  type: 'education' | 'job' | 'transition' | 'skill' | 'event' | 'project' | 'interviews';
  date: string;
  description: string;
  skills: string[];
  organization?: string;
  jobPostingUrl?: string;
  interviewRounds?: Array<{
    id: number;
    title: string;
    status: 'completed' | 'upcoming' | 'pending';
    date: string;
    description: string;
  }>;
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
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-foreground mb-3">
                    Description
                  </h2>
                  <p className="text-foreground leading-relaxed">
                    {milestone.description}
                  </p>
                  
                  {/* Job Posting Link - moved up for interviews */}
                  {milestone.type === 'interviews' && milestone.jobPostingUrl && (
                    <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                      <a 
                        href={milestone.jobPostingUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:text-primary/80 font-medium flex items-center gap-2 transition-colors"
                      >
                        📄 View Job Posting
                        <span className="text-sm">↗</span>
                      </a>
                    </div>
                  )}
                </div>

                {/* Dates */}
                <div>
                  <h2 className="text-lg font-semibold text-foreground mb-3">
                    {milestone.type === 'interviews' ? 'Application Date' : 'Dates'}
                  </h2>
                  <p className="text-foreground">
                    {milestone.type === 'interviews' ? 'Jul 15, 2025' : milestone.date}
                  </p>
                </div>

                {/* Top 3 Achievements/Interview Progress */}
                {milestone.type === 'interviews' && milestone.interviewRounds ? (
                  <div>
                    <h2 className="text-lg font-semibold text-foreground mb-4">
                      Interview Progress
                    </h2>
                    <div className="space-y-4">
                      {milestone.interviewRounds.map((round: any, index: number) => (
                        <div key={round.id} className="flex items-start gap-4">
                          <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 text-lg font-bold ${
                            round.status === 'completed' 
                              ? 'bg-green-500/20 text-green-600' 
                              : round.status === 'upcoming'
                              ? 'bg-blue-500/20 text-blue-600'
                              : 'bg-muted text-muted-foreground'
                          }`}>
                            {round.status === 'completed' ? '✓' : index + 1}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-foreground">{round.title}</h3>
                              <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                                round.status === 'completed' 
                                  ? 'bg-green-500/20 text-green-600' 
                                  : round.status === 'upcoming'
                                  ? 'bg-blue-500/20 text-blue-600'
                                  : 'bg-muted text-muted-foreground'
                              }`}>
                                {round.status}
                              </span>
                            </div>
                            <p className="text-muted-foreground leading-relaxed mb-1">{round.description}</p>
                            <p className="text-xs text-muted-foreground font-medium">{round.date}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
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
                )}

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