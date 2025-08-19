import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './ui/button';
import { ArrowRight } from 'lucide-react';

interface UpdateDialogProps {
  isVisible: boolean;
  onDismiss: () => void;
  onMoveToNext: () => void;
  onChat: () => void;
  nodePosition: { x: number; y: number };
  nodeTitle?: string;
}

const UpdateDialog: React.FC<UpdateDialogProps> = ({
  isVisible,
  onDismiss,
  onMoveToNext,
  onChat,
  nodePosition,
  nodeTitle
}) => {
  const bounceAnimation = {
    initial: { 
      opacity: 0, 
      scale: 0.8, 
      y: -20 
    },
    animate: { 
      opacity: 1, 
      scale: 1, 
      y: [0, -8, 0, -4, 0, -2, 0],
      transition: {
        opacity: { duration: 0.3 },
        scale: { duration: 0.3 },
        y: {
          duration: 1.2,
          times: [0, 0.2, 0.4, 0.6, 0.8, 0.9, 1]
        }
      }
    },
    exit: { 
      opacity: 0, 
      scale: 0.8, 
      y: -10,
      transition: { duration: 0.2 }
    }
  };

  // Customize question based on node type
  const getQuestionText = () => {
    if (nodeTitle === 'Job search') {
      return 'Any new interview or progression updates?';
    }
    if (nodeTitle === 'Interview loop') {
      return 'Do you need help preparing for your next interview?';
    }
    return 'Any new updates to chat about?';
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="relative z-20 pointer-events-auto"
          style={{ transform: 'translateX(120px)' }}
          variants={bounceAnimation}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          {/* Speech bubble pointer pointing left */}
          <div className="flex justify-start mb-1 ml-4">
            <div className="w-0 h-0 border-t-[8px] border-b-[8px] border-r-[8px] border-t-transparent border-b-transparent border-r-background"></div>
          </div>
          
          {/* Dialog content */}
          <div className="glass rounded-2xl px-6 py-4 min-w-[280px] shadow-lg">
            <h3 className="text-sm font-medium text-foreground mb-4 text-center">
              {getQuestionText()}
            </h3>
            
            <div className="flex gap-3 justify-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={onMoveToNext}
                className="text-muted-foreground hover:text-foreground"
              >
                No, dismiss
              </Button>
              
              <Button
                size="sm"
                onClick={onChat}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Yes, let's chat
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default UpdateDialog;