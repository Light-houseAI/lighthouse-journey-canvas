import { motion } from 'framer-motion';
import React, { useEffect } from 'react';
import { useLocation, useParams } from 'wouter';

import { JourneyHeader } from '../components/journey/JourneyHeader';
import { ProfileListView } from '../components/timeline/ProfileListView';
import { useTheme } from '../contexts/ThemeContext';

/**
 * UserTimelinePage - View another user's timeline by username
 * Uses ProfileListView component with username parameter for permission filtering
 * Backend automatically applies appropriate access controls
 */
export function UserTimelinePage() {
  const { username } = useParams<{ username: string }>();
  const [, setLocation] = useLocation();
  const { theme } = useTheme();

  // Redirect to main timeline if no username provided
  useEffect(() => {
    if (!username) {
      setLocation('/');
    }
  }, [username, setLocation]);

  return (
    <div
      className={`relative h-screen w-full overflow-hidden ${theme.backgroundGradient}`}
    >
      {/* Header with user context */}
      <JourneyHeader viewingUsername={username} />

      {/* Career Journey Visualization */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="h-full w-full"
      >
        <ProfileListView username={username} />
      </motion.div>
    </div>
  );
}
