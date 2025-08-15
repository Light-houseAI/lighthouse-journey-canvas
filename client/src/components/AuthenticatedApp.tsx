import React from "react";
import { useAuthStore } from "@/stores/auth-store";
import { useProfileReviewStore } from "@/stores/profile-review-store";
import OnboardingStep1 from "@/pages/onboarding-step1";
import OnboardingStep2 from "@/pages/onboarding-step2";
import ProfileReview from "@/pages/profile-review";
import ProfessionalJourney from "@/pages/professional-journey";

/**
 * AuthenticatedApp - Handles component display for authenticated users
 * No URL routing - displays components based on user state and Zustand stores
 * 3-step onboarding flow:
 * 1. OnboardingStep1 - Interest selection (if !user.interest)
 * 2. OnboardingStep2 - Profile extraction (if !extractedProfile && !user.hasCompletedOnboarding)
 * 3. ProfileReview - Profile review/save (if extractedProfile && !user.hasCompletedOnboarding)
 * 4. ProfessionalJourney - Main app (if user.hasCompletedOnboarding)
 */
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

  return <ProfessionalJourney />;
}