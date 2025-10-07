import type { CreateUpdateRequest } from '@journey/schema';
import { useMutation } from '@tanstack/react-query';
import React, { useState } from 'react';

import { createUpdate } from '../../../../services/updates-api';
import { handleAPIError } from '../../../../utils/error-toast';
import { ActivitySelectionStep } from './steps/ActivitySelectionStep';
import { AppliedToJobsStep } from './steps/AppliedToJobsStep';
import { InterviewActivityStep } from './steps/InterviewActivityStep';
import { MockInterviewStep } from './steps/MockInterviewStep';
import { NetworkingStep } from './steps/NetworkingStep';
import { ResumeUpdateStep } from './steps/ResumeUpdateStep';
import { SkillDevelopmentStep } from './steps/SkillDevelopmentStep';

interface CareerUpdateWizardProps {
  nodeId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export interface WizardData {
  // Activity selection flags
  appliedToJobs: boolean;
  updatedResumeOrPortfolio: boolean;
  networked: boolean;
  developedSkills: boolean;
  pendingInterviews: boolean;
  completedInterviews: boolean;
  practicedMock: boolean;
  receivedOffers: boolean;
  receivedRejections: boolean;
  possiblyGhosted: boolean;

  // Additional data from follow-up screens
  appliedToJobsData?: any;
  appliedToJobsNotes?: string;
  resumeUpdateData?: any;
  resumeUpdateNotes?: string;
  networkingData?: any;
  networkingNotes?: string;
  skillDevelopmentData?: any;
  skillDevelopmentNotes?: string;
  interviewActivityData?: any;
  mockInterviewNotes?: string;

  // General notes
  notes?: string;
}

export const CareerUpdateWizard: React.FC<CareerUpdateWizardProps> = ({
  nodeId,
  onSuccess,
  onCancel,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [wizardData, setWizardData] = useState<WizardData>({
    appliedToJobs: false,
    updatedResumeOrPortfolio: false,
    networked: false,
    developedSkills: false,
    pendingInterviews: false,
    completedInterviews: false,
    practicedMock: false,
    receivedOffers: false,
    receivedRejections: false,
    possiblyGhosted: false,
  });

  const { mutate: submitUpdate } = useMutation({
    mutationFn: (data: CreateUpdateRequest) => createUpdate(nodeId, data),
    onSuccess: () => {
      onSuccess();
    },
    onError: (error) => {
      handleAPIError(error, 'Save update');
    },
  });

  // Determine which steps to show based on selected activities
  const getSteps = () => {
    const steps = [
      { id: 'activity-selection', component: ActivitySelectionStep },
    ];

    if (wizardData.appliedToJobs) {
      steps.push({ id: 'applied-to-jobs', component: AppliedToJobsStep });
    }
    if (wizardData.updatedResumeOrPortfolio) {
      steps.push({ id: 'resume-update', component: ResumeUpdateStep });
    }
    if (wizardData.networked) {
      steps.push({ id: 'networking', component: NetworkingStep });
    }
    if (wizardData.developedSkills) {
      steps.push({ id: 'skill-development', component: SkillDevelopmentStep });
    }

    // Mock interview practice gets its own step
    if (wizardData.practicedMock) {
      steps.push({ id: 'mock-interview', component: MockInterviewStep });
    }

    // Other interview-related activities trigger the interview step
    if (
      wizardData.pendingInterviews ||
      wizardData.completedInterviews ||
      wizardData.receivedOffers ||
      wizardData.receivedRejections ||
      wizardData.possiblyGhosted
    ) {
      steps.push({
        id: 'interview-activity',
        component: InterviewActivityStep,
      });
    }

    return steps;
  };

  const steps = getSteps();
  const CurrentStepComponent = steps[currentStep]?.component;

  const handleNext = (stepData: Partial<WizardData>) => {
    const updatedData = { ...wizardData, ...stepData };
    setWizardData(updatedData);

    // Recalculate steps with updated data
    const newSteps = getStepsForData(updatedData);

    if (currentStep < newSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Final step - submit the update
      handleSubmit(updatedData);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = (finalData: WizardData) => {
    // Combine all activity notes into a single notes field
    const noteSections: string[] = [];

    if (finalData.appliedToJobsNotes) {
      noteSections.push(`Applied to Jobs:\n${finalData.appliedToJobsNotes}`);
    }
    if (finalData.resumeUpdateNotes) {
      noteSections.push(
        `Resume/Portfolio Update:\n${finalData.resumeUpdateNotes}`
      );
    }
    if (finalData.networkingNotes) {
      noteSections.push(`Networking:\n${finalData.networkingNotes}`);
    }
    if (finalData.skillDevelopmentNotes) {
      noteSections.push(
        `Skill Development:\n${finalData.skillDevelopmentNotes}`
      );
    }
    if (finalData.mockInterviewNotes) {
      noteSections.push(
        `Mock Interview Practice:\n${finalData.mockInterviewNotes}`
      );
    }
    if (finalData.notes) {
      noteSections.push(`General Notes:\n${finalData.notes}`);
    }

    const combinedNotes = noteSections.join('\n\n');

    // Transform wizard data into API format
    const updateRequest: CreateUpdateRequest = {
      notes: combinedNotes,
      meta: {
        appliedToJobs: finalData.appliedToJobs,
        updatedResumeOrPortfolio: finalData.updatedResumeOrPortfolio,
        networked: finalData.networked,
        developedSkills: finalData.developedSkills,
        pendingInterviews: finalData.pendingInterviews,
        completedInterviews: finalData.completedInterviews,
        practicedMock: finalData.practicedMock,
        receivedOffers: finalData.receivedOffers,
        receivedRejections: finalData.receivedRejections,
        possiblyGhosted: finalData.possiblyGhosted,
        // Store additional data from follow-up screens
        ...finalData.appliedToJobsData,
        ...finalData.resumeUpdateData,
        ...finalData.networkingData,
        ...finalData.skillDevelopmentData,
        ...finalData.interviewActivityData,
      },
    };

    submitUpdate(updateRequest);
  };

  // Helper to get steps for given data (used during wizard flow)
  const getStepsForData = (data: WizardData) => {
    const calculatedSteps = [
      { id: 'activity-selection', component: ActivitySelectionStep },
    ];

    if (data.appliedToJobs) {
      calculatedSteps.push({
        id: 'applied-to-jobs',
        component: AppliedToJobsStep,
      });
    }
    if (data.updatedResumeOrPortfolio) {
      calculatedSteps.push({
        id: 'resume-update',
        component: ResumeUpdateStep,
      });
    }
    if (data.networked) {
      calculatedSteps.push({ id: 'networking', component: NetworkingStep });
    }
    if (data.developedSkills) {
      calculatedSteps.push({
        id: 'skill-development',
        component: SkillDevelopmentStep,
      });
    }
    if (data.practicedMock) {
      calculatedSteps.push({
        id: 'mock-interview',
        component: MockInterviewStep,
      });
    }
    if (
      data.pendingInterviews ||
      data.completedInterviews ||
      data.receivedOffers ||
      data.receivedRejections ||
      data.possiblyGhosted
    ) {
      calculatedSteps.push({
        id: 'interview-activity',
        component: InterviewActivityStep,
      });
    }

    return calculatedSteps;
  };

  if (!CurrentStepComponent) {
    return null;
  }

  // Calculate activity number for detail steps (excluding first activity selection step)
  const activityNumber = currentStep > 0 ? currentStep : undefined;
  const totalActivities = steps.length > 1 ? steps.length - 1 : undefined;

  return (
    <CurrentStepComponent
      data={wizardData}
      onNext={handleNext}
      onBack={currentStep > 0 ? handleBack : undefined}
      onCancel={onCancel}
      currentStep={currentStep}
      totalSteps={steps.length}
      activityNumber={activityNumber}
      totalActivities={totalActivities}
      nodeId={nodeId}
    />
  );
};
