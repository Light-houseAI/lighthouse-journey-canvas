import { LoadingScreen } from '@journey/components';
import React from 'react';
import { Route, Switch } from 'wouter';

import { useCurrentUser } from '../hooks/useAuth';
import ApplicationMaterialsDetail from '../pages/application-materials-detail';
import BrandBuildingChapter from '../pages/brand-building-chapter';
import CareerTransitionDetail from '../pages/career-transition-detail';
import InterviewChapterDetail from '../pages/interview-chapter-detail';
import NetworkingChapterDetail from '../pages/networking-chapter-detail';
import OnboardingStep1 from '../pages/onboarding-step1';
import OnboardingStep2 from '../pages/onboarding-step2';
import ProfessionalJourney from '../pages/professional-journey';
import ProfileReview from '../pages/profile-review';
import SearchResultsPage from '../pages/search-results';
import Settings from '../pages/settings';
import { UserTimelinePage } from '../pages/user-timeline';
import { useProfileReviewStore } from '../stores/profile-review-store';
import { SectionErrorBoundary } from './errors/SectionErrorBoundary';

/**
 * AuthenticatedApp - Handles component display for authenticated users
 * No URL routing - displays components based on user state and Zustand stores
 * 3-step onboarding flow:
 * 1. OnboardingStep1 - Interest selection (if !user.interest)
 * 2. OnboardingStep2 - Profile extraction (if !extractedProfile && !user.hasCompletedOnboarding)
 * 3. ProfileReview - Profile review/save (if extractedProfile && !user.hasCompletedOnboarding)
 * 4. ProfessionalJourney - Main app (if user.hasCompletedOnboarding)
 */
/**
 * TimelineRouter - Routes for timeline viewing
 * Supports both own timeline (/) and user timeline viewing (/profile/:username)
 */
function TimelineRouter() {
  return (
    <Switch>
      {/* Settings route */}
      <Route path="/settings" component={Settings} />

      {/* Search results route */}
      <Route path="/search" component={SearchResultsPage} />

      {/* Career transition detail view */}
      <Route
        path="/career-transition/:nodeId"
        component={CareerTransitionDetail}
      />

      {/* Application materials detail view */}
      <Route
        path="/application-materials/:careerTransitionId"
        component={ApplicationMaterialsDetail}
      />

      {/* Interview chapter detail view */}
      <Route
        path="/interview-chapter/:applicationId"
        component={InterviewChapterDetail}
      />

      {/* Networking chapter detail view */}
      <Route
        path="/networking-chapter/:nodeId"
        component={NetworkingChapterDetail}
      />

      {/* Brand building chapter detail view */}
      <Route
        path="/brand-building-chapter/:nodeId"
        component={BrandBuildingChapter}
      />

      {/* Main timeline route - user's own timeline */}
      <Route path="/" component={ProfessionalJourney} />

      {/* Profile-based timeline route - viewing another user's timeline */}
      <Route path="/profile/:username" component={UserTimelinePage} />
    </Switch>
  );
}

export function AuthenticatedApp() {
  const { data: user, isLoading } = useCurrentUser();
  const { currentOnboardingStep, selectedInterest } = useProfileReviewStore();

  // Show loading state while fetching user data (prevents onboarding flash)
  if (isLoading) {
    return <LoadingScreen />;
  }

  // Show appropriate component based on user onboarding state
  if (!user?.interest && !selectedInterest) {
    return <OnboardingStep1 />;
  }

  if (!user?.hasCompletedOnboarding) {
    // Use Zustand state to determine which step to show
    if (currentOnboardingStep === 1) {
      return <OnboardingStep1 />;
    }

    // If profile is extracted (step 3) but onboarding not complete, show profile review
    if (currentOnboardingStep === 3) {
      return <ProfileReview />;
    }
    // Otherwise show step 2 (profile extraction)
    return <OnboardingStep2 />;
  }

  // Once onboarded, use routing for timeline viewing
  return (
    <SectionErrorBoundary sectionName="Timeline">
      <TimelineRouter />
    </SectionErrorBoundary>
  );
}
