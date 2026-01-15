import { Button } from '@journey/components';
import {
  AlertOctagon,
  Dumbbell,
  Gift,
  Heart,
  Search,
  Sparkles,
  ThumbsUp,
  Wand2,
  X,
  ArrowRight,
} from 'lucide-react';
import React, { useState } from 'react';

import heartPreviewImage from '../../assets/images/heart-preview.png';
import logoImage from '../../assets/images/logo.png';
import { ProgressSnapshotPanel } from '../timeline/ProgressSnapshotPanel';
import { WeeklyProgressChatModal } from './WeeklyProgressChatModal';
import { WorkflowAnalysisChatModal } from './WorkflowAnalysisChatModal';
import { WorkflowAnalysisPanel } from '../workflow/WorkflowAnalysisPanel';

interface WorkOutputTemplate {
  id: string;
  title: string;
  description: string;
  requirements: string[];
  category: 'favorites' | 'package' | 'create' | 'improve';
  templateKey: string;
  isAvailable: boolean;
  votes?: number;
}

// All work output templates
const workOutputTemplates: WorkOutputTemplate[] = [
  // Favorites
  {
    id: 'weekly-progress-update',
    title: 'Weekly progress update',
    description: 'A weekly snapshot of what you worked on. Useful for team stand-ups or progress update reports.',
    requirements: ['1 session minimum from the defined week'],
    category: 'favorites',
    templateKey: 'progress-snapshot',
    isAvailable: true,
  },
  // Package my work
  {
    id: 'case-study',
    title: 'Case study',
    description: 'A structured narrative of a project you worked on—covering the problem, approach, decisions, and outcomes. Useful for sharing impact, documenting learnings, or showcasing your work.',
    requirements: ['3+ sessions with meaningful work activity'],
    category: 'package',
    templateKey: 'case-study',
    isAvailable: false,
    votes: 5,
  },
  {
    id: 'process-documentation',
    title: 'Process documentation',
    description: 'Document your work process and methodology for knowledge sharing.',
    requirements: ['2+ sessions with documented workflow'],
    category: 'package',
    templateKey: 'process-documentation',
    isAvailable: false,
    votes: 3,
  },
  {
    id: 'project-handoff-guide',
    title: 'Project handoff guide',
    description: 'A comprehensive guide for handing off your project to another team member.',
    requirements: ['Complete project with documented sessions'],
    category: 'package',
    templateKey: 'project-handoff',
    isAvailable: false,
    votes: 2,
  },
  {
    id: 'step-by-step-tutorial',
    title: 'Step-by-step tutorial',
    description: 'Create a tutorial based on your work process.',
    requirements: ['Sessions with clear sequential work'],
    category: 'package',
    templateKey: 'tutorial',
    isAvailable: false,
    votes: 4,
  },
  {
    id: 'weekly-progress-update-pkg',
    title: 'Weekly progress update',
    description: 'A weekly snapshot of what you worked on.',
    requirements: ['1 session minimum from the defined week'],
    category: 'package',
    templateKey: 'progress-snapshot',
    isAvailable: true,
  },
  // Create from my work
  {
    id: 'social-media-post',
    title: 'Social media post',
    description: 'Generate engaging social media content from your work highlights.',
    requirements: ['1+ session with notable achievements'],
    category: 'create',
    templateKey: 'social-media',
    isAvailable: false,
    votes: 7,
  },
  {
    id: 'blog-post',
    title: 'Blog post',
    description: 'Create a blog post from your work insights and learnings.',
    requirements: ['2+ sessions with meaningful content'],
    category: 'create',
    templateKey: 'blog-post',
    isAvailable: false,
    votes: 6,
  },
  {
    id: 'resume',
    title: 'Resume',
    description: 'Generate resume content highlighting your work accomplishments.',
    requirements: ['Multiple sessions showing project work'],
    category: 'create',
    templateKey: 'resume',
    isAvailable: false,
    votes: 8,
  },
  // Improve my work
  {
    id: 'expert-critique',
    title: 'Expert critique',
    description: 'Get AI-powered feedback on your work from an expert perspective.',
    requirements: ['1+ session with work to review'],
    category: 'improve',
    templateKey: 'expert-critique',
    isAvailable: false,
    votes: 4,
  },
  {
    id: 'recommend-ai-tools',
    title: 'Recommend AI tools',
    description: 'Get personalized AI tool recommendations based on your workflow.',
    requirements: ['Sessions showing your current tools and processes'],
    category: 'improve',
    templateKey: 'ai-tools',
    isAvailable: false,
    votes: 3,
  },
  {
    id: 'my-workflow-analysis',
    title: 'My workflow analysis',
    description: 'A breakdown of your work patterns, rhythms, and strengths.',
    requirements: ['3+ sessions for meaningful analysis'],
    category: 'improve',
    templateKey: 'workflow-analysis',
    isAvailable: true,
  },
  {
    id: 'project-retrospective',
    title: 'Project retrospective',
    description: 'Reflect on what went well and what could be improved.',
    requirements: ['Completed project with multiple sessions'],
    category: 'improve',
    templateKey: 'retrospective',
    isAvailable: false,
    votes: 5,
  },
  {
    id: 'skills-progression-report',
    title: 'Skills progression report',
    description: 'Track your skill development over time.',
    requirements: ['Sessions spanning multiple weeks'],
    category: 'improve',
    templateKey: 'skills-progression',
    isAvailable: false,
    votes: 2,
  },
];

interface CategorySection {
  id: string;
  title: string;
  icon: React.ReactNode;
  category: 'favorites' | 'package' | 'create' | 'improve';
}

const categories: CategorySection[] = [
  { id: 'favorites', title: 'My favorites', icon: <Heart className="h-5 w-5" />, category: 'favorites' },
  { id: 'package', title: 'Package my work', icon: <Gift className="h-5 w-5" />, category: 'package' },
  { id: 'create', title: 'Create from my work', icon: <Wand2 className="h-5 w-5" />, category: 'create' },
  { id: 'improve', title: 'Improve my work', icon: <Dumbbell className="h-5 w-5" />, category: 'improve' },
];

interface BrowseWorkOutputsModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodeId: string;
  onSelectTemplate: (templateKey: string) => void;
}

export function BrowseWorkOutputsModal({
  isOpen,
  onClose,
  nodeId,
  onSelectTemplate,
}: BrowseWorkOutputsModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<WorkOutputTemplate | null>(
    workOutputTemplates.find((t) => t.category === 'favorites') || null
  );
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set(['weekly-progress-update']));
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set());
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSubmittedIds, setFeedbackSubmittedIds] = useState<Set<string>>(new Set());
  const [showWorkflowAnalysis, setShowWorkflowAnalysis] = useState(false);
  const [showProgressSnapshot, setShowProgressSnapshot] = useState(false);
  const [showWeeklyProgressChat, setShowWeeklyProgressChat] = useState(false);
  const [showWorkflowAnalysisChat, setShowWorkflowAnalysisChat] = useState(false);

  if (!isOpen) return null;

  const filteredTemplates = searchQuery
    ? workOutputTemplates.filter(
        (t) =>
          t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : workOutputTemplates;

  const toggleFavorite = (templateId: string) => {
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(templateId)) {
        next.delete(templateId);
      } else {
        next.add(templateId);
      }
      return next;
    });
  };

  const handleVote = (templateId: string) => {
    setVotedIds((prev) => {
      const next = new Set(prev);
      if (next.has(templateId)) {
        next.delete(templateId);
      } else {
        next.add(templateId);
      }
      return next;
    });
  };

  const handleGetStarted = () => {
    if (selectedTemplate && selectedTemplate.isAvailable) {
      // For workflow-analysis, show the panel inline instead of navigating
      if (selectedTemplate.templateKey === 'workflow-analysis') {
        setShowWorkflowAnalysis(true);
        return;
      }
      // For progress-snapshot, show the panel inline instead of navigating
      if (selectedTemplate.templateKey === 'progress-snapshot') {
        setShowProgressSnapshot(true);
        return;
      }
      onSelectTemplate(selectedTemplate.templateKey);
      onClose();
    }
  };

  const handleSubmitFeedback = () => {
    if (!selectedTemplate || !feedbackText.trim()) return;
    // TODO: Submit feedback to backend
    console.log('Feedback submitted:', feedbackText);
    setFeedbackSubmittedIds((prev) => new Set(prev).add(selectedTemplate.id));
    setFeedbackText('');
  };

  // Calculate vote count (base + user vote)
  const getVoteCount = (template: WorkOutputTemplate) => {
    const baseVotes = template.votes || 0;
    const hasUserVoted = votedIds.has(template.id);
    return baseVotes + (hasUserVoted ? 1 : 0);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative flex max-h-[90vh] w-full max-w-[1138px] flex-col overflow-hidden rounded-xl bg-white"
        style={{
          boxShadow: '0px 25px 50px -12px rgba(0, 0, 0, 0.25)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-start gap-3 border-b px-4 py-4"
          style={{ borderColor: '#D6D6D4' }}
        >
          <div className="flex flex-1 flex-col gap-0.5">
            <h2
              className="text-xl font-semibold"
              style={{
                color: '#161619',
                letterSpacing: '-0.05px',
                lineHeight: '30px',
              }}
            >
              Browse work session outputs
            </h2>
            <p
              className="text-base"
              style={{
                color: '#161619',
                letterSpacing: '-0.05px',
                lineHeight: '24px',
              }}
            >
              Produce meaningful outputs from your pushed work sessions.
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded hover:bg-gray-100"
          >
            <X className="h-4 w-4" style={{ color: '#4A4F4E' }} />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {showWorkflowAnalysis ? (
            /* Workflow Analysis Panel - full width */
            <div className="flex-1 overflow-y-auto">
              <WorkflowAnalysisPanel
                nodeId={nodeId}
                onClose={() => setShowWorkflowAnalysis(false)}
              />
            </div>
          ) : showProgressSnapshot ? (
            /* Progress Snapshot Panel - full width */
            <div className="flex-1 overflow-y-auto p-4">
              <ProgressSnapshotPanel
                nodeId={nodeId}
                onClose={() => setShowProgressSnapshot(false)}
              />
            </div>
          ) : (
            <>
          {/* Left Navigation */}
          <div
            className="flex w-[285px] flex-shrink-0 flex-col gap-4 overflow-y-auto border-r p-4"
            style={{ borderColor: '#D6D6D4' }}
          >
            {/* Search */}
            <div
              className="flex items-center gap-2 rounded-lg border bg-white px-3 py-1.5"
              style={{ borderColor: '#E9EAEB' }}
            >
              <Search className="h-4 w-4" style={{ color: '#AEAEB2' }} />
              <input
                type="text"
                placeholder="Search by name ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 text-sm outline-none"
                style={{
                  color: '#2E2E2E',
                  letterSpacing: '-0.05px',
                }}
              />
            </div>

            {/* Category sections */}
            {categories.map((category) => {
              const categoryTemplates = filteredTemplates.filter(
                (t) => t.category === category.category
              );

              if (categoryTemplates.length === 0) return null;

              return (
                <div key={category.id} className="flex flex-col gap-2">
                  {/* Section header */}
                  <div className="flex items-center gap-2">
                    <span style={{ color: '#4A4F4E' }}>{category.icon}</span>
                    <span
                      className="text-base font-semibold"
                      style={{
                        color: '#2E2E2E',
                        letterSpacing: '-0.05px',
                        lineHeight: '24px',
                      }}
                    >
                      {category.title}
                    </span>
                  </div>

                  {/* Menu items */}
                  <div className="flex flex-col gap-1">
                    {categoryTemplates.map((template) => {
                      const isSelected = selectedTemplate?.id === template.id;
                      return (
                        <button
                          key={template.id}
                          onClick={() => setSelectedTemplate(template)}
                          className="flex items-center rounded px-8 py-1.5 text-left transition-colors"
                          style={{
                            background: isSelected ? '#3D6E63' : 'transparent',
                            color: isSelected ? '#FFFFFF' : '#2E2E2E',
                          }}
                        >
                          <span
                            className="text-base"
                            style={{
                              fontWeight: isSelected ? 500 : 400,
                              letterSpacing: '-0.05px',
                              lineHeight: '24px',
                            }}
                          >
                            {template.title}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Main Panel */}
          <div className="flex flex-1 flex-col overflow-y-auto">
            {selectedTemplate ? (
              <>
                {/* Template Header - simplified for unavailable templates */}
                <div className="flex items-start gap-2.5 p-4">
                  <div className="flex flex-1 flex-col gap-1.5">
                    <h3
                      className="text-[28px] font-semibold"
                      style={{
                        color: '#2E2E2E',
                        letterSpacing: '-0.05px',
                        lineHeight: '36px',
                      }}
                    >
                      {selectedTemplate.title}
                    </h3>
                    {selectedTemplate.isAvailable && (
                      <div className="flex items-center gap-2">
                        <div
                          className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full"
                          style={{
                            background: 'linear-gradient(117.82deg, #9AC6B5 38.64%, #A897F2 85.27%)',
                          }}
                        >
                          <img
                            src={logoImage}
                            alt="Lighthouse"
                            className="h-3.5 w-3.5 object-contain"
                          />
                        </div>
                        <span
                          className="text-sm"
                          style={{
                            color: '#4A4F4E',
                            letterSpacing: '-0.05px',
                            lineHeight: '22px',
                          }}
                        >
                          Created by Lighthouse AI
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Favorite button - only for available templates */}
                  {selectedTemplate.isAvailable && (
                    <button
                      onClick={() => toggleFavorite(selectedTemplate.id)}
                      className="flex h-12 w-12 items-center justify-center rounded-full bg-white"
                      style={{
                        boxShadow: '0px 10px 50px rgba(139, 139, 139, 0.1)',
                      }}
                    >
                      <Heart
                        className="h-7 w-7"
                        fill={favoriteIds.has(selectedTemplate.id) ? '#EB3741' : 'none'}
                        style={{
                          color: favoriteIds.has(selectedTemplate.id) ? '#EB3741' : '#4A4F4E',
                        }}
                      />
                    </button>
                  )}
                </div>

                {/* Template Body */}
                <div className="flex flex-1 flex-col items-center gap-6 px-4 pb-4">
                  {/* Description */}
                  <p
                    className="w-full text-base"
                    style={{
                      color: '#2E2E2E',
                      letterSpacing: '-0.05px',
                      lineHeight: '24px',
                    }}
                  >
                    {selectedTemplate.description}
                  </p>

                  {selectedTemplate.isAvailable ? (
                    <>
                      {/* Requirements */}
                      <div className="flex w-full flex-col gap-1.5">
                        <h4
                          className="text-base font-semibold"
                          style={{
                            color: '#2E2E2E',
                            letterSpacing: '-0.05px',
                            lineHeight: '24px',
                          }}
                        >
                          Requirements to get started:
                        </h4>
                        <ul className="list-inside list-disc">
                          {selectedTemplate.requirements.map((req, idx) => (
                            <li
                              key={idx}
                              className="text-base"
                              style={{
                                color: '#2E2E2E',
                                letterSpacing: '-0.05px',
                                lineHeight: '24px',
                              }}
                            >
                              {req}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <h4
                        className="w-full text-base font-semibold"
                        style={{
                          color: '#2E2E2E',
                          letterSpacing: '-0.05px',
                          lineHeight: '24px',
                        }}
                      >
                        Sample output:
                      </h4>

                      {/* Sample Area */}
                      <div
                        className="flex w-full flex-1 items-center justify-center rounded"
                        style={{ background: '#F6F7F9' }}
                      >
                        {/* Sample output preview card */}
                        <div
                          className="my-9 flex w-[595px] flex-col gap-7 rounded-lg bg-white px-[60px] py-12"
                        >
                          {/* Sample header */}
                          <div className="flex flex-col gap-2.5">
                            <div className="flex flex-col gap-2">
                              <span
                                className="text-base font-semibold"
                                style={{ color: '#212121', letterSpacing: '-0.05px' }}
                              >
                                Week of January 11 - 17
                              </span>
                              <h4
                                className="text-[28px] font-semibold"
                                style={{ color: '#000000', letterSpacing: '-0.05px', lineHeight: '36px' }}
                              >
                                Weekly progress update
                              </h4>
                            </div>
                            <div
                              className="flex w-fit items-center gap-2 rounded bg-[#FAFAFA] px-3 py-2"
                            >
                              <div className="h-4 w-4 rounded-full bg-gray-300" />
                              <span className="text-sm" style={{ color: '#000000' }}>
                                Anna Amani
                              </span>
                            </div>
                          </div>

                          {/* Sample content sections */}
                          <div className="flex flex-col gap-3">
                            <h5 className="text-base font-semibold" style={{ color: '#212121' }}>
                              Summary
                            </h5>
                            <p className="text-sm" style={{ color: '#212121', lineHeight: '22px' }}>
                              Focused on improving the checkout experience for small merchants by
                              reducing friction in the authentication and confirmation steps.
                            </p>
                          </div>

                          <div className="flex flex-col gap-3">
                            <h5 className="text-base font-semibold" style={{ color: '#212121' }}>
                              What I worked on
                            </h5>
                            <ul className="list-inside list-disc text-sm" style={{ color: '#212121', lineHeight: '22px' }}>
                              <li>Analyzed drop-off data across key checkout flows (web + mobile).</li>
                              <li>Partnered with design on early concepts for simplified confirmation step.</li>
                              <li>Reviewed merchant feedback from recent support tickets and surveys.</li>
                            </ul>
                          </div>

                          <div className="flex flex-col gap-3">
                            <h5 className="text-base font-semibold" style={{ color: '#212121' }}>
                              Progress & outcomes
                            </h5>
                            <ul className="list-inside list-disc text-sm" style={{ color: '#212121', lineHeight: '22px' }}>
                              <li>Documented key assumptions and trade-offs for leadership review.</li>
                              <li>Confirmed with Risk that we can experiment with lighter confirmation language for low-risk transactions.</li>
                            </ul>
                          </div>

                          <div className="flex flex-col gap-3">
                            <h5 className="text-base font-semibold" style={{ color: '#212121' }}>
                              Blockers & open questions
                            </h5>
                            <ul className="list-inside list-disc text-sm" style={{ color: '#212121', lineHeight: '22px' }}>
                              <li>Need clarity on which metrics (conversions vs fraud rate) will be primary success criteria for the experiment.</li>
                              <li>Awaiting final input from Compliance on copy variations for international markets.</li>
                            </ul>
                          </div>

                          <div className="flex flex-col gap-3">
                            <h5 className="text-base font-semibold" style={{ color: '#212121' }}>
                              Next week's focus
                            </h5>
                            <ul className="list-inside list-disc text-sm" style={{ color: '#212121', lineHeight: '22px' }}>
                              <li>Finalize experiment scope and success metrics.</li>
                              <li>Prepare PRD for the checkout confirmation A/B test.</li>
                              <li>Review design concepts with merchant advisory group.</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    /* Unavailable template view */
                    <div className="flex w-full max-w-[700px] flex-col items-center gap-6 pt-[72px]">
                      {/* Not available yet banner */}
                      <div
                        className="flex w-full items-start gap-6 rounded-[10px] p-4"
                        style={{
                          background: '#F6F7F9',
                          border: '1px solid #F1F2F9',
                          boxShadow: '0px 3px 12px -2px rgba(170, 170, 190, 0.06)',
                        }}
                      >
                        {/* Left side with icon and text */}
                        <div className="flex flex-1 items-start gap-4">
                          {/* Icon */}
                          <div
                            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[9.67px]"
                            style={{
                              background: '#D4E7FF',
                              boxShadow: 'inset 0px -1px 1px rgba(50, 50, 204, 0.13), inset 0px 1.19px 1.19px rgba(255, 255, 255, 0.35), inset 0px -4.17px 4.76px rgba(171, 182, 233, 0.3)',
                            }}
                          >
                            <AlertOctagon className="h-6 w-6" style={{ color: '#033C84' }} />
                          </div>

                          {/* Text */}
                          <p
                            className="flex-1 text-sm"
                            style={{
                              color: '#4A4F4E',
                              letterSpacing: '-0.05px',
                              lineHeight: '22px',
                            }}
                          >
                            <span className="font-bold">Not available yet</span>
                            {' — we\'re still exploring this type of output. If you\'d find it useful, vote for and/or send feedback or requests to help guide what we build next.'}
                          </p>
                        </div>

                        {/* Vote button */}
                        <button
                          onClick={() => handleVote(selectedTemplate.id)}
                          className="flex items-center gap-2.5 rounded-lg border-2 bg-white px-4 py-2"
                          style={{
                            borderColor: votedIds.has(selectedTemplate.id) ? '#3D6E63' : '#2E2E2E',
                          }}
                        >
                          <ThumbsUp
                            className="h-5 w-5"
                            style={{
                              color: votedIds.has(selectedTemplate.id) ? '#3D6E63' : '#292D32',
                            }}
                            fill={votedIds.has(selectedTemplate.id) ? '#3D6E63' : 'none'}
                          />
                          <span
                            className="text-sm font-semibold"
                            style={{ color: '#000000' }}
                          >
                            {votedIds.has(selectedTemplate.id) ? 'Voted' : 'Vote'}
                          </span>
                          <span
                            className="text-sm font-medium"
                            style={{ color: '#292D32' }}
                          >
                            {getVoteCount(selectedTemplate)}
                          </span>
                        </button>
                      </div>

                      {/* Feedback section */}
                      {feedbackSubmittedIds.has(selectedTemplate.id) ? (
                        /* Feedback success state */
                        <div className="flex w-full flex-col items-center gap-4 pt-8">
                          <img
                            src={heartPreviewImage}
                            alt="Feedback received"
                            className="h-[225px] w-[300px] object-contain"
                          />
                          <h4
                            className="text-xl font-semibold"
                            style={{
                              color: '#1E1E1E',
                              letterSpacing: '-0.05px',
                              lineHeight: '30px',
                            }}
                          >
                            Feedback received
                          </h4>
                          <p
                            className="text-base"
                            style={{
                              color: '#2E2E2E',
                              letterSpacing: '-0.05px',
                              lineHeight: '24px',
                            }}
                          >
                            Thank you! Your thoughts are important to us.
                          </p>
                        </div>
                      ) : (
                        /* Feedback form */
                        <div className="flex w-full flex-col items-end gap-4">
                          <div className="flex w-full flex-col gap-3">
                            <h4
                              className="text-base font-semibold"
                              style={{
                                color: '#2E2E2E',
                                letterSpacing: '-0.05px',
                                lineHeight: '24px',
                              }}
                            >
                              Feedback or requests
                            </h4>
                            <textarea
                              value={feedbackText}
                              onChange={(e) => setFeedbackText(e.target.value)}
                              placeholder="Share your thoughts..."
                              className="h-[120px] w-full resize-none rounded-xl border bg-white p-3 text-base outline-none"
                              style={{
                                borderColor: '#EAECF0',
                                boxShadow: '3px 3px 10px rgba(120, 132, 149, 0.08)',
                                color: '#2E2E2E',
                                letterSpacing: '-0.05px',
                                lineHeight: '24px',
                              }}
                            />
                          </div>

                          {/* Submit button */}
                          <Button
                            onClick={handleSubmitFeedback}
                            variant="outline"
                            className="rounded-lg bg-white px-[18px] py-2.5"
                            style={{
                              boxShadow: '0px 2px 5px rgba(103, 110, 118, 0.08), 0px 0px 0px 1px rgba(103, 110, 118, 0.16), 0px 1px 1px rgba(0, 0, 0, 0.12)',
                            }}
                          >
                            <span className="text-sm font-semibold" style={{ color: '#000000' }}>
                              Submit feedback
                            </span>
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Action Bar - only for available templates */}
                {selectedTemplate.isAvailable && (
                  <div
                    className="flex items-center justify-end gap-4 border-t px-4 py-4"
                    style={{ borderColor: '#D6D6D4' }}
                  >
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (selectedTemplate?.templateKey === 'progress-snapshot') {
                          setShowWeeklyProgressChat(true);
                        }
                        if (selectedTemplate?.templateKey === 'workflow-analysis') {
                          setShowWorkflowAnalysisChat(true);
                        }
                      }}
                      className="flex items-center gap-2 rounded-lg bg-white px-5 py-3"
                      style={{
                        boxShadow: '0px 2px 5px rgba(103, 110, 118, 0.08), 0px 0px 0px 1px rgba(103, 110, 118, 0.16), 0px 1px 1px rgba(0, 0, 0, 0.12)',
                      }}
                    >
                      <Sparkles className="h-[18px] w-[18px]" />
                      <span className="text-sm font-semibold" style={{ color: '#000000' }}>
                        Remix with AI
                      </span>
                    </Button>
                    <Button
                      onClick={handleGetStarted}
                      className="flex items-center gap-2 rounded-lg px-5 py-3"
                      style={{
                        background: '#2E2E2E',
                        boxShadow: '0px 2px 5px rgba(103, 110, 118, 0.08), 0px 0px 0px 1px rgba(103, 110, 118, 0.16), 0px 1px 1px rgba(0, 0, 0, 0.12)',
                      }}
                    >
                      <span className="text-sm font-semibold text-white">
                        Get started
                      </span>
                      <ArrowRight className="h-[18px] w-[18px] text-white" />
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <p className="text-gray-500">Select a template to view details</p>
              </div>
            )}
          </div>
          </>
          )}
        </div>
      </div>

      {/* Weekly Progress Chat Modal */}
      <WeeklyProgressChatModal
        isOpen={showWeeklyProgressChat}
        onClose={() => setShowWeeklyProgressChat(false)}
        nodeId={nodeId}
      />

      {/* Workflow Analysis Chat Modal */}
      <WorkflowAnalysisChatModal
        isOpen={showWorkflowAnalysisChat}
        onClose={() => setShowWorkflowAnalysisChat(false)}
        nodeId={nodeId}
      />
    </div>
  );
}
