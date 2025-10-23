// Dialog components removed - now pure form component
import { Input, Label, Textarea, VStack } from '@journey/components';
import {
  careerTransitionMetaSchema,
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
type CareerTransitionFormData = z.infer<typeof careerTransitionMetaSchema>;
type FieldErrors = Partial<Record<keyof CareerTransitionFormData, string>>;

// NodeContext removed - pure form component

interface CareerTransitionFormProps {
  node?: TimelineNode; // Optional - if provided, we're in UPDATE mode
  parentId?: string; // Optional - if provided, create as child of this parent
  onSuccess?: () => void; // Called when form submission succeeds
  onFailure?: (error: string) => void; // Called when form submission fails
}

export const CareerTransitionForm: React.FC<CareerTransitionFormProps> = ({
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
  const [formData, setFormData] = useState<CareerTransitionFormData>({
    title: node?.meta.title || '',
    description: node?.meta.description || '',
    startDate: node?.meta.startDate || '',
    endDate: node?.meta.endDate || '',
  });

  const validateField = useCallback(
    (name: keyof CareerTransitionFormData, value: string) => {
      try {
        const testData = { [name]: value || undefined };
        const fieldSchema = z.object({
          [name]: careerTransitionMetaSchema.shape[name],
        });
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

  const handleInputChange = (
    name: keyof CareerTransitionFormData,
    value: string
  ) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Real-time validation with debounce for better UX
    setTimeout(() => validateField(name, value), 300);
  };

  // TanStack Query mutations
  const createCareerTransitionMutation = useMutation({
    mutationFn: async (data: CareerTransitionFormData) => {
      if (!user || !isAuthenticated) {
        throw new Error('User not authenticated. Please log in again.');
      }

      const validatedData = careerTransitionMetaSchema.parse(data);

      // Use TanStack Query mutation (already handles cache invalidation)
      const result = await createNodeMutation.mutateAsync({
        type: TimelineNodeType.CareerTransition,
        parentId: parentId ?? undefined,
        meta: validatedData,
      });

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

      showSuccessToast('Career transition added successfully!');
      onSuccess?.();
    },
    onError: (error) => {
      if (error instanceof z.ZodError) {
        const errors: FieldErrors = {};
        error.errors.forEach((err) => {
          if (err.path.length > 0) {
            const fieldName = err.path[0] as keyof CareerTransitionFormData;
            errors[fieldName] = err.message;
          }
        });
        setFieldErrors(errors);
      } else {
        handleAPIError(error, 'Career transition creation');
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to create career transition';
        onFailure?.(errorMessage);
      }
    },
  });

  const updateCareerTransitionMutation = useMutation({
    mutationFn: async (data: CareerTransitionFormData) => {
      if (!user || !isAuthenticated) {
        throw new Error('User not authenticated. Please log in again.');
      }

      if (!node) {
        throw new Error('Node not found for update');
      }

      const validatedData = careerTransitionMetaSchema.parse(data);

      // Use TanStack Query mutation (already handles cache invalidation)
      const result = await updateNodeMutation.mutateAsync({
        id: node.id,
        updates: { meta: validatedData },
      });

      return result;
    },
    onSuccess: () => {
      setFieldErrors({});
      showSuccessToast('Career transition updated successfully!');
      onSuccess?.();
    },
    onError: (error) => {
      if (error instanceof z.ZodError) {
        const errors: FieldErrors = {};
        error.errors.forEach((err) => {
          if (err.path.length > 0) {
            const fieldName = err.path[0] as keyof CareerTransitionFormData;
            errors[fieldName] = err.message;
          }
        });
        setFieldErrors(errors);
      } else {
        handleAPIError(error, 'Career transition update');
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to update career transition';
        onFailure?.(errorMessage);
      }
    },
  });

  const handleFormSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFieldErrors({});

    // Sanitize formData: convert empty strings to undefined for optional fields
    const sanitizedData: CareerTransitionFormData = {
      ...formData,
      description: formData.description?.trim() || undefined,
      startDate: formData.startDate?.trim() || undefined,
      endDate: formData.endDate?.trim() || undefined,
    };

    // Validate entire form before submission
    try {
      careerTransitionMetaSchema.parse(sanitizedData);
    } catch (err) {
      if (err instanceof z.ZodError) {
        const errors: FieldErrors = {};
        err.errors.forEach((error) => {
          if (error.path.length > 0) {
            const fieldName = error.path[0] as keyof CareerTransitionFormData;
            errors[fieldName] = error.message;
          }
        });
        setFieldErrors(errors);
        return; // Stop submission
      }
    }

    if (isUpdateMode) {
      await updateCareerTransitionMutation.mutateAsync(sanitizedData);
    } else {
      await createCareerTransitionMutation.mutateAsync(sanitizedData);
    }
  };

  return (
    <form
      id="career-transition-form"
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
            placeholder="Career transition title"
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
            placeholder="Describe your career transition..."
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
export const CareerTransitionModal: React.FC<
  Omit<CareerTransitionFormProps, 'node'>
> = (props) => {
  return <CareerTransitionForm {...props} />;
};
