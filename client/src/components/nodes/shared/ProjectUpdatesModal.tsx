import React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { ProjectUpdate, formatDate } from './nodeUtils';

interface ProjectUpdatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectUpdates: ProjectUpdate[];
}

const ProjectUpdatesModal: React.FC<ProjectUpdatesModalProps> = ({ 
  isOpen, 
  onClose, 
  projectUpdates 
}) => {
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: -20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: -20 }}
      className="absolute top-full left-1/2 transform -translate-x-1/2 mt-4 z-50"
    >
      <div className="bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-amber-500/30 min-w-[400px] max-w-[600px] max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-6 pb-4 flex-shrink-0">
          <h3 className="text-white font-bold text-lg">Project Updates</h3>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-6 pb-6 overflow-y-auto flex-1">
          <div className="space-y-4">
            {projectUpdates.map((update: ProjectUpdate, index: number) => (
              <div key={index} className="border-l-4 border-amber-500 pl-4 bg-gray-800/50 rounded-r-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-amber-400 font-semibold">{update.title}</h4>
                {update.date && (
                  <span className="text-gray-400 text-xs">{formatDate(update.date)}</span>
                )}
              </div>
              {/* Work (Required) - using description field */}
              <div className="mb-3">
                <span className="text-amber-400 text-xs font-medium">Work: </span>
                <p className="text-gray-300 text-sm leading-relaxed mt-1">
                  {update.description}
                </p>
              </div>

              {/* WDRL Framework Fields */}
              {update.decisions && (
                <div className="mb-2 bg-gray-700/30 rounded-lg p-2">
                  <span className="text-cyan-400 text-xs font-medium">Decision: </span>
                  <p className="text-gray-300 text-xs leading-relaxed mt-1">{update.decisions}</p>
                </div>
              )}

              {update.results && (
                <div className="mb-2 bg-gray-700/30 rounded-lg p-2">
                  <span className="text-green-400 text-xs font-medium">Result: </span>
                  <p className="text-gray-300 text-xs leading-relaxed mt-1">{update.results}</p>
                </div>
              )}

              {update.learnings && (
                <div className="mb-2 bg-gray-700/30 rounded-lg p-2">
                  <span className="text-purple-400 text-xs font-medium">Learning: </span>
                  <p className="text-gray-300 text-xs leading-relaxed mt-1">{update.learnings}</p>
                </div>
              )}
              
              {/* Additional Fields */}
              {update.skills && update.skills.length > 0 && (
                <div className="mb-2">
                  <span className="text-blue-400 text-xs font-medium">Skills: </span>
                  <span className="text-gray-300 text-xs">{update.skills.join(', ')}</span>
                </div>
              )}
              
              {update.achievements && (
                <div className="mb-2">
                  <span className="text-emerald-400 text-xs font-medium">Achievements: </span>
                  <span className="text-gray-300 text-xs">{update.achievements}</span>
                </div>
              )}
              
              {update.challenges && (
                <div className="mb-2">
                  <span className="text-red-400 text-xs font-medium">Challenges: </span>
                  <span className="text-gray-300 text-xs">{update.challenges}</span>
                </div>
              )}
              
              {update.impact && (
                <div>
                  <span className="text-indigo-400 text-xs font-medium">Impact: </span>
                  <span className="text-gray-300 text-xs">{update.impact}</span>
                </div>
              )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Arrow pointing to the node */}
      <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
        <div className="w-4 h-4 bg-gray-900/95 border-l border-t border-amber-500/30 rotate-45"></div>
      </div>
    </motion.div>
  );
};

export default ProjectUpdatesModal;