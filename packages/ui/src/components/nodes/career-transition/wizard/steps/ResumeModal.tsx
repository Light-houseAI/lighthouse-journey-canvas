/**
 * Resume Modal Component
 *
 * Modal for adding/editing a single resume entry
 * Features radio button group for resume type selection
 */

import { Button, Input, Label, TabsGroup, Textarea } from '@journey/components';
import { LINKEDIN_TYPE, ResumeEntry } from '@journey/schema';
import { FileText, X } from 'lucide-react';
import React, { useState } from 'react';

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
import { httpClient } from '../../../../../services/http-client';
import {
  handleAPIError,
  showSuccessToast,
} from '../../../../../utils/error-toast';
import { ResumeTypeSelector } from './ResumeTypeSelector';

const UPLOAD_MODE = {
  URL: 'url',
  UPLOAD: 'upload',
} as const;

type UploadMode = (typeof UPLOAD_MODE)[keyof typeof UPLOAD_MODE];

export interface ResumeModalProps {
  careerTransitionId: string;
  resume?: ResumeEntry; // If editing
  resumeItems: ResumeEntry[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

// Helper to derive initial values from resume prop
function getInitialValues(resume?: ResumeEntry) {
  if (resume) {
    return {
      selectedType: resume.type,
      url: resume.type === LINKEDIN_TYPE ? resume.resumeVersion.url : '',
      notes: '',
      uploadMode: UPLOAD_MODE.URL as UploadMode,
    };
  }
  return {
    selectedType: '',
    url: '',
    notes: '',
    uploadMode: UPLOAD_MODE.UPLOAD as UploadMode,
  };
}

const ResumeModalContent: React.FC<
  ResumeModalProps & { initialValues: ReturnType<typeof getInitialValues> }
> = ({
  careerTransitionId,
  resume,
  resumeItems,
  onClose,
  onSuccess,
  initialValues,
}) => {
  const [selectedType, setSelectedType] = useState<string>(
    initialValues.selectedType
  );
  const [url, setUrl] = useState(initialValues.url);
  const [notes, setNotes] = useState(initialValues.notes);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isSaving, setIsSaving] = useState(false);
  const [uploadMode, setUploadMode] = useState<UploadMode>(
    initialValues.uploadMode
  );
  const [uploadedFileInfo, setUploadedFileInfo] =
    useState<UploadedFileInfo | null>(null);

  const { data: materials } = useApplicationMaterials(careerTransitionId);
  const updateMaterialsMutation =
    useUpdateApplicationMaterials(careerTransitionId);
  const { data: currentUser } = useCurrentUser();

  // Get existing resume types from resumeItems (excluding the one being edited)
  const existingTypes = resumeItems
    .filter((r) => !resume || r.type !== resume.type)
    .map((r) => r.type);

  const handleFileUploadComplete = (file: UploadedFileInfo) => {
    setUploadedFileInfo(file);
    // The download URL is already included in the file info from the hook
    if (file.downloadUrl) {
      setUrl(file.downloadUrl);
    }
  };

  const handleFileUploadError = (error: string) => {
    handleAPIError(new Error(error), 'File upload failed');
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    // Validate resume type
    if (!selectedType.trim()) {
      newErrors.type = 'Resume type is required';
    }

    // Validate URL or file upload (must be one, not both, not neither)
    const hasUrl = url.trim().length > 0;
    const hasFile = uploadedFileInfo !== null;

    // When a file is uploaded, the hook sets the URL automatically to the download URL
    // So we should treat this as "file mode" not "both"
    // Only error if user manually entered a URL AND uploaded a file (not auto-set URL)
    const urlIsFromUpload = hasFile && uploadedFileInfo?.downloadUrl === url;

    if (!hasUrl && !hasFile) {
      // No URL and no file - require one based on current mode
      if (uploadMode === UPLOAD_MODE.URL) {
        newErrors.url = 'Resume URL is required';
      } else {
        newErrors.upload = 'Please upload a file';
      }
    } else if (hasUrl && hasFile && !urlIsFromUpload) {
      // User manually entered URL AND uploaded file (not the auto-set download URL)
      newErrors.upload = 'Please use either URL or file upload, not both';
    } else if (uploadMode === UPLOAD_MODE.URL && hasUrl && !urlIsFromUpload) {
      // Validate URL format (only if it's not from file upload)
      try {
        new URL(url);
      } catch {
        newErrors.url = 'Please enter a valid URL';
      }
    }

    // Validate notes (mandatory)
    if (!notes.trim()) {
      newErrors.notes = 'Notes are required';
    }

    // Check for duplicate type (only when adding new, not editing)
    if (!resume && selectedType.trim()) {
      const existingTypesLower = existingTypes.map((t) => t.toLowerCase());
      if (existingTypesLower.includes(selectedType.toLowerCase())) {
        newErrors.type =
          'A resume of this type already exists. Please edit the existing one or choose a different name.';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSaving(true);

    try {
      // Get all existing items (including LinkedIn if it exists)
      const allItems = materials?.items || [];

      // Build resume version based on upload mode
      const baseResumeVersion = {
        url,
        lastUpdated: new Date().toISOString(),
        notes,
        editHistory: [
          {
            editedAt: new Date().toISOString(),
            notes,
            editedBy: currentUser?.id ? String(currentUser.id) : '',
          },
        ],
      };

      // Add file metadata only if file was uploaded, otherwise ensure it's cleared
      const resumeVersion =
        uploadMode === UPLOAD_MODE.UPLOAD && uploadedFileInfo
          ? {
              ...baseResumeVersion,
              storageKey: uploadedFileInfo.storageKey,
              filename: uploadedFileInfo.filename,
              mimeType: uploadedFileInfo.mimeType,
              sizeBytes: uploadedFileInfo.sizeBytes,
            }
          : {
              ...baseResumeVersion,
              // Explicitly set to undefined to clear old file metadata when switching to URL mode
              storageKey: undefined,
              filename: undefined,
              mimeType: undefined,
              sizeBytes: undefined,
            };

      const newResumeEntry: ResumeEntry = {
        type: selectedType.trim(),
        resumeVersion,
      };

      let updatedItems: ResumeEntry[];

      // Track old file to delete if replacing with new file or switching to URL
      let oldStorageKeyToDelete: string | null = null;

      if (resume) {
        // Editing existing resume - preserve edit history
        const existingIndex = allItems.findIndex(
          (r) => r.type.toLowerCase() === resume.type.toLowerCase()
        );

        if (existingIndex >= 0) {
          const existing = allItems[existingIndex];

          // Check if we need to delete the old file
          // Delete old file if:
          // 1. Switching from file upload to URL (uploadMode is URL and old entry had storageKey)
          // 2. Replacing with a new file (uploadMode is UPLOAD and both old and new have different storageKeys)
          if (existing.resumeVersion.storageKey) {
            if (uploadMode === UPLOAD_MODE.URL) {
              // Switching to URL mode - delete old file
              oldStorageKeyToDelete = existing.resumeVersion.storageKey;
            } else if (
              uploadMode === UPLOAD_MODE.UPLOAD &&
              uploadedFileInfo &&
              existing.resumeVersion.storageKey !== uploadedFileInfo.storageKey
            ) {
              // Replacing with new file - delete old file
              oldStorageKeyToDelete = existing.resumeVersion.storageKey;
            }
          }

          // Filter out invalid editHistory entries (editedBy should be a numeric user ID)
          const validHistory = existing.resumeVersion.editHistory.filter(
            (entry) => entry.editedBy && /^\d+$/.test(entry.editedBy)
          );
          newResumeEntry.resumeVersion.editHistory = [
            ...validHistory,
            ...newResumeEntry.resumeVersion.editHistory,
          ];
          updatedItems = allItems.map((item, idx) =>
            idx === existingIndex ? newResumeEntry : item
          );
        } else {
          updatedItems = allItems;
        }
      } else {
        // Adding new resume
        updatedItems = [...allItems, newResumeEntry];
      }

      // Delete old file from storage if needed
      if (oldStorageKeyToDelete) {
        try {
          await httpClient.delete(
            `/api/v2/files/${encodeURIComponent(oldStorageKeyToDelete)}`
          );
        } catch (error) {
          // Log error but don't fail the save operation
          console.error('Failed to delete old file:', error);
        }
      }

      await updateMaterialsMutation.mutateAsync({ items: updatedItems });

      showSuccessToast(
        resume ? 'Resume updated successfully' : 'Resume added successfully'
      );
      onSuccess?.();
      onClose();
    } catch (error) {
      handleAPIError(error, 'Failed to save resume');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    const hasChanges =
      url.trim() || notes.trim() || selectedType.trim() || uploadedFileInfo;

    if (hasChanges) {
      if (
        !window.confirm(
          'You have unsaved changes. Are you sure you want to close?'
        )
      ) {
        return;
      }
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="flex h-[90vh] w-[90vw] max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="relative border-b border-gray-200 px-6 py-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-gray-200 bg-white">
              <FileText className="h-6 w-6 text-gray-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900">
                {resume ? 'Edit Resume' : 'Add new resume'}
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Track a new resume type that may be useful for different jobs or
                industries.
              </p>
            </div>
            <Button
              onClick={handleClose}
              variant="ghost"
              className="h-10 w-10 rounded-lg p-2.5"
              type="button"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-5">
            {/* Resume Type */}
            <div className="flex gap-8">
              <div className="w-40 shrink-0">
                <Label className="text-sm font-medium text-gray-700">
                  Resume type*
                </Label>
              </div>
              <div className="flex-1">
                <ResumeTypeSelector
                  value={selectedType}
                  onSelect={setSelectedType}
                  onClear={() => setSelectedType('')}
                  existingResumeTypes={existingTypes}
                  placeholder="e.g. General, Healthcare, Data analyst"
                  required
                  error={errors.type}
                />
              </div>
            </div>

            {/* Add Resume Section */}
            <div className="space-y-4">
              <div className="flex gap-8">
                <div className="w-40 shrink-0">
                  <Label className="text-sm font-medium text-gray-700">
                    Add resume*
                  </Label>
                </div>
                <div className="flex-1 space-y-6">
                  {/* Show existing file/URL info when editing */}
                  {resume && resume.resumeVersion.url && (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-gray-700">
                          Current resume
                        </p>
                        {resume.resumeVersion.filename ? (
                          <div className="flex items-center gap-2">
                            <p className="text-sm text-gray-600">
                              File: {resume.resumeVersion.filename}
                            </p>
                            {resume.resumeVersion.sizeBytes && (
                              <p className="text-xs text-gray-500">
                                (
                                {Math.round(
                                  resume.resumeVersion.sizeBytes / 1024
                                )}{' '}
                                KB)
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="break-all text-sm text-gray-600">
                            URL: {resume.resumeVersion.url}
                          </p>
                        )}
                        <a
                          href={resume.resumeVersion.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-sm text-teal-600 hover:text-teal-700"
                        >
                          View current resume →
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Segmented Control */}
                  <TabsGroup
                    options={[
                      { value: UPLOAD_MODE.UPLOAD, label: 'Upload file' },
                      { value: UPLOAD_MODE.URL, label: 'Add URL' },
                    ]}
                    activeTab={uploadMode}
                    onTabChange={(mode) => {
                      setUploadMode(mode as UploadMode);
                      // Clear the opposite field when switching modes
                      if (mode === UPLOAD_MODE.UPLOAD) {
                        setUrl(''); // Clear URL when switching to upload
                      } else {
                        setUploadedFileInfo(null); // Clear file when switching to URL
                      }
                      // Clear errors
                      setErrors({});
                    }}
                    className="w-full justify-center"
                  />

                  {/* Upload File Mode */}
                  {uploadMode === UPLOAD_MODE.UPLOAD && (
                    <div>
                      <QuotaDisplay />
                      <div className="mt-4">
                        <FileDropZoneContainer
                          onUploadComplete={handleFileUploadComplete}
                          onError={handleFileUploadError}
                        />
                      </div>
                      {errors.upload && (
                        <p className="mt-2 text-sm text-red-600">
                          {errors.upload}
                        </p>
                      )}
                    </div>
                  )}

                  {/* URL Mode */}
                  {uploadMode === UPLOAD_MODE.URL && (
                    <div>
                      <Input
                        id="resumeUrl"
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://example.com/my-resume.pdf"
                        className={errors.url ? 'border-red-500' : ''}
                      />
                      {errors.url && (
                        <p className="mt-1 text-sm text-red-600">
                          {errors.url}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-gray-200" />

            {/* Notes */}
            <div className="flex gap-8">
              <div className="w-40 shrink-0">
                <Label className="text-sm font-medium text-gray-700">
                  Notes
                </Label>
              </div>
              <div className="flex-1">
                <Textarea
                  id="resumeNotes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add your notes on why and what edits went in this version..."
                  maxLength={500}
                  className={`min-h-[123px] ${errors.notes ? 'border-red-500' : ''}`}
                  required
                />
                {errors.notes && (
                  <p className="mt-1 text-sm text-red-600">{errors.notes}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-6">
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isSaving}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                isSaving ||
                !selectedType.trim() ||
                !notes.trim() ||
                (!url.trim() && !uploadedFileInfo)
              }
              className="flex-1 bg-teal-700 text-white hover:bg-teal-800 disabled:bg-gray-100 disabled:text-gray-400"
            >
              {isSaving ? 'Saving...' : '+ Add new resume'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ResumeModal: React.FC<ResumeModalProps> = (props) => {
  const { isOpen, resume } = props;

  if (!isOpen) return null;

  // Derive initial values from resume prop
  const initialValues = getInitialValues(resume);

  // Use resume?.type as key to force remount when switching between add/edit or editing different resume
  const key = resume?.type || 'new';

  return (
    <ResumeModalContent {...props} key={key} initialValues={initialValues} />
  );
};
