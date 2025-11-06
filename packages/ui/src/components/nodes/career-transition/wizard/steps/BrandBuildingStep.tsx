import { Button, Input, Label, Textarea } from '@journey/components';
import { BrandPlatform } from '@journey/schema';
import { ArrowLeft, Check, Loader2, X } from 'lucide-react';
import React, { useState } from 'react';

import { FileDropZoneContainer } from '../../../../file-upload';
import type { WizardData } from '../CareerUpdateWizard';

interface BrandBuildingStepProps {
  data: WizardData;
  onNext: (data: Partial<WizardData>) => void;
  onBack?: () => void;
  onCancel: () => void;
  currentStep: number;
  totalSteps: number;
  activityNumber?: number;
  totalActivities?: number;
}

interface Screenshot {
  storageKey: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  notes: string;
}

interface PlatformActivity {
  platform: BrandPlatform;
  profileUrl: string;
  screenshots: Screenshot[];
  timestamp: string;
}

export const BrandBuildingStep: React.FC<BrandBuildingStepProps> = ({
  data,
  onNext,
  onBack,
  onCancel,
  currentStep,
  totalSteps,
  activityNumber,
  totalActivities,
}) => {
  // State
  const [activities, setActivities] = useState<PlatformActivity[]>([]);

  // Current activity form state
  const [profileUrl, setProfileUrl] = useState('');
  const [profileNotes, setProfileNotes] = useState('');
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [currentScreenshotNotes, setCurrentScreenshotNotes] = useState<Record<number, string>>({});
  const [isUploading, setIsUploading] = useState(false);

  // Auto-detect platform from URL
  const detectPlatform = (url: string): BrandPlatform | null => {
    if (!url) return null;
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('linkedin.com')) return 'LinkedIn';
    if (lowerUrl.includes('x.com') || lowerUrl.includes('twitter.com')) return 'X';
    return null;
  };

  const detectedPlatform = detectPlatform(profileUrl);

  // Check if this is the first activity for the detected platform
  const isFirstActivityForPlatform = () => {
    if (!detectedPlatform) return true;
    return !activities.some((act) => act.platform === detectedPlatform);
  };

  // Activity form handlers
  const handleFileUploadComplete = (file: {
    storageKey: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
  }) => {
    setScreenshots((prev) => [
      ...prev,
      {
        ...file,
        notes: '',
      },
    ]);
  };

  const handleFileUploadError = (error: Error) => {
    console.error('Upload error:', error);
  };

  const handleScreenshotNotesChange = (index: number, notes: string) => {
    setCurrentScreenshotNotes((prev) => ({
      ...prev,
      [index]: notes,
    }));
  };

  const handleRemoveScreenshot = (index: number) => {
    setScreenshots((prev) => prev.filter((_, i) => i !== index));
    setCurrentScreenshotNotes((prev) => {
      const newNotes = { ...prev };
      delete newNotes[index];
      return newNotes;
    });
  };

  const isActivityFormValid = () => {
    // Must have valid profile URL with detected platform
    if (!profileUrl.trim() || !detectedPlatform) return false;
    if (screenshots.length === 0 || screenshots.length > 5) return false;
    return true;
  };

  const handleSaveAndAddAnother = () => {
    if (!isActivityFormValid() || !detectedPlatform) return;

    // Merge notes into screenshots
    const screenshotsWithNotes = screenshots.map((screenshot, index) => ({
      ...screenshot,
      notes: currentScreenshotNotes[index] || '',
    }));

    const activity: PlatformActivity = {
      platform: detectedPlatform,
      profileUrl: profileUrl.trim(),
      screenshots: screenshotsWithNotes,
      notes: profileNotes.trim() || undefined,
      timestamp: new Date().toISOString(),
    };

    setActivities((prev) => [...prev, activity]);

    // Reset form for next activity
    setProfileUrl('');
    setProfileNotes('');
    setScreenshots([]);
    setCurrentScreenshotNotes({});
  };

  const handleSaveAndComplete = () => {
    if (!isActivityFormValid() || !detectedPlatform) return;

    // Save current activity first
    const screenshotsWithNotes = screenshots.map((screenshot, index) => ({
      ...screenshot,
      notes: currentScreenshotNotes[index] || '',
    }));

    const activity: PlatformActivity = {
      platform: detectedPlatform,
      profileUrl: profileUrl.trim(),
      screenshots: screenshotsWithNotes,
      notes: profileNotes.trim() || undefined,
      timestamp: new Date().toISOString(),
    };

    const allActivities = [...activities, activity];

    // Transform activities into grouped structure
    const groupedActivities: Record<BrandPlatform, PlatformActivity[]> = {
      LinkedIn: [],
      X: [],
    };

    allActivities.forEach((act) => {
      groupedActivities[act.platform].push(act);
    });

    onNext({
      brandBuildingData: {
        activities: groupedActivities,
      },
    });
  };

  const handleCompleteWithoutSaving = () => {
    // Complete without saving current form (if user added activities already)
    if (activities.length === 0) return;

    const groupedActivities: Record<BrandPlatform, PlatformActivity[]> = {
      LinkedIn: [],
      X: [],
    };

    activities.forEach((activity) => {
      groupedActivities[activity.platform].push(activity);
    });

    onNext({
      brandBuildingData: {
        activities: groupedActivities,
      },
    });
  };

  // Activity entry form screen
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="flex h-[90vh] w-[90vw] max-w-6xl overflow-hidden rounded-lg bg-white shadow-xl">
        {/* Left Panel - Stepper */}
        <div className="w-1/3 bg-gray-100/50 p-8 pt-12">
          <div className="flex items-start gap-4">
            <div className="flex flex-col items-center">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-600 text-white">
                <Check className="h-4 w-4" />
              </div>
            </div>
            <div className="flex-1 pt-0.5">
              <div className="text-sm font-normal text-gray-700">
                {activityNumber && totalActivities
                  ? `Activity ${activityNumber} of ${totalActivities}: Brand building`
                  : 'Brand building activity'}
                {activities.length > 0 && ` (${activities.length} added)`}
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Activity Form */}
        <div className="flex flex-1 flex-col">
          <div className="relative flex h-16 items-center justify-center border-b border-gray-200 px-8">
            <Button
              onClick={onCancel}
              variant="ghost"
              className="absolute left-6 gap-2 text-sm"
              type="button"
            >
              <X className="h-4 w-4" />
              <span>Cancel update</span>
            </Button>
            <h2 className="text-base font-semibold text-gray-900">
              Add brand building activity
            </h2>
          </div>

          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-12 py-8">
              <div className="mb-8">
                <h1 className="mb-3 text-[32px] font-bold leading-tight text-gray-900">
                  Share your brand building activity
                </h1>
                <p className="text-base text-gray-600">
                  Add your profile URL and screenshots. Platform is automatically detected from the URL.
                </p>
              </div>

              <div className="space-y-6">
                {/* Profile URL */}
                <div>
                  <Label htmlFor="profileUrl">
                    Profile URL
                    {detectedPlatform && (
                      <span className="ml-2 text-sm text-teal-600">
                        ({detectedPlatform} detected)
                      </span>
                    )}
                  </Label>
                  <Input
                    id="profileUrl"
                    type="url"
                    value={profileUrl}
                    onChange={(e) => setProfileUrl(e.target.value)}
                    placeholder="https://linkedin.com/in/yourname or https://x.com/yourhandle"
                    className="mt-2"
                  />
                  {profileUrl && !detectedPlatform && (
                    <p className="mt-1 text-sm text-amber-600">
                      Please enter a valid LinkedIn or X (Twitter) URL
                    </p>
                  )}
                </div>

                {/* Profile Notes */}
                <div>
                  <Label htmlFor="profileNotes">
                    Overall Notes (optional)
                  </Label>
                  <Textarea
                    id="profileNotes"
                    value={profileNotes}
                    onChange={(e) => setProfileNotes(e.target.value)}
                    placeholder="Describe your overall brand building approach on this platform..."
                    className="mt-2 min-h-[100px]"
                    maxLength={500}
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    {profileNotes.length}/500 characters
                  </p>
                </div>

                {/* Screenshot Upload */}
                <div>
                  <Label className="mb-2">
                    Screenshots ({screenshots.length}/5)
                  </Label>
                  <p className="mb-4 text-sm text-gray-600">
                    Upload 1-5 screenshots showing your brand building activities
                  </p>
                  {screenshots.length < 5 && (
                    <FileDropZoneContainer
                      onUploadComplete={handleFileUploadComplete}
                      onError={handleFileUploadError}
                      accept="image/*"
                    />
                  )}
                </div>

                {/* Screenshot List with Notes */}
                {screenshots.length > 0 && (
                  <div className="space-y-4">
                    {screenshots.map((screenshot, index) => (
                      <div
                        key={index}
                        className="rounded-lg border border-gray-200 p-4"
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">
                            {screenshot.filename}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveScreenshot(index)}
                            className="text-gray-400 hover:text-red-500"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <div>
                          <Label htmlFor={`notes-${index}`} className="text-xs">
                            Notes (optional)
                          </Label>
                          <Textarea
                            id={`notes-${index}`}
                            value={currentScreenshotNotes[index] || ''}
                            onChange={(e) =>
                              handleScreenshotNotesChange(index, e.target.value)
                            }
                            placeholder="Describe what this screenshot shows..."
                            className="mt-2 min-h-[80px]"
                            maxLength={500}
                          />
                          <p className="mt-1 text-xs text-gray-500">
                            {(currentScreenshotNotes[index] || '').length}/500 characters
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 px-12 py-6">
              <div className="flex justify-between">
                <div className="flex gap-3">
                  {onBack && activities.length === 0 && (
                    <Button
                      onClick={onBack}
                      variant="ghost"
                      className="gap-2"
                      type="button"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back
                    </Button>
                  )}
                  {activities.length > 0 && (
                    <Button
                      onClick={handleCompleteWithoutSaving}
                      variant="ghost"
                      type="button"
                    >
                      Complete without saving current
                    </Button>
                  )}
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={handleSaveAndAddAnother}
                    disabled={!isActivityFormValid() || isUploading}
                    variant="outline"
                    type="button"
                  >
                    {isUploading && <Loader2 className="h-4 w-4 animate-spin" />}
                    Add another activity
                  </Button>
                  <Button
                    onClick={handleSaveAndComplete}
                    disabled={!isActivityFormValid() || isUploading}
                    className="gap-2 bg-teal-700 hover:bg-teal-800"
                    type="button"
                  >
                    {isUploading && <Loader2 className="h-4 w-4 animate-spin" />}
                    Complete
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
