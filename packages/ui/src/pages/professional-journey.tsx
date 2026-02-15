import React from "react";
import { useLocation } from "wouter";

import { CompactSidebar } from '../components/layout/CompactSidebar';
import { TopHeader } from '../components/layout/TopHeader';
import { ProfileListViewContainer } from "../components/timeline/ProfileListView";

export default function ProfessionalJourney() {
  // Extract username from URL path
  // Inside nested router, /home is the current user's profile
  // /profile/:username is for viewing another user's profile
  const [location] = useLocation();
  const profileMatch = location.match(/^\/profile\/(.+)/);
  const username = profileMatch ? profileMatch[1] : undefined;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-50">
      {/* Left compact sidebar */}
      <CompactSidebar />

      {/* Main content area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top header bar */}
        <TopHeader viewingUsername={username} />

        {/* Profile list view in body content */}
        <ProfileListViewContainer
          username={username}
          className="flex-1 overflow-auto"
        />
      </div>
    </div>
  );
}
