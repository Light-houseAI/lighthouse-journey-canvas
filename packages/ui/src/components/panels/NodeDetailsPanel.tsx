import { AnimatePresence,motion } from 'framer-motion';
import { X } from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import { formatDateRange } from '@/utils/date-parser';

interface NodeDetailsPanelProps {
  isOpen: boolean;
  nodeData: any;
  onClose: () => void;
}

export const NodeDetailsPanel: React.FC<NodeDetailsPanelProps> = ({
  isOpen,
  nodeData,
  onClose,
}) => {
  if (!nodeData) return null;

  const getNodeTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      job: 'Job',
      education: 'Education',
      project: 'Project',
      event: 'Event',
      action: 'Achievement',
      careerTransition: 'Career Transition',
    };
    return labels[type] || type;
  };

  const renderNodeDetails = () => {
    switch (nodeData.type) {
      case 'job':
        return (
          <>
            <div className="mb-6">
              <h3 className="text-2xl font-bold text-gray-900">{nodeData.title}</h3>
              <p className="text-lg text-gray-600">{nodeData.company}</p>
              {nodeData.location && (
                <p className="text-sm text-gray-500 mt-1">{nodeData.location}</p>
              )}
            </div>
            
            <div className="mb-4">
              <span className="text-sm font-medium text-gray-500">Duration</span>
              <p className="text-gray-900 mt-1">
                {formatDateRange(nodeData.start, nodeData.end, nodeData.isOngoing)}
              </p>
            </div>

            {nodeData.description && (
              <div className="mb-4">
                <span className="text-sm font-medium text-gray-500">Description</span>
                <p className="text-gray-900 mt-1 whitespace-pre-wrap">{nodeData.description}</p>
              </div>
            )}

            {nodeData.projects && nodeData.projects.length > 0 && (
              <div className="mb-4">
                <span className="text-sm font-medium text-gray-500">Related Projects</span>
                <ul className="mt-2 space-y-2">
                  {nodeData.projects.map((project: any, index: number) => (
                    <li key={index} className="bg-gray-50 p-3 rounded-lg">
                      <p className="font-medium text-gray-900">{project.title}</p>
                      {project.description && (
                        <p className="text-sm text-gray-600 mt-1">{project.description}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        );

      case 'education':
        return (
          <>
            <div className="mb-6">
              <h3 className="text-2xl font-bold text-gray-900">{nodeData.degree}</h3>
              <p className="text-lg text-gray-600">{nodeData.field}</p>
              <p className="text-gray-600">{nodeData.school}</p>
            </div>
            
            <div className="mb-4">
              <span className="text-sm font-medium text-gray-500">Duration</span>
              <p className="text-gray-900 mt-1">
                {formatDateRange(nodeData.start, nodeData.end, nodeData.isOngoing)}
              </p>
            </div>

            {nodeData.description && (
              <div className="mb-4">
                <span className="text-sm font-medium text-gray-500">Description</span>
                <p className="text-gray-900 mt-1 whitespace-pre-wrap">{nodeData.description}</p>
              </div>
            )}
          </>
        );

      case 'project':
        return (
          <>
            <div className="mb-6">
              <h3 className="text-2xl font-bold text-gray-900">{nodeData.title}</h3>
              {nodeData.technologies && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {nodeData.technologies.split(',').map((tech: string, index: number) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full"
                    >
                      {tech.trim()}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {nodeData.start && (
              <div className="mb-4">
                <span className="text-sm font-medium text-gray-500">Duration</span>
                <p className="text-gray-900 mt-1">
                  {formatDateRange(nodeData.start, nodeData.end)}
                </p>
              </div>
            )}

            {nodeData.description && (
              <div className="mb-4">
                <span className="text-sm font-medium text-gray-500">Description</span>
                <p className="text-gray-900 mt-1 whitespace-pre-wrap">{nodeData.description}</p>
              </div>
            )}
          </>
        );

      case 'event':
        return (
          <>
            <div className="mb-6">
              <h3 className="text-2xl font-bold text-gray-900">{nodeData.title}</h3>
              {nodeData.eventType && (
                <span className="inline-block mt-2 px-3 py-1 bg-indigo-100 text-indigo-700 text-sm rounded-full capitalize">
                  {nodeData.eventType}
                </span>
              )}
            </div>

            <div className="mb-4">
              <span className="text-sm font-medium text-gray-500">Date</span>
              <p className="text-gray-900 mt-1">
                {formatDateRange(nodeData.start, nodeData.end)}
              </p>
            </div>

            {nodeData.location && (
              <div className="mb-4">
                <span className="text-sm font-medium text-gray-500">Location</span>
                <p className="text-gray-900 mt-1">{nodeData.location}</p>
              </div>
            )}

            {nodeData.organizer && (
              <div className="mb-4">
                <span className="text-sm font-medium text-gray-500">Organizer</span>
                <p className="text-gray-900 mt-1">{nodeData.organizer}</p>
              </div>
            )}

            {nodeData.description && (
              <div className="mb-4">
                <span className="text-sm font-medium text-gray-500">Description</span>
                <p className="text-gray-900 mt-1 whitespace-pre-wrap">{nodeData.description}</p>
              </div>
            )}
          </>
        );

      case 'action':
        return (
          <>
            <div className="mb-6">
              <h3 className="text-2xl font-bold text-gray-900">{nodeData.title}</h3>
              {nodeData.category && (
                <span className="inline-block mt-2 px-3 py-1 bg-amber-100 text-amber-700 text-sm rounded-full capitalize">
                  {nodeData.category}
                </span>
              )}
            </div>

            <div className="mb-4">
              <span className="text-sm font-medium text-gray-500">Date</span>
              <p className="text-gray-900 mt-1">
                {formatDateRange(nodeData.start, nodeData.end)}
              </p>
            </div>

            {nodeData.description && (
              <div className="mb-4">
                <span className="text-sm font-medium text-gray-500">Description</span>
                <p className="text-gray-900 mt-1 whitespace-pre-wrap">{nodeData.description}</p>
              </div>
            )}

            {nodeData.impact && (
              <div className="mb-4">
                <span className="text-sm font-medium text-gray-500">Impact</span>
                <p className="text-gray-900 mt-1">{nodeData.impact}</p>
              </div>
            )}

            {nodeData.verification && (
              <div className="mb-4">
                <span className="text-sm font-medium text-gray-500">Verification</span>
                <p className="text-gray-900 mt-1">{nodeData.verification}</p>
              </div>
            )}
          </>
        );

      case 'careerTransition':
        return (
          <>
            <div className="mb-6">
              <h3 className="text-2xl font-bold text-gray-900">{nodeData.title}</h3>
              {nodeData.transitionType && (
                <span className="inline-block mt-2 px-3 py-1 bg-orange-100 text-orange-700 text-sm rounded-full capitalize">
                  {nodeData.transitionType.replace('_', ' ')}
                </span>
              )}
            </div>

            <div className="mb-4">
              <span className="text-sm font-medium text-gray-500">Duration</span>
              <p className="text-gray-900 mt-1">
                {formatDateRange(nodeData.start, nodeData.end, nodeData.isOngoing)}
              </p>
            </div>

            {(nodeData.fromRole || nodeData.toRole) && (
              <div className="mb-4">
                <span className="text-sm font-medium text-gray-500">Transition</span>
                <div className="mt-1">
                  {nodeData.fromRole && (
                    <p className="text-gray-900">From: {nodeData.fromRole}</p>
                  )}
                  {nodeData.toRole && (
                    <p className="text-gray-900">To: {nodeData.toRole}</p>
                  )}
                </div>
              </div>
            )}

            {nodeData.reason && (
              <div className="mb-4">
                <span className="text-sm font-medium text-gray-500">Reason</span>
                <p className="text-gray-900 mt-1">{nodeData.reason}</p>
              </div>
            )}

            {nodeData.outcome && (
              <div className="mb-4">
                <span className="text-sm font-medium text-gray-500">Outcome</span>
                <p className="text-gray-900 mt-1">{nodeData.outcome}</p>
              </div>
            )}

            {nodeData.description && (
              <div className="mb-4">
                <span className="text-sm font-medium text-gray-500">Description</span>
                <p className="text-gray-900 mt-1 whitespace-pre-wrap">{nodeData.description}</p>
              </div>
            )}
          </>
        );

      default:
        return (
          <div className="mb-6">
            <h3 className="text-2xl font-bold text-gray-900">{nodeData.title || ''}</h3>
            <pre className="mt-4 text-sm text-gray-600 whitespace-pre-wrap">
              {JSON.stringify(nodeData, null, 2)}
            </pre>
          </div>
        );
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="fixed right-0 top-0 h-full w-96 bg-white shadow-2xl z-50 overflow-hidden"
        >
          <div className="h-full flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {getNodeTypeLabel(nodeData.type)}
                </span>
              </div>
              <Button
                onClick={onClose}
                variant="ghost"
                size="sm"
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {renderNodeDetails()}
            </div>

            {/* Actions */}
            <div className="px-6 py-4 border-t border-gray-200">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    // TODO: Implement edit functionality
                    console.log('Edit node:', nodeData);
                  }}
                >
                  Edit
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => {
                    // TODO: Implement delete functionality
                    console.log('Delete node:', nodeData);
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};