/**
 * Application Materials Store
 *
 * Zustand store for managing application materials modal state,
 * form data, and validation states.
 */

import { LinkedInProfile, ResumeEntry } from '@journey/schema';
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

// Form data for resume entry
export interface ResumeFormData {
  type: string; // Resume type (e.g., 'general', 'product-management', custom)
  url: string;
  notes: string;
}

// Form data for LinkedIn profile
export interface LinkedInFormData {
  url: string;
  notes: string;
}

interface ApplicationMaterialsState {
  // Modal state
  isOpen: boolean;
  activeTab: 'resume' | 'linkedIn';
  isLinkedInHelpOpen: boolean;

  // Form data
  resumeFormData: ResumeFormData;
  linkedInFormData: LinkedInFormData;

  // Resume type selection
  selectedResumeType:
    | 'general'
    | 'product-management'
    | 'business-development'
    | 'custom';
  customResumeTypeName: string;

  // Edit mode (for editing existing entries)
  editingResumeType: string | null;

  // Validation state
  formErrors: {
    resumeUrl?: string;
    resumeType?: string;
    resumeNotes?: string;
    linkedInUrl?: string;
    linkedInNotes?: string;
  };

  // Dirty state tracking
  isDirty: boolean;

  // Actions - Modal
  setIsOpen: (isOpen: boolean) => void;
  setActiveTab: (tab: 'resume' | 'linkedIn') => void;
  setIsLinkedInHelpOpen: (isOpen: boolean) => void;

  // Actions - Form data
  setResumeFormData: (data: Partial<ResumeFormData>) => void;
  setLinkedInFormData: (data: Partial<LinkedInFormData>) => void;
  setSelectedResumeType: (
    type: 'general' | 'product-management' | 'business-development' | 'custom'
  ) => void;
  setCustomResumeTypeName: (name: string) => void;
  setEditingResumeType: (type: string | null) => void;

  // Actions - Validation
  setFormError: (
    field: keyof ApplicationMaterialsState['formErrors'],
    error?: string
  ) => void;
  clearFormErrors: () => void;

  // Actions - Dirty state
  setIsDirty: (isDirty: boolean) => void;

  // Actions - Reset
  resetForm: () => void;
  resetAll: () => void;

  // Helper - Load existing data for editing
  loadResumeForEdit: (resume: ResumeEntry) => void;
  loadLinkedInForEdit: (profile: LinkedInProfile) => void;
}

const initialResumeFormData: ResumeFormData = {
  type: '',
  url: '',
  notes: '',
};

const initialLinkedInFormData: LinkedInFormData = {
  url: '',
  notes: '',
};

export const useApplicationMaterialsStore = create<ApplicationMaterialsState>()(
  immer((set) => ({
    // Initial state
    isOpen: false,
    activeTab: 'resume',
    isLinkedInHelpOpen: false,

    resumeFormData: initialResumeFormData,
    linkedInFormData: initialLinkedInFormData,

    selectedResumeType: 'general',
    customResumeTypeName: '',
    editingResumeType: null,

    formErrors: {},
    isDirty: false,

    // Modal actions
    setIsOpen: (isOpen) =>
      set((state) => {
        state.isOpen = isOpen;
      }),

    setActiveTab: (tab) =>
      set((state) => {
        state.activeTab = tab;
      }),

    setIsLinkedInHelpOpen: (isOpen) =>
      set((state) => {
        state.isLinkedInHelpOpen = isOpen;
      }),

    // Form data actions
    setResumeFormData: (data) =>
      set((state) => {
        state.resumeFormData = { ...state.resumeFormData, ...data };
        state.isDirty = true;
      }),

    setLinkedInFormData: (data) =>
      set((state) => {
        state.linkedInFormData = { ...state.linkedInFormData, ...data };
        state.isDirty = true;
      }),

    setSelectedResumeType: (type) =>
      set((state) => {
        state.selectedResumeType = type;
        // Update resume type in form data
        if (type !== 'custom') {
          state.resumeFormData.type = type;
        }
        state.isDirty = true;
      }),

    setCustomResumeTypeName: (name) =>
      set((state) => {
        state.customResumeTypeName = name;
        if (state.selectedResumeType === 'custom') {
          state.resumeFormData.type = name;
        }
        state.isDirty = true;
      }),

    setEditingResumeType: (type) =>
      set((state) => {
        state.editingResumeType = type;
      }),

    // Validation actions
    setFormError: (field, error) =>
      set((state) => {
        if (error) {
          state.formErrors[field] = error;
        } else {
          delete state.formErrors[field];
        }
      }),

    clearFormErrors: () =>
      set((state) => {
        state.formErrors = {};
      }),

    // Dirty state actions
    setIsDirty: (isDirty) =>
      set((state) => {
        state.isDirty = isDirty;
      }),

    // Reset actions
    resetForm: () =>
      set((state) => {
        state.resumeFormData = initialResumeFormData;
        state.linkedInFormData = initialLinkedInFormData;
        state.selectedResumeType = 'general';
        state.customResumeTypeName = '';
        state.editingResumeType = null;
        state.formErrors = {};
        state.isDirty = false;
      }),

    resetAll: () =>
      set((state) => {
        state.isOpen = false;
        state.activeTab = 'resume';
        state.isLinkedInHelpOpen = false;
        state.resumeFormData = initialResumeFormData;
        state.linkedInFormData = initialLinkedInFormData;
        state.selectedResumeType = 'general';
        state.customResumeTypeName = '';
        state.editingResumeType = null;
        state.formErrors = {};
        state.isDirty = false;
      }),

    // Helper actions
    loadResumeForEdit: (resume) =>
      set((state) => {
        state.editingResumeType = resume.type;
        state.resumeFormData = {
          type: resume.type,
          url: resume.resumeVersion.url,
          notes: resume.resumeVersion.notes || '',
        };

        // Set selected resume type
        const predefinedTypes = [
          'general',
          'product-management',
          'business-development',
        ];
        if (predefinedTypes.includes(resume.type)) {
          state.selectedResumeType = resume.type as
            | 'general'
            | 'product-management'
            | 'business-development';
        } else {
          state.selectedResumeType = 'custom';
          state.customResumeTypeName = resume.type;
        }

        state.isDirty = false;
      }),

    loadLinkedInForEdit: (profile) =>
      set((state) => {
        state.linkedInFormData = {
          url: profile.url,
          notes: profile.notes || '',
        };
        state.isDirty = false;
      }),
  }))
);
