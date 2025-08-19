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
      description: 'SoFi faced a critical issue: thousands of users were starting but abandoning loan applications, leading to a 72% funnel drop-off rate. Customers didn\'t know what information was required, couldn\'t save progress, and struggled with mobile-specific steps like document upload. These breakdowns weren\'t visible to the product team because no diagnostic tooling existed.'
    },
    {
      id: 'task',
      title: 'Task',
      description: 'I needed to uncover the root causes of drop-off and build alignment around a solution. With no central dashboard or analytics in place—and fragmented definitions across teams—PMs relied on anecdotes rather than data. I proposed building a real-time diagnostic dashboard, but first had to align engineering, data infrastructure, and product stakeholders who were wary of investing in internal tools without clear ROI.'
    },
    {
      id: 'action',
      title: 'Action',
      description: 'Analyzed the funnel with mixed methods: Combined metrics, user research, and support tickets to isolate friction points (e.g., 38% drop-off at income verification, mobile users 2x more likely to abandon document upload).\n\nInfluenced through storytelling: Led a product review workshop with funnel replays and user quotes, making drop-offs tangible and empathetic rather than abstract metrics.\n\nDesigned and drove adoption of the tool: Built a real-time dashboard segmented by device, cohort, and funnel stage. Ensured adoption by creating usage templates, mapping insights to roadmap priorities, and delivering annotated reports with recommendations.'
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
              Use this framework to structure your behavioral interview response. Navi will enhance your answers for you.
            </p>
          </div>
          
          {/* STAR Panel Content - Scrollable */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="p-6 space-y-4">
              <h3 className="text-xl font-bold text-foreground mb-6 leading-tight">
                Diagnosing Drop-Offs in SoFi's Loan Application Funnel
              </h3>
              {starCards.map((card, index) => (
                <motion.div
                  key={card.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`border rounded-lg p-4 transition-all duration-200 ${
                    index === 3
                      ? 'border-primary bg-primary/10 backdrop-blur-sm ring-1 ring-primary/20 shadow-lg'
                      : 'border-border/20 bg-background/60 backdrop-blur-sm hover:bg-background/80 hover:border-border/30'
                  }`}
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