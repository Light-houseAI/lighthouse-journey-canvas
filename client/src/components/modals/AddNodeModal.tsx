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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { X, Loader2 } from 'lucide-react';

// Form schemas for different node types
const workExperienceSchema = z.object({
  type: z.literal('workExperience'),
  title: z.string().min(1, 'Job title is required'),
  company: z.string().min(1, 'Company is required'),
  start: z.string().min(1, 'Start date is required').regex(/^\d{4}-\d{2}$/, 'Invalid date format'),
  end: z.string().optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  isOngoing: z.boolean().optional(),
});

const educationSchema = z.object({
  type: z.literal('education'),
  school: z.string().min(1, 'Institution is required'),
  degree: z.string().min(1, 'Degree is required'),
  field: z.string().min(1, 'Field of study is required'),
  start: z.string().min(1, 'Start date is required').regex(/^\d{4}-\d{2}$/, 'Invalid date format'),
  end: z.string().optional(),
  description: z.string().optional(),
  isOngoing: z.boolean().optional(),
});

const projectSchema = z.object({
  type: z.literal('project'),
  title: z.string().min(1, 'Project name is required'),
  description: z.string().optional(),
  technologies: z.string().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  parentExperienceId: z.string().optional(),
});

const skillSchema = z.object({
  type: z.literal('skill'),
  name: z.string().min(1, 'Skill name is required'),
  proficiency: z.enum(['beginner', 'intermediate', 'advanced', 'expert']),
  context: z.string().optional(),
  verification: z.string().optional(),
});

const jobTransitionSchema = z.object({
  type: z.literal('jobTransition'),
  title: z.string().min(1, 'Transition type is required'),
  description: z.string().min(1, 'Description is required'),
  reason: z.string().optional(),
  start: z.string().min(1, 'Start date is required').regex(/^\d{4}-\d{2}$/, 'Invalid date format'),
  end: z.string().optional(),
  status: z.enum(['active', 'completed', 'paused']).optional(),
  isOngoing: z.boolean().optional(),
});

const eventSchema = z.object({
  type: z.literal('event'),
  title: z.string().min(1, 'Event name is required'),
  description: z.string().min(1, 'Description is required'),
  eventType: z.enum(['conference', 'networking', 'presentation', 'workshop', 'meetup', 'other']),
  location: z.string().optional(),
  start: z.string().min(1, 'Event date is required').regex(/^\d{4}-\d{2}$/, 'Invalid date format'),
  end: z.string().optional(),
  organizer: z.string().optional(),
  attendees: z.string().optional(),
});

const actionSchema = z.object({
  type: z.literal('action'),
  title: z.string().min(1, 'Achievement title is required'),
  description: z.string().min(1, 'Description is required'),
  category: z.enum(['achievement', 'milestone', 'recognition', 'certification', 'other']),
  impact: z.string().optional(),
  verification: z.string().optional(),
  start: z.string().min(1, 'Date is required').regex(/^\d{4}-\d{2}$/, 'Invalid date format'),
  end: z.string().optional(),
});

const nodeSchema = z.discriminatedUnion('type', [
  workExperienceSchema,
  educationSchema,
  projectSchema,
  skillSchema,
  jobTransitionSchema,
  eventSchema,
  actionSchema,
]);

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
const selectTriggerClassNames = "bg-white text-gray-900 border-gray-300 focus:border-purple-500 focus:ring-purple-500";

export const AddNodeModal: React.FC<AddNodeModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  context,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string>('workExperience');

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
      type: 'workExperience' as const,
      isOngoing: false,
      ...context.suggestedData,
    },
  });

  const watchedType = watch('type');
  const watchedIsOngoing = watch('isOngoing');

  // Update selected type when form type changes
  useEffect(() => {
    setSelectedType(watchedType);
  }, [watchedType]);

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

  const renderFormFields = () => {
    switch (selectedType) {
      case 'workExperience':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="title" className={labelClassNames}>Job Title *</Label>
              <Input
                id="title"
                {...register('title')}
                placeholder="Software Engineer"
                className={inputClassNames}
              />
              {errors.title && (
                <p className="text-sm text-red-600">{errors.title.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="company" className={labelClassNames}>Company *</Label>
              <Input
                id="company"
                {...register('company')}
                placeholder="Company name"
                className={inputClassNames}
              />
              {errors.company && (
                <p className="text-sm text-red-600">{errors.company.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start" className={labelClassNames}>Start Date *</Label>
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
              <Label htmlFor="isOngoing" className={labelClassNames}>Currently working here</Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location" className={labelClassNames}>Location</Label>
              <Input
                id="location"
                {...register('location')}
                placeholder="San Francisco, CA"
                className={inputClassNames}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className={labelClassNames}>Description</Label>
              <Textarea
                id="description"
                {...register('description')}
                placeholder="Describe your role and responsibilities..."
                rows={3}
                className={textareaClassNames}
              />
            </div>
          </>
        );

      case 'education':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="school" className={labelClassNames}>Institution *</Label>
              <Input
                id="school"
                {...register('school')}
                placeholder="University name"
                className={inputClassNames}
              />
              {errors.school && (
                <p className="text-sm text-red-600">{errors.school.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="degree" className={labelClassNames}>Degree *</Label>
              <Input
                id="degree"
                {...register('degree')}
                placeholder="Bachelor of Science"
                className={inputClassNames}
              />
              {errors.degree && (
                <p className="text-sm text-red-600">{errors.degree.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="field" className={labelClassNames}>Field of Study *</Label>
              <Input
                id="field"
                {...register('field')}
                placeholder="Computer Science"
                className={inputClassNames}
              />
              {errors.field && (
                <p className="text-sm text-red-600">{errors.field.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start" className={labelClassNames}>Start Date *</Label>
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
              <Label htmlFor="isOngoing" className={labelClassNames}>Currently enrolled</Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className={labelClassNames}>Description</Label>
              <Textarea
                id="description"
                {...register('description')}
                placeholder="Describe your studies..."
                rows={3}
                className={textareaClassNames}
              />
            </div>
          </>
        );

      case 'project':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="title" className={labelClassNames}>Project Name *</Label>
              <Input
                id="title"
                {...register('title')}
                placeholder="Project name"
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
                placeholder="Describe the project..."
                rows={3}
                className={textareaClassNames}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="technologies" className={labelClassNames}>Technologies</Label>
              <Input
                id="technologies"
                {...register('technologies')}
                placeholder="React, Node.js, Python"
                className={inputClassNames}
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="end" className={labelClassNames}>End Date</Label>
                <Input
                  id="end"
                  {...register('end')}
                  placeholder="YYYY-MM"
                  className={inputClassNames}
                />
              </div>
            </div>

            {context.parentNode && (
              <div className="space-y-2">
                <Label htmlFor="parentExperience" className={labelClassNames}>Parent Experience</Label>
                <Input
                  id="parentExperience"
                  value={context.parentNode.title}
                  disabled
                  className={inputClassNames}
                />
              </div>
            )}
          </>
        );

      case 'skill':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="name" className={labelClassNames}>Skill Name *</Label>
              <Input
                id="name"
                {...register('name')}
                placeholder="JavaScript"
                className={inputClassNames}
              />
              {errors.name && (
                <p className="text-sm text-red-600">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="proficiency" className={labelClassNames}>Proficiency Level *</Label>
              <Select onValueChange={(value) => setValue('proficiency', value as any)}>
                <SelectTrigger className={selectTriggerClassNames}>
                  <SelectValue placeholder="Select proficiency level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                  <SelectItem value="expert">Expert</SelectItem>
                </SelectContent>
              </Select>
              {errors.proficiency && (
                <p className="text-sm text-red-600">{errors.proficiency.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="context" className={labelClassNames}>Context</Label>
              <Textarea
                id="context"
                {...register('context')}
                placeholder="How you acquired this skill..."
                rows={2}
                className={textareaClassNames}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="verification" className={labelClassNames}>Verification Method</Label>
              <Input
                id="verification"
                {...register('verification')}
                placeholder="Certification, project, etc."
                className={inputClassNames}
              />
            </div>
          </>
        );

      case 'jobTransition':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="title" className={labelClassNames}>Transition Type *</Label>
              <Input
                id="title"
                {...register('title')}
                placeholder="Job search, Career change, etc."
                className={inputClassNames}
              />
              {errors.title && (
                <p className="text-sm text-red-600">{errors.title.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className={labelClassNames}>Description *</Label>
              <Textarea
                id="description"
                {...register('description')}
                placeholder="Describe your career transition..."
                rows={3}
                className={textareaClassNames}
              />
              {errors.description && (
                <p className="text-sm text-red-600">{errors.description.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason" className={labelClassNames}>Reason for Transition</Label>
              <Textarea
                id="reason"
                {...register('reason')}
                placeholder="What motivated this career change?"
                rows={2}
                className={textareaClassNames}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start" className={labelClassNames}>Start Date *</Label>
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
              <Label htmlFor="isOngoing" className={labelClassNames}>This transition is ongoing</Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status" className={labelClassNames}>Status</Label>
              <Select onValueChange={(value) => setValue('status', value as any)}>
                <SelectTrigger className={selectTriggerClassNames}>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        );

      case 'event':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="title" className={labelClassNames}>Event Name *</Label>
              <Input
                id="title"
                {...register('title')}
                placeholder="Conference name, networking event, etc."
                className={inputClassNames}
              />
              {errors.title && (
                <p className="text-sm text-red-600">{errors.title.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="eventType" className={labelClassNames}>Event Type *</Label>
              <Select onValueChange={(value) => setValue('eventType', value as any)}>
                <SelectTrigger className={selectTriggerClassNames}>
                  <SelectValue placeholder="Select event type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="conference">Conference</SelectItem>
                  <SelectItem value="networking">Networking</SelectItem>
                  <SelectItem value="presentation">Presentation</SelectItem>
                  <SelectItem value="workshop">Workshop</SelectItem>
                  <SelectItem value="meetup">Meetup</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              {errors.eventType && (
                <p className="text-sm text-red-600">{errors.eventType.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className={labelClassNames}>Description *</Label>
              <Textarea
                id="description"
                {...register('description')}
                placeholder="Describe the event and your role..."
                rows={3}
                className={textareaClassNames}
              />
              {errors.description && (
                <p className="text-sm text-red-600">{errors.description.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="location" className={labelClassNames}>Location</Label>
              <Input
                id="location"
                {...register('location')}
                placeholder="San Francisco, CA or Virtual"
                className={inputClassNames}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start" className={labelClassNames}>Event Date *</Label>
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
                  placeholder="YYYY-MM (if multi-day)"
                  className={inputClassNames}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="organizer" className={labelClassNames}>Organizer</Label>
              <Input
                id="organizer"
                {...register('organizer')}
                placeholder="Event organizer or company"
                className={inputClassNames}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="attendees" className={labelClassNames}>Notable Attendees</Label>
              <Input
                id="attendees"
                {...register('attendees')}
                placeholder="Key people you met or networked with"
                className={inputClassNames}
              />
            </div>
          </>
        );

      case 'action':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="title" className={labelClassNames}>Achievement Title *</Label>
              <Input
                id="title"
                {...register('title')}
                placeholder="Award, recognition, milestone, etc."
                className={inputClassNames}
              />
              {errors.title && (
                <p className="text-sm text-red-600">{errors.title.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="category" className={labelClassNames}>Category *</Label>
              <Select onValueChange={(value) => setValue('category', value as any)}>
                <SelectTrigger className={selectTriggerClassNames}>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="achievement">Achievement</SelectItem>
                  <SelectItem value="milestone">Milestone</SelectItem>
                  <SelectItem value="recognition">Recognition</SelectItem>
                  <SelectItem value="certification">Certification</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              {errors.category && (
                <p className="text-sm text-red-600">{errors.category.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className={labelClassNames}>Description *</Label>
              <Textarea
                id="description"
                {...register('description')}
                placeholder="Describe your achievement and its significance..."
                rows={3}
                className={textareaClassNames}
              />
              {errors.description && (
                <p className="text-sm text-red-600">{errors.description.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="impact" className={labelClassNames}>Impact</Label>
              <Textarea
                id="impact"
                {...register('impact')}
                placeholder="What was the impact or outcome of this achievement?"
                rows={2}
                className={textareaClassNames}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="verification" className={labelClassNames}>Verification Method</Label>
              <Input
                id="verification"
                {...register('verification')}
                placeholder="Link, certificate, reference, etc."
                className={inputClassNames}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start" className={labelClassNames}>Date *</Label>
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
                  placeholder="YYYY-MM (if applicable)"
                  className={inputClassNames}
                />
              </div>
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogOverlay data-testid="modal-overlay" />
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white text-gray-900 border-gray-200 shadow-2xl">
        <DialogHeader className="pb-4 border-b border-gray-200">
          <DialogTitle id="modal-title" className="text-xl font-semibold text-gray-900">Add New Milestone</DialogTitle>
          <DialogDescription id="modal-description" className="text-gray-600 mt-2">
            {getContextDescription()}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6 add-node-form pt-4">
          <div className="space-y-2">
            <Label htmlFor="type" className={labelClassNames}>Type *</Label>
            <Select
              value={selectedType}
              onValueChange={(value) => {
                setValue('type', value as any);
                setSelectedType(value);
              }}
            >
              <SelectTrigger data-testid="node-type-selector" className={selectTriggerClassNames}>
                <SelectValue placeholder="Select node type" />
              </SelectTrigger>
              <SelectContent>
                {context.availableTypes.includes('workExperience') && (
                  <SelectItem value="workExperience">Work Experience</SelectItem>
                )}
                {context.availableTypes.includes('education') && (
                  <SelectItem value="education">Education</SelectItem>
                )}
                {context.availableTypes.includes('project') && (
                  <SelectItem value="project">Project</SelectItem>
                )}
                {context.availableTypes.includes('skill') && (
                  <SelectItem value="skill">Skill</SelectItem>
                )}
                {context.availableTypes.includes('jobTransition') && (
                  <SelectItem value="jobTransition">Job Transition</SelectItem>
                )}
                {context.availableTypes.includes('event') && (
                  <SelectItem value="event">Event</SelectItem>
                )}
                {context.availableTypes.includes('action') && (
                  <SelectItem value="action">Action</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

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
                'Add Milestone'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddNodeModal;
