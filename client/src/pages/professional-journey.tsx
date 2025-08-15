import React from "react";
import { motion } from 'framer-motion';
import { HierarchicalTimeline } from "@/components/timeline/HierarchicalTimeline";
import { JourneyHeader } from "@/components/journey/JourneyHeader";
import { useHierarchyStore } from '@/stores/hierarchy-store';
import { NaaviChat } from "@/components/NaaviChat";
import {
  LoadingState,
  NoDataState
} from "@/components/journey";

export default function ProfessionalJourney() {
  // Just use hierarchy store - auth is handled automatically via subscriptions
  const { nodes, loading, error } = useHierarchyStore();

  // Render different content based on state, but keep consistent layout
  const renderContent = () => {
    if (loading) {
      return <LoadingState />;
    }

    if (error) {
      return <NoDataState />;
    }

    if (nodes.length === 0) {
      return <NoDataState />;
    }

    return (
      <>
        {/* Career Journey Visualization */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="w-full h-full"
        >
          <HierarchicalTimeline />
        </motion.div>

        {/* Unified Chat Interface - Bottom Right */}
        <NaaviChat />
      </>
    );
  };

  return (
    <div className="w-full h-screen relative overflow-hidden bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header with logout */}
      <JourneyHeader />
      
      {renderContent()}
      {/* Timeline Scrubber - Could be implemented with behavior stores if needed */}
    </div>
  );
}
