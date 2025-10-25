import type { CreateUpdateRequest } from '@journey/schema';
import { useMutation } from '@tanstack/react-query';
import React, { useState } from 'react';

import { createUpdate } from '../../../../services/updates-api';
import { handleAPIError } from '../../../../utils/error-toast';
import { ActivitySelectionStep } from './steps/ActivitySelectionStep';
import { ApplicationMaterialsStep } from './steps/ApplicationMaterialsStep';
import { AppliedToJobsStep } from './steps/AppliedToJobsStep';
import { SuccessScreen } from './steps/SuccessScreen';

interface CareerUpdateWizardProps {
  nodeId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export interface WizardData {
  // Activity selection flags
  appliedToJobs: boolean;
  applicationMaterials?: boolean;

  // Job applications data
  appliedToJobsData?: any;

  // Application materials data
  applicationMaterialsData?: any;

  // General notes
  notes?: string;
}

export const CareerUpdateWizard: React.FC<CareerUpdateWizardProps> = ({
  nodeId,
  onSuccess,
  onCancel,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [wizardData, setWizardData] = useState<WizardData>({
    appliedToJobs: false,
    applicationMaterials: false,
  });

  const { mutate: submitUpdate } = useMutation({
    mutationFn: (data: CreateUpdateRequest) => createUpdate(nodeId, data),
    onSuccess: () => {
      setShowSuccess(true);
    },
    onError: (error) => {
      handleAPIError(error, 'Save update');
    },
  });

  // Determine which steps to show based on selected activities
  const getSteps = () => {
    const steps: Array<{
      id: string;
      component: React.FC<any>;
    }> = [{ id: 'activity-selection', component: ActivitySelectionStep }];

    if (wizardData.appliedToJobs) {
      steps.push({ id: 'applied-to-jobs', component: AppliedToJobsStep });
    }

    if (wizardData.applicationMaterials) {
      steps.push({
        id: 'application-materials',
        component: ApplicationMaterialsStep,
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
    // Transform wizard data into API format
    const updateRequest: CreateUpdateRequest = {
      notes: finalData.notes || '',
      meta: {
        appliedToJobs: finalData.appliedToJobs,
        applicationMaterials: finalData.applicationMaterials,
        // Store additional data from follow-up screens
        ...finalData.appliedToJobsData,
        ...finalData.applicationMaterialsData,
      },
    };

    submitUpdate(updateRequest);
  };

  // Helper to get steps for given data (used during wizard flow)
  const getStepsForData = (data: WizardData) => {
    const calculatedSteps: Array<{
      id: string;
      component: React.FC<any>;
    }> = [{ id: 'activity-selection', component: ActivitySelectionStep }];

    if (data.appliedToJobs) {
      calculatedSteps.push({
        id: 'applied-to-jobs',
        component: AppliedToJobsStep,
      });
    }

    if (data.applicationMaterials) {
      calculatedSteps.push({
        id: 'application-materials',
        component: ApplicationMaterialsStep,
      });
    }

    return calculatedSteps;
  };

  // Show success screen after successful submission
  if (showSuccess) {
    return <SuccessScreen nodeId={nodeId} onClose={onSuccess} />;
  }

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
