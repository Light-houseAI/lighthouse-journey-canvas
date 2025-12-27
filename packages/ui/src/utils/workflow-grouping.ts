/**
 * Workflow Grouping Utilities
 * Groups sessions by detected workflow archetype and category
 */

import type { SessionMappingItem, WorkTrackCategory } from '@journey/schema';

export interface WorkflowGroup {
  id: string;
  label: string;
  category: WorkTrackCategory;
  sessions: SessionMappingItem[];
}

export interface WorkflowNavCategory {
  id: string;
  label: string;
  children: Array<{
    id: string;
    label: string;
    sessionCount: number;
  }>;
}

/**
 * Category label mappings based on WorkTrackCategory enum
 */
const CATEGORY_LABELS: Record<string, string> = {
  // Discovery & Research
  'discovery_and_research': 'Discovery and research',
  'conduct_research': 'Conduct research',
  'gather_requirements': 'Gather requirements',
  'analyze_data': 'Analyze data',

  // Documentation
  'documentation': 'Documentation',
  'writing_documentation': 'Write documentation',
  'create_reports': 'Create reports',

  // Strategy
  'strategy_and_direction_setting': 'Strategy and direction setting',
  'define_goals': 'Define goals',
  'plan_approach': 'Plan approach',

  // Execution
  'execution_and_delivery': 'Execution and delivery',
  'implement_solution': 'Implement solution',
  'test_and_validate': 'Test and validate',

  // Product Development
  'product_development': 'Product Development',
  'feature_development': 'Feature Development',
  'bug_fixing': 'Bug Fixing',

  // Marketing & Growth
  'marketing_and_growth': 'Marketing & Growth',
  'content_creation': 'Content Creation',
  'campaign_planning': 'Campaign Planning',

  // Hiring & Operations
  'hiring_and_recruiting': 'Hiring & Recruiting',
  'candidate_screening': 'Candidate Screening',
  'interview_process': 'Interview Process',

  // Fundraising & Sales
  'fundraising': 'Fundraising',
  'investor_relations': 'Investor Relations',
  'pitch_preparation': 'Pitch Preparation',

  // Learning
  'learning_and_development': 'Learning & Development',
  'skill_building': 'Skill Building',
};

/**
 * Category hierarchy - maps parent categories to child categories
 */
const CATEGORY_HIERARCHY: Record<string, string[]> = {
  'discovery_and_research': ['conduct_research', 'gather_requirements', 'analyze_data'],
  'documentation': ['writing_documentation', 'create_reports'],
  'strategy_and_direction_setting': ['define_goals', 'plan_approach'],
  'execution_and_delivery': ['implement_solution', 'test_and_validate'],
  'product_development': ['feature_development', 'bug_fixing'],
  'marketing_and_growth': ['content_creation', 'campaign_planning'],
  'hiring_and_recruiting': ['candidate_screening', 'interview_process'],
  'fundraising': ['investor_relations', 'pitch_preparation'],
  'learning_and_development': ['skill_building'],
};

/**
 * Get human-readable label for a category
 */
export function getCategoryLabel(category: WorkTrackCategory | string): string {
  return CATEGORY_LABELS[category] || category.replace(/_/g, ' ');
}

/**
 * Group sessions by their workflow category into a navigation hierarchy
 */
export function groupSessionsForNavigation(sessions: SessionMappingItem[]): WorkflowNavCategory[] {
  // Group sessions by category
  const categoryMap = new Map<string, SessionMappingItem[]>();

  sessions.forEach((session) => {
    const category = session.category;
    if (!categoryMap.has(category)) {
      categoryMap.set(category, []);
    }
    categoryMap.get(category)!.push(session);
  });

  // Build navigation hierarchy
  const navCategories: WorkflowNavCategory[] = [];
  const processedParents = new Set<string>();

  // First pass: identify parent categories that have sessions
  categoryMap.forEach((sessions, category) => {
    // Check if this category is a parent category
    if (CATEGORY_HIERARCHY[category]) {
      processedParents.add(category);

      const children: Array<{ id: string; label: string; sessionCount: number }> = [];

      // Add child categories that have sessions
      CATEGORY_HIERARCHY[category].forEach((childCategory) => {
        const childSessions = categoryMap.get(childCategory) || [];
        if (childSessions.length > 0) {
          children.push({
            id: childCategory,
            label: getCategoryLabel(childCategory),
            sessionCount: childSessions.length,
          });
        }
      });

      // If parent has direct sessions, add "All" as first child
      if (sessions.length > 0) {
        children.unshift({
          id: category,
          label: 'All',
          sessionCount: sessions.length,
        });
      }

      if (children.length > 0) {
        navCategories.push({
          id: category,
          label: getCategoryLabel(category),
          children,
        });
      }
    }
  });

  // Second pass: add standalone categories (not parents and not children)
  categoryMap.forEach((sessions, category) => {
    if (processedParents.has(category)) return;

    // Check if this is a child of an existing parent
    const isChild = Object.values(CATEGORY_HIERARCHY).some((children) =>
      children.includes(category)
    );

    if (!isChild && sessions.length > 0) {
      // Standalone category - create a single-item group
      navCategories.push({
        id: category,
        label: getCategoryLabel(category),
        children: [
          {
            id: category,
            label: 'All sessions',
            sessionCount: sessions.length,
          },
        ],
      });
    }
  });

  return navCategories.sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Group sessions by category for content display
 */
export function groupSessionsByCategory(sessions: SessionMappingItem[]): WorkflowGroup[] {
  const categoryMap = new Map<string, SessionMappingItem[]>();

  sessions.forEach((session) => {
    const category = session.category;
    if (!categoryMap.has(category)) {
      categoryMap.set(category, []);
    }
    categoryMap.get(category)!.push(session);
  });

  const groups: WorkflowGroup[] = [];
  categoryMap.forEach((categorySessions, category) => {
    groups.push({
      id: category,
      label: getCategoryLabel(category),
      category: category as WorkTrackCategory,
      sessions: categorySessions,
    });
  });

  return groups.sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Get all sessions for a specific category (including child categories)
 */
export function getSessionsForCategory(
  sessions: SessionMappingItem[],
  categoryId: string
): SessionMappingItem[] {
  // If this is a parent category, get all sessions from children too
  const childCategories = CATEGORY_HIERARCHY[categoryId] || [];
  const allCategories = [categoryId, ...childCategories];

  return sessions.filter((session) =>
    allCategories.includes(session.category)
  );
}
