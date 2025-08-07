import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogOverlay,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { X, Loader2 } from 'lucide-react';

// Simplified base node schema for all node types
const baseNodeSchema = z.object({
  type: z.enum(['job', 'education', 'project', 'event', 'action', 'careerTransition']),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  start: z.string().optional().refine((val) => !val || /^\d{4}-\d{2}$/.test(val), 'Invalid date format'),
  end: z.string().optional().refine((val) => !val || /^\d{4}-\d{2}$/.test(val), 'Invalid date format'),
  isOngoing: z.boolean().optional(),
});

const nodeSchema = baseNodeSchema;

type NodeFormData = z.infer<typeof nodeSchema>;

interface NodeContext {
  insertionPoint: 'between' | 'after' | 'branch';
  parentNode?: {
    id: string;
    title: string;
    type: string;
  };
  targetNode?: {
    id: string;
    title: string;
    type: string;
  };
  availableTypes: string[];
  suggestedData?: Partial<NodeFormData>;
  nodeType: 'job' | 'education' | 'project' | 'event' | 'action' | 'careerTransition';
}

interface AddNodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: NodeFormData & { context: NodeContext }) => Promise<void>;
  context: NodeContext;
}

// Consistent styling for form inputs with clean light theme
const inputClassNames = "bg-white text-gray-900 border-gray-300 placeholder:text-gray-500 focus:border-purple-500 focus:ring-purple-500";
const labelClassNames = "text-gray-700 font-medium";
const textareaClassNames = "bg-white text-gray-900 border-gray-300 placeholder:text-gray-500 focus:border-purple-500 focus:ring-purple-500";

export const AddNodeModal: React.FC<AddNodeModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  context,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<NodeFormData>({
    resolver: zodResolver(nodeSchema),
    defaultValues: {
      type: context.nodeType,
      isOngoing: false,
      ...context.suggestedData,
    },
  });

  const watchedIsOngoing = watch('isOngoing');

  // Pre-populate form with context data
  useEffect(() => {
    if (context.suggestedData) {
      Object.entries(context.suggestedData).forEach(([key, value]) => {
        setValue(key as keyof NodeFormData, value as any);
      });
    }
  }, [context.suggestedData, setValue]);

  const handleFormSubmit = async (data: NodeFormData) => {
    setIsSubmitting(true);
    setError(null);

    try {
      // Validate end date is after start date if both are provided
      if ('start' in data && 'end' in data && data.start && data.end) {
        const startDate = new Date(data.start + '-01');
        const endDate = new Date(data.end + '-01');
        if (endDate <= startDate) {
          throw new Error('End date must be after start date');
        }
      }

      await onSubmit({ ...data, context });
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save milestone');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetry = () => {
    setError(null);
    handleSubmit(handleFormSubmit)();
  };

  const getContextDescription = () => {
    switch (context.insertionPoint) {
      case 'between':
        return (
          <span>
            Adding between <strong>{context.parentNode?.title}</strong> and{' '}
            <strong>{context.targetNode?.title}</strong>
          </span>
        );
      case 'after':
        return (
          <span>
            Adding after <strong>{context.targetNode?.title}</strong>
          </span>
        );
      case 'branch':
        return (
          <span>
            Adding project to <strong>{context.parentNode?.title}</strong>
          </span>
        );
      default:
        return 'Adding new milestone';
    }
  };

  const getModalTitle = () => {
    const typeLabels = {
      job: 'Job',
      education: 'Education',
      project: 'Project', 
      event: 'Event',
      action: 'Action',
      careerTransition: 'Career Transition'
    };
    return `Add ${typeLabels[context.nodeType]}`;
  };

  // Simplified form fields - same for all node types
  const renderFormFields = () => {
    return (
      <>
        <div className="space-y-2">
          <Label htmlFor="title" className={labelClassNames}>Title *</Label>
          <Input
            id="title"
            {...register('title')}
            placeholder="Enter title..."
            className={inputClassNames}
          />
          {errors.title && (
            <p className="text-sm text-red-600">{errors.title.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="description" className={labelClassNames}>Description</Label>
          <Textarea
            id="description"
            {...register('description')}
            placeholder="Enter description..."
            rows={3}
            className={textareaClassNames}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="start" className={labelClassNames}>Start Date</Label>
            <Input
              id="start"
              {...register('start')}
              placeholder="YYYY-MM"
              className={inputClassNames}
            />
            {errors.start && (
              <p className="text-sm text-red-600">{errors.start.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="end" className={labelClassNames}>End Date</Label>
            <Input
              id="end"
              {...register('end')}
              placeholder="YYYY-MM"
              disabled={watchedIsOngoing}
              className={inputClassNames}
            />
            {errors.end && (
              <p className="text-sm text-red-600">{errors.end.message}</p>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="isOngoing"
            {...register('isOngoing')}
            onCheckedChange={(checked) => {
              setValue('isOngoing', checked as boolean);
              if (checked) {
                setValue('end', '');
              }
            }}
          />
          <Label htmlFor="isOngoing" className={labelClassNames}>This is ongoing</Label>
        </div>
      </>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogOverlay data-testid="modal-overlay" />
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white text-gray-900 border-gray-200 shadow-2xl">
        <DialogHeader className="pb-4 border-b border-gray-200">
          <DialogTitle id="modal-title" className="text-xl font-semibold text-gray-900">{getModalTitle()}</DialogTitle>
          <DialogDescription id="modal-description" className="text-gray-600 mt-2">
            {getContextDescription()}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6 add-node-form pt-4">
          {renderFormFields()}

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
              type="button"
              variant="outline"
              onClick={onClose}
              data-testid="close-modal"
              className="border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-gray-900 bg-white"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              data-testid="submit-button"
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                `Add ${context.nodeType.charAt(0).toUpperCase() + context.nodeType.slice(1)}`
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddNodeModal;