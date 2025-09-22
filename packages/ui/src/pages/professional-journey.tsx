import React from "react";
import { useLocation } from "wouter";

import { JourneyHeader } from '../components/journey/JourneyHeader';
import { useTheme } from '../contexts/ThemeContext';
import { ProfileListViewContainer } from "../components/timeline/ProfileListView";

export default function ProfessionalJourney() {
  // Extract username from URL path
  const [location] = useLocation();
  const pathSegments = location.split('/').filter(Boolean);
  const { theme } = useTheme();
  
  // If path is just "/" then it's the current user's profile
  // If path is "/username" then it's viewing another user's profile
  const username = pathSegments.length > 0 ? pathSegments[0] : undefined;

  return (
    <div className={`relative h-screen w-full overflow-hidden ${theme.backgroundGradient}`}>
      {/* Keep existing JourneyHeader with search functionality */}
      <JourneyHeader viewingUsername={username} />
      
      {/* Profile list view in body content only */}
      <ProfileListViewContainer 
        username={username}
        className="flex-1 overflow-auto"
      />
    </div>
  );
}
