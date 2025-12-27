/**
 * WorkflowContentArea Component
 * Main content area showing workflow preview cards organized by categories
 * Matches journey-workflows workflow content layout
 */

import { useRef, useCallback, useEffect } from 'react';
import { WorkflowPreviewCard } from './WorkflowPreviewCard';
import type { SessionMappingItem } from '@journey/schema';

interface WorkflowCategory {
  id: string;
  title: string;
  workflows: Array<{
    id: string;
    title: string;
    steps: Array<{ id: string; label: string }>;
    hasInsights?: boolean;
    confidence?: number;
  }>;
}

interface WorkflowContentAreaProps {
  sessions: SessionMappingItem[];
  nodeId?: string;
  onCategoryInView?: (categoryId: string) => void;
}

// Generate workflow categories from sessions
// In production, this would use AI to analyze and categorize sessions
function generateWorkflowCategories(
  sessions: SessionMappingItem[],
  nodeId?: string
): WorkflowCategory[] {
  return [
    {
      id: 'discovery',
      title: 'Discovery and research',
      workflows: [
        {
          id: `${nodeId}-conduct-research`,
          title: 'Conduct research',
          steps: [
            { id: 'define-goals', label: 'Define research goals' },
            { id: 'gather-data', label: 'Gather data' },
            { id: 'analyze-findings', label: 'Analyze findings' },
            { id: 'synthesize', label: 'Synthesize insights' },
          ],
          hasInsights: true,
          confidence: 85,
        },
      ],
    },
    {
      id: 'documentation',
      title: 'Documentation',
      workflows: [
        {
          id: `${nodeId}-writing-docs`,
          title: 'Writing documentation',
          steps: [
            { id: 'outline', label: 'Create outline' },
            { id: 'draft', label: 'Write draft' },
            { id: 'review', label: 'Review and edit' },
            { id: 'publish', label: 'Publish docs' },
          ],
          hasInsights: false,
          confidence: 75,
        },
      ],
    },
    {
      id: 'strategy',
      title: 'Strategy and direction setting',
      workflows: [
        {
          id: `${nodeId}-planning`,
          title: 'Strategic planning',
          steps: [
            { id: 'assess', label: 'Assess current state' },
            { id: 'define', label: 'Define objectives' },
            { id: 'plan', label: 'Create action plan' },
            { id: 'communicate', label: 'Communicate strategy' },
          ],
          hasInsights: true,
          confidence: 90,
        },
      ],
    },
    {
      id: 'execution',
      title: 'Execution and delivery',
      workflows: [
        {
          id: `${nodeId}-implementation`,
          title: 'Implementation',
          steps: [
            { id: 'setup', label: 'Setup environment' },
            { id: 'develop', label: 'Develop solution' },
            { id: 'test', label: 'Test thoroughly' },
            { id: 'deploy', label: 'Deploy to production' },
          ],
          hasInsights: false,
          confidence: 80,
        },
      ],
    },
  ];
}

function CategorySection({
  category,
}: {
  category: WorkflowCategory;
}) {
  return (
    <section id={`category-${category.id}`} className="mb-12">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">{category.title}</h2>
      <div className="space-y-6">
        {category.workflows.map((workflow) => (
          <WorkflowPreviewCard
            key={workflow.id}
            workflowId={workflow.id}
            title={workflow.title}
            steps={workflow.steps}
            hasInsights={workflow.hasInsights}
            confidence={workflow.confidence}
          />
        ))}
      </div>
    </section>
  );
}

export function WorkflowContentArea({
  sessions,
  nodeId,
  onCategoryInView,
}: WorkflowContentAreaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const workflowCategories = generateWorkflowCategories(sessions, nodeId);

  // Scroll spy logic
  const handleScroll = useCallback(() => {
    if (!containerRef.current || !onCategoryInView) return;

    const container = containerRef.current;
    const containerTop = container.getBoundingClientRect().top;

    let closestCategory = workflowCategories[0]?.id;
    let closestDistance = Infinity;

    workflowCategories.forEach((category) => {
      const element = document.getElementById(`category-${category.id}`);
      if (element) {
        const rect = element.getBoundingClientRect();
        const distance = Math.abs(rect.top - containerTop - 50);

        if (rect.top <= containerTop + 100 && distance < closestDistance) {
          closestDistance = distance;
          closestCategory = category.id;
        }
      }
    });

    onCategoryInView(closestCategory);
  }, [onCategoryInView, workflowCategories]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial check

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [handleScroll]);

  return (
    <main ref={containerRef} className="flex-1 p-6 lg:p-10 overflow-auto bg-gray-50">
      {workflowCategories.map((category) => (
        <CategorySection key={category.id} category={category} />
      ))}
    </main>
  );
}
