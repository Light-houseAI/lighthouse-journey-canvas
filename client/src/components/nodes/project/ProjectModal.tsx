import { ProjectStatus,ProjectType } from '@shared/enums';
import { TimelineNode } from '@shared/schema';
import { projectMetaSchema } from '@shared/types';
import { Loader2 } from 'lucide-react';
import React, { useCallback,useState } from 'react';
import { z } from 'zod';

// Dialog components removed - now pure form component
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuthStore } from '@/stores/auth-store';
import { useHierarchyStore } from '@/stores/hierarchy-store';
import { handleAPIError, showSuccessToast } from '@/utils/error-toast';

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

export const ProjectForm: React.FC<ProjectFormProps> = ({ node, parentId, onSuccess, onFailure }) => {
  // Get authentication state and stores
  const { user, isAuthenticated } = useAuthStore();
  const { createNode, updateNode } = useHierarchyStore();

  const isUpdateMode = Boolean(node);

  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const validateField = useCallback((name: keyof ProjectFormData, value: string | string[] | ProjectType | ProjectStatus | undefined) => {
    try {
      // Skip validation for optional enum fields that are undefined
      if ((name === 'projectType' || name === 'status') && value === undefined) {
        setFieldErrors(prev => ({ ...prev, [name]: undefined }));
        return true;
      }

      const testData = { [name]: value || undefined };
      const fieldSchema = z.object({ [name]: projectMetaSchema.shape[name] });
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

  const handleInputChange = (name: keyof ProjectFormData, value: string | string[] | ProjectType | ProjectStatus | undefined) => {
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
      const validatedData = projectMetaSchema.parse(formData);

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
          type: 'project',
          parentId: parentId || null,
          meta: validatedData
        });
        console.log('🐛 DEBUG: createNode completed successfully');
      }

      // Reset form on success (only in CREATE mode)
      if (!isUpdateMode) {
        setFormData({
          title: '',
          description: '',
          technologies: [],
          projectType: undefined,
          status: undefined,
          startDate: '',
          endDate: '',
        });
      }

      // Show success toast
      showSuccessToast(isUpdateMode ? 'Project updated successfully!' : 'Project added successfully!');

      // Notify success
      console.log('🐛 DEBUG: Calling onSuccess callback...');
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.log('🐛 DEBUG: Caught error in form submission:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to save project';

      if (err instanceof z.ZodError) {
        // Set field-specific errors for validation errors
        const errors: FieldErrors = {};
        err.errors.forEach(error => {
          if (error.path.length > 0) {
            const fieldName = error.path[0] as keyof ProjectFormData;
            errors[fieldName] = error.message;
          }
        });
        setFieldErrors(errors);
        // Don't call onFailure for validation errors, let user fix them
      } else {
        // API or network errors - show toast and notify failure
        handleAPIError(err, 'Project submission');

        // Notify failure for API/network errors
        if (onFailure) {
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
          {isUpdateMode ? 'Edit Project' : 'Add Project'}
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
            placeholder="Project title"
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
            placeholder="Project description"
            rows={3}
            className="bg-white text-gray-900 border-gray-300 placeholder:text-gray-500 focus:border-purple-500 focus:ring-purple-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="projectType" className="text-gray-700 font-medium">Project Type</Label>
            <Select value={formData.projectType} onValueChange={(value) => handleInputChange('projectType', value)}>
              <SelectTrigger className="bg-white text-gray-900 border-gray-300 focus:border-purple-500 focus:ring-purple-500">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ProjectType.Personal}>Personal</SelectItem>
                <SelectItem value={ProjectType.Professional}>Professional</SelectItem>
                <SelectItem value={ProjectType.Academic}>Academic</SelectItem>
                <SelectItem value={ProjectType.Freelance}>Freelance</SelectItem>
                <SelectItem value={ProjectType.OpenSource}>Open Source</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status" className="text-gray-700 font-medium">Status</Label>
            <Select value={formData.status} onValueChange={(value) => handleInputChange('status', value)}>
              <SelectTrigger className="bg-white text-gray-900 border-gray-300 focus:border-purple-500 focus:ring-purple-500">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ProjectStatus.Planning}>Planning</SelectItem>
                <SelectItem value={ProjectStatus.Active}>Active</SelectItem>
                <SelectItem value={ProjectStatus.Completed}>Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
              isUpdateMode ? 'Update Project' : 'Add Project'
            )}
          </Button>
        </div>
      </form>
    </>
  );
};

// Export both the unified form and maintain backward compatibility
export default ProjectForm;

// Backward compatibility wrapper for CREATE mode
export const ProjectModal: React.FC<Omit<ProjectFormProps, 'node'>> = (props) => {
  return <ProjectForm {...props} />;
};
