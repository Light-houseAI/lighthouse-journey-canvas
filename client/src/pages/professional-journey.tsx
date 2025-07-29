import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, LogOut, X } from "lucide-react";
import { FaMicrophone, FaTimes, FaRobot } from 'react-icons/fa';
import { useAuth } from "@/hooks/useAuth";
import { nodeTypes } from '@/components/nodes';
import { edgeTypes } from '@/components/edges';
import { useProfessionalJourneyStore } from '@/stores/journey-store';
import { useShallow } from 'zustand/react/shallow';
import OverlayChat from "@/components/OverlayChat";



export default function ProfessionalJourney() {
  const [, setLocation] = useLocation();
  const [showChatPrompt, setShowChatPrompt] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedMilestone, setSelectedMilestone] = useState<any>(null);
  const [isVoicePanelOpen, setIsVoicePanelOpen] = useState(false);
  const [isChatMinimized, setIsChatMinimized] = useState(false);
  const [hasStartedOnboarding, setHasStartedOnboarding] = useState(false);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);

  // Use Zustand store with shallow comparison for performance
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    focusedExperienceId,
    isLoading,
    loadProfileData,
    setFocusedExperience,
    setReactFlowInstance,
  } = useProfessionalJourneyStore(
    useShallow((state) => ({
      nodes: state.nodes,
      edges: state.edges,
      onNodesChange: state.onNodesChange,
      onEdgesChange: state.onEdgesChange,
      onConnect: state.onConnect,
      focusedExperienceId: state.focusedExperienceId,
      isLoading: state.isLoading,
      loadProfileData: state.loadProfileData,
      setFocusedExperience: state.setFocusedExperience,
      setReactFlowInstance: state.setReactFlowInstance,
    }))
  );
  // Load profile data on component mount
  useEffect(() => {
    if (user) {
      loadProfileData();
    }
  }, [user, loadProfileData]);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["/api/profile"],
    enabled: !!user,
  });

  // Effect to show chat prompt for new and returning users
  useEffect(() => {
    if (user && profile && !showChatPrompt) {
      const hasCompletedOnboarding = user.hasCompletedOnboarding;
      const timer = setTimeout(() => {
        setShowChatPrompt(true);
        if (!hasCompletedOnboarding) {
          setIsVoicePanelOpen(true); // Auto-open for new users
        }
      }, hasCompletedOnboarding ? 1500 : 500);

      return () => clearTimeout(timer);
    }
  }, [user, profile, showChatPrompt]);


  // Node clicks are now handled by the store

  // Node deletion is now handled by the store

  // Auto-start onboarding chat when profile loads (only if not completed)
  useEffect(() => {
    if (profile && !profileLoading && !hasStartedOnboarding) {
      const hasCompletedOnboarding = (profile as any).user?.hasCompletedOnboarding;

      if (!hasCompletedOnboarding) {
        setHasStartedOnboarding(true);
        setTimeout(() => {
          setIsVoicePanelOpen(true);
        }, 1000);
      }
    }
  }, [profile, profileLoading, hasStartedOnboarding]);

  // Profile data is now handled by the store's loadProfileData action

  // Saved projects are now handled by the store

  // Node click handlers and highlighting are now managed by the store



  if (isLoading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600">Loading your professional journey...</p>
        </div>
      </div>
    );
  }

  if (!profile || nodes.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="max-w-md mx-auto text-center space-y-4">
          <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto">
            <ArrowRight className="h-8 w-8 text-purple-400" />
          </div>
          <h2 className="text-xl font-semibold text-white">No Journey Data</h2>
          <p className="text-purple-200">No professional experience or education data found.</p>
          <Button onClick={() => setLocation("/")} className="bg-purple-600 hover:bg-purple-700">
            Go to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen relative overflow-hidden bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute top-0 left-0 right-0 z-10 p-6"
      >
        <div className="glass rounded-2xl px-6 py-4 bg-slate-900/80 backdrop-blur-sm border border-purple-500/20">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                Your Professional Journey
              </h1>
              <p className="text-purple-200">
                Interactive career path visualization powered by AI
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={async () => {
                  try {
                    await fetch('/api/logout', { method: 'POST' });
                    setLocation('/signin');
                  } catch (error) {
                    console.error('Logout failed:', error);
                  }
                }}
                variant="outline"
                size="sm"
                className="bg-slate-800/50 border-purple-500/30 text-purple-200 hover:bg-purple-500/20 hover:text-white"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Focus Mode Exit Button */}
      {focusedExperienceId && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className="absolute top-24 right-6 z-20"
        >
          <Button
            onClick={() => {
              setFocusedExperience(null);
              // Reset zoom to show full timeline
              setTimeout(() => {
                reactFlowInstance.current?.fitView({
                  duration: 800,
                  padding: 0.2,
                });
              }, 100);
            }}
            variant="outline"
            size="sm"
            className="bg-amber-500/20 border-amber-400/50 text-amber-200 hover:bg-amber-500/40 hover:text-white backdrop-blur-sm"
          >
            <X className="w-4 h-4 mr-2" />
            Exit Focus Mode
          </Button>
        </motion.div>
      )}

      {/* Career Journey Visualization */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className={`w-full h-full pt-24 transition-all duration-300 ${
          isVoicePanelOpen && !isChatMinimized ? 'pr-96' : ''
        }`}
      >
        {/* Timeline background indicators removed - now handled by store */}
        <ReactFlow
          onInit={(instance) => { 
            reactFlowInstance.current = instance as any; 
            setReactFlowInstance(instance);
          }}
          nodes={nodes as any}
          edges={edges as any}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          nodesDraggable={false}
          onPaneClick={() => {
            if (isVoicePanelOpen && !isChatMinimized) {
              setIsChatMinimized(true);
            }
          }}
          fitView
          fitViewOptions={{
            padding: 0.3, // Increased padding for better spacing visualization
            includeHiddenNodes: false,
            minZoom: 0.4,
            maxZoom: 1.2, // Reduced max zoom to prevent too close inspection causing overlap appearance
          }}
          minZoom={0.2} // Allow more zoom out to see full timeline
          maxZoom={1.8}
          className="career-journey-flow"
          style={{
            background: 'transparent',
          }}
          panOnScroll={true}
          zoomOnScroll={false}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="rgba(168, 85, 247, 0.2)"
          />
        </ReactFlow>
      </motion.div>

      {/* Overlay Chat */}
      <OverlayChat
        isOpen={isVoicePanelOpen}
        isMinimized={isChatMinimized}
        onClose={() => setIsVoicePanelOpen(false)}
        onMinimize={() => setIsChatMinimized(!isChatMinimized)}
        onOpen={() => {
          setIsChatMinimized(false);
          setIsVoicePanelOpen(true);
        }}
        onMilestoneAdded={() => {
          // Legacy milestone handling removed - handled by store
          loadProfileData();
        }}
        onMilestoneUpdated={() => {
          // Legacy milestone handling removed - handled by store
          loadProfileData();
        }}
        onAddMilestone={() => {
          // Legacy milestone handling removed - handled by store
          loadProfileData();
        }}
        onProfileUpdated={() => {
          // Refresh profile and project data when profile is updated
          queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
          queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
        }}
        userId={user?.id?.toString() || ''}
      />

      {/* Timeline Scrubber */}
      {/* <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-40 w-96 max-w-[90vw]">
        <TimelineScrubber
          nodes={nodes}
          onTimelineNavigate={(nodeId) => {
            // Navigation logic would need to be implemented
            console.log('Navigate to:', nodeId);
          }}
          className="transition-all duration-300"
        />
      </div> */}

      {/* Enhanced Floating Action Button with Chat Prompt */}
      <AnimatePresence>
        {!isVoicePanelOpen && (
          <div className="fixed bottom-4 left-4 z-50">
            {/* Chat Prompt Bubble */}
            {showChatPrompt && (
              <motion.div
                initial={{ opacity: 0, x: -20, scale: 0.8 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -20, scale: 0.8 }}
                className="absolute bottom-16 left-0 w-64 bg-slate-800/95 backdrop-blur-sm border border-purple-500/30 rounded-2xl p-4 shadow-2xl"
                style={{
                  boxShadow: "0 20px 40px rgba(0, 0, 0, 0.3), 0 0 20px rgba(168, 85, 247, 0.2)",
                }}
              >
                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 bg-purple-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <FaRobot className="w-3 h-3 text-purple-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-purple-100 text-sm leading-relaxed">
                      {user && !user.hasCompletedOnboarding
                        ? `Ready to start your journey! Click the microphone to begin onboarding.`
                        : `Welcome back${(profile as any)?.filteredData?.name ? `, ${(profile as any).filteredData.name}` : ''}! Good to see you again. Do you have time to talk about your current projects?`
                      }
                    </p>
                    <button
                      onClick={() => setShowChatPrompt(false)}
                      className="absolute top-2 right-2 w-4 h-4 text-purple-400 hover:text-white opacity-60 hover:opacity-100 transition-opacity"
                    >
                      <FaTimes className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                {/* Chat bubble arrow */}
                <div className="absolute bottom-[-8px] left-8 w-4 h-4 bg-slate-800/95 border-r border-b border-purple-500/30 transform rotate-45"></div>
              </motion.div>
            )}

            {/* Enhanced Glowing Chat Icon */}
            <motion.button
              initial={{ scale: 0, opacity: 0 }}
              animate={{
                scale: 1,
                opacity: 1,
                boxShadow: showChatPrompt
                  ? ["0 0 20px rgba(168, 85, 247, 0.4)", "0 0 40px rgba(168, 85, 247, 0.8)", "0 0 20px rgba(168, 85, 247, 0.4)"]
                  : "0 8px 32px rgba(168, 85, 247, 0.4)"
              }}
              exit={{ scale: 0, opacity: 0 }}
              whileHover={{ scale: 1.1, boxShadow: "0 0 50px rgba(168, 85, 247, 0.8)" }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setShowChatPrompt(false);
                setIsVoicePanelOpen(true);
              }}
              transition={{
                boxShadow: {
                  duration: 2,
                  repeat: showChatPrompt ? Infinity : 0,
                  repeatType: "reverse"
                }
              }}
              className={`
                w-14 h-14 rounded-full
                bg-gradient-to-r from-purple-600 to-pink-600
                shadow-xl hover:shadow-2xl
                flex items-center justify-center
                transition-all duration-300 ease-in-out
                ${showChatPrompt ? 'animate-pulse' : ''}
              `}
            >
              <FaMicrophone className="w-5 h-5 text-white" />

              {/* Notification Dot for New Users */}
              {showChatPrompt && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-slate-900"
                >
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className="w-full h-full bg-red-400 rounded-full"
                  />
                </motion.div>
              )}
            </motion.button>
          </div>
        )}
      </AnimatePresence>

      {/* Developer controls removed - animation now handled by store */}

      {/* Selected milestone details */}
      {selectedMilestone && (
        <motion.div
          initial={{ opacity: 0, x: 300 }}
          animate={{ opacity: 1, x: 0 }}
          className="absolute top-24 right-6 w-80 bg-slate-900/90 backdrop-blur-sm rounded-2xl border border-purple-500/20 p-6"
        >
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-bold text-white">{selectedMilestone.title}</h3>
              <p className="text-purple-200 text-sm">{selectedMilestone.organization}</p>
              <p className="text-purple-300 text-xs">{selectedMilestone.date}</p>
            </div>
            <div>
              <p className="text-purple-100 text-sm leading-relaxed">
                {selectedMilestone.description}
              </p>
            </div>
            {selectedMilestone.skills && selectedMilestone.skills.length > 0 && (
              <div>
                <p className="text-purple-200 text-xs mb-2">Skills:</p>
                <div className="flex flex-wrap gap-1">
                  {selectedMilestone.skills.map((skill: string, index: number) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-purple-500/20 text-purple-200 text-xs rounded-full"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <Button
              onClick={() => setSelectedMilestone(null)}
              variant="outline"
              size="sm"
              className="w-full border-purple-500/30 text-purple-200 hover:bg-purple-500/20"
            >
              Close
            </Button>
          </div>
        </motion.div>
      )}

    </div>
  );
}
