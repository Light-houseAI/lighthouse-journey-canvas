import React, { useState, useCallback } from 'react';
// Dialog components removed - now pure form component
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { z } from 'zod';
import { useAuthStore } from '@/stores/auth-store';
import { useHierarchyStore } from '@/stores/hierarchy-store';
import { TimelineNode } from '@shared/schema';
import { TimelineNodeType } from '@shared/enums';
import { jobMetaSchema, CreateTimelineNodeDTO, UpdateTimelineNodeDTO } from '@shared/types';
import { handleAPIError, showSuccessToast } from '@/utils/error-toast';

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

export const JobForm: React.FC<JobFormProps> = ({ node, parentId, onSuccess, onFailure }) => {
  // Get authentication state and stores
  const { user, isAuthenticated } = useAuthStore();
  const { createNode, updateNode } = useHierarchyStore();

  const isUpdateMode = Boolean(node);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formData, setFormData] = useState<JobFormData>({
    company: node?.meta.company || '',
    role: node?.meta.role || '',
    location: node?.meta.location || '',
    description: node?.meta.description || '',
    startDate: node?.meta.startDate || '',
    endDate: node?.meta.endDate || '',
  });

  const validateField = useCallback((name: keyof JobFormData, value: string) => {
    try {
      const fieldSchema = jobMetaSchema.pick({ [name]: true });
      fieldSchema.parse({ [name]: value || undefined });
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

  const handleInputChange = (name: keyof JobFormData, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    // Real-time validation with debounce for better UX
    setTimeout(() => validateField(name, value), 300);
  };

  const handleFormSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setFieldErrors({});

    try {
      // Check authentication
      if (!user || !isAuthenticated) {
        throw new Error('User not authenticated. Please log in again.');
      }

      // Validate entire form
      const validatedData = jobMetaSchema.parse(formData);

      if (isUpdateMode && node) {
        // UPDATE mode: validate with shared schema, use current API format
        console.log('🐛 DEBUG: About to call updateNode...');
        await updateNode(node.id, {
          meta: validatedData
        });
        console.log('🐛 DEBUG: updateNode completed successfully');
      } else {
        // CREATE mode: validate with shared schema, call hierarchy store method
        console.log('🐛 DEBUG: About to call createNode...');
        await createNode({
          type: 'job',
          parentId: parentId || null,
          meta: validatedData
        });
        console.log('🐛 DEBUG: createNode completed successfully');
      }

      // Reset form on success (only in CREATE mode)
      if (!isUpdateMode) {
        setFormData({
          company: '',
          role: '',
          location: '',
          description: '',
          startDate: '',
          endDate: '',
        });
      }

      // Show success message and notify callback
      showSuccessToast(isUpdateMode ? 'Job updated successfully!' : 'Job added successfully!');
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
            const fieldName = error.path[0] as keyof JobFormData;
            errors[fieldName] = error.message;
          }
        });
        setFieldErrors(errors);
        // Don't show toast for validation errors, let user fix them in the form
      } else {
        // API or network errors - show user-friendly toast
        handleAPIError(err, 'Job save operation');

        // Still notify failure callback for any cleanup needed
        if (onFailure) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to save job';
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
          {isUpdateMode ? 'Edit Job' : 'Add Job'}
        </h2>
      </div>

      <form onSubmit={handleFormSubmit} className="space-y-6 add-node-form pt-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="company" className="text-gray-700 font-medium">Company *</Label>
            <Input
              id="company"
              name="company"
              required
              value={formData.company}
              onChange={(e) => handleInputChange('company', e.target.value)}
              placeholder="Company name"
              className={`bg-white text-gray-900 border-gray-300 placeholder:text-gray-500 focus:border-purple-500 focus:ring-purple-500 ${
                fieldErrors.company ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''
              }`}
            />
            {fieldErrors.company && (
              <p className="text-sm text-red-600">{fieldErrors.company}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="role" className="text-gray-700 font-medium">Role *</Label>
            <Input
              id="role"
              name="role"
              required
              value={formData.role}
              onChange={(e) => handleInputChange('role', e.target.value)}
              placeholder="Job role"
              className={`bg-white text-gray-900 border-gray-300 placeholder:text-gray-500 focus:border-purple-500 focus:ring-purple-500 ${
                fieldErrors.role ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''
              }`}
            />
            {fieldErrors.role && (
              <p className="text-sm text-red-600">{fieldErrors.role}</p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="location" className="text-gray-700 font-medium">Location</Label>
          <Input
            id="location"
            name="location"
            value={formData.location}
            onChange={(e) => handleInputChange('location', e.target.value)}
            placeholder="Work location"
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
            placeholder="Enter job description..."
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
              isUpdateMode ? 'Update Job' : 'Add Job'
            )}
          </Button>
        </div>
      </form>
    </>
  );
};

// Export both the unified form and maintain backward compatibility
export default JobForm;

// Backward compatibility wrapper for CREATE mode
export const JobModal: React.FC<Omit<JobFormProps, 'node'>> = (props) => {
  return <JobForm {...props} />;
};
