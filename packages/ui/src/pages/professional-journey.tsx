import React from "react";
import { useLocation } from "wouter";

import { CompactSidebar } from '../components/layout/CompactSidebar';
import { TopHeader } from '../components/layout/TopHeader';
import { ProfileListViewContainer } from "../components/timeline/ProfileListView";

export default function ProfessionalJourney() {
  // Extract username from URL path
  const [location] = useLocation();
  const pathSegments = location.split('/').filter(Boolean);

  // If path is just "/" then it's the current user's profile
  // If path is "/username" then it's viewing another user's profile
  const username = pathSegments.length > 0 ? pathSegments[0] : undefined;

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
