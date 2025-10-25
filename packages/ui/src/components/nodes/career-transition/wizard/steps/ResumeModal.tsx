/**
 * Resume Modal Component
 *
 * Modal for adding/editing a single resume entry
 * Features radio button group for resume type selection
 */

import { Button, Input, Label, Textarea } from '@journey/components';
import { LINKEDIN_TYPE, ResumeEntry } from '@journey/schema';
import { X } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import {
  useApplicationMaterials,
  useUpdateApplicationMaterials,
} from '../../../../../hooks/use-application-materials';
import { useCurrentUser } from '../../../../../hooks/useAuth';
import {
  handleAPIError,
  showSuccessToast,
} from '../../../../../utils/error-toast';
import { ResumeTypeSelector } from './ResumeTypeSelector';

export interface ResumeModalProps {
  careerTransitionId: string;
  resume?: ResumeEntry; // If editing
  resumeItems: ResumeEntry[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ResumeModal: React.FC<ResumeModalProps> = ({
  careerTransitionId,
  resume,
  resumeItems,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [selectedType, setSelectedType] = useState<string>('');
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isSaving, setIsSaving] = useState(false);

  const { data: materials } = useApplicationMaterials(careerTransitionId);
  const updateMaterialsMutation =
    useUpdateApplicationMaterials(careerTransitionId);
  const { data: currentUser } = useCurrentUser();

  // Get existing resume types from resumeItems (excluding the one being edited)
  const existingTypes = resumeItems
    .filter((r) => !resume || r.type !== resume.type)
    .map((r) => r.type);

  // Load existing resume data for editing
  useEffect(() => {
    if (isOpen && resume) {
      setSelectedType(resume.type);

      // For LinkedIn type, preserve URL but clear notes
      // For other types, clear both URL and notes for fresh entry
      if (resume.type === LINKEDIN_TYPE) {
        setUrl(resume.resumeVersion.url);
      } else {
        setUrl('');
      }
      setNotes('');
      setErrors({});
    } else if (isOpen) {
      // Reset for new resume
      setSelectedType('');
      setUrl('');
      setNotes('');
      setErrors({});
    }
  }, [isOpen, resume]);

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    // Validate resume type
    if (!selectedType.trim()) {
      newErrors.type = 'Resume type is required';
    }

    // Validate URL
    if (!url.trim()) {
      newErrors.url = 'Resume URL is required';
    } else {
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

      const newResumeEntry: ResumeEntry = {
        type: selectedType.trim(),
        resumeVersion: {
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
        },
      };

      let updatedItems: ResumeEntry[];

      if (resume) {
        // Editing existing resume - preserve edit history
        const existingIndex = allItems.findIndex(
          (r) => r.type.toLowerCase() === resume.type.toLowerCase()
        );

        if (existingIndex >= 0) {
          const existing = allItems[existingIndex];
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
    const hasChanges = url.trim() || notes.trim() || selectedType.trim();

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="flex h-[90vh] w-[90vw] max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
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
            {resume ? 'Edit Resume' : 'Add Resume'}
          </h2>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-12 py-8">
          <div className="space-y-6">
            {/* Resume Type */}
            <div>
              <Label className="mb-2 block">Resume Type *</Label>
              <ResumeTypeSelector
                value={selectedType}
                onSelect={setSelectedType}
                onClear={() => setSelectedType('')}
                existingResumeTypes={existingTypes}
                placeholder="Search or create resume type..."
                required
                error={errors.type}
              />
              <p className="mt-1 text-sm text-gray-500">
                Select an existing type or create a new one
              </p>
            </div>

            {/* Resume URL */}
            <div>
              <Label htmlFor="resumeUrl" className="mb-2 block">
                Resume URL *
              </Label>
              <Input
                id="resumeUrl"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/my-resume.pdf"
                className={errors.url ? 'border-red-500' : ''}
              />
              {errors.url && (
                <p className="mt-1 text-sm text-red-600">{errors.url}</p>
              )}
            </div>

            {/* Notes */}
            <div>
              <Label htmlFor="resumeNotes" className="mb-2 block">
                Notes *
              </Label>
              <Textarea
                id="resumeNotes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Describe what changed in this version..."
                maxLength={500}
                className={`min-h-[100px] ${errors.notes ? 'border-red-500' : ''}`}
                required
              />
              {errors.notes ? (
                <p className="mt-1 text-sm text-red-600">{errors.notes}</p>
              ) : (
                <p className="mt-1 text-sm text-gray-500">
                  {notes.length}/500 characters
                </p>
              )}
            </div>
          </div>
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
