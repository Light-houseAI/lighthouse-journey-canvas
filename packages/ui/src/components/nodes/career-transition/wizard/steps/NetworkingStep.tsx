import { Button, Label, Textarea } from '@journey/components';
import { NetworkingType } from '@journey/schema';
import { ArrowLeft, Check, Loader2, X } from 'lucide-react';
import React, { useState } from 'react';

import { MultiTextInput } from '../../../../inputs/MultiTextInput';
import type { WizardData } from '../CareerUpdateWizard';
import type { NetworkingActivity, NetworkingData } from './types';

interface NetworkingStepProps {
  data: WizardData;
  onNext: (data: Partial<WizardData>) => void;
  onBack?: () => void;
  onCancel: () => void;
  currentStep: number;
  totalSteps: number;
  activityNumber?: number;
  totalActivities?: number;
}

// Validate activity form based on networking type
function validateActivityForm(formData: Partial<NetworkingActivity>): boolean {
  switch (formData.networkingType) {
    case NetworkingType.ColdOutreach: {
      const hasChannels = (formData as any).channels?.length > 0;
      const hasOtherChannel = (formData as any).otherChannel?.trim();
      const hasAnyChannel = hasChannels || hasOtherChannel;

      return Boolean(
        formData.whom?.length && hasAnyChannel && formData.exampleOnHow
      );
    }
    case NetworkingType.ReconnectedWithSomeone:
      return Boolean(formData.contacts?.length);
    case NetworkingType.AttendedNetworkingEvent:
      return Boolean(formData.event);
    case NetworkingType.InformationalInterview:
      return Boolean(formData.contact);
    default:
      return false;
  }
}

// Render the activity form based on networking type
function renderActivityForm(
  selectedType: NetworkingType | null,
  formData: Partial<NetworkingActivity>,
  setFormData: (data: Partial<NetworkingActivity>) => void
): React.ReactElement | null {
  if (!selectedType) return null;

  const commonNotesField = (placeholder: string) => (
    <div>
      <Label htmlFor="notes">Notes (optional)</Label>
      <Textarea
        id="notes"
        value={(formData as any).notes || ''}
        onChange={(e) =>
          setFormData({ ...formData, notes: e.target.value } as any)
        }
        placeholder={placeholder}
        className="mt-2 min-h-[120px]"
        maxLength={500}
      />
    </div>
  );

  switch (selectedType) {
    case NetworkingType.ColdOutreach: {
      const predefinedChannels = [
        'LinkedIn',
        'Email',
        'Slack / Discord/ Community platforms',
        'Alumni or professional groups',
      ];
      const selectedChannels = (formData as any).channels || [];
      const otherChannel = (formData as any).otherChannel || '';

      const handleChannelToggle = (channel: string) => {
        const current = [...selectedChannels];
        const index = current.indexOf(channel);
        if (index > -1) {
          current.splice(index, 1);
        } else {
          current.push(channel);
        }
        setFormData({ ...formData, channels: current } as any);
      };

      return (
        <div className="space-y-6">
          <MultiTextInput
            label="Whom did you reach out to?"
            placeholder="Enter name or role..."
            value={(formData as any).whom || []}
            onChange={(whom) => setFormData({ ...formData, whom } as any)}
            helperText="Add the people or roles you reached out to"
          />

          <div>
            <Label>Which channels did you do cold outreach on?*</Label>
            <div className="mt-3 space-y-3">
              {predefinedChannels.map((channel) => (
                <label
                  key={channel}
                  className="flex cursor-pointer items-center gap-3"
                >
                  <input
                    type="checkbox"
                    checked={selectedChannels.includes(channel)}
                    onChange={() => handleChannelToggle(channel)}
                    className="h-5 w-5 rounded border-gray-300 text-teal-600 focus:ring-2 focus:ring-teal-500"
                  />
                  <span className="text-sm text-gray-600">{channel}</span>
                </label>
              ))}

              <div className="space-y-2">
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={otherChannel !== ''}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({ ...formData, otherChannel: ' ' } as any);
                      } else {
                        setFormData({ ...formData, otherChannel: '' } as any);
                      }
                    }}
                    className="h-5 w-5 rounded border-gray-300 text-teal-600 focus:ring-2 focus:ring-teal-500"
                  />
                  <span className="text-sm text-gray-600">Other</span>
                </label>
                {otherChannel !== '' && (
                  <input
                    type="text"
                    value={otherChannel.trim()}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        otherChannel: e.target.value,
                      } as any)
                    }
                    placeholder="Specify other channel..."
                    className="ml-8 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    maxLength={50}
                  />
                )}
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="exampleOnHow">Example on how you reached out</Label>
            <Textarea
              id="exampleOnHow"
              value={(formData as any).exampleOnHow || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  exampleOnHow: e.target.value,
                } as any)
              }
              placeholder="Share your approach or message template..."
              className="mt-2 min-h-[120px]"
              maxLength={500}
            />
          </div>
        </div>
      );
    }

    case NetworkingType.ReconnectedWithSomeone:
      return (
        <div className="space-y-6">
          <MultiTextInput
            label="Contacts"
            placeholder="Enter contact name..."
            value={(formData as any).contacts || []}
            onChange={(contacts) =>
              setFormData({ ...formData, contacts } as any)
            }
            helperText="Add the people you reconnected with"
          />
          {commonNotesField('Add any notes about the reconnection...')}
        </div>
      );

    case NetworkingType.AttendedNetworkingEvent:
      return (
        <div className="space-y-6">
          <div>
            <Label htmlFor="event">Event name</Label>
            <input
              type="text"
              id="event"
              value={(formData as any).event || ''}
              onChange={(e) =>
                setFormData({ ...formData, event: e.target.value } as any)
              }
              placeholder="Enter event name..."
              className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              maxLength={100}
            />
          </div>
          {commonNotesField('Add details about the event...')}
        </div>
      );

    case NetworkingType.InformationalInterview:
      return (
        <div className="space-y-6">
          <div>
            <Label htmlFor="contact">Contact</Label>
            <input
              type="text"
              id="contact"
              value={(formData as any).contact || ''}
              onChange={(e) =>
                setFormData({ ...formData, contact: e.target.value } as any)
              }
              placeholder="Enter contact name..."
              className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              maxLength={100}
            />
          </div>
          {commonNotesField('Add details about the interview...')}
        </div>
      );

    default:
      return null;
  }
}

export const NetworkingStep: React.FC<NetworkingStepProps> = ({
  data,
  onNext,
  onBack,
  onCancel,
  activityNumber,
  totalActivities,
}) => {
  const [activities, setActivities] = useState<NetworkingActivity[]>(
    data.networkingData?.activities || []
  );

  // Multi-step state management
  const [selectedTypes, setSelectedTypes] = useState<NetworkingType[]>([]);
  const [currentTypeIndex, setCurrentTypeIndex] = useState<number>(-1);
  const [showTypeSelection, setShowTypeSelection] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Store separate form state for each networking type
  const [formDataByType, setFormDataByType] = useState<
    Record<NetworkingType, Partial<NetworkingActivity>>
  >({} as Record<NetworkingType, Partial<NetworkingActivity>>);

  // Get current form data based on current type
  const currentType =
    currentTypeIndex >= 0 ? selectedTypes[currentTypeIndex] : null;
  const formData = currentType ? formDataByType[currentType] || {} : {};

  const setFormData = (data: Partial<NetworkingActivity>) => {
    if (!currentType) return;
    setFormDataByType((prev) => ({
      ...prev,
      [currentType]: data,
    }));
  };

  const handleToggleType = (type: NetworkingType) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleStartForms = () => {
    if (selectedTypes.length === 0) return;
    setShowTypeSelection(false);
    setCurrentTypeIndex(0);

    // Initialize form data for the first type if not already set
    const firstType = selectedTypes[0];
    if (!formDataByType[firstType]) {
      setFormDataByType((prev) => ({
        ...prev,
        [firstType]: {
          networkingType: firstType,
          timestamp: new Date().toISOString(),
        },
      }));
    }
  };

  const handleAddActivity = () => {
    if (!formData.networkingType) return;

    // Validate based on type
    const isValid = validateActivityForm(formData);
    if (!isValid) return;

    // Prepare activity data - merge otherChannel into channels if present
    let activityToSave = { ...formData };
    if (formData.networkingType === NetworkingType.ColdOutreach) {
      const otherChannel = (formData as any).otherChannel?.trim();
      if (otherChannel) {
        const channels = [...((formData as any).channels || []), otherChannel];
        activityToSave = { ...formData, channels } as any;
        // Remove otherChannel field as it's merged into channels
        delete (activityToSave as any).otherChannel;
      }
    }

    const newActivities = [...activities, activityToSave as NetworkingActivity];
    setActivities(newActivities);

    // Clear the saved state for this type since we've submitted it
    if (currentType) {
      setFormDataByType((prev) => {
        const updated = { ...prev };
        delete updated[currentType];
        return updated;
      });
    }

    // Move to next type or finish
    if (currentTypeIndex < selectedTypes.length - 1) {
      const nextIndex = currentTypeIndex + 1;
      setCurrentTypeIndex(nextIndex);

      // Initialize form data for next type if not already set
      const nextType = selectedTypes[nextIndex];
      if (!formDataByType[nextType]) {
        setFormDataByType((prev) => ({
          ...prev,
          [nextType]: {
            networkingType: nextType,
            timestamp: new Date().toISOString(),
          },
        }));
      }
    } else {
      // All forms complete - save and exit
      setIsSubmitting(true);
      const networkingData: NetworkingData = {
        activities: newActivities,
      };
      onNext({ networkingData });
    }
  };

  const handleRemoveActivity = (index: number) => {
    setActivities(activities.filter((_, i) => i !== index));
  };

  const handleBackInForm = () => {
    if (currentTypeIndex > 0) {
      const prevIndex = currentTypeIndex - 1;
      setCurrentTypeIndex(prevIndex);

      // Initialize form data for previous type if not already set
      const prevType = selectedTypes[prevIndex];
      if (!formDataByType[prevType]) {
        setFormDataByType((prev) => ({
          ...prev,
          [prevType]: {
            networkingType: prevType,
            timestamp: new Date().toISOString(),
          },
        }));
      }
    } else {
      // Go back to type selection
      setShowTypeSelection(true);
      setCurrentTypeIndex(-1);
    }
  };

  const canProceedFromSelection = selectedTypes.length > 0;

  // Type selection screen
  if (showTypeSelection) {
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
                    ? `Activity ${activityNumber} of ${totalActivities}: Networking`
                    : 'Networking activities'}
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel - Type Selection */}
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
                Add networking activity
              </h2>
            </div>

            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto px-12 py-8">
                <div className="mb-10">
                  <h1 className="mb-3 text-[32px] font-bold leading-tight text-gray-900">
                    What type of networking did you do?
                  </h1>
                  <p className="text-base text-gray-600">
                    Select the type of networking activity you completed.
                  </p>
                </div>

                <div className="space-y-3">
                  {Object.values(NetworkingType).map((type) => (
                    <label
                      key={type}
                      className="flex w-full cursor-pointer items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-gray-300"
                    >
                      <input
                        type="checkbox"
                        checked={selectedTypes.includes(type)}
                        onChange={() => handleToggleType(type)}
                        className="h-5 w-5 rounded border-gray-300 text-teal-600 focus:ring-2 focus:ring-teal-500"
                      />
                      <span className="text-sm text-gray-700">{type}</span>
                    </label>
                  ))}
                </div>

                {/* Added activities list */}
                {activities.length > 0 && (
                  <div className="mt-8">
                    <h3 className="mb-4 text-sm font-semibold text-gray-700">
                      Added activities ({activities.length})
                    </h3>
                    <div className="space-y-2">
                      {activities.map((activity, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 p-3"
                        >
                          <span className="text-sm text-gray-700">
                            {activity.networkingType}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveActivity(index)}
                            className="text-gray-400 hover:text-red-500"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-gray-200 px-12 py-6">
                <div className="flex justify-between">
                  {onBack ? (
                    <Button
                      type="button"
                      onClick={onBack}
                      variant="outline"
                      className="gap-2"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back
                    </Button>
                  ) : (
                    <div />
                  )}
                  <Button
                    type="button"
                    onClick={handleStartForms}
                    disabled={!canProceedFromSelection}
                    className="gap-2 bg-teal-700 hover:bg-teal-800"
                  >
                    <Check className="h-4 w-4" />
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

  // Form screen for selected type
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
                {currentType} ({currentTypeIndex + 1} of {selectedTypes.length})
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Form */}
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
              {currentType}
            </h2>
          </div>

          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-12 py-8">
              {renderActivityForm(currentType, formData, setFormData)}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 px-12 py-6">
              <div className="flex justify-between">
                <Button
                  type="button"
                  onClick={handleBackInForm}
                  variant="outline"
                  className="gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {currentTypeIndex > 0 ? 'Previous' : 'Back to types'}
                </Button>
                <Button
                  type="button"
                  onClick={handleAddActivity}
                  disabled={!validateActivityForm(formData) || isSubmitting}
                  className="gap-2 bg-teal-700 hover:bg-teal-800"
                >
                  {currentTypeIndex < selectedTypes.length - 1 ? (
                    <>
                      Next
                      <ArrowLeft className="h-4 w-4 rotate-180" />
                    </>
                  ) : isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Complete
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
