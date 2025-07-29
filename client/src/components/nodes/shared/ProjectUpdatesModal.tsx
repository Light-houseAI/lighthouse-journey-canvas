import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { ProjectUpdate } from './nodeUtils';
import { parseFlexibleDate } from '@/utils/date-parser';

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
  const modalRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Simple scroll test logging
    const testScrolling = () => {
      if (scrollAreaRef.current) {
        console.log('📏 Scroll area dimensions:', {
          scrollHeight: scrollAreaRef.current.scrollHeight,
          clientHeight: scrollAreaRef.current.clientHeight,
          scrollTop: scrollAreaRef.current.scrollTop,
          canScroll: scrollAreaRef.current.scrollHeight > scrollAreaRef.current.clientHeight
        });
      }
    };

    // Check scroll dimensions after a short delay
    setTimeout(testScrolling, 100);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      ref={modalRef}
      className="absolute top-full left-1/2 transform -translate-x-1/2 mt-4 z-50"
      style={{ pointerEvents: 'auto' }} // Override React Flow's pointer event capture
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseMove={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
    >
      {/* Background overlay to detect outside clicks */}
      <div
        className="fixed inset-0 z-40"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      />

      <div
        className="relative bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-amber-500/30 w-[600px] h-[500px] flex flex-col z-50 nowheel"
        style={{ pointerEvents: 'auto' }} // Ensure modal content receives all pointer events
        onMouseDown={(e) => e.stopPropagation()}
        onMouseMove={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-amber-500/20 flex-shrink-0">
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

        <div
          ref={scrollAreaRef}
          className="flex-1 p-4 overflow-y-auto"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: '#6B7280 #374151',
            maxHeight: '420px',
            height: '420px', // Fixed height to ensure scroll container
            overflowY: 'scroll', // Force scrollbar to always be visible
            pointerEvents: 'auto' // Critical: Override React Flow's pointer event blocking
          }}
          onWheel={(e) => {
            // Completely remove event handling to test if that's the issue
            console.log('🖱️ Scroll in area, deltaY:', e.deltaY, 'scrollTop:', e.currentTarget.scrollTop);
          }}
        >
          {!projectUpdates || projectUpdates.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400 text-sm">No project updates available</p>
              <p className="text-gray-500 text-xs mt-1">Updates will appear here as you add them</p>

              {/* Test content for scrolling */}
              <div className="mt-8 text-left">
                <h4 className="text-white mb-4">Test Scroll Content:</h4>
                {Array.from({length: 20}, (_, i) => (
                  <p key={i} className="text-gray-300 text-sm mb-2">
                    This is test line {i + 1} to check if scrolling works properly within the modal container.
                  </p>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {projectUpdates.map((update: ProjectUpdate, index: number) => (
              <div key={index} className="border-l-4 border-amber-500 pl-4 bg-gray-800/50 rounded-r-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-amber-400 font-semibold">{update.title}</h4>
                {update.date && (
                  <span className="text-gray-400 text-xs">{parseFlexibleDate(update.date).formatted}</span>
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
          )}
        </div>

        {/* Arrow pointing to the node above */}
        <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
          <div className="w-4 h-4 bg-gray-900/95 border-l border-t border-amber-500/30 rotate-45"></div>
        </div>
      </div>
    </div>
  );
};

export default ProjectUpdatesModal;
