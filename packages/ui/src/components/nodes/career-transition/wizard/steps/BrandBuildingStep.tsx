import { Button, Input, Label, Textarea } from '@journey/components';
import { BrandPlatform } from '@journey/schema';
import { ArrowLeft, Check, Loader2, X } from 'lucide-react';
import React, { useState } from 'react';

import { FileDropZoneContainer } from '../../../../files/FileDropZoneContainer';
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
  // Platform selection state
  const [showPlatformSelection, setShowPlatformSelection] = useState(true);
  const [selectedPlatforms, setSelectedPlatforms] = useState<BrandPlatform[]>([]);
  const [currentPlatformIndex, setCurrentPlatformIndex] = useState(0);
  const [activities, setActivities] = useState<PlatformActivity[]>([]);

  // Current activity form state
  const [profileUrl, setProfileUrl] = useState('');
  const [profileNotes, setProfileNotes] = useState('');
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [currentScreenshotNotes, setCurrentScreenshotNotes] = useState<Record<number, string>>({});
  const [isUploading, setIsUploading] = useState(false);

  const currentPlatform = selectedPlatforms[currentPlatformIndex];
  const isLastPlatform = currentPlatformIndex === selectedPlatforms.length - 1;

  // Platform selection handlers
  const handleTogglePlatform = (platform: BrandPlatform) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    );
  };

  const handleStartActivityEntry = () => {
    if (selectedPlatforms.length === 0) return;
    setShowPlatformSelection(false);
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
    if (!profileUrl.trim()) return false;
    if (screenshots.length === 0 || screenshots.length > 5) return false;
    return true;
  };

  const handleSaveActivity = () => {
    if (!isActivityFormValid()) return;

    // Merge notes into screenshots
    const screenshotsWithNotes = screenshots.map((screenshot, index) => ({
      ...screenshot,
      notes: currentScreenshotNotes[index] || '',
    }));

    const activity: PlatformActivity = {
      platform: currentPlatform,
      profileUrl: profileUrl.trim(),
      screenshots: screenshotsWithNotes,
      notes: profileNotes.trim() || undefined,
      timestamp: new Date().toISOString(),
    };

    setActivities((prev) => [...prev, activity]);

    // Reset form for next platform or finish
    if (isLastPlatform) {
      // All platforms complete, proceed to next wizard step
      handleComplete();
    } else {
      // Move to next platform
      setCurrentPlatformIndex((prev) => prev + 1);
      setProfileUrl('');
      setProfileNotes('');
      setScreenshots([]);
      setCurrentScreenshotNotes({});
    }
  };

  const handleComplete = () => {
    // Transform activities into grouped structure
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

  const handleBackFromForm = () => {
    if (currentPlatformIndex > 0) {
      setCurrentPlatformIndex((prev) => prev - 1);
      setProfileUrl('');
      setProfileNotes('');
      setScreenshots([]);
      setCurrentScreenshotNotes({});
    } else {
      setShowPlatformSelection(true);
      setCurrentPlatformIndex(0);
      setProfileUrl('');
      setProfileNotes('');
      setScreenshots([]);
      setCurrentScreenshotNotes({});
    }
  };

  // Platform selection screen
  if (showPlatformSelection) {
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
                    : 'Brand building activities'}
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel - Platform Selection */}
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
                <div className="mb-10">
                  <h1 className="mb-3 text-[32px] font-bold leading-tight text-gray-900">
                    Which platforms are you building your brand on?
                  </h1>
                  <p className="text-base text-gray-600">
                    Select the platforms where you've been active in building your professional brand.
                  </p>
                </div>

                <div className="space-y-3">
                  {(['LinkedIn', 'X'] as BrandPlatform[]).map((platform) => (
                    <label
                      key={platform}
                      className="flex w-full cursor-pointer items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-gray-300"
                    >
                      <input
                        type="checkbox"
                        checked={selectedPlatforms.includes(platform)}
                        onChange={() => handleTogglePlatform(platform)}
                        className="h-5 w-5 rounded border-gray-300 text-teal-600 focus:ring-2 focus:ring-teal-500"
                      />
                      <span className="text-sm text-gray-700">{platform}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="border-t border-gray-200 px-12 py-6">
                <div className="flex justify-between">
                  {onBack && (
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
                  <Button
                    onClick={handleStartActivityEntry}
                    disabled={selectedPlatforms.length === 0}
                    className="ml-auto gap-2 bg-teal-700 hover:bg-teal-800"
                    type="button"
                  >
                    Next
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
                {currentPlatform} ({currentPlatformIndex + 1} of {selectedPlatforms.length})
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
              {currentPlatform} activity
            </h2>
          </div>

          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-12 py-8">
              <div className="mb-8">
                <h1 className="mb-3 text-[32px] font-bold leading-tight text-gray-900">
                  Share your {currentPlatform} activity
                </h1>
                <p className="text-base text-gray-600">
                  Add your profile URL and screenshots of your brand building activities.
                </p>
              </div>

              <div className="space-y-6">
                {/* Profile URL */}
                <div>
                  <Label htmlFor="profileUrl">
                    {currentPlatform} Profile URL
                  </Label>
                  <Input
                    id="profileUrl"
                    type="url"
                    value={profileUrl}
                    onChange={(e) => setProfileUrl(e.target.value)}
                    placeholder={
                      currentPlatform === 'LinkedIn'
                        ? 'https://linkedin.com/in/yourname'
                        : 'https://x.com/yourhandle'
                    }
                    className="mt-2"
                  />
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
                <Button
                  onClick={handleBackFromForm}
                  variant="ghost"
                  className="gap-2"
                  type="button"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
                <Button
                  onClick={handleSaveActivity}
                  disabled={!isActivityFormValid() || isUploading}
                  className="gap-2 bg-teal-700 hover:bg-teal-800"
                  type="button"
                >
                  {isUploading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isLastPlatform ? 'Complete' : 'Next platform'}
                  <Check className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
