import { Button, Input, Label, Textarea } from '@journey/components';
import { BrandPlatform } from '@journey/schema';
import { ArrowLeft, Check, Loader2, X } from 'lucide-react';
import React, { useCallback, useState } from 'react';

import { FILE_TYPES } from '../../../../../constants/file-upload';
import { FileDropZoneContainer, QuotaDisplay } from '../../../../file-upload';
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

// Helper function to load existing brand building data
const loadExistingBrandBuildingData = (
  brandBuildingData?: WizardData['brandBuildingData']
) => {
  const profiles: Record<BrandPlatform, string> = {
    LinkedIn: '',
    X: '',
  };
  const flattenedActivities: PlatformActivity[] = [];

  if (brandBuildingData?.activities) {
    // Process each platform's activities
    (Object.keys(brandBuildingData.activities) as BrandPlatform[]).forEach(
      (platform) => {
        const platformActivities = brandBuildingData.activities[platform];
        if (platformActivities && platformActivities.length > 0) {
          // Get profile URL from first activity
          profiles[platform] = platformActivities[0].profileUrl;

          // Add all activities to flattened list
          flattenedActivities.push(...platformActivities);
        }
      }
    );
  }

  return { profiles, activities: flattenedActivities };
};

export const BrandBuildingStep: React.FC<BrandBuildingStepProps> = ({
  data,
  onNext,
  onBack,
  onCancel,
  activityNumber,
  totalActivities,
}) => {
  // Load existing data
  const existingData = loadExistingBrandBuildingData(data.brandBuildingData);

  // State - Screen navigation
  const [currentScreen, setCurrentScreen] = useState<
    'platform-selection' | 'activity-entry'
  >('platform-selection');

  // Platform profiles state - initialize from existing data
  const [platformProfiles, setPlatformProfiles] = useState<
    Record<BrandPlatform, string>
  >(existingData.profiles);

  // Activity state - initialize from existing data
  const [activities, setActivities] = useState<PlatformActivity[]>(
    existingData.activities
  );

  // Multi-platform selection state
  const [selectedPlatforms, setSelectedPlatforms] = useState<BrandPlatform[]>(
    []
  );
  const [currentPlatformIndex, setCurrentPlatformIndex] = useState(0);

  // Current activity form state
  const [profileUrl, setProfileUrl] = useState('');
  const [profileNotes, setProfileNotes] = useState('');
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [currentScreenshotNotes, setCurrentScreenshotNotes] = useState<
    Record<number, string>
  >({});
  const [isUploading, setIsUploading] = useState(false);

  // Auto-detect platform from URL
  const detectPlatform = (url: string): BrandPlatform | null => {
    if (!url) return null;
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('linkedin.com')) return 'LinkedIn';
    if (lowerUrl.includes('x.com') || lowerUrl.includes('twitter.com'))
      return 'X';
    return null;
  };

  // Get platforms that have profiles
  const platformsWithProfiles = (
    Object.keys(platformProfiles) as BrandPlatform[]
  ).filter((platform) => platformProfiles[platform]);

  // Get current platform being edited
  const currentPlatform = selectedPlatforms[currentPlatformIndex];

  // Platform selection handlers
  const handlePlatformToggle = (platform: BrandPlatform) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    );
  };

  const handleProceedToActivity = () => {
    if (selectedPlatforms.length === 0) return;
    setCurrentPlatformIndex(0);
    setCurrentScreen('activity-entry');
  };

  // Activity form handlers
  const handleFileUploadComplete = useCallback(
    (file: {
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
    },
    []
  );

  const handleFileUploadError = useCallback((error: string) => {
    console.error('Upload error:', error);
  }, []);

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
    // Only need screenshots for activity entry
    if (screenshots.length === 0 || screenshots.length > 5) return false;
    return true;
  };

  const handleSaveAndAddAnother = () => {
    if (!isActivityFormValid()) return;

    // Ensure we have a profile URL for this platform
    const profileUrl = platformProfiles[currentPlatform];
    if (!profileUrl) {
      console.error(`No profile URL found for ${currentPlatform}`);
      return;
    }

    setIsUploading(true);

    try {
      // Merge notes into screenshots
      const screenshotsWithNotes = screenshots.map((screenshot, index) => ({
        ...screenshot,
        notes: currentScreenshotNotes[index] || '',
      }));

      const activity: PlatformActivity = {
        platform: currentPlatform,
        profileUrl: profileUrl,
        screenshots: screenshotsWithNotes,
        notes: profileNotes.trim() || undefined,
        timestamp: new Date().toISOString(),
      };

      setActivities((prev) => [...prev, activity]);

      // Reset form for next activity on same platform
      setProfileNotes('');
      setScreenshots([]);
      setCurrentScreenshotNotes({});
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveAndContinue = () => {
    if (!isActivityFormValid()) return;

    // Ensure we have a profile URL for this platform
    const profileUrl = platformProfiles[currentPlatform];
    if (!profileUrl) {
      console.error(`No profile URL found for ${currentPlatform}`);
      return;
    }

    setIsUploading(true);

    try {
      // Save current activity
      const screenshotsWithNotes = screenshots.map((screenshot, index) => ({
        ...screenshot,
        notes: currentScreenshotNotes[index] || '',
      }));

      const activity: PlatformActivity = {
        platform: currentPlatform,
        profileUrl: profileUrl,
        screenshots: screenshotsWithNotes,
        notes: profileNotes.trim() || undefined,
        timestamp: new Date().toISOString(),
      };

      const allActivities = [...activities, activity];
      setActivities(allActivities);

      // Reset form
      setProfileNotes('');
      setScreenshots([]);
      setCurrentScreenshotNotes({});

      // Move to next platform or complete
      if (currentPlatformIndex < selectedPlatforms.length - 1) {
        setCurrentPlatformIndex(currentPlatformIndex + 1);
        setIsUploading(false);
      } else {
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
        // Don't set isUploading to false here - let the parent handle completion
      }
    } catch (error) {
      setIsUploading(false);
      console.error('Error saving activity:', error);
    }
  };

  const handleBackToPlatformSelection = () => {
    // Reset form and go back to platform selection
    setProfileNotes('');
    setScreenshots([]);
    setCurrentScreenshotNotes({});
    setCurrentScreen('platform-selection');
  };

  const detectedPlatform = detectPlatform(profileUrl);

  // Profile URL handler
  const handleProfileUrlSave = () => {
    const detected = detectPlatform(profileUrl);
    if (!detected || !profileUrl.trim()) return;

    setPlatformProfiles((prev) => ({
      ...prev,
      [detected]: profileUrl.trim(),
    }));

    setProfileUrl('');
  };

  // Render platform selection screen
  if (currentScreen === 'platform-selection') {
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
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel - Profile Setup */}
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
                Select platforms
              </h2>
            </div>

            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto px-12 py-8">
                <div className="mb-8">
                  <h1 className="mb-3 text-[32px] font-bold leading-tight text-gray-900">
                    Select platforms to add activities
                  </h1>
                  <p className="text-base text-gray-600">
                    Choose which platforms you want to add brand building
                    activities for.
                  </p>
                </div>

                <div className="space-y-6">
                  {/* Existing platforms with checkboxes */}
                  {platformsWithProfiles.length > 0 && (
                    <div>
                      <Label className="mb-3 text-sm font-medium text-gray-700">
                        Your platforms
                      </Label>
                      <div className="space-y-2">
                        {platformsWithProfiles.map((platform) => (
                          <label
                            key={platform}
                            className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 hover:bg-gray-100"
                          >
                            <input
                              type="checkbox"
                              checked={selectedPlatforms.includes(platform)}
                              onChange={() => handlePlatformToggle(platform)}
                              className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-gray-900">
                                {platform}
                              </p>
                              <a
                                href={platformProfiles[platform]}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="truncate text-xs text-gray-500 hover:text-teal-600 hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {platformProfiles[platform]}
                              </a>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Add new platform section */}
                  <div>
                    <Label
                      htmlFor="profileUrl"
                      className="text-sm font-medium text-gray-700"
                    >
                      Add new platform
                    </Label>
                    <div className="mt-2 flex gap-3">
                      <div className="flex-1">
                        <Input
                          id="profileUrl"
                          type="url"
                          value={profileUrl}
                          onChange={(e) => setProfileUrl(e.target.value)}
                          placeholder="Paste your LinkedIn or X profile URL"
                          className="h-11"
                        />
                        {detectedPlatform && (
                          <p className="mt-2 flex items-center gap-1.5 text-sm text-teal-600">
                            <Check className="h-4 w-4" />
                            {detectedPlatform} detected
                          </p>
                        )}
                        {profileUrl && !detectedPlatform && (
                          <p className="mt-2 text-sm text-amber-600">
                            Please enter a valid LinkedIn or X (Twitter) URL
                          </p>
                        )}
                      </div>
                      <Button
                        onClick={handleProfileUrlSave}
                        disabled={!detectedPlatform || !profileUrl.trim()}
                        variant="outline"
                        className="h-11 px-6"
                        type="button"
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="border-t border-gray-200 px-12 py-6">
                <div className="flex justify-between">
                  <div className="flex gap-3">
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
                  </div>
                  <Button
                    onClick={handleProceedToActivity}
                    disabled={selectedPlatforms.length === 0}
                    className="bg-teal-700 hover:bg-teal-800"
                    type="button"
                  >
                    Continue
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
              Platform {currentPlatformIndex + 1} of {selectedPlatforms.length}:{' '}
              {currentPlatform}
            </h2>
          </div>

          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-12 py-8">
              <div className="mb-8">
                <h1 className="mb-3 text-[32px] font-bold leading-tight text-gray-900">
                  Share your {currentPlatform} activity
                </h1>
                <p className="text-base text-gray-600">
                  Add screenshots and notes about your brand building activities
                  on {currentPlatform}.
                </p>
              </div>

              <div className="space-y-6">
                {/* Profile Notes */}
                <div>
                  <Label htmlFor="profileNotes">Notes (optional)</Label>
                  <Textarea
                    id="profileNotes"
                    value={profileNotes}
                    onChange={(e) => setProfileNotes(e.target.value)}
                    placeholder="Describe your brand building activities..."
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
                    Upload 1-5 screenshots showing your brand building
                    activities
                  </p>
                  {screenshots.length < 5 && (
                    <div className="space-y-4">
                      <QuotaDisplay />
                      <FileDropZoneContainer
                        onUploadComplete={handleFileUploadComplete}
                        onError={handleFileUploadError}
                        fileType={FILE_TYPES.BRAND_BUILDING_SCREENSHOT}
                        filePrefix={currentPlatform.toLowerCase()}
                        accept="image/*"
                      />
                    </div>
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
                            {(currentScreenshotNotes[index] || '').length}/500
                            characters
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
                  onClick={handleBackToPlatformSelection}
                  variant="ghost"
                  className="gap-2"
                  type="button"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
                <div className="flex gap-3">
                  <Button
                    onClick={handleSaveAndAddAnother}
                    disabled={!isActivityFormValid() || isUploading}
                    variant="outline"
                    type="button"
                  >
                    {isUploading && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    Add another activity
                  </Button>
                  <Button
                    onClick={handleSaveAndContinue}
                    disabled={!isActivityFormValid() || isUploading}
                    className="gap-2 bg-teal-700 hover:bg-teal-800"
                    type="button"
                  >
                    {isUploading && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    {currentPlatformIndex < selectedPlatforms.length - 1
                      ? 'Continue'
                      : 'Complete'}
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
