import React, { useEffect } from "react";
import { motion } from 'framer-motion';
import { JourneyTimeline } from "@/components/JourneyTimeline";
import { useDataStore } from '@/stores/data-store';
import { NaaviChat } from "@/components/NaaviChat";
import {
  LoadingState,
  NoDataState
} from "@/components/journey";

export default function ProfessionalJourney() {
  // Access store data and actions
  const { profileData, isLoading, loadProfileData } = useDataStore();

  // Load profile data on component mount
  useEffect(() => {
    loadProfileData();
  }, [loadProfileData]);

  // Render different content based on state, but keep consistent layout
  const renderContent = () => {
    if (isLoading) {
      return <LoadingState />;
    }

    if (!profileData || !profileData.filteredData) {
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
          <JourneyTimeline />
        </motion.div>

        {/* Unified Chat Interface - Bottom Right */}
        <NaaviChat />
      </>
    );
  };

  return (
    <div className="w-full h-screen relative overflow-hidden bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {renderContent()}
      {/* Timeline Scrubber - Could be implemented with behavior stores if needed */}
    </div>
  );
}
