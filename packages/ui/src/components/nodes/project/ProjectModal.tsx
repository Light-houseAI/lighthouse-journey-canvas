// Dialog components removed - now pure form component
import {
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  VStack,
} from '@journey/components';
import {
  projectMetaSchema,
  ProjectStatus,
  ProjectType,
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
type ProjectFormData = z.infer<typeof projectMetaSchema>;
type FieldErrors = Partial<Record<keyof ProjectFormData, string>>;

// NodeContext removed - pure form component

interface ProjectFormProps {
  node?: TimelineNode; // Optional - if provided, we're in UPDATE mode
  parentId?: string; // Optional - if provided, create as child of this parent
  onSuccess?: () => void; // Called when form submission succeeds
  onFailure?: (error: string) => void; // Called when form submission fails
}

export const ProjectForm: React.FC<ProjectFormProps> = ({
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
  const [formData, setFormData] = useState<ProjectFormData>({
    title: node?.meta.title || '',
    description: node?.meta.description || '',
    technologies: node?.meta.technologies || [],
    projectType: node?.meta.projectType || undefined,
    status: node?.meta.status || undefined,
    startDate: node?.meta.startDate || '',
    endDate: node?.meta.endDate || '',
  });

  const validateField = useCallback(
    (
      name: keyof ProjectFormData,
      value: string | string[] | ProjectType | ProjectStatus | undefined
    ) => {
      try {
        // Skip validation for optional enum fields that are undefined
        if (
          (name === 'projectType' || name === 'status') &&
          value === undefined
        ) {
          setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
          return true;
        }

        const testData = { [name]: value || undefined };
        const fieldSchema = z.object({ [name]: projectMetaSchema.shape[name] });
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
    name: keyof ProjectFormData,
    value: string | string[] | ProjectType | ProjectStatus | undefined
  ) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Real-time validation with debounce for better UX
    setTimeout(() => validateField(name, value), 300);
  };

  // TanStack Query mutations
  const createProjectMutation = useMutation({
    mutationFn: async (data: ProjectFormData) => {
      if (!user || !isAuthenticated) {
        throw new Error('User not authenticated. Please log in again.');
      }

      const validatedData = projectMetaSchema.parse(data);

      // Use TanStack Query mutation (already handles cache invalidation)
      const result = await createNodeMutation.mutateAsync({
        type: 'project' as TimelineNodeType,
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
        technologies: [],
        projectType: undefined,
        status: undefined,
        startDate: '',
        endDate: '',
      });
      setFieldErrors({});

      showSuccessToast('Project added successfully!');
      onSuccess?.();
    },
    onError: (error) => {
      if (error instanceof z.ZodError) {
        const errors: FieldErrors = {};
        error.errors.forEach((err) => {
          if (err.path.length > 0) {
            const fieldName = err.path[0] as keyof ProjectFormData;
            errors[fieldName] = err.message;
          }
        });
        setFieldErrors(errors);
      } else {
        handleAPIError(error, 'Project creation');
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to create project';
        onFailure?.(errorMessage);
      }
    },
  });

  const updateProjectMutation = useMutation({
    mutationFn: async (data: ProjectFormData) => {
      if (!user || !isAuthenticated) {
        throw new Error('User not authenticated. Please log in again.');
      }

      if (!node) {
        throw new Error('Node not found for update');
      }

      const validatedData = projectMetaSchema.parse(data);

      // Use TanStack Query mutation (already handles cache invalidation)
      const result = await updateNodeMutation.mutateAsync({
        id: node.id,
        updates: { meta: validatedData },
      });

      return result;
    },
    onSuccess: () => {
      setFieldErrors({});
      showSuccessToast('Project updated successfully!');
      onSuccess?.();
    },
    onError: (error) => {
      if (error instanceof z.ZodError) {
        const errors: FieldErrors = {};
        error.errors.forEach((err) => {
          if (err.path.length > 0) {
            const fieldName = err.path[0] as keyof ProjectFormData;
            errors[fieldName] = err.message;
          }
        });
        setFieldErrors(errors);
      } else {
        handleAPIError(error, 'Project update');
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to update project';
        onFailure?.(errorMessage);
      }
    },
  });

  const handleFormSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFieldErrors({});

    // Sanitize formData: convert empty strings to undefined for optional fields
    const sanitizedData: ProjectFormData = {
      ...formData,
      description: formData.description?.trim() || undefined,
      startDate: formData.startDate?.trim() || undefined,
      endDate: formData.endDate?.trim() || undefined,
    };

    // Validate entire form before submission
    try {
      projectMetaSchema.parse(sanitizedData);
    } catch (err) {
      if (err instanceof z.ZodError) {
        const errors: FieldErrors = {};
        err.errors.forEach((error) => {
          if (error.path.length > 0) {
            const fieldName = error.path[0] as keyof ProjectFormData;
            errors[fieldName] = error.message;
          }
        });
        setFieldErrors(errors);
        return; // Stop submission
      }
    }

    if (isUpdateMode) {
      await updateProjectMutation.mutateAsync(sanitizedData);
    } else {
      await createProjectMutation.mutateAsync(sanitizedData);
    }
  };

  return (
    <form
      id="project-form"
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
            placeholder="Project title"
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
            placeholder="Project description"
            rows={3}
            className="border-gray-300 bg-white text-gray-900 placeholder:text-gray-500 focus:border-purple-500 focus:ring-purple-500"
          />
        </VStack>

        <div className="grid grid-cols-2 gap-4">
          <VStack spacing={2}>
            <Label htmlFor="projectType" className="font-medium text-gray-700">
              Project Type
            </Label>
            <Select
              value={formData.projectType}
              onValueChange={(value) => handleInputChange('projectType', value)}
            >
              <SelectTrigger className="border-gray-300 bg-white text-gray-900 focus:border-purple-500 focus:ring-purple-500">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ProjectType.Personal}>Personal</SelectItem>
                <SelectItem value={ProjectType.Professional}>
                  Professional
                </SelectItem>
                <SelectItem value={ProjectType.Academic}>Academic</SelectItem>
                <SelectItem value={ProjectType.Freelance}>Freelance</SelectItem>
                <SelectItem value={ProjectType.OpenSource}>
                  Open Source
                </SelectItem>
              </SelectContent>
            </Select>
          </VStack>

          <VStack spacing={2}>
            <Label htmlFor="status" className="font-medium text-gray-700">
              Status
            </Label>
            <Select
              value={formData.status}
              onValueChange={(value) => handleInputChange('status', value)}
            >
              <SelectTrigger className="border-gray-300 bg-white text-gray-900 focus:border-purple-500 focus:ring-purple-500">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ProjectStatus.Planning}>Planning</SelectItem>
                <SelectItem value={ProjectStatus.Active}>Active</SelectItem>
                <SelectItem value={ProjectStatus.Completed}>
                  Completed
                </SelectItem>
              </SelectContent>
            </Select>
          </VStack>
        </div>

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
export const ProjectModal: React.FC<Omit<ProjectFormProps, 'node'>> = (
  props
) => {
  return <ProjectForm {...props} />;
};
