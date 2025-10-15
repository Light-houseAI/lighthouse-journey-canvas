import type { Todo } from '@journey/components';
import { Button, TodoList } from '@journey/components';
import { type Organization, OrganizationType } from '@journey/schema';
import { X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { z } from 'zod';

import { OrganizationSelector } from '../../../../ui/organization-selector';
import type { ApplicationModalProps, JobApplicationFormData } from './types';
import { ApplicationStatus, OutreachMethod } from './types';

const isInterviewStatus = (status: ApplicationStatus): boolean => {
  return [
    ApplicationStatus.RecruiterScreen,
    ApplicationStatus.PhoneInterview,
    ApplicationStatus.TechnicalInterview,
    ApplicationStatus.OnsiteInterview,
    ApplicationStatus.FinalInterview,
  ].includes(status);
};

export const ApplicationModal: React.FC<ApplicationModalProps> = ({
  application,
  isOpen,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState<JobApplicationFormData>({
    company: '',
    companyId: undefined,
    jobTitle: '',
    applicationDate: '',
    jobPostingUrl: '',
    applicationStatus: ApplicationStatus.Applied,
    outreachMethod: OutreachMethod.ColdApply,
    interviewContext: '',
    notes: '',
    todos: [],
  });

  // Store todos per status
  const [todosByStatus, setTodosByStatus] = useState<
    Record<ApplicationStatus, Todo[]>
  >({} as Record<ApplicationStatus, Todo[]>);
  const [currentStatus, setCurrentStatus] = useState<ApplicationStatus>(
    ApplicationStatus.Applied
  );

  const [selectedOrganization, setSelectedOrganization] =
    useState<Organization | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Initialize form data when application prop changes
  useEffect(() => {
    if (application) {
      // Initialize todosByStatus from statusData (new) or todosByStatus (legacy)
      let initialTodosByStatus: Record<ApplicationStatus, Todo[]> =
        {} as Record<ApplicationStatus, Todo[]>;
      let currentInterviewContext = '';

      if (application.statusData) {
        // New structure: extract todos and interviewContext from statusData
        for (const [status, data] of Object.entries(application.statusData)) {
          initialTodosByStatus[status as ApplicationStatus] = data.todos || [];
          if (status === application.applicationStatus) {
            currentInterviewContext = data.interviewContext || '';
          }
        }
      } else if (application.todosByStatus) {
        // Legacy structure: use todosByStatus directly
        initialTodosByStatus = application.todosByStatus;
        currentInterviewContext = application.interviewContext || '';
      }

      setTodosByStatus(initialTodosByStatus);

      // Load todos for the current application status
      const currentStatusTodos =
        initialTodosByStatus[application.applicationStatus] || [];

      setFormData({
        company: application.company,
        companyId: application.companyId,
        jobTitle: application.jobTitle,
        applicationDate: application.applicationDate,
        jobPostingUrl: application.jobPostingUrl || '',
        applicationStatus: application.applicationStatus,
        outreachMethod: application.outreachMethod,
        interviewContext: currentInterviewContext,
        notes: application.notes || '',
        todos: currentStatusTodos, // Load todos for current status, not legacy field
      });

      setCurrentStatus(application.applicationStatus);

      // Set selected organization if companyId exists
      if (application.companyId) {
        setSelectedOrganization({
          id: application.companyId,
          name: application.company,
          type: OrganizationType.Company,
        } as Organization);
      } else {
        setSelectedOrganization(null);
      }
    } else {
      // Reset to defaults for add mode
      setFormData({
        company: '',
        companyId: undefined,
        jobTitle: '',
        applicationDate: '',
        jobPostingUrl: '',
        applicationStatus: ApplicationStatus.Applied,
        outreachMethod: OutreachMethod.ColdApply,
        interviewContext: '',
        notes: '',
        todos: [],
      });
      setTodosByStatus({} as Record<ApplicationStatus, Todo[]>);
      setCurrentStatus(ApplicationStatus.Applied);
      setSelectedOrganization(null);
    }
    // Clear errors when modal opens/closes or application changes
    setErrors({});
    setSaveError(null);
  }, [application, isOpen]);

  const handleFieldChange = (
    field: keyof JobApplicationFormData,
    value: any
  ) => {
    // Handle status change specially
    if (field === 'applicationStatus') {
      const newStatus = value as ApplicationStatus;

      // Save current todos to the current status
      setTodosByStatus((prev) => ({
        ...prev,
        [currentStatus]: formData.todos,
      }));

      // Load todos for the new status (or empty array)
      const newTodos = todosByStatus[newStatus] || [];

      setFormData((prev) => ({
        ...prev,
        [field]: value,
        todos: newTodos,
      }));
      setCurrentStatus(newStatus);
    } else {
      setFormData((prev) => ({ ...prev, [field]: value }));
    }

    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
    setSaveError(null);
  };

  const handleTodoChange = (todos: Todo[]) => {
    setFormData((prev) => ({ ...prev, todos }));
    // Update todosByStatus for current status
    setTodosByStatus((prev) => ({
      ...prev,
      [currentStatus]: todos,
    }));
  };

  const handleOrganizationSelect = (org: Organization) => {
    setSelectedOrganization(org);
    setFormData((prev) => ({
      ...prev,
      company: org.name,
      companyId: org.id,
    }));
    // Clear company error
    if (errors.company) {
      setErrors((prev) => ({ ...prev, company: '' }));
    }
  };

  const handleOrganizationClear = () => {
    setSelectedOrganization(null);
    setFormData((prev) => ({
      ...prev,
      company: '',
      companyId: undefined,
    }));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Required field validation
    if (!formData.company.trim()) {
      newErrors.company = 'Company is required';
    }
    if (!formData.jobTitle.trim()) {
      newErrors.jobTitle = 'Job Title is required';
    }

    // URL validation using Zod (matches API's eventMetaSchema)
    if (formData.jobPostingUrl && formData.jobPostingUrl.trim()) {
      try {
        z.string().url().parse(formData.jobPostingUrl);
      } catch (err) {
        if (err instanceof z.ZodError) {
          newErrors.jobPostingUrl = 'Invalid URL format';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      // Save current todos to current status before submitting
      const updatedTodosByStatus = {
        ...todosByStatus,
        [currentStatus]: formData.todos,
      };

      // Convert todosByStatus to new statusData structure
      const statusData: Record<ApplicationStatus, any> = {};
      for (const [status, todos] of Object.entries(updatedTodosByStatus)) {
        statusData[status as ApplicationStatus] = {
          todos,
          interviewContext:
            status === currentStatus
              ? formData.interviewContext?.trim() || undefined
              : undefined,
        };
      }

      // Sanitize formData: convert empty strings to undefined for optional fields
      const sanitizedData: JobApplicationFormData = {
        ...formData,
        // Convert empty strings to undefined for optional string fields
        jobPostingUrl: formData.jobPostingUrl?.trim() || undefined, // Critical: empty string → undefined
        notes: formData.notes?.trim() || undefined,
        // Use new statusData structure
        statusData,
        // Clear legacy fields
        interviewContext: undefined,
        todosByStatus: undefined,
        todos: undefined,
      };

      await onSave(sanitizedData);
      onClose();
    } catch (error) {
      setSaveError((error as Error).message || 'Failed to save application');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  const showInterviewContext = isInterviewStatus(formData.applicationStatus);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="flex max-h-[90vh] w-[90vw] max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {application ? 'Edit Job Application' : 'Add Job Application'}
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          {saveError && (
            <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              Error: {saveError}
            </div>
          )}

          <div className="space-y-4">
            {/* Core Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Company
                </label>
                <OrganizationSelector
                  value={selectedOrganization}
                  onSelect={handleOrganizationSelect}
                  onClear={handleOrganizationClear}
                  placeholder="Search for organization..."
                  required
                  error={errors.company}
                  defaultOrgType={OrganizationType.Company}
                />
              </div>

              <div>
                <label
                  htmlFor="jobTitle"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Job Title
                </label>
                <input
                  id="jobTitle"
                  type="text"
                  value={formData.jobTitle}
                  onChange={(e) =>
                    handleFieldChange('jobTitle', e.target.value)
                  }
                  className={`w-full rounded-md border px-3 py-2 focus:border-teal-500 focus:ring-teal-500 ${
                    errors.jobTitle ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
                {errors.jobTitle && (
                  <p className="mt-1 text-sm text-red-600">{errors.jobTitle}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="applicationDate"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Application Date
                </label>
                <input
                  id="applicationDate"
                  type="date"
                  value={formData.applicationDate}
                  onChange={(e) =>
                    handleFieldChange('applicationDate', e.target.value)
                  }
                  className={`w-full rounded-md border px-3 py-2 focus:border-teal-500 focus:ring-teal-500 ${
                    errors.applicationDate
                      ? 'border-red-300'
                      : 'border-gray-300'
                  }`}
                />
                {errors.applicationDate && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.applicationDate}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="jobPostingUrl"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Job Posting URL
                </label>
                <input
                  id="jobPostingUrl"
                  type="url"
                  value={formData.jobPostingUrl}
                  onChange={(e) =>
                    handleFieldChange('jobPostingUrl', e.target.value)
                  }
                  placeholder="https://..."
                  className={`w-full rounded-md border px-3 py-2 focus:border-teal-500 focus:ring-teal-500 ${
                    errors.jobPostingUrl ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
                {errors.jobPostingUrl && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.jobPostingUrl}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="applicationStatus"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Status
                </label>
                <select
                  id="applicationStatus"
                  value={formData.applicationStatus}
                  onChange={(e) =>
                    handleFieldChange(
                      'applicationStatus',
                      e.target.value as ApplicationStatus
                    )
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-teal-500 focus:ring-teal-500"
                >
                  {Object.values(ApplicationStatus).map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="outreachMethod"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Outreach Method
                </label>
                <select
                  id="outreachMethod"
                  value={formData.outreachMethod}
                  onChange={(e) =>
                    handleFieldChange(
                      'outreachMethod',
                      e.target.value as OutreachMethod
                    )
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-teal-500 focus:ring-teal-500"
                >
                  {Object.values(OutreachMethod).map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Interview Context - only shown for interview statuses */}
            {showInterviewContext && (
              <div>
                <label
                  htmlFor="interviewContext"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Interview Context
                </label>
                <textarea
                  id="interviewContext"
                  value={formData.interviewContext}
                  onChange={(e) =>
                    handleFieldChange('interviewContext', e.target.value)
                  }
                  rows={3}
                  placeholder="Interview details, dates, interviewers, topics covered..."
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-teal-500 focus:ring-teal-500"
                />
              </div>
            )}

            {/* Notes */}
            <div>
              <label
                htmlFor="notes"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Notes
              </label>
              <textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleFieldChange('notes', e.target.value)}
                rows={3}
                placeholder="Additional notes about this application..."
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-teal-500 focus:ring-teal-500"
              />
            </div>

            {/* Todos for Current Status */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                To-dos for {formData.applicationStatus}
              </label>
              <p className="mb-2 text-xs text-gray-500">
                These todos are specific to the {formData.applicationStatus}{' '}
                status. Change status above to manage todos for different
                stages.
              </p>
              <TodoList todos={formData.todos} onChange={handleTodoChange} />
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={isSaving}
            className="bg-teal-700 hover:bg-teal-800"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
};
