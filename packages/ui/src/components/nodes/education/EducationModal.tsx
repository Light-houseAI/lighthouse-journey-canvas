import { Input, Label, Textarea, VStack } from '@journey/components';
import {
  educationMetaSchema,
  Organization,
  OrganizationType,
  TimelineNode,
  TimelineNodeType,
} from '@journey/schema';
import { useMutation } from '@tanstack/react-query';
import React, { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';

import { useCurrentUser } from '../../../hooks/useAuth';
import { useCreateNode, useUpdateNode } from '../../../hooks/useTimeline';
import { handleAPIError, showSuccessToast } from '../../../utils/error-toast';
import { OrganizationSelector } from '../../ui/organization-selector';

// Use shared schema as single source of truth
type EducationFormData = z.infer<typeof educationMetaSchema>;
type FieldErrors = Partial<Record<keyof EducationFormData, string>>;

// NodeContext removed - pure form component

interface EducationFormProps {
  node?: TimelineNode; // Optional - if provided, we're in UPDATE mode
  parentId?: string; // Optional - if provided, create as child of this parent
  onSuccess?: () => void; // Called when form submission succeeds
  onFailure?: (error: string) => void; // Called when form submission fails
}

export const EducationForm: React.FC<EducationFormProps> = ({
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
  const [formData, setFormData] = useState<EducationFormData>({
    orgId: node?.meta.orgId || 0,
    degree: node?.meta.degree || '',
    field: node?.meta.field || '',
    location: node?.meta.location || '',
    description: node?.meta.description || '',
    startDate: node?.meta.startDate || '',
    endDate: node?.meta.endDate || '',
  });

  // Organization selection state
  const [selectedOrganization, setSelectedOrganization] =
    useState<Organization | null>(null);

  // Load initial organization data
  useEffect(() => {
    if (!node) return;

    // If we have organizationName from backend, create a temp org object for display
    const orgName =
      (node.meta as any)?.organizationName ||
      (node.meta as any)?.institution ||
      (node.meta as any)?.school;
    if (orgName && orgName !== 'Institution') {
      const tempOrg: Organization = {
        id: node.meta.orgId || 0,
        name: orgName,
        type: OrganizationType.EducationalInstitution,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setSelectedOrganization(tempOrg);
    }
  }, [node]);

  const validateField = useCallback(
    (name: keyof EducationFormData, value: string | number) => {
      try {
        // Create a partial validation object for the specific field
        const fieldValue =
          name === 'orgId' ? (value as number) : (value as string);
        const validationObj = { [name]: fieldValue || undefined };

        // Use partial schema to validate only this field
        educationMetaSchema.partial().parse(validationObj);
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
    name: keyof EducationFormData,
    value: string | number
  ) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Real-time validation with debounce for better UX
    setTimeout(() => validateField(name, value), 300);
  };

  // TanStack Query mutations
  const createEducationMutation = useMutation({
    mutationFn: async (data: EducationFormData) => {
      if (!user || !isAuthenticated) {
        throw new Error('User not authenticated. Please log in again.');
      }

      const validatedData = educationMetaSchema.parse(data);

      // Use TanStack Query mutation (already handles cache invalidation)
      const result = await createNodeMutation.mutateAsync({
        type: 'education' as TimelineNodeType,
        parentId: parentId ?? undefined,
        meta: validatedData,
      });

      return result;
    },
    onSuccess: () => {
      // Reset form on successful creation
      setFormData({
        orgId: 0,
        degree: '',
        field: '',
        location: '',
        description: '',
        startDate: '',
        endDate: '',
      });
      setSelectedOrganization(null);
      setFieldErrors({});

      showSuccessToast('Education added successfully!');
      onSuccess?.();
    },
    onError: (error) => {
      if (error instanceof z.ZodError) {
        const errors: FieldErrors = {};
        error.errors.forEach((err) => {
          if (err.path.length > 0) {
            const fieldName = err.path[0] as keyof EducationFormData;
            errors[fieldName] = err.message;
          }
        });
        setFieldErrors(errors);
      } else {
        handleAPIError(error, 'Education creation');
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to create education';
        onFailure?.(errorMessage);
      }
    },
  });

  const updateEducationMutation = useMutation({
    mutationFn: async (data: EducationFormData) => {
      if (!user || !isAuthenticated) {
        throw new Error('User not authenticated. Please log in again.');
      }

      if (!node) {
        throw new Error('Node not found for update');
      }

      const validatedData = educationMetaSchema.parse(data);

      // Use TanStack Query mutation (already handles cache invalidation)
      const result = await updateNodeMutation.mutateAsync({
        id: node.id,
        updates: { meta: validatedData },
      });

      return result;
    },
    onSuccess: () => {
      setFieldErrors({});
      showSuccessToast('Education updated successfully!');
      onSuccess?.();
    },
    onError: (error) => {
      if (error instanceof z.ZodError) {
        const errors: FieldErrors = {};
        error.errors.forEach((err) => {
          if (err.path.length > 0) {
            const fieldName = err.path[0] as keyof EducationFormData;
            errors[fieldName] = err.message;
          }
        });
        setFieldErrors(errors);
      } else {
        handleAPIError(error, 'Education update');
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to update education';
        onFailure?.(errorMessage);
      }
    },
  });

  const handleFormSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFieldErrors({});

    // Sanitize formData: convert empty strings to undefined for optional fields
    const sanitizedData: EducationFormData = {
      ...formData,
      field: formData.field?.trim() || undefined,
      location: formData.location?.trim() || undefined,
      description: formData.description?.trim() || undefined,
      startDate: formData.startDate?.trim() || undefined,
      endDate: formData.endDate?.trim() || undefined,
    };

    // Validate entire form before submission
    try {
      educationMetaSchema.parse(sanitizedData);
    } catch (err) {
      if (err instanceof z.ZodError) {
        const errors: FieldErrors = {};
        err.errors.forEach((error) => {
          if (error.path.length > 0) {
            const fieldName = error.path[0] as keyof EducationFormData;
            errors[fieldName] = error.message;
          }
        });
        setFieldErrors(errors);
        return; // Stop submission
      }
    }

    if (isUpdateMode) {
      await updateEducationMutation.mutateAsync(sanitizedData);
    } else {
      await createEducationMutation.mutateAsync(sanitizedData);
    }
  };

  return (
    <form
      id="education-form"
      onSubmit={handleFormSubmit}
      className="add-node-form"
    >
      <VStack spacing={6}>
        <div className="grid grid-cols-2 gap-4">
          <VStack spacing={2}>
            <Label htmlFor="organization" className="font-medium text-gray-700">
              Institution *
            </Label>
            <OrganizationSelector
              value={selectedOrganization}
              onSelect={handleOrgSelect}
              onClear={handleOrgClear}
              placeholder="Search institutions..."
              required
              error={fieldErrors.orgId}
              orgTypes={[OrganizationType.EducationalInstitution]}
              defaultOrgType={OrganizationType.EducationalInstitution}
            />
          </VStack>

          <VStack spacing={2}>
            <Label htmlFor="degree" className="font-medium text-gray-700">
              Degree *
            </Label>
            <Input
              id="degree"
              name="degree"
              required
              value={formData.degree}
              onChange={(e) => handleInputChange('degree', e.target.value)}
              placeholder="Degree or certification"
              className={`border-gray-300 bg-white text-gray-900 placeholder:text-gray-500 focus:border-purple-500 focus:ring-purple-500 ${
                fieldErrors.degree
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                  : ''
              }`}
            />
            {fieldErrors.degree && (
              <p className="text-sm text-red-600">{fieldErrors.degree}</p>
            )}
          </VStack>
        </div>

        <VStack spacing={2}>
          <Label htmlFor="field" className="font-medium text-gray-700">
            Field of Study
          </Label>
          <Input
            id="field"
            name="field"
            value={formData.field}
            onChange={(e) => handleInputChange('field', e.target.value)}
            placeholder="Field of study"
            className="border-gray-300 bg-white text-gray-900 placeholder:text-gray-500 focus:border-purple-500 focus:ring-purple-500"
          />
        </VStack>

        <VStack spacing={2}>
          <Label htmlFor="location" className="font-medium text-gray-700">
            Location
          </Label>
          <Input
            id="location"
            name="location"
            value={formData.location}
            onChange={(e) => handleInputChange('location', e.target.value)}
            placeholder="School location"
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
            placeholder="Education description"
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
export const EducationModal: React.FC<Omit<EducationFormProps, 'node'>> = (
  props
) => {
  return <EducationForm {...props} />;
};
