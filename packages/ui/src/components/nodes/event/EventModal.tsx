import { TimelineNode } from '@journey/schema';
import { eventMetaSchema } from '@journey/schema';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { z } from 'zod';

import { useAuthStore } from '../../../stores/auth-store';
import { useHierarchyStore } from '../../../stores/hierarchy-store';
import { handleAPIError, showSuccessToast } from '../../../utils/error-toast';
// Dialog components removed - now pure form component
import { Button } from '@journey/components';
import { Input } from '@journey/components';
import { Label } from '@journey/components';
import { Textarea } from '@journey/components';

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
  // Get authentication state and stores
  const { user, isAuthenticated } = useAuthStore();
  const { createNode, updateNode } = useHierarchyStore();
  const queryClient = useQueryClient();

  const isUpdateMode = Boolean(node);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formData, setFormData] = useState<EventFormData>({
    title: node?.meta.title || '',
    description: node?.meta.description || '',
    startDate: node?.meta.startDate || '',
    endDate: node?.meta.endDate || '',
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

      // Wait for the API call to complete
      const result = await createNode({
        type: 'event',
        parentId: parentId || null,
        meta: validatedData,
      });

      // Wait for cache invalidation to complete
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['timeline'] }),
        queryClient.invalidateQueries({ queryKey: ['nodes'] }),
      ]);

      return result;
    },
    onSuccess: () => {
      // Reset form on successful creation
      setFormData({
        title: '',
        description: '',
        startDate: '',
        endDate: '',
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

      // Wait for the API call to complete
      const result = await updateNode(node.id, { meta: validatedData });

      // Wait for cache invalidation to complete
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['timeline'] }),
        queryClient.invalidateQueries({ queryKey: ['nodes'] }),
      ]);

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

    if (isUpdateMode) {
      await updateEventMutation.mutateAsync(formData);
    } else {
      await createEventMutation.mutateAsync(formData);
    }
  };

  const isPending = isUpdateMode
    ? updateEventMutation.isPending
    : createEventMutation.isPending;

  return (
    <>
      <div className="border-b border-gray-200 pb-4">
        <h2 className="text-xl font-semibold text-gray-900">
          {isUpdateMode ? 'Edit Event' : 'Add Event'}
        </h2>
      </div>

      <form
        onSubmit={handleFormSubmit}
        className="add-node-form space-y-6 pt-4"
      >
        <div className="space-y-2">
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
        </div>

        <div className="space-y-2">
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
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
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
          </div>

          <div className="space-y-2">
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
          </div>
        </div>

        <div className="mt-6 flex justify-end space-x-3 border-t border-gray-200 pt-6">
          <Button
            type="submit"
            disabled={isPending}
            data-testid="submit-button"
            className="bg-purple-600 text-white hover:bg-purple-700"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isUpdateMode ? 'Updating...' : 'Adding...'}
              </>
            ) : isUpdateMode ? (
              'Update Event'
            ) : (
              'Add Event'
            )}
          </Button>
        </div>
      </form>
    </>
  );
};

// Backward compatibility wrapper for CREATE mode
export const EventModal: React.FC<Omit<EventFormProps, 'node'>> = (props) => {
  return <EventForm {...props} />;
};
