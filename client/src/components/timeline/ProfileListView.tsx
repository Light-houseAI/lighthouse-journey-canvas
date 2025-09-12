import { AlertCircle, RefreshCw } from 'lucide-react';
import React, { useCallback, useEffect, useMemo } from 'react';

import { getProfileErrorMessage,useProfileQuery } from '../../stores/profile/useProfileStore';
import { useProfileViewActions,useProfileViewStore } from '../../stores/profile/useProfileViewStore';
import { transformTimelineForProfile } from '../../stores/profile/useTimelineTransform';
import type { ProfileListViewProps } from '../../types/profile';
import { ProfileHeader, ProfileHeaderError,ProfileHeaderSkeleton } from '../profile/ProfileHeader';
import { Alert, AlertDescription } from '../ui/alert';
import { Button } from '../ui/button';
import { ExperienceSection, ExperienceSectionError,ExperienceSectionSkeleton } from './ExperienceSection';

// ============================================================================
// PROFILE LIST VIEW COMPONENT  
// ============================================================================
// Main component that orchestrates the entire profile view feature

export function ProfileListView({ username, className }: ProfileListViewProps) {
  const {
    data: profileData,
    isLoading,
    error,
    refetch,
  } = useProfileQuery(username);

  const expandedNodeIds = useProfileViewStore((state) => state.expandedNodeIds);
  const selectedNodeId = useProfileViewStore((state) => state.selectedNodeId);
  const selectNode = useProfileViewStore((state) => state.selectNode);
  const toggleNodeExpansion = useProfileViewStore((state) => state.toggleNodeExpansion);

  // Transform profile data into tree structures
  const { currentTree, pastTree, allNodes } = useMemo(() => {
    if (!profileData?.timeline) {
      return { currentTree: [], pastTree: [], allNodes: [] };
    }

    const { current, past } = profileData.timeline;
    const allNodes = [...(current || []), ...(past || [])];
    
    return transformTimelineForProfile(allNodes);
  }, [profileData]);

  // Note: Store node updates temporarily disabled to prevent infinite re-render
  // TODO: Implement proper node caching without causing render loops

  // Share and copy handlers
  const handleShare = () => {
    // Analytics or additional tracking could go here
    // Profile shared: profileData?.profile?.profileUrl
  };

  const handleCopy = () => {
    // Analytics or additional tracking could go here  
    // Profile URL copied: profileData?.profile?.profileUrl
  };

  // Retry handler
  const handleRetry = () => {
    refetch();
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={className}>
        <ProfileHeaderSkeleton />
        <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
          <ExperienceSectionSkeleton title="Current Experiences" itemCount={2} />
          <ExperienceSectionSkeleton title="Past Experiences" itemCount={4} />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    const errorMessage = getProfileErrorMessage(error);
    return (
      <div className={className}>
        <ProfileHeaderError error={errorMessage} onRetry={handleRetry} />
        <div className="p-6 bg-gray-50 min-h-screen">
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              <div className="space-y-2">
                <p>{errorMessage}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRetry}
                  className="text-red-600 border-red-300 hover:bg-red-100"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Retry
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  // No data state (shouldn't happen with proper error handling, but just in case)
  if (!profileData?.profile) {
    return (
      <div className={className}>
        <div className="p-6 text-center bg-gray-50 min-h-screen">
          <div className="max-w-md mx-auto">
            <div className="text-gray-400 mb-4">
              <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
                👤
              </div>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No Profile Data
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Unable to load profile information.
            </p>
            <Button variant="outline" onClick={handleRetry}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const { profile, permissions } = profileData;

  return (
    <div className={className}>
      {/* Profile Header */}
      <ProfileHeader
        name={`${profile.firstName} ${profile.lastName}`}
        profileUrl={profile.profileUrl}
        onShare={handleShare}
        onCopy={handleCopy}
      />

      {/* Main Content */}
      <div className="bg-gray-50 min-h-screen">
        <div className="max-w-4xl mx-auto p-6 space-y-6">
          {/* Profile Stats */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <div className="flex items-center space-x-6">
                <div>
                  <span className="font-medium text-gray-900">
                    {profileData?.timeline?.totalCount || 0}
                  </span> total entries
                </div>
                <div>
                  <span className="font-medium text-gray-900">
                    {currentTree.length}
                  </span> current
                </div>
                <div>
                  <span className="font-medium text-gray-900">
                    {pastTree.length}
                  </span> past
                </div>
              </div>
              
              <div className="text-xs text-gray-400">
                Profile: {profile.userName}
              </div>
            </div>
          </div>

          {/* Current Experiences Section */}
          <ExperienceSection
            title="Current Experiences"
            nodes={currentTree}
            expandedIds={expandedNodeIds}
            selectedId={selectedNodeId}
            onNodeClick={selectNode}
            onToggleExpand={toggleNodeExpansion}
          />

          {/* Past Experiences Section */}
          <ExperienceSection
            title="Past Experiences"
            nodes={pastTree}
            expandedIds={expandedNodeIds}
            selectedId={selectedNodeId}
            onNodeClick={selectNode}
            onToggleExpand={toggleNodeExpansion}
          />

          {/* Empty state for no experiences */}
          {currentTree.length === 0 && pastTree.length === 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
              <div className="text-gray-400 mb-4">
                <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
                  📝
                </div>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No Timeline Entries
              </h3>
              <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
                {username 
                  ? `${profile.firstName} hasn't added any timeline entries yet.`
                  : "Start building your professional timeline by adding your experiences, education, and projects."
                }
              </p>
              
              {!username && permissions?.canEdit && (
                <Button variant="outline">
                  Add First Entry
                </Button>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="text-center text-xs text-gray-400 py-4">
            <p>
              Lighthouse Profile • {profile.userName}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// PROFILE LIST VIEW CONTAINER
// ============================================================================
// Container component with error boundaries and context providers

interface ProfileListViewContainerProps extends ProfileListViewProps {
  fallback?: React.ComponentType<{ error: Error; reset: () => void }>;
}

export function ProfileListViewContainer({
  username,
  className,
  fallback: Fallback,
}: ProfileListViewContainerProps) {
  return (
    <React.Suspense 
      fallback={
        <div className={className}>
          <ProfileHeaderSkeleton />
          <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
            <ExperienceSectionSkeleton title="Current Experiences" itemCount={2} />
            <ExperienceSectionSkeleton title="Past Experiences" itemCount={4} />
          </div>
        </div>
      }
    >
      <ProfileErrorBoundary fallback={Fallback}>
        <ProfileListView username={username} className={className} />
      </ProfileErrorBoundary>
    </React.Suspense>
  );
}

// ============================================================================
// PROFILE ERROR BOUNDARY
// ============================================================================
// Catches and handles React errors in the profile view

class ProfileErrorBoundary extends React.Component<
  { 
    children: React.ReactNode; 
    fallback?: React.ComponentType<{ error: Error; reset: () => void }>;
  },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Report to error tracking service
    // Example: Sentry.captureException(error, { contexts: { errorInfo } });
    // Profile view error logged: error, errorInfo
  }

  render() {
    if (this.state.hasError && this.state.error) {
      const Fallback = this.props.fallback;
      
      if (Fallback) {
        return (
          <Fallback
            error={this.state.error}
            reset={() => this.setState({ hasError: false, error: null })}
          />
        );
      }

      return (
        <div className="p-6 bg-gray-50 min-h-screen">
          <div className="max-w-md mx-auto text-center">
            <div className="text-red-400 mb-4">
              <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center">
                ⚠️
              </div>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Something went wrong
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              An error occurred while loading the profile. Please try refreshing the page.
            </p>
            <Button
              variant="outline"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}