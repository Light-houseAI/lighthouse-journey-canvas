/**
 * Template Store
 *
 * Zustand store with localStorage persistence for user-editable slash templates.
 * Seeds with built-in defaults on first load. Users can edit, create, and delete templates.
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// ============================================================================
// TYPES
// ============================================================================

/** Icon keys that map to lucide-react icons in the popup component */
export type TemplateIconKey = 'FileText' | 'BookOpen' | 'Rocket' | 'Sparkles' | 'Zap' | 'Brain' | 'Target' | 'Lightbulb';

/** Color preset keys */
export type TemplateColorPreset = 'blue' | 'purple' | 'orange' | 'green' | 'red' | 'amber' | 'teal' | 'pink';

export const COLOR_PRESETS: Record<TemplateColorPreset, { bg: string; text: string; iconBg: string }> = {
  blue:   { bg: 'hover:bg-blue-50',   text: 'text-blue-700',   iconBg: 'bg-blue-100' },
  purple: { bg: 'hover:bg-purple-50', text: 'text-purple-700', iconBg: 'bg-purple-100' },
  orange: { bg: 'hover:bg-orange-50', text: 'text-orange-700', iconBg: 'bg-orange-100' },
  green:  { bg: 'hover:bg-green-50',  text: 'text-green-700',  iconBg: 'bg-green-100' },
  red:    { bg: 'hover:bg-red-50',    text: 'text-red-700',    iconBg: 'bg-red-100' },
  amber:  { bg: 'hover:bg-amber-50',  text: 'text-amber-700',  iconBg: 'bg-amber-100' },
  teal:   { bg: 'hover:bg-teal-50',   text: 'text-teal-700',   iconBg: 'bg-teal-100' },
  pink:   { bg: 'hover:bg-pink-50',   text: 'text-pink-700',   iconBg: 'bg-pink-100' },
};

/** Serializable template stored in localStorage */
export interface StoredTemplate {
  id: string;
  name: string;
  description: string;
  iconKey: TemplateIconKey;
  query: string;
  promptPreview: string;
  colorPreset: TemplateColorPreset;
  /** Whether this is a built-in default (can be reset but not deleted) */
  isBuiltIn: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// DEFAULTS
// ============================================================================

const DEFAULT_TEMPLATES: StoredTemplate[] = [
  {
    id: 'weekly-progress-update',
    name: 'Weekly Progress Update',
    description: 'Generate a structured progress report from your recent workflows',
    iconKey: 'FileText',
    query: 'Create a weekly progress update report from my recent workflows',
    promptPreview: `Prompt: Weekly Progress Update

Transforms your workflow session data into a professional weekly progress report covering:
- Key accomplishments and activities
- Tools & platforms utilized
- Collaboration and deliverables
- Upcoming priorities based on observed patterns
- Workflow insights (strengths & areas for improvement)

Output: Downloadable markdown report`,
    colorPreset: 'blue',
    isBuiltIn: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'blog-creation',
    name: 'Blog Creation',
    description: 'Transform your workflow insights into an engaging blog post',
    iconKey: 'BookOpen',
    query: 'Create a blog post based on my recent workflow patterns and insights',
    promptPreview: `Prompt: Blog Creation

Transforms your workflow data into an engaging, publishable blog post featuring:
- Compelling narrative about how you worked
- Tool usage patterns and productivity insights
- AI integration observations (if applicable)
- Key takeaways for readers
- Forward-looking conclusions about modern work practices

Output: Downloadable markdown blog post`,
    colorPreset: 'purple',
    isBuiltIn: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'skill-file-generation',
    name: 'Skill File',
    description: 'Create a reusable SKILL.md documenting your workflow patterns',
    iconKey: 'Target',
    query: 'Create a SKILL.md file from my recent workflow sessions that documents the repeatable workflow pattern as a structured, reusable skill',
    promptPreview: `Prompt: Skill File Generation

Analyzes your workflow session data and creates a structured SKILL.md file:
- Identifies the core repeatable workflow pattern
- Documents step-by-step methodology in imperative voice
- Maps tools & integration points used
- Captures AI integration patterns (if applicable)
- Includes quality checks and common pitfalls
- Provides a concrete example from your actual session data

Output: Downloadable SKILL.md with YAML frontmatter`,
    colorPreset: 'green',
    isBuiltIn: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'founders',
    name: 'Founders',
    description: 'Analyze a session for a founder — predict outcomes, assess optimality, rank opportunities',
    iconKey: 'Rocket',
    query: `Analyze this session for a Founder. For each captured step: (1) Predict the likely outcome user is trying to achieve in this session (2) assess if steps taken by the user were done optimally, (3) identify what could be better (4) Only state an observation to do something better if you can point to a page + timestamp segment in the session (5) The suggested improvement should create meaningful difference to get user a better outcome. Ignore the PDF filename; it's a screen-capture timeline. Then provide the top 3-5 opportunities ranked by effort vs. impact, formatted as a priority matrix.`,
    promptPreview: `Prompt: Founders Session Analysis

Analyzes your session from a Founder's perspective:
- Predicts the likely outcome you're trying to achieve
- Assesses if steps were done optimally
- Identifies what could be better (with page + timestamp evidence)
- Only suggests improvements that create meaningful difference
- Provides top 3-5 opportunities as an effort vs. impact priority matrix

Output: Priority matrix with evidence-backed recommendations`,
    colorPreset: 'orange',
    isBuiltIn: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// ============================================================================
// STORE
// ============================================================================

interface TemplateState {
  templates: StoredTemplate[];

  // Actions
  addTemplate: (template: Omit<StoredTemplate, 'id' | 'isBuiltIn' | 'createdAt' | 'updatedAt'>) => void;
  updateTemplate: (id: string, updates: Partial<Pick<StoredTemplate, 'name' | 'description' | 'iconKey' | 'query' | 'promptPreview' | 'colorPreset'>>) => void;
  deleteTemplate: (id: string) => void;
  resetTemplate: (id: string) => void;
  resetAllDefaults: () => void;
  reorderTemplates: (fromIndex: number, toIndex: number) => void;
}

export const useTemplateStore = create<TemplateState>()(
  devtools(
    persist(
      immer((set) => ({
        templates: DEFAULT_TEMPLATES,

        addTemplate: (template) =>
          set((state) => {
            state.templates.push({
              ...template,
              id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              isBuiltIn: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }),

        updateTemplate: (id, updates) =>
          set((state) => {
            const idx = state.templates.findIndex((t) => t.id === id);
            if (idx !== -1) {
              Object.assign(state.templates[idx], updates);
              state.templates[idx].updatedAt = new Date().toISOString();
            }
          }),

        deleteTemplate: (id) =>
          set((state) => {
            const idx = state.templates.findIndex((t) => t.id === id);
            if (idx !== -1 && !state.templates[idx].isBuiltIn) {
              state.templates.splice(idx, 1);
            }
          }),

        resetTemplate: (id) =>
          set((state) => {
            const defaultTemplate = DEFAULT_TEMPLATES.find((t) => t.id === id);
            if (defaultTemplate) {
              const idx = state.templates.findIndex((t) => t.id === id);
              if (idx !== -1) {
                state.templates[idx] = { ...defaultTemplate, updatedAt: new Date().toISOString() };
              }
            }
          }),

        resetAllDefaults: () =>
          set((state) => {
            // Reset built-in templates to defaults, keep custom ones
            const customTemplates = state.templates.filter((t) => !t.isBuiltIn);
            state.templates = [...DEFAULT_TEMPLATES.map(t => ({ ...t, updatedAt: new Date().toISOString() })), ...customTemplates];
          }),

        reorderTemplates: (fromIndex, toIndex) =>
          set((state) => {
            const [moved] = state.templates.splice(fromIndex, 1);
            state.templates.splice(toIndex, 0, moved);
          }),
      })),
      {
        name: 'template-store',
        partialize: (state) => ({
          templates: state.templates,
        }),
      }
    ),
    { name: 'template-store' }
  )
);

export default useTemplateStore;
