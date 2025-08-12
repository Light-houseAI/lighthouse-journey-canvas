import React, { useState, useCallback } from 'react';
// Dialog components removed - now pure form component
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { z } from 'zod';
import { useAuthStore } from '@/stores/auth-store';
import { useJourneyStore } from '@/stores/journey-store';
import { useHierarchyStore } from '@/stores/hierarchy-store';
import { actionMetaSchema, TimelineNode } from '@shared/schema';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Use shared schema as single source of truth
type ActionFormData = z.infer<typeof actionMetaSchema>;
type FieldErrors = Partial<Record<keyof ActionFormData, string>>;

// NodeContext removed - pure form component

interface ActionFormProps {
  node?: TimelineNode; // Optional - if provided, we're in UPDATE mode
  onSuccess?: () => void; // Called when form submission succeeds
  onFailure?: (error: string) => void; // Called when form submission fails
}

export const ActionForm: React.FC<ActionFormProps> = ({ node, onSuccess, onFailure }) => {
  // Get authentication state and stores
  const { user, isAuthenticated } = useAuthStore();
  const { createAction } = useJourneyStore();
  const { updateNode } = useHierarchyStore();

  const isUpdateMode = Boolean(node);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formData, setFormData] = useState<ActionFormData>({
    title: node?.meta.title || '',
    description: node?.meta.description || '',
    startDate: node?.meta.startDate || '',
    endDate: node?.meta.endDate || '',
  });

  const validateField = useCallback((name: keyof ActionFormData, value: string) => {
    try {
      const testData = { [name]: value || undefined };
      const fieldSchema = z.object({ [name]: actionMetaSchema.shape[name] });
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

  const handleInputChange = (name: keyof ActionFormData, value: string) => {
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
      const validatedData = actionMetaSchema.parse(formData);

      if (isUpdateMode && node) {
        // UPDATE mode: validate with shared schema, use current API format
        console.log('🐛 DEBUG: About to call updateNode...');
        await updateNode(node.id, {
          meta: validatedData
        });
        console.log('🐛 DEBUG: updateNode completed successfully');
      } else {
        // CREATE mode: validate with shared schema, call existing store method
        console.log('🐛 DEBUG: About to call createAction...');
        await createAction(validatedData);
        console.log('🐛 DEBUG: createAction completed successfully');
      }

      // Reset form on success (only in CREATE mode)
      if (!isUpdateMode) {
        setFormData({
          title: '',
          description: '',
          startDate: '',
          endDate: '',
        });
      }

      // Notify success
      console.log('🐛 DEBUG: Calling onSuccess callback...');
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.log('🐛 DEBUG: Caught error in form submission:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to save action';

      if (err instanceof z.ZodError) {
        // Set field-specific errors for validation errors
        const errors: FieldErrors = {};
        err.errors.forEach(error => {
          if (error.path.length > 0) {
            const fieldName = error.path[0] as keyof ActionFormData;
            errors[fieldName] = error.message;
          }
        });
        setFieldErrors(errors);
        // Don't call onFailure for validation errors, let user fix them
      } else {
        // API or network errors - set error state to show retry option
        setError(errorMessage);

        // Notify failure for API/network errors
        if (onFailure) {
          onFailure(errorMessage);
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetry = () => {
    setError(null);
    const form = document.querySelector('.add-node-form') as HTMLFormElement;
    if (form) {
      form.requestSubmit();
    }
  };

  return (
    <>
      <div className="pb-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">
          {isUpdateMode ? 'Edit Action' : 'Add Action'}
        </h2>
      </div>

      <form onSubmit={handleFormSubmit} className="space-y-6 add-node-form pt-4">
        <div className="space-y-2">
          <Label htmlFor="title" className="text-gray-700 font-medium">Title *</Label>
          <Input
            id="title"
            name="title"
            required
            value={formData.title}
            onChange={(e) => handleInputChange('title', e.target.value)}
            placeholder="Action title"
            className={`bg-white text-gray-900 border-gray-300 placeholder:text-gray-500 focus:border-purple-500 focus:ring-purple-500 ${
              fieldErrors.title ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''
            }`}
          />
          {fieldErrors.title && (
            <p className="text-sm text-red-600">{fieldErrors.title}</p>
          )}
        </div>


        <div className="space-y-2">
          <Label htmlFor="description" className="text-gray-700 font-medium">Description</Label>
          <Textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            placeholder="Action description"
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

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-800 text-sm mb-2">
              {error.includes('Network') ? (
                <>
                  <strong>Network Error</strong>
                  <br />
                  Please check your connection and try again.
                </>
              ) : (
                error
              )}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRetry}
              data-testid="retry-button"
            >
              Retry
            </Button>
          </div>
        )}

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
              isUpdateMode ? 'Update Action' : 'Add Action'
            )}
          </Button>
        </div>
      </form>
    </>
  );
};

// Export both the unified form and maintain backward compatibility
export default ActionForm;

// Backward compatibility wrapper for CREATE mode
export const ActionModal: React.FC<Omit<ActionFormProps, 'node'>> = (props) => {
  return <ActionForm {...props} />;
};
