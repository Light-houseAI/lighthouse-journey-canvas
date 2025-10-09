import type { ProfileData } from '../types';

// ============================================================================
// USER DATA INTERFACE
// ============================================================================

export interface UserData {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  userName: string;
  interest: string | null;
  hasCompletedOnboarding: boolean;
  createdAt: string; // ISO string
}

// ============================================================================
// UPDATE INTEREST ENDPOINT
// ============================================================================

export interface UpdateInterestSuccessResponse {
  success: true;
  data: {
    user: UserData;
  };
}

// ============================================================================
// COMPLETE ONBOARDING ENDPOINT
// ============================================================================

export interface CompleteOnboardingSuccessResponse {
  success: true;
  data: {
    user: UserData;
  };
}

// ============================================================================
// EXTRACT PROFILE ENDPOINT
// ============================================================================

export interface ExtractProfileSuccessResponse {
  success: true;
  data: {
    profile: ProfileData;
  };
}

// ============================================================================
// SAVE PROFILE ENDPOINT
// ============================================================================

export interface SaveProfileSuccessResponse {
  success: true;
  data: {
    profile: {
      id: string;
      username: string;
      nodesCreated: number;
      nodes: any[];
    };
  };
}
