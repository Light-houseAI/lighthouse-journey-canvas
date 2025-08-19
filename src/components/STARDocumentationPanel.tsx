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
          className="w-1/2 bg-muted/30 border-l border-border/50 flex flex-col min-h-0"
        >
          <div className="p-6 border-b border-border/30 bg-background/50">
            <h2 className="text-lg font-semibold text-foreground mb-2">
              Prepare a STAR story
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Use this framework to structure your behavioral interview response
            </p>
          </div>
          
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="p-6 space-y-4">
              {starCards.map((card, index) => (
                <motion.div
                  key={card.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`border rounded-lg p-4 transition-all duration-200 ${
                    index === 0
                      ? 'border-primary bg-background/80 ring-1 ring-primary/20'
                      : 'border-border/30 bg-background/60 hover:bg-background/80'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{card.title}</span>
                      {index === 0 && (
                        <div className="w-2 h-2 bg-primary rounded-full" />
                      )}
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