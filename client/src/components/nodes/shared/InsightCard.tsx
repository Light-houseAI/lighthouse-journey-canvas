'use client';

import { NodeInsight } from '@shared/schema';
import { AnimatePresence,motion } from 'framer-motion';
import { Edit2, ExternalLink, MoreHorizontal, Trash2 } from 'lucide-react';
import React, { useState } from 'react';

import { BlurFade } from '@/components/magicui/blur-fade';
import { InteractiveHoverButton } from '@/components/magicui/interactive-hover-button';
import { MagicCard } from '@/components/magicui/magic-card';
import { useTimelineStore } from '../../../hooks/useTimelineStore';
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
  DropdownMenuTrigger
} from '../../ui/dropdown-menu';
import { InsightForm } from './InsightForm';

interface InsightCardProps {
  insight: NodeInsight;
  nodeId: string;
  delay?: number;
}

export const InsightCard: React.FC<InsightCardProps> = ({
  insight,
  nodeId,
  delay = 0
}) => {
  const { deleteInsight, getNodeById } = useTimelineStore();
  const [expanded, setExpanded] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Get node permissions to check if user can edit
  const node = getNodeById(nodeId);
  const canEdit = node?.permissions?.canEdit === true;

  const handleDelete = async () => {
    if (!deleteInsight || !canEdit) {
      console.warn('Cannot delete insight: insufficient permissions');
      return;
    }

    setIsDeleting(true);
    try {
      await deleteInsight(insight.id, nodeId);
    } catch (error) {
      console.error('Failed to delete insight:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const shouldTruncate = insight.description.length > 120;
  const displayText = expanded || !shouldTruncate
    ? insight.description
    : `${insight.description.substring(0, 120)}...`;

  return (
    <BlurFade delay={delay / 1000} inView>
      <MagicCard className="p-6 hover:shadow-lg transition-all duration-300">
        <div className="flex items-start gap-4">
          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div>
                <h5 className="font-semibold text-gray-900 mb-1">
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
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setShowEditForm(true)}>
                      <Edit2 className="w-4 h-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <DropdownMenuItem
                          className="text-red-600 focus:text-red-600"
                          onSelect={(e) => e.preventDefault()}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Insight</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete this insight? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            {isDeleting ? 'Deleting...' : 'Delete'}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {/* Description */}
            <p className="text-gray-700 mb-4 leading-relaxed">
              {displayText}
            </p>

            {/* Expand/Collapse Button */}
            {!expanded && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(true)}
                className="text-gray-500 text-sm h-auto p-0"
              >
                Show more
              </Button>
            )}

            {/* Resources Section - Only show when expanded */}
            <AnimatePresence>
              {expanded && insight.resources.length > 0 && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="mb-4"
                >
                  <h6 className="font-medium text-gray-900 mb-2 text-sm">
                    Resources
                  </h6>
                  <div className="space-y-2">
                    {insight.resources.map((resource, index) => {
                      const isUrl = resource.startsWith('http://') || resource.startsWith('https://');

                      return isUrl ? (
                        <a
                          key={index}
                          href={resource}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors text-sm"
                        >
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{resource}</span>
                        </a>
                      ) : (
                        <div key={index} className="flex items-center gap-2 text-gray-700 text-sm">
                          <div className="w-3 h-3 bg-gray-400 rounded-full flex-shrink-0" />
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
                className="text-gray-500 text-sm h-auto p-0"
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
