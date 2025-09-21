'use client';

import { NodeInsight } from '@journey/schema';
import { AnimatePresence, motion } from 'framer-motion';
import { Edit2, ExternalLink, MoreHorizontal, Trash2 } from 'lucide-react';
import React, { useState } from 'react';

import { BlurFade } from '@/components/magicui/blur-fade';
import { MagicCard } from '@/components/magicui/magic-card';
import { useDeleteInsight } from '../../../hooks/useNodeInsights';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../../ui/alert-dialog';
import { Button } from '../../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu';
import { InsightForm } from './InsightForm';

interface InsightCardProps {
  insight: NodeInsight;
  nodeId: string;
  delay?: number;
  canEdit?: boolean;
}

export const InsightCard: React.FC<InsightCardProps> = ({
  insight,
  nodeId,
  delay = 0,
  canEdit = false,
}) => {
  const deleteMutation = useDeleteInsight(nodeId);
  const [expanded, setExpanded] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);

  const handleDelete = async () => {
    if (!canEdit) {
      console.warn('Cannot delete insight: insufficient permissions');
      return;
    }

    try {
      await deleteMutation.mutateAsync(insight.id);
    } catch (error) {
      console.error('Failed to delete insight:', error);
    }
  };

  const shouldTruncate = insight.description.length > 120;
  const displayText =
    expanded || !shouldTruncate
      ? insight.description
      : `${insight.description.substring(0, 120)}...`;

  return (
    <BlurFade delay={delay / 1000} inView>
      <MagicCard className="p-6" gradientOpacity={0}>
        <div className="flex items-start gap-4">
          {/* Content */}
          <div className="min-w-0 flex-1">
            {/* Header */}
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h5 className="mb-1 font-semibold text-gray-900">
                  Key Lessons from This Experience
                </h5>
                <p className="text-sm text-gray-500">
                  {(insight as any).timeAgo || 'recently'}
                </p>
              </div>

              {canEdit && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setShowEditForm(true)}>
                      <Edit2 className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <DropdownMenuItem
                          className="text-red-600 focus:text-red-600"
                          onSelect={(e) => e.preventDefault()}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Insight</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete this insight? This
                            action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleDelete}
                            disabled={deleteMutation.isPending}
                            className="bg-red-600"
                          >
                            {deleteMutation.isPending
                              ? 'Deleting...'
                              : 'Delete'}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {/* Description */}
            <p className="mb-4 leading-relaxed text-gray-700">{displayText}</p>

            {/* Expand/Collapse Button */}
            {!expanded && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(true)}
                className="h-auto p-0 text-sm text-gray-500"
              >
                Show more
              </Button>
            )}

            {/* Resources Section - Only show when expanded */}
            <AnimatePresence>
              {expanded && insight.resources.length > 0 && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="mb-4"
                >
                  <h6 className="mb-2 text-sm font-medium text-gray-900">
                    Resources
                  </h6>
                  <div className="space-y-2">
                    {insight.resources.map((resource, index) => {
                      const isUrl =
                        resource.startsWith('http://') ||
                        resource.startsWith('https://');

                      return isUrl ? (
                        <a
                          key={index}
                          href={resource}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-blue-600 transition-colors"
                        >
                          <ExternalLink className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{resource}</span>
                        </a>
                      ) : (
                        <div
                          key={index}
                          className="flex items-center gap-2 text-sm text-gray-700"
                        >
                          <div className="h-3 w-3 flex-shrink-0 rounded-full bg-gray-400" />
                          <span>{resource}</span>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Show Less Button */}
            {expanded && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(false)}
                className="h-auto p-0 text-sm text-gray-500"
              >
                Show less
              </Button>
            )}
          </div>
        </div>

        {/* Edit Form Modal */}
        {showEditForm && canEdit && (
          <InsightForm
            nodeId={nodeId}
            insight={insight}
            onClose={() => setShowEditForm(false)}
            onSuccess={() => setShowEditForm(false)}
          />
        )}
      </MagicCard>
    </BlurFade>
  );
};
