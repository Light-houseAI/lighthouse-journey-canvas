import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus } from 'lucide-react';
import AddExperienceModal from './AddExperienceModal';

interface Milestone {
  id: string;
  title: string;
  type: 'education' | 'jobs' | 'projects' | 'jobsearch' | 'interviews' | 'events';
  date: string;
  description: string;
  skills: string[];
  organization?: string;
  tags?: string[];
}

interface FloatingAddButtonProps {
  onCategorySelect: (categoryId: string) => void;
}

const FloatingAddButton: React.FC<FloatingAddButtonProps> = ({ onCategorySelect }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleCategorySelect = (categoryId: string) => {
    setIsModalOpen(false);
    onCategorySelect(categoryId);
  };

  return (
    <>
      <div className="fixed bottom-4 right-4 z-50">
        <motion.button
          onClick={() => setIsModalOpen(true)}
          className="w-14 h-14 bg-gradient-to-r from-primary/80 to-accent/80 text-white rounded-full backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center group"
          whileHover={{ 
            scale: 1.1, 
            boxShadow: "0 0 30px hsl(var(--primary) / 0.4)" 
          }}
          whileTap={{ scale: 0.95 }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ 
            type: "spring", 
            stiffness: 260, 
            damping: 20,
            delay: 0.2 
          }}
        >
          <motion.div
            animate={{ 
              rotate: 0,
            }}
            whileHover={{ 
              rotate: 90,
            }}
            transition={{ duration: 0.2 }}
          >
            <Plus className="w-6 h-6" strokeWidth={2.5} />
          </motion.div>
          
          {/* Subtle pulse ring effect */}
          <motion.div
            className="absolute inset-0 rounded-full bg-gradient-to-r from-primary/20 to-accent/20"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.5, 0, 0.5],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </motion.button>
      </div>

      <AddExperienceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCategorySelect={handleCategorySelect}
      />
    </>
  );
};

export default FloatingAddButton;