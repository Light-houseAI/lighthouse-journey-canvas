import { motion } from 'framer-motion';
import React, { useEffect } from 'react';
import { useLocation, useParams } from 'wouter';

import { LoadingState, NoDataState } from '@/components/journey';
import { JourneyHeader } from '@/components/journey/JourneyHeader';
// TODO: LIG-175 - Update to use ProfileListView instead of HierarchicalTimeline
// import { HierarchicalTimeline } from '@/components/timeline/HierarchicalTimeline';
import { ProfileListView } from '@/components/timeline/ProfileListView';
import { useTheme } from '@/contexts/ThemeContext';
import { useOtherUserTimelineStore } from '@/stores/other-user-timeline-store';

/**
 * UserTimelinePage - View another user's timeline by username
 * Uses the same HierarchicalTimeline component but with username parameter
 * Permission filtering is applied on the backend
 */
export function UserTimelinePage() {
  const { username } = useParams<{ username: string }>();
  const [, setLocation] = useLocation();
  const { theme } = useTheme();

  // Use other user timeline store for read-only access
  const { nodes, loading, error, loadUserTimeline } =
    useOtherUserTimelineStore();

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
          {/* TODO: LIG-175 - Properly integrate with ProfileListView */}
          <ProfileListView username={username} />
        </motion.div>

        {/* Chat disabled for viewing other users' timelines */}
      </>
    );
  };

  return (
    <div
      className={`relative h-screen w-full overflow-hidden ${theme.backgroundGradient}`}
    >
      {/* Header with user context */}
      <JourneyHeader viewingUsername={username} />

      {renderContent()}
    </div>
  );
}
