/**
 * Application Materials Store Tests
 *
 * Tests for application materials Zustand store including:
 * - Modal state management
 * - Form data management
 * - Validation state
 * - Dirty state tracking
 * - Reset functionality
 * - Loading existing data for editing
 */

import { LinkedInProfile, ResumeEntry } from '@journey/schema';
import { beforeEach, describe, expect, it } from 'vitest';

import { useApplicationMaterialsStore } from './application-materials-store';

describe('useApplicationMaterialsStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    const store = useApplicationMaterialsStore.getState();
    store.resetAll();
  });

  describe('Initial State', () => {
    it('should have correct initial modal state', () => {
      const { isOpen, activeTab, isLinkedInHelpOpen } =
        useApplicationMaterialsStore.getState();

      expect(isOpen).toBe(false);
      expect(activeTab).toBe('resume');
      expect(isLinkedInHelpOpen).toBe(false);
    });

    it('should have empty initial form data', () => {
      const { resumeFormData, linkedInFormData } =
        useApplicationMaterialsStore.getState();

      expect(resumeFormData).toEqual({
        type: '',
        url: '',
        notes: '',
      });

      expect(linkedInFormData).toEqual({
        url: '',
        notes: '',
      });
    });

    it('should have initial resume type selection as general', () => {
      const { selectedResumeType, customResumeTypeName } =
        useApplicationMaterialsStore.getState();

      expect(selectedResumeType).toBe('general');
      expect(customResumeTypeName).toBe('');
    });

    it('should have no editing resume type initially', () => {
      const { editingResumeType } = useApplicationMaterialsStore.getState();

      expect(editingResumeType).toBeNull();
    });

    it('should have no form errors initially', () => {
      const { formErrors } = useApplicationMaterialsStore.getState();

      expect(formErrors).toEqual({});
    });

    it('should not be dirty initially', () => {
      const { isDirty } = useApplicationMaterialsStore.getState();

      expect(isDirty).toBe(false);
    });
  });

  describe('Modal Actions', () => {
    describe('setIsOpen', () => {
      it('should set modal open state', () => {
        const { setIsOpen } = useApplicationMaterialsStore.getState();

        setIsOpen(true);
        expect(useApplicationMaterialsStore.getState().isOpen).toBe(true);

        setIsOpen(false);
        expect(useApplicationMaterialsStore.getState().isOpen).toBe(false);
      });
    });

    describe('setActiveTab', () => {
      it('should set active tab to resume', () => {
        const { setActiveTab } = useApplicationMaterialsStore.getState();

        setActiveTab('resume');
        expect(useApplicationMaterialsStore.getState().activeTab).toBe(
          'resume'
        );
      });

      it('should set active tab to linkedIn', () => {
        const { setActiveTab } = useApplicationMaterialsStore.getState();

        setActiveTab('linkedIn');
        expect(useApplicationMaterialsStore.getState().activeTab).toBe(
          'linkedIn'
        );
      });
    });

    describe('setIsLinkedInHelpOpen', () => {
      it('should set LinkedIn help modal state', () => {
        const { setIsLinkedInHelpOpen } =
          useApplicationMaterialsStore.getState();

        setIsLinkedInHelpOpen(true);
        expect(useApplicationMaterialsStore.getState().isLinkedInHelpOpen).toBe(
          true
        );

        setIsLinkedInHelpOpen(false);
        expect(useApplicationMaterialsStore.getState().isLinkedInHelpOpen).toBe(
          false
        );
      });
    });
  });

  describe('Form Data Actions', () => {
    describe('setResumeFormData', () => {
      it('should update resume form data with partial updates', () => {
        const { setResumeFormData } = useApplicationMaterialsStore.getState();

        setResumeFormData({ url: 'https://example.com/resume.pdf' });

        const { resumeFormData } = useApplicationMaterialsStore.getState();
        expect(resumeFormData.url).toBe('https://example.com/resume.pdf');
        expect(resumeFormData.type).toBe(''); // Other fields unchanged
        expect(resumeFormData.notes).toBe('');
      });

      it('should update multiple fields at once', () => {
        const { setResumeFormData } = useApplicationMaterialsStore.getState();

        setResumeFormData({
          url: 'https://example.com/resume.pdf',
          notes: 'My resume',
        });

        const { resumeFormData } = useApplicationMaterialsStore.getState();
        expect(resumeFormData.url).toBe('https://example.com/resume.pdf');
        expect(resumeFormData.notes).toBe('My resume');
      });

      it('should set isDirty to true when updating resume form', () => {
        const { setResumeFormData } = useApplicationMaterialsStore.getState();

        setResumeFormData({ url: 'https://example.com/resume.pdf' });

        expect(useApplicationMaterialsStore.getState().isDirty).toBe(true);
      });

      it('should preserve existing data when updating single field', () => {
        const { setResumeFormData } = useApplicationMaterialsStore.getState();

        setResumeFormData({ url: 'https://example.com/resume.pdf' });
        setResumeFormData({ notes: 'Updated notes' });

        const { resumeFormData } = useApplicationMaterialsStore.getState();
        expect(resumeFormData.url).toBe('https://example.com/resume.pdf');
        expect(resumeFormData.notes).toBe('Updated notes');
      });
    });

    describe('setLinkedInFormData', () => {
      it('should update LinkedIn form data with partial updates', () => {
        const { setLinkedInFormData } = useApplicationMaterialsStore.getState();

        setLinkedInFormData({ url: 'https://linkedin.com/in/user' });

        const { linkedInFormData } = useApplicationMaterialsStore.getState();
        expect(linkedInFormData.url).toBe('https://linkedin.com/in/user');
        expect(linkedInFormData.notes).toBe(''); // Other fields unchanged
      });

      it('should update multiple fields at once', () => {
        const { setLinkedInFormData } = useApplicationMaterialsStore.getState();

        setLinkedInFormData({
          url: 'https://linkedin.com/in/user',
          notes: 'My LinkedIn profile',
        });

        const { linkedInFormData } = useApplicationMaterialsStore.getState();
        expect(linkedInFormData.url).toBe('https://linkedin.com/in/user');
        expect(linkedInFormData.notes).toBe('My LinkedIn profile');
      });

      it('should set isDirty to true when updating LinkedIn form', () => {
        const { setLinkedInFormData } = useApplicationMaterialsStore.getState();

        setLinkedInFormData({ url: 'https://linkedin.com/in/user' });

        expect(useApplicationMaterialsStore.getState().isDirty).toBe(true);
      });

      it('should preserve existing data when updating single field', () => {
        const { setLinkedInFormData } = useApplicationMaterialsStore.getState();

        setLinkedInFormData({ url: 'https://linkedin.com/in/user' });
        setLinkedInFormData({ notes: 'Updated notes' });

        const { linkedInFormData } = useApplicationMaterialsStore.getState();
        expect(linkedInFormData.url).toBe('https://linkedin.com/in/user');
        expect(linkedInFormData.notes).toBe('Updated notes');
      });
    });

    describe('setSelectedResumeType', () => {
      it('should set resume type to general', () => {
        const { setSelectedResumeType } =
          useApplicationMaterialsStore.getState();

        setSelectedResumeType('general');

        const { selectedResumeType, resumeFormData } =
          useApplicationMaterialsStore.getState();
        expect(selectedResumeType).toBe('general');
        expect(resumeFormData.type).toBe('general');
      });

      it('should set resume type to product-management', () => {
        const { setSelectedResumeType } =
          useApplicationMaterialsStore.getState();

        setSelectedResumeType('product-management');

        const { selectedResumeType, resumeFormData } =
          useApplicationMaterialsStore.getState();
        expect(selectedResumeType).toBe('product-management');
        expect(resumeFormData.type).toBe('product-management');
      });

      it('should set resume type to business-development', () => {
        const { setSelectedResumeType } =
          useApplicationMaterialsStore.getState();

        setSelectedResumeType('business-development');

        const { selectedResumeType, resumeFormData } =
          useApplicationMaterialsStore.getState();
        expect(selectedResumeType).toBe('business-development');
        expect(resumeFormData.type).toBe('business-development');
      });

      it('should set resume type to custom but not update form type', () => {
        const { setSelectedResumeType } =
          useApplicationMaterialsStore.getState();

        setSelectedResumeType('custom');

        const { selectedResumeType, resumeFormData } =
          useApplicationMaterialsStore.getState();
        expect(selectedResumeType).toBe('custom');
        // Form type should not be updated for 'custom' - it will be set via customResumeTypeName
        expect(resumeFormData.type).toBe('');
      });

      it('should set isDirty to true when changing resume type', () => {
        const { setSelectedResumeType } =
          useApplicationMaterialsStore.getState();

        setSelectedResumeType('product-management');

        expect(useApplicationMaterialsStore.getState().isDirty).toBe(true);
      });
    });

    describe('setCustomResumeTypeName', () => {
      it('should set custom resume type name', () => {
        const { setCustomResumeTypeName } =
          useApplicationMaterialsStore.getState();

        setCustomResumeTypeName('custom-resume-type');

        expect(
          useApplicationMaterialsStore.getState().customResumeTypeName
        ).toBe('custom-resume-type');
      });

      it('should update form type when selected type is custom', () => {
        const { setSelectedResumeType, setCustomResumeTypeName } =
          useApplicationMaterialsStore.getState();

        setSelectedResumeType('custom');
        setCustomResumeTypeName('my-custom-type');

        const { resumeFormData } = useApplicationMaterialsStore.getState();
        expect(resumeFormData.type).toBe('my-custom-type');
      });

      it('should not update form type when selected type is not custom', () => {
        const { setSelectedResumeType, setCustomResumeTypeName } =
          useApplicationMaterialsStore.getState();

        setSelectedResumeType('general');
        setCustomResumeTypeName('my-custom-type');

        const { resumeFormData } = useApplicationMaterialsStore.getState();
        expect(resumeFormData.type).toBe('general'); // Should remain general
      });

      it('should set isDirty to true when setting custom name', () => {
        const { setCustomResumeTypeName } =
          useApplicationMaterialsStore.getState();

        setCustomResumeTypeName('custom-type');

        expect(useApplicationMaterialsStore.getState().isDirty).toBe(true);
      });
    });

    describe('setEditingResumeType', () => {
      it('should set editing resume type', () => {
        const { setEditingResumeType } =
          useApplicationMaterialsStore.getState();

        setEditingResumeType('general');

        expect(useApplicationMaterialsStore.getState().editingResumeType).toBe(
          'general'
        );
      });

      it('should clear editing resume type', () => {
        const { setEditingResumeType } =
          useApplicationMaterialsStore.getState();

        setEditingResumeType('general');
        setEditingResumeType(null);

        expect(
          useApplicationMaterialsStore.getState().editingResumeType
        ).toBeNull();
      });
    });
  });

  describe('Validation Actions', () => {
    describe('setFormError', () => {
      it('should set form error for field', () => {
        const { setFormError } = useApplicationMaterialsStore.getState();

        setFormError('resumeUrl', 'Invalid URL');

        const { formErrors } = useApplicationMaterialsStore.getState();
        expect(formErrors.resumeUrl).toBe('Invalid URL');
      });

      it('should set multiple form errors', () => {
        const { setFormError } = useApplicationMaterialsStore.getState();

        setFormError('resumeUrl', 'Invalid URL');
        setFormError('resumeType', 'Type is required');

        const { formErrors } = useApplicationMaterialsStore.getState();
        expect(formErrors.resumeUrl).toBe('Invalid URL');
        expect(formErrors.resumeType).toBe('Type is required');
      });

      it('should clear form error when error is undefined', () => {
        const { setFormError } = useApplicationMaterialsStore.getState();

        setFormError('resumeUrl', 'Invalid URL');
        setFormError('resumeUrl', undefined);

        const { formErrors } = useApplicationMaterialsStore.getState();
        expect(formErrors.resumeUrl).toBeUndefined();
      });

      it('should update existing error', () => {
        const { setFormError } = useApplicationMaterialsStore.getState();

        setFormError('resumeUrl', 'Invalid URL');
        setFormError('resumeUrl', 'URL is required');

        const { formErrors } = useApplicationMaterialsStore.getState();
        expect(formErrors.resumeUrl).toBe('URL is required');
      });
    });

    describe('clearFormErrors', () => {
      it('should clear all form errors', () => {
        const { setFormError, clearFormErrors } =
          useApplicationMaterialsStore.getState();

        setFormError('resumeUrl', 'Invalid URL');
        setFormError('resumeType', 'Type is required');
        setFormError('linkedInUrl', 'Invalid LinkedIn URL');

        clearFormErrors();

        const { formErrors } = useApplicationMaterialsStore.getState();
        expect(formErrors).toEqual({});
      });

      it('should work when no errors exist', () => {
        const { clearFormErrors } = useApplicationMaterialsStore.getState();

        clearFormErrors();

        const { formErrors } = useApplicationMaterialsStore.getState();
        expect(formErrors).toEqual({});
      });
    });
  });

  describe('Dirty State Actions', () => {
    describe('setIsDirty', () => {
      it('should set dirty state to true', () => {
        const { setIsDirty } = useApplicationMaterialsStore.getState();

        setIsDirty(true);

        expect(useApplicationMaterialsStore.getState().isDirty).toBe(true);
      });

      it('should set dirty state to false', () => {
        const { setIsDirty } = useApplicationMaterialsStore.getState();

        setIsDirty(true);
        setIsDirty(false);

        expect(useApplicationMaterialsStore.getState().isDirty).toBe(false);
      });
    });
  });

  describe('Reset Actions', () => {
    describe('resetForm', () => {
      it('should reset form data to initial state', () => {
        const { setResumeFormData, setLinkedInFormData, resetForm } =
          useApplicationMaterialsStore.getState();

        // Set some data
        setResumeFormData({
          type: 'general',
          url: 'https://example.com/resume.pdf',
          notes: 'Notes',
        });
        setLinkedInFormData({
          url: 'https://linkedin.com/in/user',
          notes: 'LinkedIn notes',
        });

        // Reset
        resetForm();

        const { resumeFormData, linkedInFormData } =
          useApplicationMaterialsStore.getState();
        expect(resumeFormData).toEqual({
          type: '',
          url: '',
          notes: '',
        });
        expect(linkedInFormData).toEqual({
          url: '',
          notes: '',
        });
      });

      it('should reset resume type selection', () => {
        const { setSelectedResumeType, setCustomResumeTypeName, resetForm } =
          useApplicationMaterialsStore.getState();

        setSelectedResumeType('custom');
        setCustomResumeTypeName('my-custom-type');

        resetForm();

        const { selectedResumeType, customResumeTypeName } =
          useApplicationMaterialsStore.getState();
        expect(selectedResumeType).toBe('general');
        expect(customResumeTypeName).toBe('');
      });

      it('should clear editing resume type', () => {
        const { setEditingResumeType, resetForm } =
          useApplicationMaterialsStore.getState();

        setEditingResumeType('general');

        resetForm();

        expect(
          useApplicationMaterialsStore.getState().editingResumeType
        ).toBeNull();
      });

      it('should clear form errors', () => {
        const { setFormError, resetForm } =
          useApplicationMaterialsStore.getState();

        setFormError('resumeUrl', 'Invalid URL');
        setFormError('linkedInUrl', 'Invalid LinkedIn URL');

        resetForm();

        const { formErrors } = useApplicationMaterialsStore.getState();
        expect(formErrors).toEqual({});
      });

      it('should set isDirty to false', () => {
        const { setIsDirty, resetForm } =
          useApplicationMaterialsStore.getState();

        setIsDirty(true);

        resetForm();

        expect(useApplicationMaterialsStore.getState().isDirty).toBe(false);
      });

      it('should not reset modal state', () => {
        const { setIsOpen, setActiveTab, resetForm } =
          useApplicationMaterialsStore.getState();

        setIsOpen(true);
        setActiveTab('linkedIn');

        resetForm();

        const { isOpen, activeTab } = useApplicationMaterialsStore.getState();
        expect(isOpen).toBe(true);
        expect(activeTab).toBe('linkedIn');
      });
    });

    describe('resetAll', () => {
      it('should reset everything to initial state', () => {
        const {
          setIsOpen,
          setActiveTab,
          setIsLinkedInHelpOpen,
          setResumeFormData,
          setLinkedInFormData,
          setSelectedResumeType,
          setCustomResumeTypeName,
          setEditingResumeType,
          setFormError,
          setIsDirty,
          resetAll,
        } = useApplicationMaterialsStore.getState();

        // Set various states
        setIsOpen(true);
        setActiveTab('linkedIn');
        setIsLinkedInHelpOpen(true);
        setResumeFormData({ type: 'general', url: 'url', notes: 'notes' });
        setLinkedInFormData({ url: 'linkedin-url', notes: 'notes' });
        setSelectedResumeType('custom');
        setCustomResumeTypeName('custom-type');
        setEditingResumeType('general');
        setFormError('resumeUrl', 'Error');
        setIsDirty(true);

        // Reset all
        resetAll();

        const state = useApplicationMaterialsStore.getState();
        expect(state.isOpen).toBe(false);
        expect(state.activeTab).toBe('resume');
        expect(state.isLinkedInHelpOpen).toBe(false);
        expect(state.resumeFormData).toEqual({ type: '', url: '', notes: '' });
        expect(state.linkedInFormData).toEqual({ url: '', notes: '' });
        expect(state.selectedResumeType).toBe('general');
        expect(state.customResumeTypeName).toBe('');
        expect(state.editingResumeType).toBeNull();
        expect(state.formErrors).toEqual({});
        expect(state.isDirty).toBe(false);
      });
    });
  });

  describe('Helper Actions', () => {
    describe('loadResumeForEdit', () => {
      it('should load general resume for editing', () => {
        const resume: ResumeEntry = {
          type: 'general',
          resumeVersion: {
            url: 'https://example.com/resume.pdf',
            notes: 'My general resume',
            editHistory: [],
          },
        };

        const { loadResumeForEdit } = useApplicationMaterialsStore.getState();

        loadResumeForEdit(resume);

        const { editingResumeType, resumeFormData, selectedResumeType } =
          useApplicationMaterialsStore.getState();
        expect(editingResumeType).toBe('general');
        expect(resumeFormData.type).toBe('general');
        expect(resumeFormData.url).toBe('https://example.com/resume.pdf');
        expect(resumeFormData.notes).toBe('My general resume');
        expect(selectedResumeType).toBe('general');
      });

      it('should load product-management resume for editing', () => {
        const resume: ResumeEntry = {
          type: 'product-management',
          resumeVersion: {
            url: 'https://example.com/pm-resume.pdf',
            notes: 'PM resume',
            editHistory: [],
          },
        };

        const { loadResumeForEdit } = useApplicationMaterialsStore.getState();

        loadResumeForEdit(resume);

        const { selectedResumeType, resumeFormData } =
          useApplicationMaterialsStore.getState();
        expect(selectedResumeType).toBe('product-management');
        expect(resumeFormData.type).toBe('product-management');
      });

      it('should load business-development resume for editing', () => {
        const resume: ResumeEntry = {
          type: 'business-development',
          resumeVersion: {
            url: 'https://example.com/bd-resume.pdf',
            notes: 'BD resume',
            editHistory: [],
          },
        };

        const { loadResumeForEdit } = useApplicationMaterialsStore.getState();

        loadResumeForEdit(resume);

        const { selectedResumeType, resumeFormData } =
          useApplicationMaterialsStore.getState();
        expect(selectedResumeType).toBe('business-development');
        expect(resumeFormData.type).toBe('business-development');
      });

      it('should load custom resume type for editing', () => {
        const resume: ResumeEntry = {
          type: 'my-custom-type',
          resumeVersion: {
            url: 'https://example.com/custom-resume.pdf',
            notes: 'Custom resume',
            editHistory: [],
          },
        };

        const { loadResumeForEdit } = useApplicationMaterialsStore.getState();

        loadResumeForEdit(resume);

        const { selectedResumeType, customResumeTypeName, resumeFormData } =
          useApplicationMaterialsStore.getState();
        expect(selectedResumeType).toBe('custom');
        expect(customResumeTypeName).toBe('my-custom-type');
        expect(resumeFormData.type).toBe('my-custom-type');
      });

      it('should handle resume with no notes', () => {
        const resume: ResumeEntry = {
          type: 'general',
          resumeVersion: {
            url: 'https://example.com/resume.pdf',
            editHistory: [],
          },
        };

        const { loadResumeForEdit } = useApplicationMaterialsStore.getState();

        loadResumeForEdit(resume);

        const { resumeFormData } = useApplicationMaterialsStore.getState();
        expect(resumeFormData.notes).toBe('');
      });

      it('should set isDirty to false when loading for edit', () => {
        const resume: ResumeEntry = {
          type: 'general',
          resumeVersion: {
            url: 'https://example.com/resume.pdf',
            notes: 'Notes',
            editHistory: [],
          },
        };

        const { setIsDirty, loadResumeForEdit } =
          useApplicationMaterialsStore.getState();

        setIsDirty(true);
        loadResumeForEdit(resume);

        expect(useApplicationMaterialsStore.getState().isDirty).toBe(false);
      });
    });

    describe('loadLinkedInForEdit', () => {
      it('should load LinkedIn profile for editing', () => {
        const profile: LinkedInProfile = {
          url: 'https://linkedin.com/in/user',
          notes: 'My LinkedIn profile',
          editHistory: [],
        };

        const { loadLinkedInForEdit } = useApplicationMaterialsStore.getState();

        loadLinkedInForEdit(profile);

        const { linkedInFormData } = useApplicationMaterialsStore.getState();
        expect(linkedInFormData.url).toBe('https://linkedin.com/in/user');
        expect(linkedInFormData.notes).toBe('My LinkedIn profile');
      });

      it('should handle LinkedIn profile with no notes', () => {
        const profile: LinkedInProfile = {
          url: 'https://linkedin.com/in/user',
          editHistory: [],
        };

        const { loadLinkedInForEdit } = useApplicationMaterialsStore.getState();

        loadLinkedInForEdit(profile);

        const { linkedInFormData } = useApplicationMaterialsStore.getState();
        expect(linkedInFormData.url).toBe('https://linkedin.com/in/user');
        expect(linkedInFormData.notes).toBe('');
      });

      it('should set isDirty to false when loading for edit', () => {
        const profile: LinkedInProfile = {
          url: 'https://linkedin.com/in/user',
          notes: 'Notes',
          editHistory: [],
        };

        const { setIsDirty, loadLinkedInForEdit } =
          useApplicationMaterialsStore.getState();

        setIsDirty(true);
        loadLinkedInForEdit(profile);

        expect(useApplicationMaterialsStore.getState().isDirty).toBe(false);
      });
    });
  });

  describe('Complex Workflows', () => {
    it('should handle complete resume creation workflow', () => {
      const {
        setIsOpen,
        setActiveTab,
        setSelectedResumeType,
        setResumeFormData,
        resetForm,
      } = useApplicationMaterialsStore.getState();

      // Open modal
      setIsOpen(true);
      expect(useApplicationMaterialsStore.getState().isOpen).toBe(true);

      // Select resume tab (already default)
      setActiveTab('resume');

      // Select resume type
      setSelectedResumeType('product-management');

      // Fill form
      setResumeFormData({
        url: 'https://example.com/pm-resume.pdf',
        notes: 'Product management focused resume',
      });

      // Verify state
      const state = useApplicationMaterialsStore.getState();
      expect(state.resumeFormData.type).toBe('product-management');
      expect(state.resumeFormData.url).toBe(
        'https://example.com/pm-resume.pdf'
      );
      expect(state.isDirty).toBe(true);

      // Reset form after save
      resetForm();
      expect(useApplicationMaterialsStore.getState().resumeFormData.url).toBe(
        ''
      );
      expect(useApplicationMaterialsStore.getState().isDirty).toBe(false);
    });

    it('should handle resume edit workflow', () => {
      const { loadResumeForEdit, setResumeFormData } =
        useApplicationMaterialsStore.getState();

      const existingResume: ResumeEntry = {
        type: 'general',
        resumeVersion: {
          url: 'https://example.com/old-resume.pdf',
          notes: 'Old notes',
          editHistory: [],
        },
      };

      // Load for editing
      loadResumeForEdit(existingResume);

      // Verify loaded
      let state = useApplicationMaterialsStore.getState();
      expect(state.editingResumeType).toBe('general');
      expect(state.resumeFormData.url).toBe(
        'https://example.com/old-resume.pdf'
      );
      expect(state.isDirty).toBe(false);

      // Update
      setResumeFormData({ url: 'https://example.com/new-resume.pdf' });

      state = useApplicationMaterialsStore.getState();
      expect(state.resumeFormData.url).toBe(
        'https://example.com/new-resume.pdf'
      );
      expect(state.isDirty).toBe(true);
    });

    it('should handle custom resume type workflow', () => {
      const {
        setSelectedResumeType,
        setCustomResumeTypeName,
        setResumeFormData,
      } = useApplicationMaterialsStore.getState();

      // Select custom type
      setSelectedResumeType('custom');
      expect(useApplicationMaterialsStore.getState().selectedResumeType).toBe(
        'custom'
      );

      // Set custom name
      setCustomResumeTypeName('sales-engineer');

      // Verify type is updated in form
      let state = useApplicationMaterialsStore.getState();
      expect(state.resumeFormData.type).toBe('sales-engineer');
      expect(state.customResumeTypeName).toBe('sales-engineer');

      // Fill rest of form
      setResumeFormData({
        url: 'https://example.com/sales-resume.pdf',
        notes: 'Sales engineering focused',
      });

      state = useApplicationMaterialsStore.getState();
      expect(state.resumeFormData.type).toBe('sales-engineer');
      expect(state.resumeFormData.url).toBe(
        'https://example.com/sales-resume.pdf'
      );
    });

    it('should handle form validation workflow', () => {
      const { setResumeFormData, setFormError, clearFormErrors } =
        useApplicationMaterialsStore.getState();

      // Fill form with invalid data
      setResumeFormData({ url: 'invalid-url' });

      // Set validation error
      setFormError('resumeUrl', 'Invalid URL format');

      let state = useApplicationMaterialsStore.getState();
      expect(state.formErrors.resumeUrl).toBe('Invalid URL format');

      // Correct the data
      setResumeFormData({ url: 'https://example.com/resume.pdf' });

      // Clear error
      setFormError('resumeUrl', undefined);

      state = useApplicationMaterialsStore.getState();
      expect(state.formErrors.resumeUrl).toBeUndefined();

      // Clear all errors
      setFormError('resumeType', 'Type required');
      setFormError('resumeNotes', 'Notes required');

      clearFormErrors();

      state = useApplicationMaterialsStore.getState();
      expect(state.formErrors).toEqual({});
    });

    it('should handle LinkedIn creation workflow', () => {
      const { setActiveTab, setLinkedInFormData, setIsLinkedInHelpOpen } =
        useApplicationMaterialsStore.getState();

      // Switch to LinkedIn tab
      setActiveTab('linkedIn');
      expect(useApplicationMaterialsStore.getState().activeTab).toBe(
        'linkedIn'
      );

      // Open help modal
      setIsLinkedInHelpOpen(true);
      expect(useApplicationMaterialsStore.getState().isLinkedInHelpOpen).toBe(
        true
      );

      // Close help
      setIsLinkedInHelpOpen(false);

      // Fill form
      setLinkedInFormData({
        url: 'https://linkedin.com/in/johndoe',
        notes: 'Updated profile for job search',
      });

      const state = useApplicationMaterialsStore.getState();
      expect(state.linkedInFormData.url).toBe(
        'https://linkedin.com/in/johndoe'
      );
      expect(state.linkedInFormData.notes).toBe(
        'Updated profile for job search'
      );
      expect(state.isDirty).toBe(true);
    });
  });
});
