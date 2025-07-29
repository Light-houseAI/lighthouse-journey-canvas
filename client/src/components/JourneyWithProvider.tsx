import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { JourneyProvider } from '@/providers/journey-provider';
import ProfessionalJourney from '@/pages/professional-journey';

/**
 * Wrapper component that fetches profile data and provides it to the separated stores
 */
export default function JourneyWithProvider() {
  const { user } = useAuth();
  const [profileData, setProfileData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch profile data when user is available
  useEffect(() => {
    const fetchProfileData = async () => {
      if (!user || profileData) return; // Don't fetch if no user or already have data
      
      setIsLoading(true);
      setError(null);
      
      try {
        const response = await fetch('/api/profile');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        setProfileData(data);
      } catch (err) {
        console.error('Failed to fetch profile data:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch profile data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfileData();
  }, [user, profileData]);

  // Show loading state while fetching initial data
  if (isLoading && !profileData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600">Loading your professional journey...</p>
        </div>
      </div>
    );
  }

  // Show error state if data fetch failed
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="max-w-md mx-auto text-center space-y-4">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto">
            <span className="text-red-400 text-2xl">!</span>
          </div>
          <h2 className="text-xl font-semibold text-white">Failed to Load Data</h2>
          <p className="text-red-200">{error}</p>
          <button 
            onClick={() => {
              setError(null);
              setProfileData(null); // This will trigger a re-fetch
            }}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Render with the clean journey provider
  return (
    <JourneyProvider profileData={profileData}>
      <ProfessionalJourney />
    </JourneyProvider>
  );
}