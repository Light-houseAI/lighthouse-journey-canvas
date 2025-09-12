import React from "react";
import { useLocation } from "wouter";

import { ProfileListViewContainer } from "../components/timeline/ProfileListView";

export default function ProfessionalJourney() {
  // Extract username from URL path
  const [location] = useLocation();
  const pathSegments = location.split('/').filter(Boolean);
  
  // If path is just "/" then it's the current user's profile
  // If path is "/username" then it's viewing another user's profile
  const username = pathSegments.length > 0 ? pathSegments[0] : undefined;

  return (
    <ProfileListViewContainer 
      username={username}
      className="min-h-screen bg-gray-50"
    />
  );
}
