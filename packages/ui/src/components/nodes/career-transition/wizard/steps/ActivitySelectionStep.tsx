import React, { useState } from 'react';
import { X, Check, Circle, CheckCircle2 } from 'lucide-react';
import { Button, Checkbox, Label, Textarea } from '@journey/components';
import type { WizardData } from '../CareerUpdateWizard';

interface ActivitySelectionStepProps {
  data: WizardData;
  onNext: (data: Partial<WizardData>) => void;
  onCancel: () => void;
  currentStep: number;
  totalSteps: number;
  nodeId?: string;
}

export const ActivitySelectionStep: React.FC<ActivitySelectionStepProps> = ({
  data,
  onNext,
  onCancel,
  currentStep,
  totalSteps,
}) => {
  // Job Search Prep checkboxes
  const [appliedToJobs, setAppliedToJobs] = useState(data.appliedToJobs);
  const [updatedResumeOrPortfolio, setUpdatedResumeOrPortfolio] = useState(data.updatedResumeOrPortfolio);
  const [networked, setNetworked] = useState(data.networked);
  const [developedSkills, setDevelopedSkills] = useState(data.developedSkills);

  // Interview Activity checkboxes
  const [pendingInterviews, setPendingInterviews] = useState(data.pendingInterviews);
  const [completedInterviews, setCompletedInterviews] = useState(data.completedInterviews);
  const [practicedMock, setPracticedMock] = useState(data.practicedMock);
  const [receivedOffers, setReceivedOffers] = useState(data.receivedOffers);
  const [receivedRejections, setReceivedRejections] = useState(data.receivedRejections);
  const [possiblyGhosted, setPossiblyGhosted] = useState(data.possiblyGhosted);

  const [notes, setNotes] = useState(data.notes || '');
  const maxNotesLength = 1000;

  // Form validation
  const hasChanges =
    appliedToJobs ||
    updatedResumeOrPortfolio ||
    networked ||
    developedSkills ||
    pendingInterviews ||
    completedInterviews ||
    practicedMock ||
    receivedOffers ||
    receivedRejections ||
    possiblyGhosted ||
    notes.trim().length > 0;

  const handleNext = () => {
    onNext({
      appliedToJobs,
      updatedResumeOrPortfolio,
      networked,
      developedSkills,
      pendingInterviews,
      completedInterviews,
      practicedMock,
      receivedOffers,
      receivedRejections,
      possiblyGhosted,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="flex h-[90vh] w-[90vw] max-w-6xl overflow-hidden rounded-lg bg-white shadow-xl">
        {/* Left Panel - Stepper */}
        <div className="w-1/3 bg-gray-100/50 p-8 pt-12">
          <div className="flex items-start gap-4">
            {/* Step indicator */}
            <div className="flex flex-col items-center">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-600 text-white">
                <Check className="h-4 w-4" />
              </div>
              {totalSteps > 1 && (
                <>
                  <div className="mt-2 h-16 w-0.5 bg-gray-300" />
                  <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-gray-300 bg-white">
                    <div className="h-2 w-2 rounded-full bg-gray-300" />
                  </div>
                </>
              )}
            </div>

            {/* Step content */}
            <div className="flex-1 pt-0.5">
              <div className="text-sm font-normal text-gray-700">Step 1: Confirm activities</div>
            </div>
          </div>
        </div>

        {/* Right Panel - Form Content */}
        <div className="flex flex-1 flex-col">
          {/* Header */}
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
            <h2 className="text-base font-semibold text-gray-900">Add update</h2>
          </div>

          {/* Scrollable Content */}
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-12 py-8">
              {/* Main Question */}
              <div className="mb-10">
                <h1 className="mb-3 text-[32px] font-bold leading-tight text-gray-900">
                  What's new in your job search journey since we last checked in?
                </h1>
                <p className="text-base text-gray-600">Select all that happened.</p>
              </div>

              {/* Job Search Preparation Section */}
              <div className="mb-8">
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">Job search preparation</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-3.5 hover:border-gray-300 transition-colors">
                    <Checkbox
                      id="appliedToJobs"
                      checked={appliedToJobs}
                      onCheckedChange={(checked) => setAppliedToJobs(checked as boolean)}
                    />
                    <Label htmlFor="appliedToJobs" className="cursor-pointer text-sm leading-normal text-gray-700">
                      Applied to jobs with strong fit
                    </Label>
                  </div>
                  <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-3.5 hover:border-gray-300 transition-colors">
                    <Checkbox
                      id="updatedResumeOrPortfolio"
                      checked={updatedResumeOrPortfolio}
                      onCheckedChange={(checked) => setUpdatedResumeOrPortfolio(checked as boolean)}
                    />
                    <Label htmlFor="updatedResumeOrPortfolio" className="cursor-pointer text-sm leading-normal text-gray-700">
                      Updated my resume or portfolio
                    </Label>
                  </div>
                  <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-3.5 hover:border-gray-300 transition-colors">
                    <Checkbox
                      id="networked"
                      checked={networked}
                      onCheckedChange={(checked) => setNetworked(checked as boolean)}
                    />
                    <Label htmlFor="networked" className="cursor-pointer text-sm leading-normal text-gray-700">
                      Networked (via messages, meetings, or events)
                    </Label>
                  </div>
                  <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-3.5 hover:border-gray-300 transition-colors">
                    <Checkbox
                      id="developedSkills"
                      checked={developedSkills}
                      onCheckedChange={(checked) => setDevelopedSkills(checked as boolean)}
                    />
                    <Label htmlFor="developedSkills" className="cursor-pointer text-sm leading-normal text-gray-700">
                      Developed skills (through courses or self-learning)
                    </Label>
                  </div>
                </div>
              </div>

              {/* Interview Activity Section */}
              <div className="mb-8">
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">Interview activity</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-3.5 hover:border-gray-300 transition-colors">
                    <Checkbox
                      id="pendingInterviews"
                      checked={pendingInterviews}
                      onCheckedChange={(checked) => setPendingInterviews(checked as boolean)}
                    />
                    <Label htmlFor="pendingInterviews" className="cursor-pointer text-sm leading-normal text-gray-700">
                      Pending an upcoming interview
                    </Label>
                  </div>
                  <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-3.5 hover:border-gray-300 transition-colors">
                    <Checkbox
                      id="practicedMock"
                      checked={practicedMock}
                      onCheckedChange={(checked) => setPracticedMock(checked as boolean)}
                    />
                    <Label htmlFor="practicedMock" className="cursor-pointer text-sm leading-normal text-gray-700">
                      Practiced mock interviews
                    </Label>
                  </div>
                  <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-3.5 hover:border-gray-300 transition-colors">
                    <Checkbox
                      id="completedInterviews"
                      checked={completedInterviews}
                      onCheckedChange={(checked) => setCompletedInterviews(checked as boolean)}
                    />
                    <Label htmlFor="completedInterviews" className="cursor-pointer text-sm leading-normal text-gray-700">
                      Completed an interview
                    </Label>
                  </div>
                  <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-3.5 hover:border-gray-300 transition-colors">
                    <Checkbox
                      id="receivedOffers"
                      checked={receivedOffers}
                      onCheckedChange={(checked) => setReceivedOffers(checked as boolean)}
                    />
                    <Label htmlFor="receivedOffers" className="cursor-pointer text-sm leading-normal text-gray-700">
                      Received an offer
                    </Label>
                  </div>
                  <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-3.5 hover:border-gray-300 transition-colors">
                    <Checkbox
                      id="receivedRejections"
                      checked={receivedRejections}
                      onCheckedChange={(checked) => setReceivedRejections(checked as boolean)}
                    />
                    <Label htmlFor="receivedRejections" className="cursor-pointer text-sm leading-normal text-gray-700">
                      Received a rejection
                    </Label>
                  </div>
                  <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-3.5 hover:border-gray-300 transition-colors">
                    <Checkbox
                      id="possiblyGhosted"
                      checked={possiblyGhosted}
                      onCheckedChange={(checked) => setPossiblyGhosted(checked as boolean)}
                    />
                    <Label htmlFor="possiblyGhosted" className="cursor-pointer text-sm leading-normal text-gray-700">
                      Possibly been ghosted
                    </Label>
                  </div>
                </div>
              </div>

              {/* Other Section */}
              <div className="mb-8">
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">Other</h3>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={maxNotesLength}
                  placeholder="Please describe"
                  className="min-h-[120px] resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 px-12 py-6">
              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={handleNext}
                  disabled={!hasChanges}
                  className="gap-2 bg-teal-700 hover:bg-teal-800"
                >
                  <Check className="h-4 w-4" />
                  Confirm answer
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
