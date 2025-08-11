import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { NodeIcon } from '../../icons/NodeIcons';
import { HierarchyNode, NodeMetadata } from '../../../services/hierarchy-api';
import { useHierarchyStore } from '../../../stores/hierarchy-store';
import { educationFormSchema, EducationFormData } from './schema';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../../ui/alert-dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../ui/form';
import { formatDateRange } from '../../../utils/date-parser';

interface EducationNodePanelProps {
  node: HierarchyNode;
}

interface EducationViewProps {
  node: HierarchyNode;
  onEdit: () => void;
  onDelete: () => void;
  loading: boolean;
}

const EducationView: React.FC<EducationViewProps> = ({ node, onEdit, onDelete, loading }) => {
  const getEducationTitle = () => {
    if (node.meta.degree && node.meta.institution) {
      return node.meta.field 
        ? `${node.meta.degree} in ${node.meta.field} at ${node.meta.institution}`
        : `${node.meta.degree} at ${node.meta.institution}`;
    } else if (node.meta.degree) {
      return node.meta.field ? `${node.meta.degree} in ${node.meta.field}` : node.meta.degree;
    } else if (node.meta.institution) {
      return node.meta.institution;
    }
    return 'Education';
  };

  return (
    <>
      {/* Education Title with Magic Card Effect */}
      <div className="relative mb-6 p-6 rounded-2xl bg-gradient-to-br from-white to-emerald-50 border border-emerald-200/50 shadow-lg">
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-emerald-500/5 via-transparent to-teal-500/5"></div>
        <div className="relative">
          <h3 className="text-2xl font-bold bg-gradient-to-r from-emerald-800 to-teal-600 bg-clip-text text-transparent">
            {getEducationTitle()}
          </h3>
          {node.meta.institution && (
            <p className="text-lg text-emerald-600 mt-1">{node.meta.institution}</p>
          )}
          {node.meta.location && (
            <div className="flex items-center mt-2 text-sm text-emerald-500">
              <div className="w-1 h-1 bg-emerald-400 rounded-full mr-2"></div>
              {node.meta.location}
            </div>
          )}
        </div>
      </div>
      
      {/* Duration */}
      {(node.meta.startDate || node.meta.endDate) && (
        <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/50">
          <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Duration</span>
          <p className="text-slate-900 mt-2 font-medium">
            {formatDateRange(node.meta.startDate, node.meta.endDate)}
          </p>
        </div>
      )}

      {/* Degree & Field */}
      {(node.meta.degree || node.meta.field) && (
        <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-200/50">
          <span className="text-xs font-semibold text-teal-600 uppercase tracking-wider">Study</span>
          <div className="mt-2">
            {node.meta.degree && <p className="text-slate-900 font-medium">{node.meta.degree}</p>}
            {node.meta.field && <p className="text-teal-600 text-sm">Field: {node.meta.field}</p>}
          </div>
        </div>
      )}

      {/* Description */}
      {node.meta.description && (
        <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-slate-50 to-white border border-slate-200/50">
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Description</span>
          <p className="text-slate-900 mt-2 whitespace-pre-wrap leading-relaxed">{node.meta.description}</p>
        </div>
      )}

      {/* Enhanced Action Buttons */}
      <div className="flex gap-3 mt-8">
        <button
          onClick={onEdit}
          className="group relative flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-medium transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/25 overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-teal-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
          <span className="relative z-10">Edit</span>
        </button>
        
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              className="group relative flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white font-medium transition-all duration-300 hover:shadow-lg hover:shadow-red-500/25 overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-red-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
              <span className="relative z-10">Delete</span>
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent className="bg-white border border-slate-200 shadow-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-slate-900">Delete Education</AlertDialogTitle>
              <AlertDialogDescription className="text-slate-600">
                Are you sure you want to delete "{getEducationTitle()}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-300">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction 
                onClick={onDelete} 
                className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );
};

interface EducationEditProps {
  node: HierarchyNode;
  onSave: (data: { meta: Partial<NodeMetadata> }) => void;
  onCancel: () => void;
  loading: boolean;
}

const EducationEdit: React.FC<EducationEditProps> = ({ node, onSave, onCancel, loading }) => {
  const form = useForm<EducationFormData>({
    resolver: zodResolver(educationFormSchema),
    defaultValues: {
      title: node.meta.title || '',
      institution: node.meta.institution || '',
      degree: node.meta.degree || '',
      field: node.meta.field || '',
      location: node.meta.location || '',
      description: node.meta.description || '',
      startDate: node.meta.startDate || '',
      endDate: node.meta.endDate || '',
    },
  });

  const onSubmit = (data: EducationFormData) => {
    // Generate title if not provided explicitly
    const generateEducationTitle = () => {
      if (data.title && data.title.trim()) {
        return data.title.trim();
      }
      if (data.degree && data.field) {
        return `${data.degree} in ${data.field}`;
      } else if (data.degree) {
        return data.degree;
      } else if (data.field) {
        return `Studies in ${data.field}`;
      } else if (data.institution) {
        return `Education at ${data.institution}`;
      }
      return 'Education';
    };

    onSave({
      meta: {
        ...node.meta, // Keep existing meta
        ...data, // Override with form data
        title: generateEducationTitle(),
        // Only include non-empty strings
        institution: data.institution || undefined,
        degree: data.degree || undefined,
        field: data.field || undefined,
        location: data.location || undefined,
        description: data.description || undefined,
        startDate: data.startDate || undefined,
        endDate: data.endDate || undefined,
      }
    });
  };

  return (
    <>
      {/* Header with Magic Gradient */}
      <div className="relative mb-8 p-6 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200/50">
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-emerald-500/5 via-transparent to-teal-500/5"></div>
        <div className="relative">
          <h3 className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
            Edit Education
          </h3>
          <p className="text-slate-600 mt-2">Update your education information</p>
          <div className="w-16 h-1 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full mt-3"></div>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Enhanced Form Fields */}
          <div className="grid grid-cols-1 gap-6">
            {/* Title */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold text-slate-700">Education Title</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input 
                        placeholder="Education title (auto-generated if left empty)" 
                        className="border-slate-300 focus:border-emerald-500 focus:ring-emerald-500/20 rounded-lg bg-white/50 backdrop-blur-sm transition-all duration-200"
                        {...field} 
                      />
                      <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-emerald-500/5 to-teal-500/5 pointer-events-none"></div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Institution */}
            <FormField
              control={form.control}
              name="institution"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold text-slate-700">Institution</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input 
                        placeholder="School or institution name" 
                        className="border-slate-300 focus:border-emerald-500 focus:ring-emerald-500/20 rounded-lg bg-white/50 backdrop-blur-sm transition-all duration-200"
                        {...field} 
                      />
                      <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-emerald-500/5 to-teal-500/5 pointer-events-none"></div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Degree */}
            <FormField
              control={form.control}
              name="degree"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold text-slate-700">Degree</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input 
                        placeholder="Degree or certification" 
                        className="border-slate-300 focus:border-emerald-500 focus:ring-emerald-500/20 rounded-lg bg-white/50 backdrop-blur-sm transition-all duration-200"
                        {...field} 
                      />
                      <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-emerald-500/5 to-teal-500/5 pointer-events-none"></div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Field */}
            <FormField
              control={form.control}
              name="field"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold text-slate-700">Field of Study</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input 
                        placeholder="Field of study" 
                        className="border-slate-300 focus:border-emerald-500 focus:ring-emerald-500/20 rounded-lg bg-white/50 backdrop-blur-sm transition-all duration-200"
                        {...field} 
                      />
                      <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-emerald-500/5 to-teal-500/5 pointer-events-none"></div>
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
                    <div className="relative">
                      <Input 
                        placeholder="School location" 
                        className="border-slate-300 focus:border-emerald-500 focus:ring-emerald-500/20 rounded-lg bg-white/50 backdrop-blur-sm transition-all duration-200"
                        {...field} 
                      />
                      <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-emerald-500/5 to-teal-500/5 pointer-events-none"></div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold text-slate-700">Description</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input 
                        placeholder="Education description" 
                        className="border-slate-300 focus:border-emerald-500 focus:ring-emerald-500/20 rounded-lg bg-white/50 backdrop-blur-sm transition-all duration-200"
                        {...field} 
                      />
                      <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-emerald-500/5 to-teal-500/5 pointer-events-none"></div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Date Fields */}
            <div className="grid grid-cols-2 gap-4">
              {/* Start Date */}
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-slate-700">Start Date</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type="month"
                          placeholder="YYYY-MM"
                          className="border-slate-300 focus:border-emerald-500 focus:ring-emerald-500/20 rounded-lg bg-white/50 backdrop-blur-sm transition-all duration-200"
                          {...field}
                        />
                        <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-emerald-500/5 to-teal-500/5 pointer-events-none"></div>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* End Date */}
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-slate-700">End Date</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type="month"
                          placeholder="YYYY-MM or current"
                          className="border-slate-300 focus:border-emerald-500 focus:ring-emerald-500/20 rounded-lg bg-white/50 backdrop-blur-sm transition-all duration-200"
                          {...field}
                        />
                        <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-emerald-500/5 to-teal-500/5 pointer-events-none"></div>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Enhanced Action buttons */}
          <div className="flex gap-3 mt-8 pt-6 border-t border-slate-200">
            <button
              type="submit"
              disabled={loading || !form.formState.isValid}
              className="group relative flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-medium transition-all duration-300 hover:shadow-lg hover:shadow-green-500/25 overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-green-600 to-emerald-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
              <span className="relative z-10">Save Changes</span>
            </button>
            
            <button
              type="button"
              onClick={onCancel}
              className="group relative flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-slate-100 to-slate-200 text-slate-700 font-medium transition-all duration-300 hover:shadow-lg hover:shadow-slate-500/25 overflow-hidden border border-slate-300"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-slate-200 to-slate-300 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
              <span className="relative z-10">Cancel</span>
            </button>
          </div>
        </form>
      </Form>
    </>
  );
};

export const EducationNodePanel: React.FC<EducationNodePanelProps> = ({ node }) => {
  const {
    loading,
    updateNode,
    deleteNode,
    selectNode,
  } = useHierarchyStore();

  const [mode, setMode] = useState<'view' | 'edit'>('view');

  const handleClose = () => {
    selectNode(null); // Clear selection
  };

  const handleSave = async (data: { meta: Partial<NodeMetadata> }) => {
    try {
      await updateNode(node.id, data);
      setMode('view');
    } catch (error) {
      console.error('Failed to save education node:', error);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteNode(node.id);
    } catch (error) {
      console.error('Failed to delete education node:', error);
    }
  };

  const renderContent = () => {
    if (mode === 'edit') {
      return (
        <EducationEdit
          node={node}
          onSave={handleSave}
          onCancel={() => setMode('view')}
          loading={loading}
        />
      );
    }

    return (
      <EducationView
        node={node}
        onEdit={() => setMode('edit')}
        onDelete={handleDelete}
        loading={loading}
      />
    );
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed right-0 top-0 h-full w-96 z-50 overflow-hidden"
        style={{ colorScheme: 'light' }}
      >
        {/* Magic Card Container with Border Beam */}
        <div className="relative h-full bg-gradient-to-br from-emerald-50 via-white to-teal-50 shadow-2xl border border-emerald-200">
          {/* Animated Border Beam */}
          <div className="absolute inset-0 rounded-none overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent animate-pulse"></div>
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-shimmer"></div>
          </div>
          
          <div className="relative h-full flex flex-col backdrop-blur-sm bg-white/80">
            {/* Enhanced Header with Gradient */}
            <div className="px-6 py-4 border-b border-emerald-200/50 flex items-center justify-between bg-gradient-to-r from-emerald-50/50 to-white/50 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                  <NodeIcon type="education" size={20} className="text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-bold bg-gradient-to-r from-emerald-700 to-teal-900 bg-clip-text text-transparent uppercase tracking-wider">
                    Education
                  </h2>
                  <div className="w-8 h-0.5 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full"></div>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="group relative p-2 rounded-full transition-all duration-300 hover:bg-emerald-100 hover:shadow-lg"
              >
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-emerald-400/0 via-emerald-400/10 to-emerald-400/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <X className="h-5 w-5 text-emerald-400 group-hover:text-emerald-600 relative z-10 transition-colors duration-300" />
              </button>
            </div>

            {/* Enhanced Content Area */}
            <div className="flex-1 overflow-y-auto">
              <div className="relative p-6">
                {/* Subtle background pattern */}
                <div className="absolute inset-0 opacity-5">
                  <div className="absolute inset-0" style={{
                    backgroundImage: `radial-gradient(circle at 1px 1px, rgb(16 185 129) 1px, transparent 0)`,
                    backgroundSize: '20px 20px'
                  }}></div>
                </div>
                
                <div className="relative z-10">
                  {renderContent()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};