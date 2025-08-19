import React from 'react';
import { Route, Switch } from 'wouter';
import { useAuthStore } from '@/stores/auth-store';
import { useProfileReviewStore } from '@/stores/profile-review-store';
import OnboardingStep1 from '@/pages/onboarding-step1';
import OnboardingStep2 from '@/pages/onboarding-step2';
import ProfileReview from '@/pages/profile-review';
import ProfessionalJourney from '@/pages/professional-journey';
import { UserTimelinePage } from '@/pages/user-timeline';

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
 * Supports both own timeline (/) and user timeline viewing (/:username)
 */
function TimelineRouter() {
  return (
    <Switch>
      {/* Main timeline route - user's own timeline */}
      <Route path="/" component={ProfessionalJourney} />

      {/* Username-based timeline route - viewing another user's timeline */}
      <Route path="/:username" component={UserTimelinePage} />
    </Switch>
  );
}

export function AuthenticatedApp() {
  const { user } = useAuthStore();
  const { extractedProfile } = useProfileReviewStore();

  // Show appropriate component based on user onboarding state
  if (!user?.interest) {
    return <OnboardingStep1 />;
  }

  if (!user?.hasCompletedOnboarding) {
    // If profile is extracted but onboarding not complete, show profile review
    if (extractedProfile) {
      return <ProfileReview />;
    }
    // Otherwise show step 2 (profile extraction)
    return <OnboardingStep2 />;
  }

  // Once onboarded, use routing for timeline viewing
  return <TimelineRouter />;
}
