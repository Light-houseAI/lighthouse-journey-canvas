import type { CreateUpdateRequest } from '@journey/schema';
import { useMutation } from '@tanstack/react-query';
import React, { useState } from 'react';

import { hierarchyApi } from '../../../../services/hierarchy-api';
import { createUpdate } from '../../../../services/updates-api';
import { handleAPIError } from '../../../../utils/error-toast';
import { ActivitySelectionStep } from './steps/ActivitySelectionStep';
import { ApplicationMaterialsStep } from './steps/ApplicationMaterialsStep';
import { AppliedToJobsStep } from './steps/AppliedToJobsStep';
import { BrandBuildingStep } from './steps/BrandBuildingStep';
import { NetworkingStep } from './steps/NetworkingStep';
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
  networking?: boolean;
  brandBuilding?: boolean;

  // Job applications data
  appliedToJobsData?: any;

  // Application materials data
  applicationMaterialsData?: any;

  // Networking data
  networkingData?: any;

  // Brand building data
  brandBuildingData?: any;

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
    networking: false,
    brandBuilding: false,
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

    if (wizardData.networking) {
      steps.push({
        id: 'networking',
        component: NetworkingStep,
      });
    }

    if (wizardData.brandBuilding) {
      steps.push({
        id: 'brand-building',
        component: BrandBuildingStep,
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

  const handleSubmit = async (finalData: WizardData) => {
    try {
      // Fetch current node once for both networking and brand building
      const currentNode = await hierarchyApi.getNode(nodeId);
      let updatedMeta = { ...currentNode?.meta };

      // Handle networking activities - save to node.meta (not update.meta)
      if (finalData.networkingData?.activities) {
        const existingNetworkingData = currentNode?.meta?.networkingData as any;
        const existingActivities =
          (existingNetworkingData?.activities as Record<string, any[]>) || {};

        // Group new activities by type
        const newActivitiesByType: Record<string, any[]> = {};
        for (const activity of finalData.networkingData.activities) {
          const type = activity.networkingType;
          if (!newActivitiesByType[type]) {
            newActivitiesByType[type] = [];
          }
          newActivitiesByType[type].push(activity);
        }

        // Merge with existing activities
        const updatedActivities: Record<string, any[]> = {
          ...existingActivities,
        };
        for (const [type, activities] of Object.entries(newActivitiesByType)) {
          if (!updatedActivities[type]) {
            updatedActivities[type] = [];
          }
          updatedActivities[type] = [...updatedActivities[type], ...activities];
        }

        updatedMeta = {
          ...updatedMeta,
          networkingData: {
            activities: updatedActivities,
          },
        };
      }

      // Handle brand building activities - save to node.meta
      if (finalData.brandBuildingData?.activities) {
        const existingBrandBuildingData = currentNode?.meta?.brandBuildingData as any;
        const existingActivities =
          (existingBrandBuildingData?.activities as Record<string, any[]>) || {};

        // Merge with existing activities by platform
        const updatedBrandActivities: Record<string, any[]> = {
          ...existingActivities,
        };
        for (const [platform, activities] of Object.entries(
          finalData.brandBuildingData.activities
        )) {
          if (!updatedBrandActivities[platform]) {
            updatedBrandActivities[platform] = [];
          }
          updatedBrandActivities[platform] = [
            ...updatedBrandActivities[platform],
            ...(activities as any[]),
          ];
        }

        updatedMeta = {
          ...updatedMeta,
          brandBuildingData: {
            activities: updatedBrandActivities,
          },
        };
      }

      // Update node meta if there are changes
      if (finalData.networkingData?.activities || finalData.brandBuildingData?.activities) {
        await hierarchyApi.updateNode(nodeId, {
          meta: updatedMeta,
        });
      }

      // Transform wizard data into API format for update record
      const updateRequest: CreateUpdateRequest = {
        notes: finalData.notes || '',
        meta: {
          appliedToJobs: finalData.appliedToJobs,
          applicationMaterials: finalData.applicationMaterials,
          networked: finalData.networking,
          brandBuilding: finalData.brandBuilding,
          // Store additional data from follow-up screens
          ...finalData.appliedToJobsData,
          ...finalData.applicationMaterialsData,
          // Don't store networkingData or brandBuildingData in update.meta anymore
        },
      };

      submitUpdate(updateRequest);
    } catch (error) {
      console.error('Failed to submit career update:', error);
      // Still try to submit the update record even if node update fails
      const updateRequest: CreateUpdateRequest = {
        notes: finalData.notes || '',
        meta: {
          appliedToJobs: finalData.appliedToJobs,
          applicationMaterials: finalData.applicationMaterials,
          networked: finalData.networking,
          brandBuilding: finalData.brandBuilding,
          ...finalData.appliedToJobsData,
          ...finalData.applicationMaterialsData,
        },
      };
      submitUpdate(updateRequest);
    }
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

    if (data.networking) {
      calculatedSteps.push({
        id: 'networking',
        component: NetworkingStep,
      });
    }

    if (data.brandBuilding) {
      calculatedSteps.push({
        id: 'brand-building',
        component: BrandBuildingStep,
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
