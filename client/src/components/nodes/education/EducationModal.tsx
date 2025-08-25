import React, { useState, useCallback } from 'react';
// Dialog components removed - now pure form component
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { z } from 'zod';
import { useAuthStore } from '@/stores/auth-store';
import { useHierarchyStore } from '@/stores/hierarchy-store';
import { TimelineNode } from '@shared/schema';
import { TimelineNodeType } from '@shared/enums';
import { educationMetaSchema, CreateTimelineNodeDTO, UpdateTimelineNodeDTO } from '@shared/types';
import { handleAPIError, showSuccessToast } from '@/utils/error-toast';

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

export const EducationForm: React.FC<EducationFormProps> = ({ node, parentId, onSuccess, onFailure }) => {
  // Get authentication state and stores
  const { user, isAuthenticated } = useAuthStore();
  const { createNode, updateNode } = useHierarchyStore();

  const isUpdateMode = Boolean(node);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formData, setFormData] = useState<EducationFormData>({
    institution: node?.meta.institution || '',
    degree: node?.meta.degree || '',
    field: node?.meta.field || '',
    location: node?.meta.location || '',
    description: node?.meta.description || '',
    startDate: node?.meta.startDate || '',
    endDate: node?.meta.endDate || '',
  });

  const validateField = useCallback((name: keyof EducationFormData, value: string) => {
    try {
      // Skip validation for optional fields that are empty
      if (!value && name !== 'institution' && name !== 'degree') {
        setFieldErrors(prev => ({ ...prev, [name]: undefined }));
        return true;
      }

      const testData = { [name]: value || undefined };
      const fieldSchema = z.object({ [name]: educationMetaSchema.shape[name] });
      fieldSchema.parse(testData);
      setFieldErrors(prev => ({ ...prev, [name]: undefined }));
      return true;
    } catch (err) {
      if (err instanceof z.ZodError) {
        const errorMessage = err.errors[0]?.message || 'Invalid value';
        setFieldErrors(prev => ({ ...prev, [name]: errorMessage }));
      }
      return false;
    }
  }, []);

  const handleInputChange = (name: keyof EducationFormData, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    // Real-time validation with debounce for better UX
    setTimeout(() => validateField(name, value), 300);
  };

  const handleFormSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setFieldErrors({});

    try {
      // Check authentication
      if (!user || !isAuthenticated) {
        throw new Error('User not authenticated. Please log in again.');
      }

      // Validate entire form
      const validatedData = educationMetaSchema.parse(formData);

      if (isUpdateMode && node) {
        // UPDATE mode: validate with shared schema, use current API format
        console.log('🐛 DEBUG: About to call updateNode...');
        await updateNode(node.id, {
          meta: validatedData
        });
        console.log('🐛 DEBUG: updateNode completed successfully');
      } else {
        // CREATE mode: validate with shared schema, call existing store method
        console.log('🐛 DEBUG: About to call createNode...');
        await createNode({
          type: 'education',
          parentId: parentId || null,
          meta: validatedData
        });
        console.log('🐛 DEBUG: createNode completed successfully');
      }

      // Reset form on success (only in CREATE mode)
      if (!isUpdateMode) {
        setFormData({
          institution: '',
          degree: '',
          field: '',
          location: '',
          description: '',
          startDate: '',
          endDate: '',
        });
      }

      // Show success message and notify callback
      showSuccessToast(isUpdateMode ? 'Education updated successfully!' : 'Education added successfully!');
      console.log('🐛 DEBUG: Calling onSuccess callback...');
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.log('🐛 DEBUG: Caught error in form submission:', err);

      if (err instanceof z.ZodError) {
        // Set field-specific errors for validation errors
        const errors: FieldErrors = {};
        err.errors.forEach(error => {
          if (error.path.length > 0) {
            const fieldName = error.path[0] as keyof EducationFormData;
            errors[fieldName] = error.message;
          }
        });
        setFieldErrors(errors);
        // Don't show toast for validation errors, let user fix them in the form
      } else {
        // API or network errors - show user-friendly toast
        handleAPIError(err, 'Education save operation');

        // Still notify failure callback for any cleanup needed
        if (onFailure) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to save education';
          onFailure(errorMessage);
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <>
      <div className="pb-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">
          {isUpdateMode ? 'Edit Education' : 'Add Education'}
        </h2>
      </div>

      <form onSubmit={handleFormSubmit} className="space-y-6 add-node-form pt-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="institution" className="text-gray-700 font-medium">Institution *</Label>
            <Input
              id="institution"
              name="institution"
              required
              value={formData.institution}
              onChange={(e) => handleInputChange('institution', e.target.value)}
              placeholder="School or institution"
              className={`bg-white text-gray-900 border-gray-300 placeholder:text-gray-500 focus:border-purple-500 focus:ring-purple-500 ${
                fieldErrors.institution ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''
              }`}
            />
            {fieldErrors.institution && (
              <p className="text-sm text-red-600">{fieldErrors.institution}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="degree" className="text-gray-700 font-medium">Degree *</Label>
            <Input
              id="degree"
              name="degree"
              required
              value={formData.degree}
              onChange={(e) => handleInputChange('degree', e.target.value)}
              placeholder="Degree or certification"
              className={`bg-white text-gray-900 border-gray-300 placeholder:text-gray-500 focus:border-purple-500 focus:ring-purple-500 ${
                fieldErrors.degree ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''
              }`}
            />
            {fieldErrors.degree && (
              <p className="text-sm text-red-600">{fieldErrors.degree}</p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="field" className="text-gray-700 font-medium">Field of Study</Label>
          <Input
            id="field"
            name="field"
            value={formData.field}
            onChange={(e) => handleInputChange('field', e.target.value)}
            placeholder="Field of study"
            className="bg-white text-gray-900 border-gray-300 placeholder:text-gray-500 focus:border-purple-500 focus:ring-purple-500"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="location" className="text-gray-700 font-medium">Location</Label>
          <Input
            id="location"
            name="location"
            value={formData.location}
            onChange={(e) => handleInputChange('location', e.target.value)}
            placeholder="School location"
            className="bg-white text-gray-900 border-gray-300 placeholder:text-gray-500 focus:border-purple-500 focus:ring-purple-500"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description" className="text-gray-700 font-medium">Description</Label>
          <Textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            placeholder="Education description"
            rows={3}
            className="bg-white text-gray-900 border-gray-300 placeholder:text-gray-500 focus:border-purple-500 focus:ring-purple-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="startDate" className="text-gray-700 font-medium">Start Date</Label>
            <Input
              id="startDate"
              name="startDate"
              value={formData.startDate}
              onChange={(e) => handleInputChange('startDate', e.target.value)}
              placeholder="YYYY-MM"
              pattern="\d{4}-\d{2}"
              title="Please enter date in YYYY-MM format (e.g., 2009-05)"
              className={`bg-white text-gray-900 border-gray-300 placeholder:text-gray-500 focus:border-purple-500 focus:ring-purple-500 ${
                fieldErrors.startDate ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''
              }`}
            />
            {fieldErrors.startDate && (
              <p className="text-sm text-red-600">{fieldErrors.startDate}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="endDate" className="text-gray-700 font-medium">End Date</Label>
            <Input
              id="endDate"
              name="endDate"
              value={formData.endDate}
              onChange={(e) => handleInputChange('endDate', e.target.value)}
              placeholder="YYYY-MM"
              pattern="\d{4}-\d{2}"
              title="Please enter date in YYYY-MM format (e.g., 2009-05)"
              className={`bg-white text-gray-900 border-gray-300 placeholder:text-gray-500 focus:border-purple-500 focus:ring-purple-500 ${
                fieldErrors.endDate ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''
              }`}
            />
            {fieldErrors.endDate && (
              <p className="text-sm text-red-600">{fieldErrors.endDate}</p>
            )}
          </div>
        </div>


        <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200 mt-6">
          <Button
            type="submit"
            disabled={isSubmitting}
            data-testid="submit-button"
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {isUpdateMode ? 'Updating...' : 'Adding...'}
              </>
            ) : (
              isUpdateMode ? 'Update Education' : 'Add Education'
            )}
          </Button>
        </div>
      </form>
    </>
  );
};

// Export both the unified form and maintain backward compatibility
export default EducationForm;

// Backward compatibility wrapper for CREATE mode
export const EducationModal: React.FC<Omit<EducationFormProps, 'node'>> = (props) => {
  return <EducationForm {...props} />;
};
