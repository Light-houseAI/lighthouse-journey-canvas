// Dialog components removed - now pure form component
import { Input, Label, Textarea, VStack } from '@journey/components';
import {
  actionMetaSchema,
  TimelineNode,
  TimelineNodeType,
} from '@journey/schema';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useCallback, useState } from 'react';
import { z } from 'zod';

import { useAuthStore } from '../../../stores/auth-store';
import { useHierarchyStore } from '../../../stores/hierarchy-store';
import { handleAPIError, showSuccessToast } from '../../../utils/error-toast';

// Use shared schema as single source of truth
type ActionFormData = z.infer<typeof actionMetaSchema>;
type FieldErrors = Partial<Record<keyof ActionFormData, string>>;

// NodeContext removed - pure form component

interface ActionFormProps {
  node?: TimelineNode; // Optional - if provided, we're in UPDATE mode
  parentId?: string; // Optional - if provided, create as child of this parent
  onSuccess?: () => void; // Called when form submission succeeds
  onFailure?: (error: string) => void; // Called when form submission fails
}

export const ActionForm: React.FC<ActionFormProps> = ({
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
  const [formData, setFormData] = useState<ActionFormData>({
    title: node?.meta.title || '',
    description: node?.meta.description || '',
    startDate: node?.meta.startDate || '',
    endDate: node?.meta.endDate || '',
  });

  const validateField = useCallback(
    (name: keyof ActionFormData, value: string) => {
      try {
        const testData = { [name]: value || undefined };
        const fieldSchema = z.object({ [name]: actionMetaSchema.shape[name] });
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

  const handleInputChange = (name: keyof ActionFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Real-time validation with debounce for better UX
    setTimeout(() => validateField(name, value), 300);
  };

  // TanStack Query mutations
  const createActionMutation = useMutation({
    mutationFn: async (data: ActionFormData) => {
      if (!user || !isAuthenticated) {
        throw new Error('User not authenticated. Please log in again.');
      }

      const validatedData = actionMetaSchema.parse(data);

      // Wait for the API call to complete
      const result = await createNode({
        type: TimelineNodeType.Action,
        parentId: parentId || undefined,
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

      showSuccessToast('Action added successfully!');
      onSuccess?.();
    },
    onError: (error) => {
      if (error instanceof z.ZodError) {
        const errors: FieldErrors = {};
        error.errors.forEach((err) => {
          if (err.path.length > 0) {
            const fieldName = err.path[0] as keyof ActionFormData;
            errors[fieldName] = err.message;
          }
        });
        setFieldErrors(errors);
      } else {
        handleAPIError(error, 'Action creation');
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to create action';
        onFailure?.(errorMessage);
      }
    },
  });

  const updateActionMutation = useMutation({
    mutationFn: async (data: ActionFormData) => {
      if (!user || !isAuthenticated) {
        throw new Error('User not authenticated. Please log in again.');
      }

      if (!node) {
        throw new Error('Node not found for update');
      }

      const validatedData = actionMetaSchema.parse(data);

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
      showSuccessToast('Action updated successfully!');
      onSuccess?.();
    },
    onError: (error) => {
      if (error instanceof z.ZodError) {
        const errors: FieldErrors = {};
        error.errors.forEach((err) => {
          if (err.path.length > 0) {
            const fieldName = err.path[0] as keyof ActionFormData;
            errors[fieldName] = err.message;
          }
        });
        setFieldErrors(errors);
      } else {
        handleAPIError(error, 'Action update');
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to update action';
        onFailure?.(errorMessage);
      }
    },
  });

  const handleFormSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFieldErrors({});

    // Sanitize formData: convert empty strings to undefined for optional fields
    const sanitizedData: ActionFormData = {
      ...formData,
      description: formData.description?.trim() || undefined,
      startDate: formData.startDate?.trim() || undefined,
      endDate: formData.endDate?.trim() || undefined,
    };

    // Validate entire form before submission
    try {
      actionMetaSchema.parse(sanitizedData);
    } catch (err) {
      if (err instanceof z.ZodError) {
        const errors: FieldErrors = {};
        err.errors.forEach((error) => {
          if (error.path.length > 0) {
            const fieldName = error.path[0] as keyof ActionFormData;
            errors[fieldName] = error.message;
          }
        });
        setFieldErrors(errors);
        return; // Stop submission
      }
    }

    if (isUpdateMode) {
      await updateActionMutation.mutateAsync(sanitizedData);
    } else {
      await createActionMutation.mutateAsync(sanitizedData);
    }
  };

  return (
    <form
      id="action-form"
      onSubmit={handleFormSubmit}
      className="add-node-form"
    >
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
            placeholder="Action title"
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
            placeholder="Action description"
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
export const ActionModal: React.FC<Omit<ActionFormProps, 'node'>> = (props) => {
  return <ActionForm {...props} />;
};
