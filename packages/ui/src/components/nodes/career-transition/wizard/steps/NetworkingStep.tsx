import React, { useState } from 'react';
import { ArrowLeft, Check, X } from 'lucide-react';

import { Label } from '@journey/components';
import { Textarea } from '@journey/components';
import type { WizardData } from '../CareerUpdateWizard';

interface NetworkingStepProps {
  data: WizardData;
  onNext: (data: Partial<WizardData>) => void;
  onBack?: () => void;
  onCancel: () => void;
  currentStep: number;
  totalSteps: number;
  nodeId?: string;
}

export const NetworkingStep: React.FC<NetworkingStepProps> = ({
  data,
  onNext,
  onBack,
  onCancel,
  currentStep,
  totalSteps,
}) => {
  const [notes, setNotes] = useState(data?.networkingNotes || '');

  const handleNext = () => {
    onNext({
      networkingData: {},
      networkingNotes: notes,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="flex h-[90vh] w-[90vw] max-w-6xl overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="w-1/3 bg-gray-50 p-8">
          <div className="text-sm font-medium text-gray-900">
            Step {currentStep + 1} of {totalSteps}: Networking
          </div>
        </div>

        <div className="flex flex-1 flex-col">
          <div className="relative border-b border-gray-200 px-8 py-4">
            <button onClick={onCancel} className="absolute left-4 top-4 flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900" type="button">
              <X className="h-4 w-4" />
              <span>Cancel update</span>
            </button>
            <h2 className="text-center text-lg font-semibold text-gray-900">Add update</h2>
          </div>

          <div className="flex-1 overflow-y-auto px-8 py-6">
            <h1 className="mb-4 text-3xl font-bold text-gray-900">Networking</h1>
            <p className="mb-6 text-gray-600">Share details about your networking activities.</p>
            <div className="flex flex-col gap-2">
              <Label htmlFor="networkingNotes" className="text-sm font-medium text-gray-700">
                Notes
              </Label>
              <Textarea
                id="networkingNotes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g., Connected with 3 people on LinkedIn, attended local tech meetup..."
                className="h-[188px] resize-none rounded-lg bg-neutral-100 p-4 text-base"
              />
            </div>
          </div>

          <div className="border-t border-gray-200 px-8 py-4">
            <div className="flex justify-between">
              {onBack && (
                <button type="button" onClick={onBack} className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
              )}
              <button type="button" onClick={handleNext} className="ml-auto flex items-center gap-2 rounded-lg bg-teal-700 px-6 py-2.5 text-sm font-medium text-white hover:bg-teal-800">
                <Check className="h-4 w-4" />
                Continue
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
