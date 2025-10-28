/**
 * Application Materials Modal
 *
 * Modal component for managing resume versions and LinkedIn profile
 * Phase 1: URL-only tracking
 */

import { Button, Input, Label, Textarea } from '@journey/components';
import {
  ApplicationMaterials,
  LINKEDIN_TYPE,
  ResumeEntry,
} from '@journey/schema';
import { X } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import {
  FileDropZoneContainer,
  QuotaDisplay,
} from '../../../../../components/file-upload';
import {
  useApplicationMaterials,
  useUpdateApplicationMaterials,
} from '../../../../../hooks/use-application-materials';
import { UploadedFileInfo } from '../../../../../hooks/use-file-upload';
import { useCurrentUser } from '../../../../../hooks/useAuth';
import { useApplicationMaterialsStore } from '../../../../../stores/application-materials-store';
import {
  handleAPIError,
  showSuccessToast,
} from '../../../../../utils/error-toast';

const UPLOAD_MODE = {
  URL: 'url',
  UPLOAD: 'upload',
} as const;

type UploadMode = (typeof UPLOAD_MODE)[keyof typeof UPLOAD_MODE];

const TAB = {
  RESUME: 'resume',
  LINKEDIN: 'linkedIn',
} as const;
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
  const [uploadMode, setUploadMode] = useState<UploadMode>(UPLOAD_MODE.URL);
  const [uploadedFileInfo, setUploadedFileInfo] =
    useState<UploadedFileInfo | null>(null);

  // Helper to find LinkedIn entry in items array
  const linkedInEntry = existingMaterials?.items?.find(
    (item) => item.type === LINKEDIN_TYPE
  );

  // Helper to get non-LinkedIn resumes
  const resumeItems =
    existingMaterials?.items?.filter((item) => item.type !== LINKEDIN_TYPE) ||
    [];

  // Load existing data and set initial tab when modal opens
  useEffect(() => {
    if (isOpen && existingMaterials) {
      // Load existing LinkedIn if available
      if (linkedInEntry) {
        setLinkedInFormData({
          url: linkedInEntry.resumeVersion.url,
          notes: linkedInEntry.resumeVersion.notes || '',
        });
      }

      // Set initial tab based on what data exists
      if (resumeItems.length > 0) {
        setActiveTab(TAB.RESUME); // Show resume tab if resumes exist
      } else if (linkedInEntry) {
        setActiveTab(TAB.LINKEDIN); // Show LinkedIn tab if only LinkedIn exists
      } else {
        setActiveTab(TAB.RESUME); // Default to resume tab
      }

      // Mark form as clean after loading data
      setIsDirty(false);
    }
  }, [
    isOpen,
    existingMaterials,
    linkedInEntry,
    resumeItems.length,
    setLinkedInFormData,
    setActiveTab,
    setIsDirty,
  ]);

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

  const handleFileUploadComplete = (file: UploadedFileInfo) => {
    setUploadedFileInfo(file);
    // The download URL is already included in the file info from the hook
    if (file.downloadUrl) {
      setResumeFormData({ url: file.downloadUrl });
    }
  };

  const handleFileUploadError = (error: string) => {
    handleAPIError(new Error(error), 'File upload failed');
  };

  const handleSave = async () => {
    clearFormErrors();
    setIsSaving(true);

    try {
      // Start with existing items or empty array
      const updatedItems: ResumeEntry[] = [...(existingMaterials?.items || [])];

      // Update resume if on resume tab and form has data
      if (activeTab === TAB.RESUME && resumeFormData.url.trim()) {
        if (
          uploadMode === UPLOAD_MODE.URL &&
          !validateResumeUrl(resumeFormData.url)
        ) {
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

        // Check for duplicate resume type (excluding LinkedIn)
        const existingIndex = updatedItems.findIndex(
          (r) =>
            r.type !== LINKEDIN_TYPE &&
            r.type.toLowerCase() === resumeType.toLowerCase()
        );

        const newResumeEntry: ResumeEntry = {
          type: resumeType,
          resumeVersion: {
            url: resumeFormData.url,
            lastUpdated: new Date().toISOString(),
            notes: resumeFormData.notes || undefined,
            // Add file metadata if uploaded via file upload
            ...(uploadedFileInfo && {
              storageKey: uploadedFileInfo.storageKey,
              filename: uploadedFileInfo.filename,
              mimeType: uploadedFileInfo.mimeType,
              sizeBytes: uploadedFileInfo.sizeBytes,
            }),
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
          const existing = updatedItems[existingIndex];
          // Filter out invalid editHistory entries (editedBy should be a numeric user ID)
          const validHistory = existing.resumeVersion.editHistory.filter(
            (entry) => entry.editedBy && /^\d+$/.test(entry.editedBy)
          );
          newResumeEntry.resumeVersion.editHistory = [
            ...validHistory,
            ...newResumeEntry.resumeVersion.editHistory,
          ];
          updatedItems[existingIndex] = newResumeEntry;
        } else {
          // Add new resume
          updatedItems.push(newResumeEntry);
        }
      }

      // Update LinkedIn if on LinkedIn tab and form has data
      if (activeTab === TAB.LINKEDIN && linkedInFormData.url.trim()) {
        if (!validateLinkedInUrl(linkedInFormData.url)) {
          setIsSaving(false);
          return;
        }

        // Find existing LinkedIn entry index
        const linkedInIndex = updatedItems.findIndex(
          (item) => item.type === LINKEDIN_TYPE
        );

        const existingHistory = linkedInEntry?.resumeVersion.editHistory || [];
        // Filter out invalid editHistory entries (editedBy should be a numeric user ID)
        const validHistory = existingHistory.filter(
          (entry) => entry.editedBy && /^\d+$/.test(entry.editedBy)
        );

        const newLinkedInEntry: ResumeEntry = {
          type: LINKEDIN_TYPE,
          resumeVersion: {
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
          },
        };

        if (linkedInIndex >= 0) {
          // Update existing LinkedIn entry
          updatedItems[linkedInIndex] = newLinkedInEntry;
        } else {
          // Add new LinkedIn entry
          updatedItems.push(newLinkedInEntry);
        }
      }

      // Build final materials object
      const updatedMaterials: ApplicationMaterials = {
        items: updatedItems,
        summary: existingMaterials?.summary,
      };

      // Save to backend
      await updateMaterialsMutation.mutateAsync(updatedMaterials);

      showSuccessToast('Application materials saved successfully');
      resetForm();
      setIsDirty(false);
      setUploadedFileInfo(null);
      setUploadMode(UPLOAD_MODE.URL);
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
            onClick={() => setActiveTab(TAB.RESUME)}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
              activeTab === TAB.RESUME
                ? 'border-b-2 border-teal-600 text-teal-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Resume
          </button>
          <button
            onClick={() => setActiveTab(TAB.LINKEDIN)}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
              activeTab === TAB.LINKEDIN
                ? 'border-b-2 border-teal-600 text-teal-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            LinkedIn Profile
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-12 py-8">
          {activeTab === TAB.RESUME && (
            <div className="space-y-6">
              {/* Storage Quota */}
              <QuotaDisplay />

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

              {/* Show existing resume if there's one for the selected type */}
              {(() => {
                const existingResume = resumeItems.find(
                  (r) =>
                    r.type.toLowerCase() ===
                    (selectedResumeType === 'custom'
                      ? customResumeTypeName
                      : selectedResumeType
                    ).toLowerCase()
                );
                return (
                  existingResume &&
                  existingResume.resumeVersion.url && (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-gray-700">
                          Current {existingResume.type} resume
                        </p>
                        {existingResume.resumeVersion.filename ? (
                          <div className="flex items-center gap-2">
                            <p className="text-sm text-gray-600">
                              File: {existingResume.resumeVersion.filename}
                            </p>
                            {existingResume.resumeVersion.sizeBytes && (
                              <p className="text-xs text-gray-500">
                                (
                                {Math.round(
                                  existingResume.resumeVersion.sizeBytes / 1024
                                )}{' '}
                                KB)
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="break-all text-sm text-gray-600">
                            URL: {existingResume.resumeVersion.url}
                          </p>
                        )}
                        <a
                          href={existingResume.resumeVersion.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-sm text-teal-600 hover:text-teal-700"
                        >
                          View current resume →
                        </a>
                      </div>
                    </div>
                  )
                );
              })()}

              {/* Upload Mode Toggle */}
              <div>
                <Label className="mb-2">Upload Method</Label>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setUploadMode(UPLOAD_MODE.URL)}
                    className={`flex-1 rounded-md border-2 px-4 py-3 text-sm font-medium transition-colors ${
                      uploadMode === UPLOAD_MODE.URL
                        ? 'border-teal-600 bg-teal-50 text-teal-700'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    External URL
                  </button>
                  <button
                    type="button"
                    onClick={() => setUploadMode(UPLOAD_MODE.UPLOAD)}
                    className={`flex-1 rounded-md border-2 px-4 py-3 text-sm font-medium transition-colors ${
                      uploadMode === UPLOAD_MODE.UPLOAD
                        ? 'border-teal-600 bg-teal-50 text-teal-700'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Upload File
                  </button>
                </div>
              </div>

              {/* URL Input Mode */}
              {uploadMode === UPLOAD_MODE.URL && (
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
              )}

              {/* File Upload Mode */}
              {uploadMode === UPLOAD_MODE.UPLOAD && (
                <div>
                  <Label className="mb-2">Upload Resume File</Label>
                  <FileDropZoneContainer
                    onUploadComplete={handleFileUploadComplete}
                    onError={handleFileUploadError}
                  />
                </div>
              )}

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

          {activeTab === TAB.LINKEDIN && (
            <div className="space-y-6">
              {/* Show existing LinkedIn profile if available */}
              {linkedInEntry && linkedInEntry.resumeVersion.url && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700">
                      Current LinkedIn profile
                    </p>
                    <p className="break-all text-sm text-gray-600">
                      {linkedInEntry.resumeVersion.url}
                    </p>
                    <a
                      href={linkedInEntry.resumeVersion.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-sm text-teal-600 hover:text-teal-700"
                    >
                      View current profile →
                    </a>
                  </div>
                </div>
              )}

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
