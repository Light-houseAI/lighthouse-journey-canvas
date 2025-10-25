/**
 * LinkedIn Tab Component
 *
 * Inline form for managing LinkedIn profile
 * No table, no modal - saves when Continue is clicked
 */

import { Input, Label, Textarea } from '@journey/components';
import { LINKEDIN_TYPE, ResumeEntry } from '@journey/schema';
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react';

import {
  useApplicationMaterials,
  useUpdateApplicationMaterials,
} from '../../../../../hooks/use-application-materials';
import { useCurrentUser } from '../../../../../hooks/useAuth';
import {
  handleAPIError,
  showSuccessToast,
} from '../../../../../utils/error-toast';

export interface LinkedInTabProps {
  careerTransitionId: string;
  linkedInEntry: ResumeEntry | undefined;
}

export interface LinkedInTabHandle {
  saveIfNeeded: () => Promise<boolean>;
  hasChanges: boolean;
}

export const LinkedInTab = forwardRef<LinkedInTabHandle, LinkedInTabProps>(
  ({ careerTransitionId, linkedInEntry }, ref) => {
    const { data: materials } = useApplicationMaterials(careerTransitionId);
    const updateMaterialsMutation =
      useUpdateApplicationMaterials(careerTransitionId);
    const { data: currentUser } = useCurrentUser();

    const [url, setUrl] = useState('');
    const [notes, setNotes] = useState('');
    const [errors, setErrors] = useState<{ [key: string]: string }>({});
    const [hasChanges, setHasChanges] = useState(false);

    // Expose save function to parent
    useImperativeHandle(ref, () => ({
      saveIfNeeded: async () => {
        if (!hasChanges) {
          return true; // No changes, consider it successful
        }
        return await handleSave();
      },
      hasChanges,
    }));

    // Load existing LinkedIn profile data
    useEffect(() => {
      if (linkedInEntry?.resumeVersion) {
        setUrl(linkedInEntry.resumeVersion.url);
        setNotes(''); // Always start with blank notes for LinkedIn
        setHasChanges(false);
      }
    }, [linkedInEntry]);

    const validateForm = (): boolean => {
      const newErrors: { [key: string]: string } = {};

      // Validate URL
      if (!url.trim()) {
        newErrors.url = 'LinkedIn URL is required';
      } else {
        try {
          const parsed = new URL(url);
          if (!parsed.hostname.includes('linkedin.com')) {
            newErrors.url = 'Must be a LinkedIn profile URL';
          } else if (!parsed.pathname.includes('/in/')) {
            newErrors.url =
              'Must be a LinkedIn profile URL (linkedin.com/in/username)';
          }
        } catch {
          newErrors.url = 'Please enter a valid URL';
        }
      }

      // Validate notes (mandatory)
      if (!notes.trim()) {
        newErrors.notes = 'Notes are required';
      }

      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    };

    const handleSave = async (): Promise<boolean> => {
      if (!validateForm()) {
        return false;
      }

      try {
        const existingHistory = linkedInEntry?.resumeVersion?.editHistory || [];
        // Filter out invalid editHistory entries (editedBy should be a numeric user ID)
        const validHistory = existingHistory.filter(
          (entry) => entry.editedBy && /^\d+$/.test(entry.editedBy)
        );

        const linkedInItem: ResumeEntry = {
          type: LINKEDIN_TYPE,
          resumeVersion: {
            url,
            lastUpdated: new Date().toISOString(),
            notes,
            editHistory: [
              ...validHistory,
              {
                editedAt: new Date().toISOString(),
                notes,
                editedBy: currentUser?.id ? String(currentUser.id) : '',
              },
            ],
          },
        };

        // Get all existing items except the old LinkedIn entry
        const existingItems =
          materials?.items?.filter((item) => item.type !== LINKEDIN_TYPE) || [];

        // Add the new LinkedIn entry
        const updatedItems = [...existingItems, linkedInItem];

        await updateMaterialsMutation.mutateAsync({ items: updatedItems });

        showSuccessToast('LinkedIn profile saved successfully');
        setHasChanges(false);
        return true;
      } catch (error) {
        handleAPIError(error, 'Failed to save LinkedIn profile');
        return false;
      }
    };

    const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setUrl(e.target.value);
      setHasChanges(true);
      // Clear errors on change
      if (errors.url) {
        setErrors({});
      }
    };

    const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setNotes(e.target.value);
      setHasChanges(true);
    };

    return (
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            LinkedIn Profile
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            Keep your LinkedIn profile current for your job search.
          </p>
        </div>

        {/* LinkedIn URL */}
        <div>
          <Label htmlFor="linkedInUrl" className="mb-2 block">
            LinkedIn Profile URL *
          </Label>
          <Input
            id="linkedInUrl"
            type="url"
            value={url}
            onChange={handleUrlChange}
            placeholder="https://linkedin.com/in/your-profile"
            className={errors.url ? 'border-red-500' : ''}
          />
          {errors.url ? (
            <p className="mt-1 text-sm text-red-600">{errors.url}</p>
          ) : (
            <p className="mt-2 text-sm text-gray-600">
              Enter your LinkedIn profile URL (e.g., linkedin.com/in/username)
            </p>
          )}
        </div>

        {/* Notes */}
        <div>
          <Label htmlFor="linkedInNotes" className="mb-2 block">
            Notes *
          </Label>
          <Textarea
            id="linkedInNotes"
            value={notes}
            onChange={handleNotesChange}
            placeholder="Describe what you updated on your profile..."
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

        {/* Current Status */}
        {linkedInEntry && !hasChanges && (
          <div className="rounded-lg bg-green-50 p-4">
            <p className="text-sm font-medium text-green-900">
              ✓ LinkedIn profile saved
            </p>
            <p className="mt-1 text-sm text-green-700">
              Last updated:{' '}
              {new Date(
                linkedInEntry.resumeVersion.lastUpdated
              ).toLocaleDateString()}
            </p>
          </div>
        )}
      </div>
    );
  }
);

LinkedInTab.displayName = 'LinkedInTab';
