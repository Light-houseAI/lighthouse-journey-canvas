import React, { useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { HierarchicalTimeline } from '@/components/timeline/HierarchicalTimeline';
import { JourneyHeader } from '@/components/journey/JourneyHeader';
import { useHierarchyStore } from '@/stores/hierarchy-store';
import { NaaviChat } from '@/components/NaaviChat';
import { LoadingState, NoDataState } from '@/components/journey';

/**
 * UserTimelinePage - View another user's timeline by username
 * Uses the same HierarchicalTimeline component but with username parameter
 * Permission filtering is applied on the backend
 */
export function UserTimelinePage() {
  const { username } = useParams<{ username: string }>();
  const [, setLocation] = useLocation();

  // Use hierarchy store with username parameter
  const { nodes, loading, error, loadUserTimeline } = useHierarchyStore();

  // Load the user's timeline when component mounts or username changes
  useEffect(() => {
    if (!username) {
      // If no username, redirect to main timeline
      setLocation('/');
      return;
    }

    // Load timeline for the specified username
    loadUserTimeline(username);
  }, [username, loadUserTimeline, setLocation]);

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
          className="h-full w-full"
        >
          <HierarchicalTimeline />
        </motion.div>

        {/* Unified Chat Interface - Bottom Right (could be disabled for user timelines) */}
        <NaaviChat />
      </>
    );
  };

  return (
    <div className="relative h-screen w-full overflow-hidden bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header with user context */}
      <JourneyHeader viewingUsername={username} />

      {renderContent()}
    </div>
  );
}
