import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import React from 'react';

interface STARDetails {
  situation: string;
  task: string;
  action: string;
  result: string;
}

interface STARModalProps {
  isOpen: boolean;
  onClose: () => void;
  starDetails: STARDetails;
}

const STARModal: React.FC<STARModalProps> = ({ isOpen, onClose, starDetails }) => {
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: -20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: -20 }}
      className="absolute top-full left-1/2 transform -translate-x-1/2 mt-4 z-50"
    >
      <div className="bg-gray-900/95 backdrop-blur-xl rounded-2xl p-6 shadow-2xl border border-purple-500/30 min-w-[400px] max-w-[500px]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-bold text-lg">STAR Story Details</h3>
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

        <div className="space-y-4">
          <div className="border-l-4 border-blue-500 pl-4">
            <h4 className="text-blue-400 font-semibold mb-1">Situation</h4>
            <p className="text-gray-300 text-sm leading-relaxed">
              {starDetails.situation}
            </p>
          </div>

          <div className="border-l-4 border-green-500 pl-4">
            <h4 className="text-green-400 font-semibold mb-1">Task</h4>
            <p className="text-gray-300 text-sm leading-relaxed">
              {starDetails.task}
            </p>
          </div>

          <div className="border-l-4 border-amber-500 pl-4">
            <h4 className="text-amber-400 font-semibold mb-1">Action</h4>
            <p className="text-gray-300 text-sm leading-relaxed">
              {starDetails.action}
            </p>
          </div>

          <div className="border-l-4 border-purple-500 pl-4">
            <h4 className="text-purple-400 font-semibold mb-1">Result</h4>
            <p className="text-gray-300 text-sm leading-relaxed">
              {starDetails.result}
            </p>
          </div>
        </div>
      </div>

      {/* Arrow pointing to the node */}
      <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
        <div className="w-4 h-4 bg-gray-900/95 border-l border-t border-purple-500/30 rotate-45"></div>
      </div>
    </motion.div>
  );
};

export default STARModal;