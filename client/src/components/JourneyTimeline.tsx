import React, { useMemo, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useJourneyStore } from '@/stores/journey-store';
import { useUICoordinatorStore } from '@/stores/ui-coordinator-store';
import { useChatToggleStore } from '@/stores/chat-toggle-store';
import { JourneyHeader } from '@/components/journey/JourneyHeader';
import { ChatToggle } from '@/components/ui/chat-toggle';
import { NaaviChat } from '@/components/NaaviChat';
import { MultiStepAddNodeModal } from '@/components/modals/MultiStepAddNodeModal';
import { HierarchicalTimeline } from '@/components/timeline/HierarchicalTimeline';
import {
  nodeApi,
  type NodeData,
  type JobCreateData,
  type EducationCreateData,
  type ProjectCreateData,
  type EventCreateData,
  type ActionCreateData,
  type CareerTransitionCreateData
} from '@/services/node-api';
import { useAuthStore } from '@/stores/auth-store';



interface JourneyTimelineProps {
  className?: string;
  style?: React.CSSProperties;
  onPaneClick?: () => void;
}

/**
 * JourneyTimeline Component
 *
 * A data-driven component that automatically:
 * 1. Consumes profile data from context (via stores)
 * 2. Transforms data into React Flow nodes and edges
 * 3. Handles all behavior states (focus, selection, highlight)
 * 4. Pre-generates all nodes for optimal performance
 *
 * No complex hooks needed - just a component that does one thing well.
 */
export const JourneyTimeline: React.FC<JourneyTimelineProps> = ({
  className = "career-journey-flow",
  style = { background: 'transparent' },
  onPaneClick
}) => {
  // Get authentication state
  const { user, isAuthenticated } = useAuthStore();

  // Get data from unified journey store
  const {
    profileData,
    refreshProfileData,
    focusedExperienceId,
    setFocusedExperience,
    selectedNodeId,
    highlightedNodeId,
    expandedNodeId
  } = useJourneyStore();
  const { setReactFlowInstance, autoFitTimeline } = useUICoordinatorStore();
  const { chatEnabled, setChatEnabled } = useChatToggleStore();
  // Removed - using only journey store for focus state

  // Get available node types based on plus button type
  const getAvailableTypes = (insertionPoint: string) => {
    switch (insertionPoint) {
      case 'child':
        // Child nodes under a parent - only allow child-appropriate types
        return ['project', 'event', 'action'];

      case 'timeline-start':
      case 'timeline-end':
      case 'timeline-between':
      case 'before':
      case 'after':
      case 'between':
      default:
        // Timeline siblings - allow all primary experience types
        return ['job', 'education', 'project', 'event', 'action', 'careerTransition'];
    }
  };

  // Enhanced timeline state
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [chatInitialMessage, setChatInitialMessage] = useState('');
  const [nodeContext, setNodeContext] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Details panel is now handled by HierarchicalTimeline -> HierarchyNodePanel

  // Handle focus mode exit
  const handleExitFocus = () => {
    console.log('🚪 Exiting focus mode - before clear:', { focusedExperienceId, selectedNodeId });

    // Clear the focused experience state
    setFocusedExperience(null); // Journey store only

    // Reset zoom to show full timeline after clearing focus
    setTimeout(() => {
      autoFitTimeline();
    }, 100);
  };

  // Handle plus button click on edges
  const handlePlusButtonClick = (edgeData: any) => {
    // Create context based on edge data
    const context = {
      insertionPoint: edgeData.insertionPoint || 'between',
      parentNode: edgeData.parentNode,
      targetNode: edgeData.targetNode,
      availableTypes: getAvailableTypes(edgeData.insertionPoint),
    };

    setNodeContext(context);

    if (chatEnabled) {
      // Open chat with contextual message
      const message = generateContextMessage(context);
      setChatInitialMessage(message);
      setIsChatOpen(true);
    } else {
      // Open manual modal
      setIsModalOpen(true);
    }
  };

  // Generate contextual chat messages for different plus button types
  const generateContextMessage = (context: any) => {
    switch (context.insertionPoint) {
      case 'timeline-start':
      case 'before':
        return `Add a new experience before ${context.targetNode?.title || 'the timeline'}`;

      case 'timeline-end':
      case 'after':
        return `Add a new experience after ${context.parentNode?.title || 'the timeline'}`;

      case 'timeline-between':
      case 'between':
        return `Add a new experience between ${context.parentNode?.title || 'previous'} and ${context.targetNode?.title || 'next'}`;

      case 'child':
        return `Add a child item (project, event, or action) under ${context.parentNode?.title || 'this experience'}`;

      default:
        return 'Add a new milestone to your career timeline';
    }
  };



  // Auto-fit timeline when data loads (component handles its own behavior)
  useEffect(() => {
    if (profileData) {
      // Small delay to ensure nodes are rendered
      setTimeout(() => {
        autoFitTimeline();
      }, 100);
    }
  }, [profileData, autoFitTimeline]);

  // The HierarchicalTimeline loads data directly from the hierarchy API
  // No need to transform profileData anymore

  return (
    <div className="relative w-full h-full">
      {/* Journey Header - Always visible */}
      <JourneyHeader />

      {/* Chat Toggle - Hidden for now but keeps functionality intact */}
      <div className="absolute top-4 right-4 z-30" data-testid="chat-toggle" style={{ display: 'none' }}>
        <ChatToggle
          enabled={chatEnabled}
          onToggle={setChatEnabled}
          className="bg-white/10 backdrop-blur-sm rounded-lg px-3 py-2 border border-white/20"
        />
      </div>

      {/* Focus Mode Exit Button */}
      <AnimatePresence>
        {focusedExperienceId && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute top-24 right-6 z-20"
          >
            <Button
              onClick={handleExitFocus}
              variant="outline"
              size="sm"
              className="bg-amber-500/20 border-amber-400/50 text-amber-200 hover:bg-amber-500/40 hover:text-white backdrop-blur-sm"
            >
              <X className="w-4 h-4 mr-2" />
              Exit Focus Mode
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hierarchical Timeline - with space for header */}
      <div className="pt-24 h-full">
        <HierarchicalTimeline
          className={className}
          style={style}
        />
      </div>

      {/* NaaviChat for AI-assisted node creation */}
      {isChatOpen && (
        <NaaviChat
          isOpen={isChatOpen}
          onClose={() => {
            setIsChatOpen(false);
            setChatInitialMessage('');
            setNodeContext(null);
          }}
          initialMessage={chatInitialMessage}
          context={nodeContext}
          onMilestoneAdded={(milestone) => {
            // Handle automatic milestone creation from AI
            console.log('AI created milestone:', milestone);
            // Force refresh of the timeline data
            refreshProfileData();
          }}
        />
      )}

      {/* MultiStepAddNodeModal for manual node creation */}
      {isModalOpen && nodeContext && (
        <MultiStepAddNodeModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setNodeContext(null);
          }}
          onSuccess={() => {
            // Modal is already closed by MultiStepAddNodeModal
            // Just reset the context state
            setNodeContext(null);
          }}
          context={nodeContext}
          isSubmitting={isSubmitting}
        />
      )}

      {/* Side panel is now handled by HierarchicalTimeline -> HierarchyNodePanel */}
    </div>
  );
};
