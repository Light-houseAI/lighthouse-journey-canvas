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
import { NodeDetailsPanel } from '@/components/panels/NodeDetailsPanel';
import { Timeline } from '@/components/timeline/Timeline';
import { transformProfileToTimelineNodes, createMainTimelineConfig } from '@/components/timeline/timelineTransformers';
import { nodeApi, type NodeData } from '@/services/node-api';
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
    isNodeExpanded,
    nodeExpansionState
  } = useJourneyStore();
  const { setReactFlowInstance, autoFitTimeline } = useUICoordinatorStore();
  const { chatEnabled, setChatEnabled } = useChatToggleStore();
  // Removed - using only journey store for focus state

  // Enhanced timeline state
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [chatInitialMessage, setChatInitialMessage] = useState('');
  const [nodeContext, setNodeContext] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Details panel state
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [selectedNodeData, setSelectedNodeData] = useState<any>(null);

  // Handle focus mode exit
  const handleExitFocus = () => {
    console.log('🚪 Exiting focus mode - before clear:', { focusedExperienceId, selectedNodeId });
    
    // Clear the focused experience state
    setFocusedExperience(null); // Journey store only
    
    // Force a re-render check
    setTimeout(() => {
      console.log('🚪 After focus clear - state check:', { 
        focusedExperienceId, 
        selectedNodeId,
        timelineNodesCount: timelineNodes.length 
      });
    }, 50);
    
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
      availableTypes: ['job', 'education', 'project', 'event', 'action', 'careerTransition'],
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

  // Generate contextual chat messages
  const generateContextMessage = (context: any) => {
    switch (context.insertionPoint) {
      case 'between':
        return `Add a new milestone between ${context.parentNode?.title || 'previous'} and ${context.targetNode?.title || 'next'}`;
      case 'after':
        return `Add a new milestone after ${context.targetNode?.title || 'current timeline'}`;
      case 'branch':
        return `Add a project to my ${context.parentNode?.title || 'experience'}`;
      default:
        return 'Add a new milestone to your career timeline';
    }
  };

  // Handle modal form submission
  const handleModalSubmit = async (data: any) => {
    if (isSubmitting) return; // Prevent double submission

    setIsSubmitting(true);
    try {
      console.log('Saving node:', data);

      // Get the current user for profile ID
      console.log('Auth state debug:', {
        user,
        isAuthenticated,
        hasUser: !!user
      });

      if (!user) {
        throw new Error('User not authenticated. Please log in again.');
      }

      // Map the form data to the correct node structure based on type
      let nodeData: NodeData;

      switch (data.type) {
        case 'workExperience': // Map old type name to new
        case 'job':
          nodeData = {
            type: 'job',
            title: data.title,
            company: data.company,
            position: data.position || data.title,
            description: data.description,
            startDate: data.startDate || data.start,
            endDate: data.endDate || data.end,
            location: data.location,
            isOngoing: data.isOngoing,
          };
          break;

        case 'education':
          nodeData = {
            type: 'education',
            title: data.title || `${data.degree} in ${data.field}`,
            institution: data.institution || data.school,
            degree: data.degree,
            field: data.field,
            description: data.description,
            startDate: data.startDate || data.start,
            endDate: data.endDate || data.end,
            isOngoing: data.isOngoing,
          };
          break;

        case 'project':
          nodeData = {
            type: 'project',
            title: data.title,
            description: data.description,
            technologies: data.technologies,
            startDate: data.startDate || data.start,
            endDate: data.endDate || data.end,
            parentExperienceId: data.parentExperienceId,
          };
          break;

        case 'event':
          nodeData = {
            type: 'event',
            title: data.title,
            description: data.description,
            eventType: data.eventType,
            location: data.location,
            organizer: data.organizer,
            startDate: data.startDate || data.start,
            endDate: data.endDate || data.end,
          };
          break;

        case 'action':
          nodeData = {
            type: 'action',
            title: data.title,
            description: data.description,
            category: data.category,
            impact: data.impact,
            verification: data.verification,
            startDate: data.startDate || data.start,
            endDate: data.endDate || data.end,
          };
          break;

        case 'jobTransition': // Map old type name
        case 'careerTransition':
          nodeData = {
            type: 'careerTransition',
            title: data.title,
            description: data.description,
            transitionType: data.transitionType,
            fromRole: data.fromRole,
            toRole: data.toRole,
            reason: data.reason,
            outcome: data.outcome,
            startDate: data.startDate || data.start,
            endDate: data.endDate || data.end,
            isOngoing: data.isOngoing,
          };
          break;

        default:
          throw new Error(`Unknown node type: ${data.type}`);
      }

      // Call the new CRUD API
      const result = await nodeApi.createNode(user.id, nodeData);
      console.log('Node saved successfully:', result);

      // Close the modal first
      setIsModalOpen(false);
      setNodeContext(null);

      // Refresh profile data using the store's method
      await refreshProfileData();

    } catch (error) {
      console.error('Failed to save node:', error);
      throw error; // Let the modal handle the error
    } finally {
      setIsSubmitting(false);
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

  // Transform profile data to timeline nodes
  const timelineNodes = useMemo(() => {
    console.log('JourneyTimeline: Transforming profileData:', profileData);
    const nodes = transformProfileToTimelineNodes(profileData);
    console.log('JourneyTimeline: Generated timelineNodes:', nodes);
    return nodes;
  }, [profileData]);

  // Create timeline configuration
  const timelineConfig = useMemo(() => {
    return createMainTimelineConfig(handlePlusButtonClick);
  }, []);

  // Get expanded nodes set
  const expandedNodes = useMemo(() => {
    const expanded = new Set<string>();
    Object.entries(nodeExpansionState).forEach(([nodeId, isExpanded]) => {
      if (isExpanded) {
        expanded.add(nodeId);
      }
    });
    return expanded;
  }, [nodeExpansionState]);

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

      {/* React Flow Timeline - with space for header */}
      <div className="pt-24 h-full">
        <Timeline
          nodes={timelineNodes}
          config={timelineConfig}
          expandedNodes={expandedNodes}
          focusedNodeId={focusedExperienceId}
          selectedNodeId={selectedNodeId}
          highlightedNodeId={highlightedNodeId}
          onInit={setReactFlowInstance}
          onPaneClick={onPaneClick}
          className={className}
          style={style}
          fitView
          fitViewOptions={{
            padding: 0.3,
            includeHiddenNodes: false,
            minZoom: 0.4,
            maxZoom: 1.2,
          }}
          minZoom={0.2}
          maxZoom={1.8}
          panOnScroll={true}
          zoomOnScroll={false}
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
            if (!isSubmitting) { // Prevent closing while submitting
              setIsModalOpen(false);
              setNodeContext(null);
            }
          }}
          onSubmit={handleModalSubmit}
          context={nodeContext}
          isSubmitting={isSubmitting}
        />
      )}

      {/* NodeDetailsPanel for side panel behavior */}
      {isPanelOpen && selectedNodeData && (
        <NodeDetailsPanel
          data={selectedNodeData}
          isOpen={isPanelOpen}
          onClose={() => {
            setIsPanelOpen(false);
            setSelectedNodeData(null);
          }}
        />
      )}
    </div>
  );
};
