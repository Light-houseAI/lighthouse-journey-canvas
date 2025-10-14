import { Input, Label, Textarea, VStack } from '@journey/components';
import {
  jobMetaSchema,
  Organization,
  OrganizationType,
  TimelineNode,
} from '@journey/schema';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';

import { useAuthStore } from '../../../stores/auth-store';
import { useHierarchyStore } from '../../../stores/hierarchy-store';
import { handleAPIError, showSuccessToast } from '../../../utils/error-toast';
import { OrganizationSelector } from '../../ui/organization-selector';

// Use shared schema as single source of truth
type JobFormData = z.infer<typeof jobMetaSchema>;
type FieldErrors = Partial<Record<keyof JobFormData, string>>;

// NodeContext removed - pure form component

interface JobFormProps {
  node?: TimelineNode; // Optional - if provided, we're in UPDATE mode
  parentId?: string; // Optional - if provided, create as child of this parent
  onSuccess?: () => void; // Called when form submission succeeds
  onFailure?: (error: string) => void; // Called when form submission fails
}

export const JobForm: React.FC<JobFormProps> = ({
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

  // Using toast for error handling instead of local state
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formData, setFormData] = useState<JobFormData>({
    orgId: node?.meta.orgId || 0, // Use orgId from schema
    role: node?.meta.role || '',
    location: node?.meta.location || '',
    description: node?.meta.description || '',
    startDate: node?.meta.startDate || '',
    endDate: node?.meta.endDate || '',
  });

  // Organization selection state
  const [selectedOrganization, setSelectedOrganization] =
    useState<Organization | null>(null);

  const validateField = useCallback(
    (name: keyof JobFormData, value: string | number) => {
      try {
        // Create a partial validation object for the specific field
        const fieldValue =
          name === 'orgId' ? (value as number) : (value as string);
        const validationObj = { [name]: fieldValue || undefined };

        // Use partial schema to validate only this field
        jobMetaSchema.partial().parse(validationObj);
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

  // Load initial organization data
  useEffect(() => {
    if (!node) return;

    // If we have organizationName from backend, create a temp org object for display
    const orgName =
      (node.meta as any)?.organizationName || (node.meta as any)?.company;
    if (orgName && orgName !== 'Company') {
      const tempOrg: Organization = {
        id: node.meta.orgId || 0,
        name: orgName,
        type: OrganizationType.Company,
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setSelectedOrganization(tempOrg);
    }
  }, [node]);

  // Handle organization selection
  const handleOrgSelect = (org: Organization) => {
    setSelectedOrganization(org);
    setFormData((prev) => ({ ...prev, orgId: org.id }));
    validateField('orgId', org.id);
  };

  // Handle organization clearing
  const handleOrgClear = () => {
    setSelectedOrganization(null);
    setFormData((prev) => ({ ...prev, orgId: 0 }));
  };

  const handleInputChange = (
    name: keyof JobFormData,
    value: string | number
  ) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Real-time validation with debounce for better UX
    setTimeout(() => validateField(name, value), 300);
  };

  // TanStack Query mutations
  const createJobMutation = useMutation({
    mutationFn: async (data: JobFormData) => {
      if (!user || !isAuthenticated) {
        throw new Error('User not authenticated. Please log in again.');
      }

      const validatedData = jobMetaSchema.parse(data);

      // Wait for the API call to complete
      const result = await createNode({
        type: 'job',
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
        orgId: 0,
        role: '',
        location: '',
        description: '',
        startDate: '',
        endDate: '',
      });
      setSelectedOrganization(null);
      setFieldErrors({});

      showSuccessToast('Job added successfully!');
      onSuccess?.();
    },
    onError: (error) => {
      if (error instanceof z.ZodError) {
        const errors: FieldErrors = {};
        error.errors.forEach((err) => {
          if (err.path.length > 0) {
            const fieldName = err.path[0] as keyof JobFormData;
            errors[fieldName] = err.message;
          }
        });
        setFieldErrors(errors);
      } else {
        handleAPIError(error, 'Job creation');
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to create job';
        onFailure?.(errorMessage);
      }
    },
  });

  const updateJobMutation = useMutation({
    mutationFn: async (data: JobFormData) => {
      if (!user || !isAuthenticated) {
        throw new Error('User not authenticated. Please log in again.');
      }

      if (!node) {
        throw new Error('Node not found for update');
      }

      const validatedData = jobMetaSchema.parse(data);

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
      showSuccessToast('Job updated successfully!');
      onSuccess?.();
    },
    onError: (error) => {
      if (error instanceof z.ZodError) {
        const errors: FieldErrors = {};
        error.errors.forEach((err) => {
          if (err.path.length > 0) {
            const fieldName = err.path[0] as keyof JobFormData;
            errors[fieldName] = err.message;
          }
        });
        setFieldErrors(errors);
      } else {
        handleAPIError(error, 'Job update');
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to update job';
        onFailure?.(errorMessage);
      }
    },
  });

  const handleFormSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFieldErrors({});

    // Sanitize formData: convert empty strings to undefined for optional fields
    const sanitizedData: JobFormData = {
      ...formData,
      location: formData.location?.trim() || undefined,
      description: formData.description?.trim() || undefined,
      startDate: formData.startDate?.trim() || undefined,
      endDate: formData.endDate?.trim() || undefined,
    };

    // Validate entire form before submission
    try {
      jobMetaSchema.parse(sanitizedData);
    } catch (err) {
      if (err instanceof z.ZodError) {
        const errors: FieldErrors = {};
        err.errors.forEach((error) => {
          if (error.path.length > 0) {
            const fieldName = error.path[0] as keyof JobFormData;
            errors[fieldName] = error.message;
          }
        });
        setFieldErrors(errors);
        return; // Stop submission
      }
    }

    if (isUpdateMode) {
      await updateJobMutation.mutateAsync(sanitizedData);
    } else {
      await createJobMutation.mutateAsync(sanitizedData);
    }
  };

  return (
    <form id="job-form" onSubmit={handleFormSubmit} className="add-node-form">
      <VStack spacing={6}>
        <div className="grid grid-cols-2 gap-4">
          <VStack spacing={2}>
            <Label htmlFor="organization" className="font-medium text-gray-700">
              Organization *
            </Label>
            <OrganizationSelector
              value={selectedOrganization}
              onSelect={handleOrgSelect}
              onClear={handleOrgClear}
              placeholder="Search organizations..."
              required
              error={fieldErrors.orgId}
              orgTypes={[OrganizationType.Company]}
              defaultOrgType={OrganizationType.Company}
            />
          </VStack>

          <VStack spacing={2}>
            <Label htmlFor="role" className="font-medium text-gray-700">
              Role *
            </Label>
            <Input
              id="role"
              name="role"
              required
              value={formData.role}
              onChange={(e) => handleInputChange('role', e.target.value)}
              placeholder="Job role"
              className={`border-gray-300 bg-white text-gray-900 placeholder:text-gray-500 focus:border-purple-500 focus:ring-purple-500 ${
                fieldErrors.role
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                  : ''
              }`}
            />
            {fieldErrors.role && (
              <p className="text-sm text-red-600">{fieldErrors.role}</p>
            )}
          </VStack>
        </div>

        <VStack spacing={2}>
          <Label htmlFor="location" className="font-medium text-gray-700">
            Location
          </Label>
          <Input
            id="location"
            name="location"
            value={formData.location}
            onChange={(e) => handleInputChange('location', e.target.value)}
            placeholder="Work location"
            className="border-gray-300 bg-white text-gray-900 placeholder:text-gray-500 focus:border-purple-500 focus:ring-purple-500"
          />
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
            placeholder="Enter job description..."
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
export const JobModal: React.FC<Omit<JobFormProps, 'node'>> = (props) => {
  return <JobForm {...props} />;
};
