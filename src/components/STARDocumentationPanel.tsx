import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface STARDocumentationPanelProps {
  isVisible: boolean;
}

const STARDocumentationPanel: React.FC<STARDocumentationPanelProps> = ({ isVisible }) => {
  const starCards = [
    {
      id: 'situation',
      title: 'Situation',
      description: 'Describe the context of the situation. This could be a project, a challenge you faced, or an experience you had.'
    },
    {
      id: 'task',
      title: 'Task',
      description: 'Explain your specific responsibility or what you were tasked with accomplishing in that situation.'
    },
    {
      id: 'action',
      title: 'Action',
      description: 'Detail the actions you took to address the task or situation. Focus on your individual contributions, not just the team\'s efforts.'
    },
    {
      id: 'result',
      title: 'Result',
      description: 'Describe the outcome. What happened? What did you learn? What impact did it have?'
    }
  ];

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="w-1/2 bg-muted/10 border-l border-border/50 flex flex-col min-h-0 overflow-hidden"
        >
          {/* STAR Panel Header - Fixed */}
          <div className="flex-shrink-0 p-6 border-b border-border/30 bg-background/20 backdrop-blur-sm">
            <h2 className="text-lg font-semibold text-foreground mb-2">
              STAR Method Framework
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Use this framework to structure your behavioral interview response
            </p>
          </div>
          
          {/* STAR Panel Content - Scrollable */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="p-6 space-y-4">
              {starCards.map((card, index) => (
                <motion.div
                  key={card.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="border border-border/20 bg-background/60 backdrop-blur-sm rounded-lg p-4 transition-all duration-200 hover:bg-background/80 hover:border-border/30"
                >
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">
                        {card.title.charAt(0)}
                      </div>
                      <span className="font-semibold text-foreground">{card.title}</span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {card.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default STARDocumentationPanel;