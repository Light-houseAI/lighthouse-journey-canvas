'use client';

import React, { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { z } from 'zod';
import { NodeInsight } from '@shared/schema';
import { insightCreateSchema, insightUpdateSchema } from '@shared/types';
import { useTimelineStore } from '../../../hooks/useTimelineStore';
import { AnimatedSubscribeButton } from '../../../../../components/magicui/animated-subscribe-button';
import { RippleButton } from '../../../../../components/magicui/ripple-button';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';

interface InsightFormProps {
  nodeId: string;
  insight?: NodeInsight;
  onClose: () => void;
  onSuccess: () => void;
}

export const InsightForm: React.FC<InsightFormProps> = ({
  nodeId,
  insight,
  onClose,
  onSuccess
}) => {
  const { createInsight, updateInsight } = useTimelineStore();
  const isEditing = Boolean(insight);

  const [formData, setFormData] = useState({
    description: insight?.description || '',
    resources: insight?.resources || []
  });

  const [newResourceUrl, setNewResourceUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const addResource = () => {
    const resourceText = newResourceUrl.trim();
    if (!resourceText) return;
    
    setFormData(prev => ({
      ...prev,
      resources: [...prev.resources, resourceText]
    }));
    setNewResourceUrl('');
    setErrors({ ...errors, newResource: '' });
  };

  const removeResource = (index: number) => {
    setFormData(prev => ({
      ...prev,
      resources: prev.resources.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    try {
      // Validate form data
      const schema = isEditing ? insightUpdateSchema : insightCreateSchema;
      const validatedData = schema.parse(formData);

      if (isEditing && insight) {
        await updateInsight(insight.id, nodeId, validatedData);
      } else {
        await createInsight(nodeId, validatedData);
      }

      setSubmitted(true);
      
      // Show success state briefly before closing
      setTimeout(() => {
        onSuccess();
      }, 1500);

    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach(err => {
          if (err.path.length > 0) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
      } else {
        console.error(`Failed to ${isEditing ? 'update' : 'create'} insight:`, error);
        setErrors({ 
          general: `Failed to ${isEditing ? 'update' : 'create'} insight. Please try again.` 
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Insight' : 'Add New Insight'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* General Error */}
          {errors.general && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {errors.general}
            </div>
          )}

          {/* Description Field */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium">
              Share your insight *
            </Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                description: e.target.value 
              }))}
              placeholder="What did you learn from this experience? Share your key takeaways, lessons learned, or insights that could help others..."
              rows={6}
              className={`resize-none ${errors.description ? 'border-red-500' : ''}`}
              disabled={isSubmitting}
            />
            {errors.description && (
              <p className="text-sm text-red-600">{errors.description}</p>
            )}
            <p className="text-xs text-gray-500">
              {formData.description.length}/2000 characters
            </p>
          </div>

          {/* Resources Section */}
          <div className="space-y-4">
            <Label className="text-sm font-medium">Resources (Optional)</Label>
            
            {/* Existing Resources */}
            <AnimatePresence>
              {formData.resources.map((url, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 truncate">{url}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeResource(index)}
                    className="text-red-500 hover:text-red-700 h-8 w-8 p-0"
                    disabled={isSubmitting}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Add New Resource */}
            {formData.resources.length < 10 && (
              <div className="space-y-3 p-4 border border-dashed border-gray-300 rounded-lg">
                <div className="flex gap-2">
                  <Input
                    value={newResourceUrl}
                    onChange={(e) => setNewResourceUrl(e.target.value)}
                    placeholder="URL, book reference, note, etc."
                    className="flex-1"
                    disabled={isSubmitting}
                  />
                  <RippleButton
                    type="button"
                    onClick={addResource}
                    disabled={!newResourceUrl.trim() || isSubmitting}
                  >
                    <Plus className="w-4 h-4" />
                  </RippleButton>
                </div>
                {errors.newResource && (
                  <p className="text-sm text-red-600">{errors.newResource}</p>
                )}
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            
            <AnimatedSubscribeButton
              subscribeStatus={submitted}
              disabled={isSubmitting || !formData.description.trim()}
              className="min-w-[120px]"
            >
              <span>
                {isSubmitting 
                  ? (isEditing ? 'Updating...' : 'Saving...') 
                  : (isEditing ? 'Update' : 'Save Insight')
                }
              </span>
              <span>✓ {isEditing ? 'Updated!' : 'Saved!'}</span>
            </AnimatedSubscribeButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};