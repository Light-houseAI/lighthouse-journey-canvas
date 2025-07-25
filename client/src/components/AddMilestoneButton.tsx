import React from 'react';
import { motion } from 'framer-motion';
import { FaPlus } from 'react-icons/fa';

interface AddMilestoneButtonProps {
  onAdd: () => void;
  isSubMilestone?: boolean;
  position: { x: number; y: number };
}

const AddMilestoneButton: React.FC<AddMilestoneButtonProps> = ({ 
  onAdd, 
  isSubMilestone = false, 
  position 
}) => {
  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      onClick={onAdd}
      className={`absolute z-10 rounded-full flex items-center justify-center text-white border-2 transition-all duration-200 ${
        isSubMilestone 
          ? 'w-6 h-6 bg-purple-500/80 hover:bg-purple-600/90 border-purple-400/50' 
          : 'w-8 h-8 bg-blue-500/80 hover:bg-blue-600/90 border-blue-400/50'
      }`}
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      <FaPlus className={isSubMilestone ? "w-2 h-2" : "w-3 h-3"} />
    </motion.button>
  );
};

export default AddMilestoneButton;