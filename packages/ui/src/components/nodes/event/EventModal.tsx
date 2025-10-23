// Dialog components removed - now pure form component
import { Input, Label, Textarea, VStack } from '@journey/components';
import {
  eventMetaSchema,
  EventType,
  TimelineNode,
  TimelineNodeType,
} from '@journey/schema';
import { useMutation } from '@tanstack/react-query';
import React, { useCallback, useState } from 'react';
import { z } from 'zod';

import { useCurrentUser } from '../../../hooks/useAuth';
import { useCreateNode, useUpdateNode } from '../../../hooks/useTimeline';
import { handleAPIError, showSuccessToast } from '../../../utils/error-toast';

// Use shared schema as single source of truth
type EventFormData = z.infer<typeof eventMetaSchema>;
type FieldErrors = Partial<Record<keyof EventFormData, string>>;

// NodeContext removed - pure form component

interface EventFormProps {
  node?: TimelineNode; // Optional - if provided, we're in UPDATE mode
  parentId?: string; // Optional - if provided, create as child of this parent
  onSuccess?: () => void; // Called when form submission succeeds
  onFailure?: (error: string) => void; // Called when form submission fails
}

export const EventForm: React.FC<EventFormProps> = ({
  node,
  parentId,
  onSuccess,
  onFailure,
}) => {
  // Get authentication state and TanStack Query mutations
  const { data: user } = useCurrentUser();
  const isAuthenticated = !!user;
  const createNodeMutation = useCreateNode();
  const updateNodeMutation = useUpdateNode();

  const isUpdateMode = Boolean(node);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formData, setFormData] = useState<EventFormData>({
    // Required fields
    title: node?.meta.title || '',
    eventType: node?.meta.eventType || EventType.Other,

    // Basic optional fields
    description: node?.meta.description || undefined,
    startDate: node?.meta.startDate || undefined,
    endDate: node?.meta.endDate || undefined,
    notes: node?.meta.notes || undefined,

    // Interview-specific fields
    company: node?.meta.company || undefined,
    role: node?.meta.role || undefined,
    stage: node?.meta.stage || undefined,
    status: node?.meta.status || undefined,
    scheduledAt: node?.meta.scheduledAt || undefined,
    outcomeAt: node?.meta.outcomeAt || undefined,
    contact: node?.meta.contact || undefined,
    medium: node?.meta.medium || undefined,

    // Job application-specific fields
    companyId: node?.meta.companyId || undefined,
    jobTitle: node?.meta.jobTitle || undefined,
    applicationDate: node?.meta.applicationDate || undefined,
    jobPostingUrl: node?.meta.jobPostingUrl || undefined, // URL field - must be valid or undefined
    applicationStatus: node?.meta.applicationStatus || undefined,
    outreachMethod: node?.meta.outreachMethod || undefined,
    interviewContext: node?.meta.interviewContext || undefined,
  });

  const validateField = useCallback(
    (name: keyof EventFormData, value: string) => {
      try {
        const testData = { [name]: value || undefined };
        const fieldSchema = z.object({ [name]: eventMetaSchema.shape[name] });
        fieldSchema.parse(testData);
        setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
        return true;
      } catch (err) {
        if (err instanceof z.ZodError) {
          const errorMessage = err.errors[0]?.message || 'Invalid value';
          setFieldErrors((prev) => ({ ...prev, [name]: errorMessage }));
        }
        return false;
      }
    },
    []
  );

  const handleInputChange = (name: keyof EventFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Real-time validation with debounce for better UX
    setTimeout(() => validateField(name, value), 300);
  };

  // TanStack Query mutations
  const createEventMutation = useMutation({
    mutationFn: async (data: EventFormData) => {
      if (!user || !isAuthenticated) {
        throw new Error('User not authenticated. Please log in again.');
      }

      const validatedData = eventMetaSchema.parse(data);

      // Use TanStack Query mutation (already handles cache invalidation)
      const result = await createNodeMutation.mutateAsync({
        type: 'event' as TimelineNodeType,
        parentId: parentId ?? undefined,
        meta: validatedData,
      });

      return result;
    },
    onSuccess: () => {
      // Reset form on successful creation
      setFormData({
        title: '',
        eventType: EventType.Other,
        description: undefined,
        startDate: undefined,
        endDate: undefined,
        notes: undefined,
        company: undefined,
        role: undefined,
        stage: undefined,
        status: undefined,
        scheduledAt: undefined,
        outcomeAt: undefined,
        contact: undefined,
        medium: undefined,
        companyId: undefined,
        jobTitle: undefined,
        applicationDate: undefined,
        jobPostingUrl: undefined,
        applicationStatus: undefined,
        outreachMethod: undefined,
        interviewContext: undefined,
      });
      setFieldErrors({});

      showSuccessToast('Event added successfully!');
      onSuccess?.();
    },
    onError: (error) => {
      if (error instanceof z.ZodError) {
        const errors: FieldErrors = {};
        error.errors.forEach((err) => {
          if (err.path.length > 0) {
            const fieldName = err.path[0] as keyof EventFormData;
            errors[fieldName] = err.message;
          }
        });
        setFieldErrors(errors);
      } else {
        handleAPIError(error, 'Event creation');
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to create event';
        onFailure?.(errorMessage);
      }
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: async (data: EventFormData) => {
      if (!user || !isAuthenticated) {
        throw new Error('User not authenticated. Please log in again.');
      }

      if (!node) {
        throw new Error('Node not found for update');
      }

      const validatedData = eventMetaSchema.parse(data);

      // Use TanStack Query mutation (already handles cache invalidation)
      const result = await updateNodeMutation.mutateAsync({
        id: node.id,
        updates: { meta: validatedData },
      });

      return result;
    },
    onSuccess: () => {
      setFieldErrors({});
      showSuccessToast('Event updated successfully!');
      onSuccess?.();
    },
    onError: (error) => {
      if (error instanceof z.ZodError) {
        const errors: FieldErrors = {};
        error.errors.forEach((err) => {
          if (err.path.length > 0) {
            const fieldName = err.path[0] as keyof EventFormData;
            errors[fieldName] = err.message;
          }
        });
        setFieldErrors(errors);
      } else {
        handleAPIError(error, 'Event update');
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to update event';
        onFailure?.(errorMessage);
      }
    },
  });

  const handleFormSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFieldErrors({});

    // Sanitize formData: convert empty strings to undefined for optional fields
    const sanitizedData: EventFormData = {
      ...formData,
      // Convert empty strings to undefined for all optional string fields
      description: formData.description?.trim() || undefined,
      startDate: formData.startDate?.trim() || undefined,
      endDate: formData.endDate?.trim() || undefined,
      notes: formData.notes?.trim() || undefined,
      company: formData.company?.trim() || undefined,
      role: formData.role?.trim() || undefined,
      contact: formData.contact?.trim() || undefined,
      medium: formData.medium?.trim() || undefined,
      jobTitle: formData.jobTitle?.trim() || undefined,
      applicationDate: formData.applicationDate?.trim() || undefined,
      jobPostingUrl: formData.jobPostingUrl?.trim() || undefined, // Critical: empty string → undefined
      interviewContext: formData.interviewContext?.trim() || undefined,
    };

    // Validate entire form before submission
    try {
      eventMetaSchema.parse(sanitizedData);
    } catch (err) {
      if (err instanceof z.ZodError) {
        const errors: FieldErrors = {};
        err.errors.forEach((error) => {
          if (error.path.length > 0) {
            const fieldName = error.path[0] as keyof EventFormData;
            errors[fieldName] = error.message;
          }
        });
        setFieldErrors(errors);
        // Don't call onFailure - this is just client-side validation
        return; // Stop submission
      }
    }

    if (isUpdateMode) {
      await updateEventMutation.mutateAsync(sanitizedData);
    } else {
      await createEventMutation.mutateAsync(sanitizedData);
    }
  };

  return (
    <form id="event-form" onSubmit={handleFormSubmit} className="add-node-form">
      <VStack spacing={6}>
        <VStack spacing={2}>
          <Label htmlFor="title" className="font-medium text-gray-700">
            Title *
          </Label>
          <Input
            id="title"
            name="title"
            required
            value={formData.title}
            onChange={(e) => handleInputChange('title', e.target.value)}
            placeholder="Event title"
            className={`border-gray-300 bg-white text-gray-900 placeholder:text-gray-500 focus:border-purple-500 focus:ring-purple-500 ${
              fieldErrors.title
                ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                : ''
            }`}
          />
          {fieldErrors.title && (
            <p className="text-sm text-red-600">{fieldErrors.title}</p>
          )}
        </VStack>

        <VStack spacing={2}>
          <Label htmlFor="description" className="font-medium text-gray-700">
            Description
          </Label>
          <Textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            placeholder="Event description"
            rows={3}
            className="border-gray-300 bg-white text-gray-900 placeholder:text-gray-500 focus:border-purple-500 focus:ring-purple-500"
          />
        </VStack>

        <div className="grid grid-cols-2 gap-4">
          <VStack spacing={2}>
            <Label htmlFor="startDate" className="font-medium text-gray-700">
              Start Date
            </Label>
            <Input
              id="startDate"
              name="startDate"
              value={formData.startDate}
              onChange={(e) => handleInputChange('startDate', e.target.value)}
              placeholder="YYYY-MM"
              pattern="\d{4}-\d{2}"
              title="Please enter date in YYYY-MM format (e.g., 2009-05)"
              className={`border-gray-300 bg-white text-gray-900 placeholder:text-gray-500 focus:border-purple-500 focus:ring-purple-500 ${
                fieldErrors.startDate
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                  : ''
              }`}
            />
            {fieldErrors.startDate && (
              <p className="text-sm text-red-600">{fieldErrors.startDate}</p>
            )}
          </VStack>

          <VStack spacing={2}>
            <Label htmlFor="endDate" className="font-medium text-gray-700">
              End Date
            </Label>
            <Input
              id="endDate"
              name="endDate"
              value={formData.endDate}
              onChange={(e) => handleInputChange('endDate', e.target.value)}
              placeholder="YYYY-MM"
              pattern="\d{4}-\d{2}"
              title="Please enter date in YYYY-MM format (e.g., 2009-05)"
              className={`border-gray-300 bg-white text-gray-900 placeholder:text-gray-500 focus:border-purple-500 focus:ring-purple-500 ${
                fieldErrors.endDate
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                  : ''
              }`}
            />
            {fieldErrors.endDate && (
              <p className="text-sm text-red-600">{fieldErrors.endDate}</p>
            )}
          </VStack>
        </div>
      </VStack>
    </form>
  );
};

// Backward compatibility wrapper for CREATE mode
export const EventModal: React.FC<Omit<EventFormProps, 'node'>> = (props) => {
  return <EventForm {...props} />;
};
