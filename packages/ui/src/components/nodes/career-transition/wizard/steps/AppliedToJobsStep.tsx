import { Button } from '@journey/components';
import { TimelineNodeType } from '@journey/schema';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, X } from 'lucide-react';
import React, { useState } from 'react';

import { hierarchyApi } from '../../../../../services/hierarchy-api';
import { handleAPIError } from '../../../../../utils/error-toast';
import type { WizardData } from '../CareerUpdateWizard';
import { ApplicationModal } from './ApplicationModal';
import { ApplicationsTable } from './ApplicationsTable';
import type { JobApplication, JobApplicationFormData } from './types';
import { EventType } from './types';

interface AppliedToJobsStepProps {
  onNext: (data: Partial<WizardData>) => void;
  onBack?: () => void;
  onCancel: () => void;
  currentStep: number;
  totalSteps: number;
  nodeId: string;
}

export const AppliedToJobsStep: React.FC<AppliedToJobsStepProps> = ({
  onNext,
  onBack,
  onCancel,
  currentStep,
  totalSteps,
  nodeId,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingApplication, setEditingApplication] = useState<
    JobApplication | undefined
  >();
  const queryClient = useQueryClient();

  // Fetch job applications
  const { data: applications = [], isLoading } = useQuery({
    queryKey: ['job-applications', nodeId],
    queryFn: async () => {
      const nodes = await hierarchyApi.listNodes();
      const appNodes = nodes.filter(
        (node) =>
          node.parentId === nodeId &&
          node.meta?.eventType === EventType.JobApplication
      );

      return appNodes.map((node) => ({
        id: node.id,
        ...node.meta,
      })) as JobApplication[];
    },
  });

  // Create job application mutation
  const createMutation = useMutation({
    mutationFn: async (formData: JobApplicationFormData) => {
      return hierarchyApi.createNode({
        type: TimelineNodeType.Event,
        parentId: nodeId,
        meta: {
          eventType: EventType.JobApplication,
          title: `${formData.company} - ${formData.jobTitle}`,
          description: `Status: ${formData.applicationStatus}`,
          startDate: formData.applicationDate
            ? formData.applicationDate.substring(0, 7)
            : undefined,
          ...formData,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-applications', nodeId] });
      setIsModalOpen(false);
      setEditingApplication(undefined);
    },
    onError: (error) => {
      handleAPIError(error, 'Create job application');
    },
  });

  // Update job application mutation
  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: JobApplicationFormData;
    }) => {
      return hierarchyApi.updateNode(id, {
        meta: {
          eventType: EventType.JobApplication,
          title: `${data.company} - ${data.jobTitle}`,
          description: `Status: ${data.applicationStatus}`,
          startDate: data.applicationDate
            ? data.applicationDate.substring(0, 7)
            : undefined,
          ...data,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-applications', nodeId] });
      setIsModalOpen(false);
      setEditingApplication(undefined);
    },
    onError: (error) => {
      handleAPIError(error, 'Update job application');
    },
  });

  // Delete job application mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return hierarchyApi.deleteNode(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-applications', nodeId] });
    },
    onError: (error) => {
      handleAPIError(error, 'Delete job application');
    },
  });

  const handleAdd = () => {
    setEditingApplication(undefined);
    setIsModalOpen(true);
  };

  const handleEdit = (application: JobApplication) => {
    setEditingApplication(application);
    setIsModalOpen(true);
  };

  const handleSave = async (formData: JobApplicationFormData) => {
    if (editingApplication) {
      await updateMutation.mutateAsync({
        id: editingApplication.id,
        data: formData,
      });
    } else {
      await createMutation.mutateAsync(formData);
    }
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const handleNext = () => {
    onNext({
      appliedToJobsData: {
        applications,
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="flex h-[90vh] w-[90vw] max-w-6xl overflow-hidden rounded-lg bg-white shadow-xl">
        {/* Left Panel - Stepper */}
        <div className="w-1/3 bg-gray-50 p-8">
          <div className="flex items-start gap-4">
            {/* Step indicator */}
            <div className="flex flex-col items-center">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-600 text-white">
                <Check className="h-4 w-4" />
              </div>
              {totalSteps > currentStep + 1 && (
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
                Step {currentStep + 1} of {totalSteps}: Job Applications
              </div>
              <div className="mt-2 text-xs text-gray-500">
                Track your job applications and interview progress
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Content */}
        <div className="flex flex-1 flex-col">
          {/* Header */}
          <div className="relative border-b border-gray-200 px-8 py-4">
            <Button
              onClick={onCancel}
              variant="ghost"
              className="absolute left-4 top-4 gap-2 text-sm"
              type="button"
            >
              <X className="h-4 w-4" />
              <span>Cancel update</span>
            </Button>
            <h2 className="text-center text-lg font-semibold text-gray-900">
              Add job search progress
            </h2>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-8">
            <div className="mb-6">
              <div className="mb-4 inline-flex rounded-lg bg-teal-50 px-3 py-1 text-sm font-medium text-teal-700">
                Application or interview progress
              </div>
              <h1 className="mb-2 text-3xl font-bold text-gray-900">
                What progress have you made in applications or interviews?
              </h1>
              <p className="text-gray-600">
                Focus on the jobs you feel you are a strong fit for. Add new job
                applications or update jobs in your interview pipeline and see
                who you can be connected to for help.
              </p>
            </div>

            <ApplicationsTable
              applications={applications}
              onAdd={handleAdd}
              onEdit={handleEdit}
              onDelete={handleDelete}
              isLoading={isLoading}
            />
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 px-8 py-4">
            <div className="flex justify-between">
              {onBack && (
                <Button
                  type="button"
                  onClick={onBack}
                  variant="outline"
                  className="gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
              )}
              <Button
                type="button"
                onClick={handleNext}
                className="ml-auto gap-2 bg-teal-700 hover:bg-teal-800"
              >
                Continue
                <Check className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <ApplicationModal
          application={editingApplication}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingApplication(undefined);
          }}
          onSave={handleSave}
        />
      )}
    </div>
  );
};
