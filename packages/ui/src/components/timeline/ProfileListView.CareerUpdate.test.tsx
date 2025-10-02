/**
 * Unit Tests for ProfileListView Career Update Button (LIG-189)
 *
 * Tests the "Add Update" button functionality for career transition nodes in ProfileListView.
 * These tests define the expected component behavior and must FAIL before implementation (TDD approach).
 */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

import type { TimelineNode } from '@journey/schema';
import { ProfileListView } from './ProfileListView';
import * as hierarchyApi from '../../services/hierarchy-api';
import * as updatesApi from '../../services/updates-api';

// Mock the hierarchy API
vi.mock('../../services/hierarchy-api');
vi.mock('../../services/updates-api');

// Test data
const mockCareerTransitionNode: TimelineNode = {
  id: 'career-transition-1',
  type: 'careerTransition',
  meta: {
    title: 'Software engineer to Staff engineer',
    fromRole: 'Software engineer',
    toRole: 'Staff engineer',
    description: 'Looking to change in software engineering roles',
    startDate: '2025-09',
    endDate: null,
  },
  userId: 1,
  parentId: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  position: 0,
  visibility: 'private',
  permissions: {
    canEdit: true,
    canDelete: true,
    canShare: true,
    shouldShowMatches: false,
  },
};

// Test wrapper with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
        gcTime: 0,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

describe('ProfileListView - Career Update Button', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock the API to return our career transition node
    vi.mocked(hierarchyApi.hierarchyApi.listNodesWithPermissions).mockResolvedValue([mockCareerTransitionNode]);
  });

  describe('Button Visibility', () => {
    it('should render "Add Update" button for career transition nodes with edit permissions', async () => {
      render(<ProfileListView />, { wrapper: createWrapper() });

      // Wait for data to load
      const careerTransitionCard = await screen.findByText(/Software engineer to Staff engineer/i);
      expect(careerTransitionCard).toBeInTheDocument();

      // Find the parent node container
      const nodeContainer = careerTransitionCard.closest('.group');
      expect(nodeContainer).toBeInTheDocument();

      // Look for "Add Update" button within this node
      const addUpdateButton = within(nodeContainer!).getByRole('button', { name: /add update/i });
      expect(addUpdateButton).toBeInTheDocument();
    });
  });

  describe('Modal Interaction', () => {
    it('should open CareerUpdateWizard modal when "Add Update" button is clicked', async () => {
      const user = userEvent.setup();
      render(<ProfileListView />, { wrapper: createWrapper() });

      // Wait for data to load
      const careerTransitionCard = await screen.findByText(/Software engineer to Staff engineer/i);
      const nodeContainer = careerTransitionCard.closest('.group');

      // Click "Add Update" button
      const addUpdateButton = within(nodeContainer!).getByRole('button', { name: /add update/i });
      await user.click(addUpdateButton);

      // Verify wizard modal is open by checking for wizard elements
      expect(screen.getByRole('button', { name: /confirm answer/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel update/i })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /applied to jobs with strong fit/i })).toBeInTheDocument();
      expect(screen.getByText(/step 1.*confirm activities/i)).toBeInTheDocument();
    });
  });
});
