import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { type ProfileData, type InsertProfile } from '@shared/schema';
import { httpClient } from '@/services/http-client';
import { getErrorMessage } from '../utils/error-toast';

interface SelectionState {
  name: boolean;
  headline: boolean;
  location: boolean;
  about: boolean;
  avatarUrl: boolean;
  experiences: boolean[];
  education: boolean[];
}

type InterestType = 'find-job' | 'grow-career' | 'change-careers' | 'start-startup';

interface ProfileReviewState {
  // State
  extractedProfile: ProfileData | null;
  username: string | null;
  selection: SelectionState | null;
  showSuccess: boolean;
  isLoading: boolean;
  error: string | null;
  // Onboarding state
  selectedInterest: InterestType | null;
  currentOnboardingStep: 1 | 2 | 3; // 1: select interest, 2: extract profile, 3: review profile

  // Actions
  setExtractedProfile: (profile: ProfileData, username: string) => void;
  updateSelection: (updates: Partial<SelectionState>) => void;
  toggleSelection: (field: keyof Omit<SelectionState, 'experiences' | 'education'>, value: boolean) => void;
  toggleExperience: (index: number, value: boolean) => void;
  toggleEducation: (index: number, value: boolean) => void;
  toggleSectionSelection: (section: 'basicInfo' | 'experiences' | 'education', checked: boolean) => void;
  setShowSuccess: (show: boolean) => void;
  saveProfile: (completeOnboardingFn: () => Promise<void>) => Promise<void>;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearProfile: () => void;
  reset: () => void;
  // Onboarding actions
  setSelectedInterest: (interest: InterestType) => void;
  setOnboardingStep: (step: 1 | 2 | 3) => void;
  goBackToStep1: () => void;
}

export const useProfileReviewStore = create<ProfileReviewState>()(
  devtools(
    immer((set, get) => ({
      // Initial state
      extractedProfile: null,
      username: null,
      selection: null,
      showSuccess: false,
      isLoading: false,
      error: null,
      // Onboarding state
      selectedInterest: null,
      currentOnboardingStep: 1,

      // Actions
      setExtractedProfile: (profile, username) => set((state) => {
        state.extractedProfile = profile;
        state.username = username;

        // Initialize selection state - all items selected by default
        state.selection = {
          name: true,
          headline: Boolean(profile.headline),
          location: Boolean(profile.location),
          about: Boolean(profile.about),
          avatarUrl: Boolean(profile.avatarUrl),
          experiences: profile.experiences.map(() => true),
          education: profile.education.map(() => true)
        };
      }),

      updateSelection: (updates) => set((state) => {
        if (state.selection) {
          Object.assign(state.selection, updates);
        }
      }),

      toggleSelection: (field, value) => set((state) => {
        if (state.selection) {
          state.selection[field] = value;
        }
      }),

      toggleExperience: (index, value) => set((state) => {
        if (state.selection) {
          state.selection.experiences[index] = value;
        }
      }),

      toggleEducation: (index, value) => set((state) => {
        if (state.selection) {
          state.selection.education[index] = value;
        }
      }),

      toggleSectionSelection: (section, checked) => set((state) => {
        if (!state.selection || !state.extractedProfile) return;

        switch (section) {
          case 'basicInfo':
            state.selection.headline = checked && Boolean(state.extractedProfile.headline);
            state.selection.location = checked && Boolean(state.extractedProfile.location);
            state.selection.about = checked && Boolean(state.extractedProfile.about);
            state.selection.avatarUrl = checked && Boolean(state.extractedProfile.avatarUrl);
            break;
          case 'experiences':
            state.selection.experiences = state.selection.experiences.map(() => checked);
            break;
          case 'education':
            state.selection.education = state.selection.education.map(() => checked);
            break;
        }
      }),

      setShowSuccess: (show) => set((state) => {
        state.showSuccess = show;
      }),

      setLoading: (loading) => set((state) => {
        state.isLoading = loading;
      }),

      setError: (error) => set((state) => {
        state.error = error;
        state.isLoading = false;
      }),

      saveProfile: async (completeOnboardingFn) => {
        const { extractedProfile, username, selection, selectedInterest, setLoading, setError, setShowSuccess } = get();

        if (!extractedProfile || !selection || !username || !selectedInterest) {
          setError("Missing required data");
          return;
        }

        try {
          setLoading(true);
          setError(null);

          // Create filtered profile data based on selection
          const filteredProfile: ProfileData = {
            name: extractedProfile.name, // Name is always required
            headline: selection.headline ? extractedProfile.headline : undefined,
            location: selection.location ? extractedProfile.location : undefined,
            about: selection.about ? extractedProfile.about : undefined,
            avatarUrl: selection.avatarUrl ? extractedProfile.avatarUrl : undefined,
            skills: extractedProfile.skills || [], // Include skills (empty array if not present)
            experiences: extractedProfile.experiences.filter((_, index) => selection.experiences[index]),
            education: extractedProfile.education.filter((_, index) => selection.education[index])
          };

          const saveData: InsertProfile = {
            username,
            rawData: extractedProfile,
            filteredData: filteredProfile,
          };

          // First save the interest
          await httpClient.post('/api/onboarding/interest', { interest: selectedInterest });

          // Then save the profile
          await httpClient.post("/api/onboarding/save-profile", saveData);

          // Complete onboarding
          await completeOnboardingFn();

          // Show success state
          setShowSuccess(true);

          // Hide success screen after delay
          setTimeout(() => {
            setShowSuccess(false);
          }, 2000);

        } catch (error) {
          const message = getErrorMessage(error);
          setError(message);
          throw error;
        } finally {
          setLoading(false);
        }
      },

      clearProfile: () => set((state) => {
        state.extractedProfile = null;
        state.username = null;
        state.selection = null;
        state.showSuccess = false;
        state.isLoading = false;
        state.error = null;
      }),

      reset: () => set((state) => {
        state.extractedProfile = null;
        state.username = null;
        state.selection = null;
        state.showSuccess = false;
        state.isLoading = false;
        state.error = null;
        state.selectedInterest = null;
        state.currentOnboardingStep = 1;
      }),

      // Onboarding actions
      setSelectedInterest: (interest: InterestType) => set((state) => {
        state.selectedInterest = interest;
        state.currentOnboardingStep = 2;
      }),

      setOnboardingStep: (step: 1 | 2 | 3) => set((state) => {
        state.currentOnboardingStep = step;
      }),

      goBackToStep1: () => set((state) => {
        state.currentOnboardingStep = 1;
        // Keep the selected interest so user doesn't lose their choice
      }),
    })),
    { name: 'profile-review-store' }
  )
);
