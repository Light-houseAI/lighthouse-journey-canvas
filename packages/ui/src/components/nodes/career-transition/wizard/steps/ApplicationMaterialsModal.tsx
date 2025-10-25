/**
 * Application Materials Modal
 *
 * Modal component for managing resume versions and LinkedIn profile
 * Phase 1: URL-only tracking
 */

import { Button, Input, Label, Textarea } from '@journey/components';
import { ApplicationMaterials, ResumeEntry } from '@journey/schema';
import { X } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import {
  useApplicationMaterials,
  useUpdateApplicationMaterials,
} from '../../../../../hooks/use-application-materials';
import { useCurrentUser } from '../../../../../hooks/useAuth';
import { useApplicationMaterialsStore } from '../../../../../stores/application-materials-store';
import {
  handleAPIError,
  showSuccessToast,
} from '../../../../../utils/error-toast';

export interface ApplicationMaterialsModalProps {
  careerTransitionId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ApplicationMaterialsModal: React.FC<
  ApplicationMaterialsModalProps
> = ({ careerTransitionId, isOpen, onClose, onSuccess }) => {
  const {
    activeTab,
    setActiveTab,
    resumeFormData,
    setResumeFormData,
    linkedInFormData,
    setLinkedInFormData,
    selectedResumeType,
    setSelectedResumeType,
    customResumeTypeName,
    setCustomResumeTypeName,
    formErrors,
    setFormError,
    clearFormErrors,
    isDirty,
    setIsDirty,
    resetForm,
  } = useApplicationMaterialsStore();

  const { data: existingMaterials } =
    useApplicationMaterials(careerTransitionId);
  const updateMaterialsMutation =
    useUpdateApplicationMaterials(careerTransitionId);
  const { data: currentUser } = useCurrentUser();

  const [isSaving, setIsSaving] = useState(false);

  // Load existing data when modal opens
  useEffect(() => {
    if (isOpen && existingMaterials) {
      // Load existing LinkedIn if available
      if (existingMaterials.linkedInProfile) {
        setLinkedInFormData({
          url: existingMaterials.linkedInProfile.url,
          notes: existingMaterials.linkedInProfile.notes || '',
        });
      }
      // Mark form as clean after loading data
      setIsDirty(false);
    }
  }, [isOpen, existingMaterials, setLinkedInFormData, setIsDirty]);

  // Validation helpers
  const validateResumeUrl = (url: string): boolean => {
    if (!url.trim()) {
      setFormError('resumeUrl', 'Resume URL is required');
      return false;
    }
    try {
      new URL(url);
      setFormError('resumeUrl', undefined);
      return true;
    } catch {
      setFormError('resumeUrl', 'Please enter a valid URL');
      return false;
    }
  };

  const validateLinkedInUrl = (url: string): boolean => {
    if (!url.trim()) {
      setFormError('linkedInUrl', 'LinkedIn URL is required');
      return false;
    }
    try {
      const parsed = new URL(url);
      if (!parsed.hostname.includes('linkedin.com')) {
        setFormError('linkedInUrl', 'Must be a LinkedIn profile URL');
        return false;
      }
      if (!parsed.pathname.includes('/in/')) {
        setFormError(
          'linkedInUrl',
          'Must be a LinkedIn profile URL (linkedin.com/in/username)'
        );
        return false;
      }
      setFormError('linkedInUrl', undefined);
      return true;
    } catch {
      setFormError('linkedInUrl', 'Please enter a valid URL');
      return false;
    }
  };

  const handleSave = async () => {
    clearFormErrors();
    setIsSaving(true);

    try {
      // Build updated materials
      const updatedMaterials: ApplicationMaterials = {
        resumes: {
          items: existingMaterials?.resumes?.items || [],
          summary: existingMaterials?.resumes?.summary,
        },
        linkedInProfile: existingMaterials?.linkedInProfile,
      };

      // Update resume if on resume tab and form has data
      if (activeTab === 'resume' && resumeFormData.url.trim()) {
        if (!validateResumeUrl(resumeFormData.url)) {
          setIsSaving(false);
          return;
        }

        const resumeType =
          selectedResumeType === 'custom'
            ? customResumeTypeName
            : selectedResumeType;
        if (!resumeType.trim()) {
          setFormError('resumeType', 'Please enter a custom resume type name');
          setIsSaving(false);
          return;
        }

        // Check for duplicate resume type
        const existingIndex = updatedMaterials.resumes.items.findIndex(
          (r) => r.type.toLowerCase() === resumeType.toLowerCase()
        );

        const newResumeEntry: ResumeEntry = {
          type: resumeType,
          resumeVersion: {
            url: resumeFormData.url,
            lastUpdated: new Date().toISOString(),
            notes: resumeFormData.notes || undefined,
            editHistory: [
              {
                editedAt: new Date().toISOString(),
                notes: resumeFormData.notes || 'Initial upload',
                editedBy: currentUser?.id ? String(currentUser.id) : '',
              },
            ],
          },
        };

        if (existingIndex >= 0) {
          // Update existing resume
          const existing = updatedMaterials.resumes.items[existingIndex];
          // Filter out invalid editHistory entries (editedBy should be a numeric user ID)
          const validHistory = existing.resumeVersion.editHistory.filter(
            (entry) => entry.editedBy && /^\d+$/.test(entry.editedBy)
          );
          newResumeEntry.resumeVersion.editHistory = [
            ...validHistory,
            ...newResumeEntry.resumeVersion.editHistory,
          ];
          updatedMaterials.resumes.items[existingIndex] = newResumeEntry;
        } else {
          // Add new resume
          updatedMaterials.resumes.items.push(newResumeEntry);
        }
      }

      // Update LinkedIn if on LinkedIn tab and form has data
      if (activeTab === 'linkedIn' && linkedInFormData.url.trim()) {
        if (!validateLinkedInUrl(linkedInFormData.url)) {
          setIsSaving(false);
          return;
        }

        const existingHistory =
          existingMaterials?.linkedInProfile?.editHistory || [];
        // Filter out invalid editHistory entries (editedBy should be a numeric user ID)
        const validHistory = existingHistory.filter(
          (entry) => entry.editedBy && /^\d+$/.test(entry.editedBy)
        );
        updatedMaterials.linkedInProfile = {
          url: linkedInFormData.url,
          lastUpdated: new Date().toISOString(),
          notes: linkedInFormData.notes || undefined,
          editHistory: [
            ...validHistory,
            {
              editedAt: new Date().toISOString(),
              notes: linkedInFormData.notes || 'Profile updated',
              editedBy: currentUser?.id ? String(currentUser.id) : '',
            },
          ],
        };
      }

      // Save to backend
      await updateMaterialsMutation.mutateAsync(updatedMaterials);

      showSuccessToast('Application materials saved successfully');
      resetForm();
      setIsDirty(false);
      onSuccess?.();
      onClose();
    } catch (error) {
      handleAPIError(error, 'Failed to save application materials');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (isDirty) {
      if (
        !confirm('You have unsaved changes. Are you sure you want to close?')
      ) {
        return;
      }
    }
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="flex h-[90vh] w-[90vw] max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="relative flex h-16 items-center justify-center border-b border-gray-200 px-8">
          <Button
            onClick={handleClose}
            variant="ghost"
            className="absolute left-6 gap-2 text-sm"
            type="button"
          >
            <X className="h-4 w-4" />
            <span>Close</span>
          </Button>
          <h2 className="text-base font-semibold text-gray-900">
            Application Materials
          </h2>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('resume')}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
              activeTab === 'resume'
                ? 'border-b-2 border-teal-600 text-teal-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Resume
          </button>
          <button
            onClick={() => setActiveTab('linkedIn')}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
              activeTab === 'linkedIn'
                ? 'border-b-2 border-teal-600 text-teal-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            LinkedIn Profile
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-12 py-8">
          {activeTab === 'resume' && (
            <div className="space-y-6">
              <div>
                <Label htmlFor="resumeType" className="mb-2">
                  Resume Type
                </Label>
                <select
                  id="resumeType"
                  value={selectedResumeType}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    setSelectedResumeType(e.target.value as any)
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                >
                  <option value="general">General</option>
                  <option value="product-management">Product Management</option>
                  <option value="business-development">
                    Business Development
                  </option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              {selectedResumeType === 'custom' && (
                <div>
                  <Label htmlFor="customType" className="mb-2">
                    Custom Resume Type Name
                  </Label>
                  <Input
                    id="customType"
                    value={customResumeTypeName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setCustomResumeTypeName(e.target.value)
                    }
                    placeholder="e.g., Data Science, Executive"
                    maxLength={50}
                  />
                  {formErrors.resumeType && (
                    <p className="mt-1 text-sm text-red-600">
                      {formErrors.resumeType}
                    </p>
                  )}
                </div>
              )}

              <div>
                <Label htmlFor="resumeUrl" className="mb-2">
                  Resume URL *
                </Label>
                <Input
                  id="resumeUrl"
                  type="url"
                  value={resumeFormData.url}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setResumeFormData({ url: e.target.value })
                  }
                  placeholder="https://example.com/my-resume.pdf"
                />
                {formErrors.resumeUrl && (
                  <p className="mt-1 text-sm text-red-600">
                    {formErrors.resumeUrl}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="resumeNotes" className="mb-2">
                  Notes (optional)
                </Label>
                <Textarea
                  id="resumeNotes"
                  value={resumeFormData.notes}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setResumeFormData({ notes: e.target.value })
                  }
                  placeholder="Describe what changed in this version..."
                  maxLength={500}
                  className="min-h-[100px]"
                />
                <p className="mt-1 text-sm text-gray-500">
                  {resumeFormData.notes.length}/500 characters
                </p>
              </div>
            </div>
          )}

          {activeTab === 'linkedIn' && (
            <div className="space-y-6">
              <div>
                <Label htmlFor="linkedInUrl" className="mb-2">
                  LinkedIn Profile URL *
                </Label>
                <Input
                  id="linkedInUrl"
                  type="url"
                  value={linkedInFormData.url}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setLinkedInFormData({ url: e.target.value })
                  }
                  placeholder="https://linkedin.com/in/your-profile"
                />
                {formErrors.linkedInUrl && (
                  <p className="mt-1 text-sm text-red-600">
                    {formErrors.linkedInUrl}
                  </p>
                )}
                <p className="mt-2 text-sm text-gray-600">
                  Enter your LinkedIn profile URL (e.g.,
                  linkedin.com/in/username)
                </p>
              </div>

              <div>
                <Label htmlFor="linkedInNotes" className="mb-2">
                  Notes (optional)
                </Label>
                <Textarea
                  id="linkedInNotes"
                  value={linkedInFormData.notes}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setLinkedInFormData({ notes: e.target.value })
                  }
                  placeholder="Describe what you updated on your profile..."
                  maxLength={500}
                  className="min-h-[100px]"
                />
                <p className="mt-1 text-sm text-gray-500">
                  {linkedInFormData.notes.length}/500 characters
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-12 py-6">
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={handleClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-teal-700 hover:bg-teal-800"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
