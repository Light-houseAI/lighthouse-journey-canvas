import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogOverlay,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { NodeIcon } from '../../icons/NodeIcons';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { educationFormSchema, EducationFormData } from './schema';

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
  suggestedData?: Partial<EducationFormData>;
}

interface EducationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: EducationFormData & { context: NodeContext }) => Promise<void>;
  context: NodeContext;
}

export const EducationModal: React.FC<EducationModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  context,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<EducationFormData>({
    resolver: zodResolver(educationFormSchema),
    defaultValues: {
      institution: 'Institution Name', // Required by educationMetaSchema
      degree: 'Degree Name', // Required by educationMetaSchema
      field: '',
      location: '',
      startDate: '',
      endDate: '',
      ...context.suggestedData,
    },
  });

  useEffect(() => {
    if (context.suggestedData) {
      Object.entries(context.suggestedData).forEach(([key, value]) => {
        form.setValue(key as keyof EducationFormData, value as any);
      });
    }
  }, [context.suggestedData, form]);

  const handleFormSubmit = async (data: EducationFormData) => {
    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit({ ...data, context });
      form.reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save education');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetry = () => {
    setError(null);
    form.handleSubmit(handleFormSubmit)();
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
            Adding education to <strong>{context.parentNode?.title}</strong>
          </span>
        );
      default:
        return 'Adding new education';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogOverlay 
        data-testid="modal-overlay" 
        className="bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
      />
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-white via-emerald-50 to-teal-50/30 border border-emerald-200/50 shadow-2xl backdrop-blur-sm">
        {/* Subtle Background Effects */}
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-transparent to-teal-500/5 rounded-lg"></div>
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent"></div>
        
        <div className="relative z-10">
          <DialogHeader className="pb-6 border-b border-emerald-200/50">
            {/* Enhanced Header */}
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                <NodeIcon type="education" size={24} className="text-white" />
              </div>
              <div>
                <DialogTitle id="modal-title" className="text-2xl font-bold bg-gradient-to-r from-emerald-800 to-teal-600 bg-clip-text text-transparent">
                  Add Education
                </DialogTitle>
                <div className="w-16 h-1 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full mt-2"></div>
              </div>
            </div>
            <DialogDescription id="modal-description" className="text-slate-600 text-base leading-relaxed">
              {getContextDescription()}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6 add-node-form pt-6">
              {/* Enhanced Form Fields */}
              
              {/* Institution and Degree */}
              <div className="grid grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="institution"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold text-slate-700">Institution</FormLabel>
                      <FormControl>
                        <div className="relative group">
                          <Input
                            placeholder="School or institution"
                            className="border-slate-300 focus:border-emerald-500 focus:ring-emerald-500/20 rounded-lg bg-white/50 backdrop-blur-sm transition-all duration-200 group-hover:bg-white/70"
                            {...field}
                          />
                          <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-emerald-500/5 to-teal-500/5 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="degree"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold text-slate-700">Degree</FormLabel>
                      <FormControl>
                        <div className="relative group">
                          <Input
                            placeholder="Degree or certification"
                            className="border-slate-300 focus:border-emerald-500 focus:ring-emerald-500/20 rounded-lg bg-white/50 backdrop-blur-sm transition-all duration-200 group-hover:bg-white/70"
                            {...field}
                          />
                          <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-emerald-500/5 to-teal-500/5 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Field of Study */}
              <FormField
                control={form.control}
                name="field"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-slate-700">Field of Study</FormLabel>
                    <FormControl>
                      <div className="relative group">
                        <Input
                          placeholder="Field of study"
                          className="border-slate-300 focus:border-emerald-500 focus:ring-emerald-500/20 rounded-lg bg-white/50 backdrop-blur-sm transition-all duration-200 group-hover:bg-white/70"
                          {...field}
                        />
                        <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-emerald-500/5 to-teal-500/5 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Location */}
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-slate-700">Location</FormLabel>
                    <FormControl>
                      <div className="relative group">
                        <Input
                          placeholder="School location"
                          className="border-slate-300 focus:border-emerald-500 focus:ring-emerald-500/20 rounded-lg bg-white/50 backdrop-blur-sm transition-all duration-200 group-hover:bg-white/70"
                          {...field}
                        />
                        <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-emerald-500/5 to-teal-500/5 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Start and End Date */}
              <div className="grid grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold text-slate-700">Start Date</FormLabel>
                      <FormControl>
                        <div className="relative group">
                          <Input
                            type="month"
                            placeholder="YYYY-MM"
                            className="border-slate-300 focus:border-emerald-500 focus:ring-emerald-500/20 rounded-lg bg-white/50 backdrop-blur-sm transition-all duration-200 group-hover:bg-white/70"
                            {...field}
                          />
                          <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-emerald-500/5 to-teal-500/5 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold text-slate-700">End Date</FormLabel>
                      <FormControl>
                        <div className="relative group">
                          <Input
                            type="month"
                            placeholder="YYYY-MM or leave empty"
                            className="border-slate-300 focus:border-emerald-500 focus:ring-emerald-500/20 rounded-lg bg-white/50 backdrop-blur-sm transition-all duration-200 group-hover:bg-white/70"
                            {...field}
                          />
                          <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-emerald-500/5 to-teal-500/5 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Enhanced Error Display */}
              {error && (
                <div className="relative p-4 rounded-xl bg-gradient-to-r from-red-50 to-red-100/50 border border-red-200/50 backdrop-blur-sm">
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-red-500/5 via-transparent to-red-500/5"></div>
                  <div className="relative">
                    <p className="text-red-800 text-sm mb-3 leading-relaxed">
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
                    <button
                      type="button"
                      onClick={handleRetry}
                      data-testid="retry-button"
                      className="group relative px-4 py-2 rounded-lg bg-gradient-to-r from-red-500 to-red-600 text-white text-sm font-medium transition-all duration-300 hover:shadow-lg hover:shadow-red-500/25 overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-red-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                      <span className="relative z-10">Retry</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Enhanced Action Buttons */}
              <div className="flex justify-end space-x-4 pt-8 border-t border-emerald-200/50 mt-8">
                <button
                  type="button"
                  onClick={onClose}
                  data-testid="close-modal"
                  className="group relative px-6 py-3 rounded-xl bg-gradient-to-r from-slate-100 to-slate-200 text-slate-700 font-medium transition-all duration-300 hover:shadow-lg hover:shadow-slate-500/25 overflow-hidden border border-slate-300"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-slate-200 to-slate-300 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                  <span className="relative z-10">Cancel</span>
                </button>
                
                <button
                  type="submit"
                  disabled={isSubmitting}
                  data-testid="submit-button"
                  className="group relative px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-medium transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/25 overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-teal-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                  <span className="relative z-10 flex items-center">
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      'Add Education'
                    )}
                  </span>
                </button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EducationModal;