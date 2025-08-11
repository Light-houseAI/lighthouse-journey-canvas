import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { NodeIcon } from '../../icons/NodeIcons';
import { HierarchyNode, NodeMetadata } from '../../../services/hierarchy-api';
import { useHierarchyStore } from '../../../stores/hierarchy-store';
import { eventFormSchema, EventFormData } from './schema';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../../ui/alert-dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../ui/form';
import { formatDateRange } from '../../../utils/date-parser';

interface EventNodePanelProps {
  node: HierarchyNode;
}

interface EventViewProps {
  node: HierarchyNode;
  onEdit: () => void;
  onDelete: () => void;
  loading: boolean;
}

const EventView: React.FC<EventViewProps> = ({ node, onEdit, onDelete, loading }) => {
  const getEventTitle = () => {
    // Generate title from event title or meta
    return node.meta.title || 'Event';
  };

  return (
    <>
      {/* Event Title */}
      <div className="mb-6">
        <h3 className="text-2xl font-bold text-gray-900">{getEventTitle()}</h3>
        {node.meta.eventType && (
          <span className="inline-block mt-2 px-3 py-1 bg-indigo-100 text-indigo-700 text-sm rounded-full capitalize">
            {node.meta.eventType}
          </span>
        )}
      </div>

      {/* Date */}
      {(node.meta.startDate || node.meta.endDate) && (
        <div className="mb-4">
          <span className="text-sm font-medium text-gray-500">Date</span>
          <p className="text-gray-900 mt-1">
            {formatDateRange(node.meta.startDate, node.meta.endDate)}
          </p>
        </div>
      )}

      {/* Location */}
      {node.meta.location && (
        <div className="mb-4">
          <span className="text-sm font-medium text-gray-500">Location</span>
          <p className="text-gray-900 mt-1">{node.meta.location}</p>
        </div>
      )}

      {/* Organizer */}
      {node.meta.organizer && (
        <div className="mb-4">
          <span className="text-sm font-medium text-gray-500">Organizer</span>
          <p className="text-gray-900 mt-1">{node.meta.organizer}</p>
        </div>
      )}

      {/* Description */}
      {node.meta.description && (
        <div className="mb-4">
          <span className="text-sm font-medium text-gray-500">Description</span>
          <p className="text-gray-900 mt-1 whitespace-pre-wrap">{node.meta.description}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 mt-6">
        <Button
          variant="outline"
          className="flex-1"
          onClick={onEdit}
        >
          Edit
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
              disabled={loading}
            >
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Event</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{getEventTitle()}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete} className="bg-red-500 hover:bg-red-600">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );
};

interface EventEditProps {
  node: HierarchyNode;
  onSave: (data: { meta: Partial<NodeMetadata> }) => void;
  onCancel: () => void;
  loading: boolean;
}

const EventEdit: React.FC<EventEditProps> = ({ node, onSave, onCancel, loading }) => {
  const form = useForm<EventFormData>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      title: node.meta.title || '',
      description: node.meta.description || '',
      startDate: node.meta.startDate || '',
      endDate: node.meta.endDate || '',
    },
  });

  const onSubmit = (data: EventFormData) => {
    onSave({
      meta: {
        ...node.meta, // Keep existing meta
        ...data, // Override with form data
        // Only include non-empty strings
        title: data.title || undefined,
        description: data.description || undefined,
        startDate: data.startDate || undefined,
        endDate: data.endDate || undefined,
      }
    });
  };

  return (
    <>
      <div className="mb-6">
        <h3 className="text-2xl font-bold text-gray-900">Edit Event</h3>
        <p className="text-lg text-gray-600">Update the event information</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Title */}
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Event Title</FormLabel>
                <FormControl>
                  <Input placeholder="Event title" {...field} />
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
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Event description"
                    rows={3}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Start Date */}
          <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Start Date</FormLabel>
                <FormControl>
                  <Input
                    type="month"
                    placeholder="YYYY-MM"
                    {...field}
                  />
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
                <FormLabel>End Date</FormLabel>
                <FormControl>
                  <Input
                    type="month"
                    placeholder="YYYY-MM or leave empty for current"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Action buttons */}
          <div className="flex gap-2 mt-6">
            <Button
              type="submit"
              variant="outline"
              className="flex-1"
              disabled={loading || !form.formState.isValid}
            >
              Save
            </Button>
            <Button
              type="button"
              onClick={onCancel}
              variant="outline"
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </form>
      </Form>
    </>
  );
};

export const EventNodePanel: React.FC<EventNodePanelProps> = ({ node }) => {
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
      console.error('Failed to save event node:', error);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteNode(node.id);
    } catch (error) {
      console.error('Failed to delete event node:', error);
    }
  };

  const renderContent = () => {
    if (mode === 'edit') {
      return (
        <EventEdit
          node={node}
          onSave={handleSave}
          onCancel={() => setMode('view')}
          loading={loading}
        />
      );
    }

    return (
      <EventView
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
        className="fixed right-0 top-0 h-full w-96 bg-white shadow-2xl z-50 overflow-hidden text-gray-900"
        style={{ colorScheme: 'light' }}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <NodeIcon type="event" size={20} className="text-white" />
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Event
              </span>
            </div>
            <Button
              onClick={handleClose}
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {renderContent()}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};