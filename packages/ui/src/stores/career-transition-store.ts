import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

import type {
  ApplicationStatus,
  Todo,
} from '../components/nodes/career-transition/wizard/steps/types';

interface CareerTransitionState {
  // Expanded state for companies and statuses in My Tasks sidebar
  expandedCompanies: Set<string>;
  expandedStatuses: Set<string>;

  // Active todos being edited (not yet saved)
  activeApplicationTodos: Record<string, Record<ApplicationStatus, Todo[]>>;

  // Actions
  toggleCompany: (applicationId: string) => void;
  toggleStatus: (statusKey: string) => void;
  expandAll: (applicationIds: string[], statusKeys: string[]) => void;
  collapseAll: () => void;
  setActiveTodos: (
    applicationId: string,
    status: ApplicationStatus,
    todos: Todo[]
  ) => void;
  reset: () => void;
}

export const useCareerTransitionStore = create<CareerTransitionState>()(
  immer((set) => ({
    // Initial state
    expandedCompanies: new Set<string>(),
    expandedStatuses: new Set<string>(),
    activeApplicationTodos: {},

    // Toggle company expansion
    toggleCompany: (applicationId) =>
      set((state) => {
        if (state.expandedCompanies.has(applicationId)) {
          state.expandedCompanies.delete(applicationId);
        } else {
          state.expandedCompanies.add(applicationId);
        }
      }),

    // Toggle status expansion
    toggleStatus: (statusKey) =>
      set((state) => {
        if (state.expandedStatuses.has(statusKey)) {
          state.expandedStatuses.delete(statusKey);
        } else {
          state.expandedStatuses.add(statusKey);
        }
      }),

    // Expand all companies and statuses
    expandAll: (applicationIds, statusKeys) =>
      set((state) => {
        state.expandedCompanies = new Set(applicationIds);
        state.expandedStatuses = new Set(statusKeys);
      }),

    // Collapse all
    collapseAll: () =>
      set((state) => {
        state.expandedCompanies.clear();
        state.expandedStatuses.clear();
      }),

    // Set active todos for an application status
    setActiveTodos: (applicationId, status, todos) =>
      set((state) => {
        if (!state.activeApplicationTodos[applicationId]) {
          state.activeApplicationTodos[applicationId] = {} as Record<
            ApplicationStatus,
            Todo[]
          >;
        }
        state.activeApplicationTodos[applicationId][status] = todos;
      }),

    // Reset all state
    reset: () =>
      set((state) => {
        state.expandedCompanies.clear();
        state.expandedStatuses.clear();
        state.activeApplicationTodos = {};
      }),
  }))
);
