/**
 * Profile Review Store
 *
 * Manages UI state ONLY for the profile review and onboarding flow.
 * Server state (profile data) is managed by TanStack Query hooks in useOnboarding.ts
 *
 * UI State includes:
 * - Selection state: which fields user has selected to save
 * - Onboarding step: current step in onboarding flow
 * - Success display: whether to show success screen
 *
 * Pattern:
 * - Use this store for UI interactions (select fields, toggle sections)
 * - Use useOnboarding hooks for data operations (extract, save profile)
 */

import type { ProfileData } from '@journey/schema';
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// ============================================================================
// Types
// ============================================================================

interface SelectionState {
  name: boolean;
  headline: boolean;
  location: boolean;
  about: boolean;
  avatarUrl: boolean;
  experiences: boolean[];
  education: boolean[];
}

type InterestType =
  | 'find-job'
  | 'grow-career'
  | 'change-careers'
  | 'start-startup';

export interface ProfileReviewUIState {
  // UI State - Selection
  selection: SelectionState | null;

  // UI State - Onboarding flow
  selectedInterest: InterestType | null;
  currentOnboardingStep: 1 | 2 | 3; // 1: select interest, 2: extract profile, 3: review profile
  extractedProfile: ProfileData | null; // Store extracted profile for ProfileReview page

  // UI State - Success display
  showSuccess: boolean;

  // Selection actions
  initializeSelection: (profile: ProfileData) => void;
  clearSelection: () => void;
  updateSelection: (updates: Partial<SelectionState>) => void;
  toggleSelection: (
    field: keyof Omit<SelectionState, 'experiences' | 'education'>,
    value: boolean
  ) => void;
  toggleExperience: (index: number, value: boolean) => void;
  toggleEducation: (index: number, value: boolean) => void;
  toggleSectionSelection: (
    section: 'basicInfo' | 'experiences' | 'education',
    checked: boolean,
    profile: ProfileData
  ) => void;

  // Onboarding actions
  setSelectedInterest: (interest: InterestType) => void;
  setOnboardingStep: (step: 1 | 2 | 3) => void;
  goBackToStep1: () => void;
  goBackToStep2: () => void;

  // Success display actions
  setShowSuccess: (show: boolean) => void;

  // Helper to get filtered profile data from selection
  getFilteredProfileData: (profile: ProfileData) => ProfileData;

  // Reset
  reset: () => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState = {
  selection: null,
  selectedInterest: null,
  currentOnboardingStep: 1 as const,
  extractedProfile: null,
  showSuccess: false,
};

// ============================================================================
// Store
// ============================================================================

export const useProfileReviewStore = create<ProfileReviewUIState>()(
  devtools(
    persist(
      immer((set, get) => ({
        // Initial state
        ...initialState,

        // ========================================================================
        // Selection Actions
        // ========================================================================

        initializeSelection: (profile: ProfileData) => {
          set((state) => {
            // Store extracted profile
            state.extractedProfile = profile;

            // Initialize selection state - all items selected by default
            state.selection = {
              name: true,
              headline: Boolean(profile.headline),
              location: Boolean(profile.location),
              about: Boolean(profile.about),
              avatarUrl: Boolean(profile.avatarUrl),
              experiences: profile.experiences.map(() => true),
              education: profile.education.map(() => true),
            };
            state.currentOnboardingStep = 3;
          });
        },

        clearSelection: () => {
          set((state) => {
            state.selection = null;
            state.currentOnboardingStep = 2;
          });
        },

        updateSelection: (updates: Partial<SelectionState>) => {
          set((state) => {
            if (state.selection) {
              Object.assign(state.selection, updates);
            }
          });
        },

        toggleSelection: (field, value) => {
          set((state) => {
            if (state.selection) {
              state.selection[field] = value;
            }
          });
        },

        toggleExperience: (index, value) => {
          set((state) => {
            if (state.selection) {
              state.selection.experiences[index] = value;
            }
          });
        },

        toggleEducation: (index, value) => {
          set((state) => {
            if (state.selection) {
              state.selection.education[index] = value;
            }
          });
        },

        toggleSectionSelection: (section, checked, profile) => {
          set((state) => {
            if (!state.selection) return;

            switch (section) {
              case 'basicInfo':
                state.selection.headline = checked && Boolean(profile.headline);
                state.selection.location = checked && Boolean(profile.location);
                state.selection.about = checked && Boolean(profile.about);
                state.selection.avatarUrl =
                  checked && Boolean(profile.avatarUrl);
                break;
              case 'experiences':
                state.selection.experiences = state.selection.experiences.map(
                  () => checked
                );
                break;
              case 'education':
                state.selection.education = state.selection.education.map(
                  () => checked
                );
                break;
            }
          });
        },

        // ========================================================================
        // Onboarding Actions
        // ========================================================================

        setSelectedInterest: (interest: InterestType) => {
          set((state) => {
            state.selectedInterest = interest;
            state.currentOnboardingStep = 2;
          });
        },

        setOnboardingStep: (step: 1 | 2 | 3) => {
          set((state) => {
            state.currentOnboardingStep = step;
          });
        },

        goBackToStep1: () => {
          set((state) => {
            state.currentOnboardingStep = 1;
            // Keep the selected interest so user doesn't lose their choice
          });
        },

        goBackToStep2: () => {
          set((state) => {
            state.currentOnboardingStep = 2;
            // Clear selection when going back to step 2
            state.selection = null;
          });
        },

        // ========================================================================
        // Success Display Actions
        // ========================================================================

        setShowSuccess: (show: boolean) => {
          set((state) => {
            state.showSuccess = show;
          });
        },

        // ========================================================================
        // Helper Methods
        // ========================================================================

        getFilteredProfileData: (profile: ProfileData) => {
          const { selection } = get();

          if (!selection) {
            // If no selection, return the full profile
            return profile;
          }

          // Create filtered profile data based on selection
          const filteredProfile: ProfileData = {
            name: profile.name, // Name is always required
            headline: selection.headline ? profile.headline : undefined,
            location: selection.location ? profile.location : undefined,
            about: selection.about ? profile.about : undefined,
            avatarUrl: selection.avatarUrl ? profile.avatarUrl : undefined,
            skills: profile.skills || [], // Include skills (empty array if not present)
            experiences: profile.experiences.filter(
              (_, index) => selection.experiences[index]
            ),
            education: profile.education.filter(
              (_, index) => selection.education[index]
            ),
          };

          return filteredProfile;
        },

        // ========================================================================
        // Reset
        // ========================================================================

        reset: () => {
          set(initialState);
          console.log('🔄 Profile review UI state reset');
        },
      })),
      {
        name: 'lighthouse-onboarding-state',
        partialize: (state) => ({
          selectedInterest: state.selectedInterest,
          currentOnboardingStep: state.currentOnboardingStep,
        }),
      }
    ),
    { name: 'profile-review-ui-store' }
  )
);
