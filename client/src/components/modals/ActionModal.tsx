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
import { Loader2 } from 'lucide-react';

const actionSchema = z.object({
  type: z.literal('action'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  start: z.string().optional().refine((val) => !val || /^\d{4}-\d{2}$/.test(val), 'Invalid date format'),
  end: z.string().optional().refine((val) => !val || /^\d{4}-\d{2}$/.test(val), 'Invalid date format'),
});

type ActionFormData = z.infer<typeof actionSchema>;

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
  suggestedData?: Partial<ActionFormData>;
}

interface ActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ActionFormData & { context: NodeContext }) => Promise<void>;
  context: NodeContext;
}

const inputClassNames = "bg-white text-gray-900 border-gray-300 placeholder:text-gray-500 focus:border-purple-500 focus:ring-purple-500";
const labelClassNames = "text-gray-700 font-medium";
const textareaClassNames = "bg-white text-gray-900 border-gray-300 placeholder:text-gray-500 focus:border-purple-500 focus:ring-purple-500";

export const ActionModal: React.FC<ActionModalProps> = ({
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
    setValue,
  } = useForm<ActionFormData>({
    resolver: zodResolver(actionSchema),
    defaultValues: {
      type: 'action',
      ...context.suggestedData,
    },
  });

  useEffect(() => {
    if (context.suggestedData) {
      Object.entries(context.suggestedData).forEach(([key, value]) => {
        setValue(key as keyof ActionFormData, value as any);
      });
    }
  }, [context.suggestedData, setValue]);

  const handleFormSubmit = async (data: ActionFormData) => {
    setIsSubmitting(true);
    setError(null);

    try {
      if (data.start && data.end) {
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
      setError(err instanceof Error ? err.message : 'Failed to save action');
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
        return 'Adding new action';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogOverlay data-testid="modal-overlay" />
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white text-gray-900 border-gray-200 shadow-2xl">
        <DialogHeader className="pb-4 border-b border-gray-200">
          <DialogTitle id="modal-title" className="text-xl font-semibold text-gray-900">Add Action</DialogTitle>
          <DialogDescription id="modal-description" className="text-gray-600 mt-2">
            {getContextDescription()}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6 add-node-form pt-4">
          <div className="space-y-2">
            <Label htmlFor="title" className={labelClassNames}>Title *</Label>
            <Input
              id="title"
              {...register('title')}
              placeholder="Enter action title..."
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
              placeholder="Enter action description..."
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
                className={inputClassNames}
              />
              {errors.end && (
                <p className="text-sm text-red-600">{errors.end.message}</p>
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
                'Add Action'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ActionModal;