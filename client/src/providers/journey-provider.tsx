import React, { useEffect } from 'react';
import { useJourneyStore } from '@/stores/journey-store';

/**
 * Simple provider that initializes the journey store with profile data
 * Following Zustand best practices - minimal provider, store handles everything
 */
export const JourneyProvider: React.FC<{
  children: React.ReactNode;
  profileData?: any;
}> = ({ children, profileData }) => {
  const setProfileData = useJourneyStore(state => state.setProfileData);
  const loadProfileData = useJourneyStore(state => state.loadProfileData);
  const currentProfileData = useJourneyStore(state => state.profileData);
  const isLoading = useJourneyStore(state => state.isLoading);

  // Initialize store with provided data or load from API
  useEffect(() => {
    if (profileData && !currentProfileData) {
      setProfileData(profileData);
    } else if (!profileData && !currentProfileData && !isLoading) {
      loadProfileData();
    }
  }, [profileData, currentProfileData, isLoading, setProfileData, loadProfileData]);

  return <>{children}</>;
};