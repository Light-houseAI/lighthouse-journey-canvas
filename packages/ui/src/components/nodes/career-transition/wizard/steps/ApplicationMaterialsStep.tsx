/**
 * Application Materials Step
 *
 * Wizard step component for managing application materials (resumes and LinkedIn profile)
 * Features inline tabs for resume table and LinkedIn form
 */

import { Button, TabsGroup } from '@journey/components';
import { LINKEDIN_TYPE } from '@journey/schema';
import { ArrowLeft, Check, X } from 'lucide-react';
import React, { useRef, useState } from 'react';

import {
  useApplicationMaterials,
  useCareerTransitionNode,
} from '../../../../../hooks/use-application-materials';
import type { WizardData } from '../CareerUpdateWizard';
import { LinkedInTab, LinkedInTabHandle } from './LinkedInTab';
import { ResumesTab } from './ResumesTab';

interface ApplicationMaterialsStepProps {
  onNext: (data: Partial<WizardData>) => void;
  onBack?: () => void;
  onCancel: () => void;
  currentStep: number;
  totalSteps: number;
  nodeId: string;
}

export const ApplicationMaterialsStep: React.FC<
  ApplicationMaterialsStepProps
> = ({ onNext, onBack, onCancel, currentStep, totalSteps, nodeId }) => {
  const [activeTab, setActiveTab] = useState<'resume' | 'linkedin'>('resume');
  const linkedInTabRef = useRef<LinkedInTabHandle>(null);

  // Fetch existing materials and node data
  const { data: materials, isLoading: isMaterialsLoading } =
    useApplicationMaterials(nodeId);
  const { isLoading: isNodeLoading } = useCareerTransitionNode(nodeId);

  const isLoading = isMaterialsLoading || isNodeLoading;

  // Count resume entries and check if LinkedIn profile exists
  const resumeItems =
    materials?.items?.filter((item) => item.type !== LINKEDIN_TYPE) || [];
  const linkedInEntry = materials?.items?.find(
    (item) => item.type === LINKEDIN_TYPE
  );
  const resumeCount = resumeItems.length;
  const hasLinkedInProfile = !!linkedInEntry;

  const handleNext = async () => {
    // Save LinkedIn profile if there are changes
    if (linkedInTabRef.current?.hasChanges) {
      const saved = await linkedInTabRef.current.saveIfNeeded();
      if (!saved) {
        // Don't proceed if save failed
        return;
      }
    }

    onNext({
      applicationMaterialsData: {
        resumeCount,
        hasLinkedInProfile,
      },
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
              {/* Previous steps */}
              {currentStep > 0 && (
                <>
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-600 text-white">
                    <Check className="h-4 w-4" />
                  </div>
                  <div className="mt-2 h-16 w-0.5 bg-teal-600" />
                </>
              )}

              {/* Current step */}
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-600 text-white">
                <Check className="h-4 w-4" />
              </div>

              {/* Future steps */}
              {currentStep < totalSteps - 1 && (
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
              <div className="text-sm font-normal text-gray-700">
                Step {currentStep + 1}: Application materials
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Content */}
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
            <h2 className="text-base font-semibold text-gray-900">
              Add update
            </h2>
          </div>

          {/* Scrollable Content */}
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-12 py-8">
              {/* Main Question */}
              <div className="mb-10">
                <h1 className="mb-3 text-[32px] font-bold leading-tight text-gray-900">
                  Update your application materials
                </h1>
                <p className="text-base text-gray-600">
                  Keep your resumes and LinkedIn profile current for your job
                  search.
                </p>
              </div>

              {/* Loading State */}
              {isLoading && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
                  <p className="text-gray-600">Loading materials...</p>
                </div>
              )}

              {/* Custom Tabs */}
              {!isLoading && (
                <div className="w-full space-y-6">
                  {/* Tab Buttons */}
                  <TabsGroup
                    label="View"
                    options={[
                      { value: 'resume', label: `Resumes (${resumeCount})` },
                      { value: 'linkedin', label: 'LinkedIn Profile' },
                    ]}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                  />

                  {/* Tab Content */}
                  {activeTab === 'resume' ? (
                    <ResumesTab
                      careerTransitionId={nodeId}
                      resumeItems={resumeItems}
                    />
                  ) : (
                    <LinkedInTab
                      ref={linkedInTabRef}
                      careerTransitionId={nodeId}
                      linkedInEntry={linkedInEntry}
                    />
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 px-12 py-6">
              <div className="flex justify-between">
                {onBack && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onBack}
                    className="gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </Button>
                )}
                <div className="flex-1" />
                <Button
                  type="button"
                  onClick={handleNext}
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
};
