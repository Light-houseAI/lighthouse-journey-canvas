import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { X, Check, Circle, CheckCircle2 } from 'lucide-react';
import { Checkbox } from '../../ui/checkbox';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { createUpdate } from '../../../services/updates-api';
import { handleAPIError } from '../../../utils/error-toast';
import type { CreateUpdateRequest } from '@journey/schema';

interface CareerUpdateFormProps {
  nodeId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export const CareerUpdateForm: React.FC<CareerUpdateFormProps> = ({ nodeId, onSuccess, onCancel }) => {
  const [notes, setNotes] = useState('');
  const maxNotesLength = 1000;

  // Job Search Prep checkboxes
  const [appliedToJobs, setAppliedToJobs] = useState(false);
  const [updatedResumeOrPortfolio, setUpdatedResumeOrPortfolio] = useState(false);
  const [networked, setNetworked] = useState(false);
  const [developedSkills, setDevelopedSkills] = useState(false);

  // Interview Activity checkboxes
  const [pendingInterviews, setPendingInterviews] = useState(false);
  const [completedInterviews, setCompletedInterviews] = useState(false);
  const [practicedMock, setPracticedMock] = useState(false);
  const [receivedOffers, setReceivedOffers] = useState(false);
  const [receivedRejections, setReceivedRejections] = useState(false);
  const [possiblyGhosted, setPossiblyGhosted] = useState(false);

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

  // Mutation for creating update
  const { mutate: submitUpdate, isPending } = useMutation({
    mutationFn: (data: CreateUpdateRequest) => createUpdate(nodeId, data),
    onSuccess: () => {
      onSuccess();
    },
    onError: (error) => {
      handleAPIError(error, 'Save update');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const data: CreateUpdateRequest = {
      notes: notes.trim() || undefined,
      meta: {
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
      },
    };

    submitUpdate(data);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="flex h-[90vh] w-[90vw] max-w-6xl overflow-hidden rounded-lg bg-white shadow-xl">
        {/* Left Panel - Stepper */}
        <div className="w-1/3 bg-gray-50 p-8">
          <div className="flex items-start gap-4">
            {/* Step indicator */}
            <div className="flex flex-col items-center">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500 text-white">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="mt-2 h-16 w-0.5 bg-gray-300" />
              <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-gray-300 bg-white">
                <Circle className="h-4 w-4 text-gray-300" />
              </div>
            </div>

            {/* Step content */}
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900">Step 1: Confirm activities</div>
            </div>
          </div>
        </div>

        {/* Right Panel - Form Content */}
        <div className="flex flex-1 flex-col">
          {/* Header */}
          <div className="relative border-b border-gray-200 px-8 py-4">
            <button
              onClick={onCancel}
              className="absolute left-4 top-4 flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
              type="button"
            >
              <X className="h-4 w-4" />
              <span>Cancel update</span>
            </button>
            <h2 className="text-center text-lg font-semibold text-gray-900">Add update</h2>
          </div>

          {/* Scrollable Content */}
          <form onSubmit={handleSubmit} className="flex flex-1 flex-col">
            <div className="flex-1 overflow-y-auto px-8 py-6">
              {/* Main Question */}
              <div className="mb-8">
                <h1 className="mb-2 text-3xl font-bold text-gray-900">
                  What's new in your job search journey since we last checked in?
                </h1>
                <p className="text-gray-600">Select all that happened.</p>
              </div>

              {/* Job Search Preparation Section */}
              <div className="mb-8">
                <h3 className="mb-4 text-sm font-semibold text-gray-900">Job search preparation</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-300">
                    <Checkbox
                      id="appliedToJobs"
                      checked={appliedToJobs}
                      onCheckedChange={(checked) => setAppliedToJobs(checked as boolean)}
                    />
                    <Label htmlFor="appliedToJobs" className="cursor-pointer text-sm leading-relaxed">
                      Applied to jobs with strong fit
                    </Label>
                  </div>
                  <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-300">
                    <Checkbox
                      id="updatedResumeOrPortfolio"
                      checked={updatedResumeOrPortfolio}
                      onCheckedChange={(checked) => setUpdatedResumeOrPortfolio(checked as boolean)}
                    />
                    <Label htmlFor="updatedResumeOrPortfolio" className="cursor-pointer text-sm leading-relaxed">
                      Updated my resume or portfolio
                    </Label>
                  </div>
                  <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-300">
                    <Checkbox
                      id="networked"
                      checked={networked}
                      onCheckedChange={(checked) => setNetworked(checked as boolean)}
                    />
                    <Label htmlFor="networked" className="cursor-pointer text-sm leading-relaxed">
                      Networked (via messages, meetings, or events)
                    </Label>
                  </div>
                  <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-300">
                    <Checkbox
                      id="developedSkills"
                      checked={developedSkills}
                      onCheckedChange={(checked) => setDevelopedSkills(checked as boolean)}
                    />
                    <Label htmlFor="developedSkills" className="cursor-pointer text-sm leading-relaxed">
                      Developed skills (through courses or self-learning)
                    </Label>
                  </div>
                </div>
              </div>

              {/* Interview Activity Section */}
              <div className="mb-8">
                <h3 className="mb-4 text-sm font-semibold text-gray-900">Interview activity</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-300">
                    <Checkbox
                      id="pendingInterviews"
                      checked={pendingInterviews}
                      onCheckedChange={(checked) => setPendingInterviews(checked as boolean)}
                    />
                    <Label htmlFor="pendingInterviews" className="cursor-pointer text-sm leading-relaxed">
                      Pending an upcoming interview
                    </Label>
                  </div>
                  <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-300">
                    <Checkbox
                      id="practicedMock"
                      checked={practicedMock}
                      onCheckedChange={(checked) => setPracticedMock(checked as boolean)}
                    />
                    <Label htmlFor="practicedMock" className="cursor-pointer text-sm leading-relaxed">
                      Practiced mock interviews
                    </Label>
                  </div>
                  <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-300">
                    <Checkbox
                      id="completedInterviews"
                      checked={completedInterviews}
                      onCheckedChange={(checked) => setCompletedInterviews(checked as boolean)}
                    />
                    <Label htmlFor="completedInterviews" className="cursor-pointer text-sm leading-relaxed">
                      Completed an interview
                    </Label>
                  </div>
                  <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-300">
                    <Checkbox
                      id="receivedOffers"
                      checked={receivedOffers}
                      onCheckedChange={(checked) => setReceivedOffers(checked as boolean)}
                    />
                    <Label htmlFor="receivedOffers" className="cursor-pointer text-sm leading-relaxed">
                      Received an offer
                    </Label>
                  </div>
                  <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-300">
                    <Checkbox
                      id="receivedRejections"
                      checked={receivedRejections}
                      onCheckedChange={(checked) => setReceivedRejections(checked as boolean)}
                    />
                    <Label htmlFor="receivedRejections" className="cursor-pointer text-sm leading-relaxed">
                      Received a rejection
                    </Label>
                  </div>
                  <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-300">
                    <Checkbox
                      id="possiblyGhosted"
                      checked={possiblyGhosted}
                      onCheckedChange={(checked) => setPossiblyGhosted(checked as boolean)}
                    />
                    <Label htmlFor="possiblyGhosted" className="cursor-pointer text-sm leading-relaxed">
                      Possibly been ghosted
                    </Label>
                  </div>
                </div>
              </div>

              {/* Other Section */}
              <div className="mb-8">
                <h3 className="mb-4 text-sm font-semibold text-gray-900">Other</h3>
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
            <div className="border-t border-gray-200 px-8 py-4">
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!hasChanges || isPending}
                  className="flex items-center gap-2 rounded-lg bg-green-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                  Confirm answer
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
