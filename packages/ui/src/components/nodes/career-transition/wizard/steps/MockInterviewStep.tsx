import React, { useState } from 'react';
import { ArrowLeft, Check, X } from 'lucide-react';

import { Label } from '@journey/components';
import { Textarea } from '@journey/components';
import type { WizardData } from '../CareerUpdateWizard';

interface MockInterviewStepProps {
  data?: WizardData;
  onNext: (data: Partial<WizardData>) => void;
  onBack?: () => void;
  onCancel: () => void;
  currentStep: number;
  totalSteps: number;
  activityNumber?: number;
  totalActivities?: number;
  nodeId?: string;
}

export const MockInterviewStep: React.FC<MockInterviewStepProps> = ({
  data,
  onNext,
  onBack,
  onCancel,
  currentStep,
  totalSteps,
  activityNumber,
  totalActivities,
}) => {
  const [mockInterviewNotes, setMockInterviewNotes] = useState(data?.mockInterviewNotes || '');

  const handleNext = () => {
    onNext({
      mockInterviewNotes,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="flex h-[90vh] w-[90vw] max-w-6xl overflow-hidden rounded-lg bg-white shadow-xl">
        {/* Left Panel - Question */}
        <div className="flex w-1/2 flex-col gap-24 overflow-y-auto bg-neutral-100 px-12 pb-3 pt-12">
          {/* Progress Tracker */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center">
              <div className="size-2 shrink-0 rounded-full border-2 border-[#9ac6b5] bg-[#9ac6b5]" />
              <div className="h-[2px] grow bg-[#9ac6b5]" />
              <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#9ac6b5]">
                <div className="text-xs font-semibold text-white">2</div>
              </div>
              <div className="h-[2px] grow bg-[#d6d6d4]" />
              <div className="size-2 shrink-0 rounded-full border-2 border-[#d6d6d4] bg-white" />
              <div className="h-[2px] grow bg-[#d6d6d4]" />
              <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#d6d6d4]">
                <Check className="size-4 text-white" />
              </div>
            </div>
            <div className="flex justify-center">
              <p className="text-xs text-[#4a4f4e]">Step {currentStep + 1}: Provide activity details</p>
            </div>
          </div>

          {/* Question Content */}
          <div className="flex flex-col gap-2.5">
            {activityNumber && totalActivities && (
              <p className="text-base text-[#2e2e2e]">Activity {activityNumber} of {totalActivities}</p>
            )}
            <h1 className="text-4xl font-bold leading-[44px] text-[#2e2e2e]">
              How did your mock interviews go?
            </h1>
            <p className="text-base text-[#2e2e2e]">
              Describe the types of questions you practiced, if you had help, or how you feel after
              practicing.
            </p>
          </div>
        </div>

        {/* Right Panel - Content */}
        <div className="flex w-1/2 flex-col justify-between bg-white px-12 pb-12 pt-48">
          {/* Textarea Field */}
          <div className="flex flex-col gap-12">
            <div className="flex flex-col gap-2">
              <Label htmlFor="mockNotes" className="sr-only">
                Mock Interview Details
              </Label>
              <Textarea
                id="mockNotes"
                value={mockInterviewNotes}
                onChange={(e) => setMockInterviewNotes(e.target.value)}
                placeholder="Details on mock interview practice..."
                className="h-[188px] resize-none rounded-lg bg-neutral-100 p-4 text-base"
              />
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-between">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-[18px] py-2.5 text-sm font-semibold text-black shadow-sm hover:bg-gray-50"
              >
                <ArrowLeft className="size-[18px]" />
                Previous question
              </button>
            ) : (
              <div />
            )}
            <button
              type="button"
              onClick={handleNext}
              disabled={!mockInterviewNotes.trim()}
              className="flex items-center gap-2 rounded-lg bg-teal-600 px-[18px] py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Check className="size-[18px]" />
              Confirm details
            </button>
          </div>
        </div>

        {/* Cancel Button - Top Right */}
        <button
          onClick={onCancel}
          className="absolute right-4 top-4 flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-semibold text-[#24292e] hover:bg-gray-100"
          type="button"
        >
          <X className="size-[18px]" />
          <span>Cancel update</span>
        </button>
      </div>
    </div>
  );
};
