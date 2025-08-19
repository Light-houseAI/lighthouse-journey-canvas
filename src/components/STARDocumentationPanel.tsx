import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Skeleton } from './ui/skeleton';

interface STARDocumentationPanelProps {
  isVisible: boolean;
  resultLoading?: boolean;
  resultUpdated?: boolean;
}

const STARDocumentationPanel: React.FC<STARDocumentationPanelProps> = ({ 
  isVisible, 
  resultLoading = false, 
  resultUpdated = false 
}) => {
  const contentEndRef = useRef<HTMLDivElement>(null);
  const resultCardRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when result updates
  useEffect(() => {
    if (resultUpdated) {
      contentEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [resultUpdated]);

  // Auto-scroll to Result card when loading starts
  useEffect(() => {
    if (resultLoading) {
      resultCardRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [resultLoading]);

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
      description: resultUpdated 
        ? '• Product team prioritized redesign of income verification and mobile document upload.\n\n• Within 6 weeks: drop-off at income verification decreased by 9%; mobile completion improved by 7%.\n\n• The dashboard became the default diagnostic tool across lending funnels, expanding to student loan and refinance teams.\n\n• PMs now use the dashboard in weekly reviews, replacing static reports with real-time insights.'
        : 'Describe the outcome. What happened? What did you learn? What impact did it have?'
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
                  ref={card.id === 'result' ? resultCardRef : undefined}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`border rounded-lg p-4 transition-all duration-200 ${
                    index === 3
                      ? 'border-primary bg-purple-100 dark:bg-purple-900/40 backdrop-blur-sm ring-1 ring-primary/20 shadow-lg'
                      : 'border-border/20 bg-white dark:bg-gray-800 backdrop-blur-sm hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-border/30'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">
                        {card.title.charAt(0)}
                      </div>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">{card.title}</span>
                    </div>
                    {card.id === 'result' && resultLoading ? (
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-full bg-gray-300 dark:bg-gray-600" />
                        <Skeleton className="h-4 w-3/4 bg-gray-300 dark:bg-gray-600" />
                        <Skeleton className="h-4 w-5/6 bg-gray-300 dark:bg-gray-600" />
                        <Skeleton className="h-4 w-2/3 bg-gray-300 dark:bg-gray-600" />
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed whitespace-pre-line italic">
                        {card.description}
                      </p>
                    )}
                  </div>
                </motion.div>
              ))}
              <div ref={contentEndRef} />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default STARDocumentationPanel;