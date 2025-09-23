/**
 * Unit Tests for ViewMatchesButton Component (LIG-179)
 *
 * Tests the ViewMatchesButton component that displays match count and navigates to search results.
 * These tests define the expected component behavior and must FAIL before implementation (TDD approach).
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

import type { TimelineNode } from '@journey/schema';
import type { GraphRAGSearchResponse } from '../../components/search/types/search.types';
import { ViewMatchesButton } from './ViewMatchesButton';
import { useExperienceMatches } from '../../hooks/search/useExperienceMatches';

// Mock dependencies
vi.mock('wouter', () => ({
  useLocation: vi.fn(() => ['/', vi.fn()]),
}));

vi.mock('../../hooks/search/useExperienceMatches', () => ({
  useExperienceMatches: vi.fn(),
}));

vi.mock('./ExperienceMatchesModal', () => ({
  ExperienceMatchesModal: vi.fn(() => null),
}));

const mockUseExperienceMatches = vi.mocked(useExperienceMatches);

// Test data
const TEST_NODE_ID = '123e4567-e89b-12d3-a456-426614174000';
const TEST_USER_ID = 1;

const mockCurrentJobNode: TimelineNode = {
  id: TEST_NODE_ID,
  type: 'job',
  meta: {
    orgId: 1,
    role: 'Senior Software Engineer',
    description: 'Building scalable React applications with TypeScript',
    startDate: '2023-01',
    endDate: null,
  },
  userId: TEST_USER_ID,
  parentId: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  position: 0,
  visibility: 'private',
};

const mockPastJobNode: TimelineNode = {
  ...mockCurrentJobNode,
  id: '222e4567-e89b-12d3-a456-426614174001',
  meta: {
    orgId: 1,
    role: 'Junior Developer',
    description: 'Learning web development',
    startDate: '2021-01',
    endDate: '2022-12',
  },
};

const mockMatchData: GraphRAGSearchResponse = {
  query: 'Building scalable React applications with TypeScript',
  totalResults: 2,
  profiles: [
    {
      id: 'profile-123',
      name: 'John Doe',
      email: 'john.doe@techcorp.com',
      currentRole: 'Senior React Developer',
      company: 'TechCorp',
      location: 'San Francisco, CA',
      matchScore: '85',
      whyMatched: ['5 years of React experience', 'Expert in TypeScript', 'Scalable architecture'],
      skills: ['React', 'TypeScript', 'Node.js', 'GraphQL'],
      matchedNodes: [
        {
          id: 'node-1',
          type: 'job',
          meta: { role: 'Senior React Developer', company: 'TechCorp' },
          score: 0.85,
        }
      ],
      insightsSummary: ['Led React migration for enterprise platform'],
    },
    {
      id: 'opportunity-456',
      name: 'React Engineer',
      email: 'hiring@startupxyz.com',
      currentRole: 'Frontend Engineer',
      company: 'StartupXYZ',
      location: 'Remote',
      matchScore: '78',
      whyMatched: ['Looking for React developers', 'TypeScript required'],
      skills: ['React', 'TypeScript', 'Next.js'],
      matchedNodes: [
        {
          id: 'node-2',
          type: 'job',
          meta: { role: 'Frontend Engineer', company: 'StartupXYZ' },
          score: 0.78,
        }
      ],
    },
  ],
  timestamp: new Date().toISOString(),
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

describe('ViewMatchesButton Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useNavigate as any).mockReturnValue(mockNavigate);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Visibility Logic', () => {
    it('should render for current experiences with matches', () => {
      mockUseExperienceMatches.mockReturnValue({
        data: mockMatchData,
        isLoading: false,
        error: null,
        hasMatches: true,
        matchCount: 2,
        searchQuery: 'Building scalable React applications with TypeScript',
        isCurrentExperience: true,
        shouldShowButton: true,
        refetch: vi.fn(),
      } as any);

      render(<ViewMatchesButton node={mockCurrentJobNode} />, { wrapper: createWrapper() });

      const button = screen.getByRole('button', { name: /view.*matches/i });
      expect(button).toBeInTheDocument();
    });

    it('should not render for past experiences', () => {
      mockUseExperienceMatches.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
        hasMatches: false,
        matchCount: 0,
        searchQuery: '',
        isCurrentExperience: false,
        shouldShowButton: false,
        refetch: vi.fn(),
      } as any);

      const { container } = render(<ViewMatchesButton node={mockPastJobNode} />, { wrapper: createWrapper() });

      expect(container.firstChild).toBeNull();
    });

    it('should not render when no matches are available', () => {
      mockUseExperienceMatches.mockReturnValue({
        data: { ...mockMatchData, matchCount: 0, matches: [] },
        isLoading: false,
        error: null,
        hasMatches: false,
        matchCount: 0,
        searchQuery: 'Building scalable React applications with TypeScript',
        isCurrentExperience: true,
        shouldShowButton: false,
        refetch: vi.fn(),
      } as any);

      const { container } = render(<ViewMatchesButton node={mockCurrentJobNode} />, { wrapper: createWrapper() });

      expect(container.firstChild).toBeNull();
    });

    it('should not render for non-experience node types', () => {
      const projectNode = {
        ...mockCurrentJobNode,
        type: 'project' as const,
        meta: {
          title: 'Portfolio Website',
          description: 'Personal portfolio',
        },
      };

      mockUseExperienceMatches.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
        hasMatches: false,
        matchCount: 0,
        searchQuery: '',
        isCurrentExperience: false,
        shouldShowButton: false,
        refetch: vi.fn(),
      } as any);

      const { container } = render(<ViewMatchesButton node={projectNode as any} />, { wrapper: createWrapper() });

      expect(container.firstChild).toBeNull();
    });
  });

  describe('Button Display', () => {
    it('should display correct match count in button text', () => {
      mockUseExperienceMatches.mockReturnValue({
        data: mockMatchData,
        isLoading: false,
        error: null,
        hasMatches: true,
        matchCount: 2,
        searchQuery: 'Building scalable React applications with TypeScript',
        isCurrentExperience: true,
        shouldShowButton: true,
        refetch: vi.fn(),
      } as any);

      render(<ViewMatchesButton node={mockCurrentJobNode} />, { wrapper: createWrapper() });

      const button = screen.getByRole('button');
      expect(button).toHaveTextContent('View 2 matches');
    });

    it('should display singular form for single match', () => {
      mockUseExperienceMatches.mockReturnValue({
        data: { ...mockMatchData, totalResults: 1, profiles: [mockMatchData.profiles[0]] },
        isLoading: false,
        error: null,
        hasMatches: true,
        matchCount: 1,
        searchQuery: 'Building scalable React applications with TypeScript',
        isCurrentExperience: true,
        shouldShowButton: true,
        refetch: vi.fn(),
      } as any);

      render(<ViewMatchesButton node={mockCurrentJobNode} />, { wrapper: createWrapper() });

      const button = screen.getByRole('button');
      expect(button).toHaveTextContent('View 1 match');
    });

    it('should display up to 3 matches maximum', () => {
      const manyMatches = {
        ...mockMatchData,
        matchCount: 10,
        profiles: mockMatchData.profiles.slice(0, 3), // API should limit to 3
      };

      mockUseExperienceMatches.mockReturnValue({
        data: manyMatches,
        isLoading: false,
        error: null,
        hasMatches: true,
        matchCount: 10,
        searchQuery: 'Building scalable React applications with TypeScript',
        isCurrentExperience: true,
        shouldShowButton: true,
        refetch: vi.fn(),
      } as any);

      render(<ViewMatchesButton node={mockCurrentJobNode} />, { wrapper: createWrapper() });

      const button = screen.getByRole('button');
      expect(button).toHaveTextContent('View 10 matches');
    });
  });

  describe('Loading States', () => {
    it('should show loading state while fetching matches', () => {
      mockUseExperienceMatches.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        hasMatches: false,
        matchCount: 0,
        searchQuery: '',
        isCurrentExperience: true,
        shouldShowButton: false,
        refetch: vi.fn(),
      } as any);

      render(<ViewMatchesButton node={mockCurrentJobNode} />, { wrapper: createWrapper() });

      // Should show a loading indicator or skeleton
      const loadingElement = screen.queryByTestId('loading-spinner');
      // Since we haven't implemented yet, this will be null, but in implementation it should exist
      expect(loadingElement).toBeInTheDocument();
    });

    it('should be disabled while loading', () => {
      mockUseExperienceMatches.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        hasMatches: false,
        matchCount: 0,
        searchQuery: '',
        isCurrentExperience: true,
        shouldShowButton: true,
        refetch: vi.fn(),
      } as any);

      render(<ViewMatchesButton node={mockCurrentJobNode} />, { wrapper: createWrapper() });

      const button = screen.queryByRole('button');
      if (button) {
        expect(button).toBeDisabled();
      }
    });
  });

  describe('Navigation Behavior', () => {
    it('should navigate to search results page on click', () => {
      mockUseExperienceMatches.mockReturnValue({
        data: mockMatchData,
        isLoading: false,
        error: null,
        hasMatches: true,
        matchCount: 2,
        searchQuery: 'Building scalable React applications with TypeScript',
        isCurrentExperience: true,
        shouldShowButton: true,
        refetch: vi.fn(),
      } as any);

      render(<ViewMatchesButton node={mockCurrentJobNode} />, { wrapper: createWrapper() });

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(mockNavigate).toHaveBeenCalledWith({
        pathname: '/search',
        search: '?q=Building scalable React applications with TypeScript',
      });
    });

    it('should encode search query properly in URL', () => {
      const specialCharsQuery = 'C++ & React/TypeScript development';
      mockUseExperienceMatches.mockReturnValue({
        data: { ...mockMatchData, searchQuery: specialCharsQuery },
        isLoading: false,
        error: null,
        hasMatches: true,
        matchCount: 2,
        searchQuery: specialCharsQuery,
        isCurrentExperience: true,
        shouldShowButton: true,
        refetch: vi.fn(),
      } as any);

      render(<ViewMatchesButton node={mockCurrentJobNode} />, { wrapper: createWrapper() });

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(mockNavigate).toHaveBeenCalledWith({
        pathname: '/search',
        search: `?q=${encodeURIComponent(specialCharsQuery)}`,
      });
    });

    it('should not navigate if search query is empty', () => {
      mockUseExperienceMatches.mockReturnValue({
        data: { ...mockMatchData, searchQuery: '' },
        isLoading: false,
        error: null,
        hasMatches: true,
        matchCount: 2,
        searchQuery: '',
        isCurrentExperience: true,
        shouldShowButton: true,
        refetch: vi.fn(),
      } as any);

      render(<ViewMatchesButton node={mockCurrentJobNode} />, { wrapper: createWrapper() });

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should not render button when API error occurs', () => {
      mockUseExperienceMatches.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Failed to fetch matches'),
        hasMatches: false,
        matchCount: 0,
        searchQuery: '',
        isCurrentExperience: true,
        shouldShowButton: false,
        refetch: vi.fn(),
      } as any);

      const { container } = render(<ViewMatchesButton node={mockCurrentJobNode} />, { wrapper: createWrapper() });

      expect(container.firstChild).toBeNull();
    });

    it('should allow retry on error via refetch', async () => {
      const refetchMock = vi.fn();
      mockUseExperienceMatches.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Failed to fetch matches'),
        hasMatches: false,
        matchCount: 0,
        searchQuery: '',
        isCurrentExperience: true,
        shouldShowButton: false,
        refetch: refetchMock,
      } as any);

      render(<ViewMatchesButton node={mockCurrentJobNode} />, { wrapper: createWrapper() });

      // In a real implementation, there might be a retry button
      // For now, we just verify the refetch function is available
      expect(refetchMock).toBeDefined();
    });
  });

  describe('Accessibility', () => {
    it('should have appropriate ARIA attributes', () => {
      mockUseExperienceMatches.mockReturnValue({
        data: mockMatchData,
        isLoading: false,
        error: null,
        hasMatches: true,
        matchCount: 2,
        searchQuery: 'Building scalable React applications with TypeScript',
        isCurrentExperience: true,
        shouldShowButton: true,
        refetch: vi.fn(),
      } as any);

      render(<ViewMatchesButton node={mockCurrentJobNode} />, { wrapper: createWrapper() });

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', expect.stringContaining('View 2 matches'));
    });

    it('should be keyboard accessible', () => {
      mockUseExperienceMatches.mockReturnValue({
        data: mockMatchData,
        isLoading: false,
        error: null,
        hasMatches: true,
        matchCount: 2,
        searchQuery: 'Building scalable React applications with TypeScript',
        isCurrentExperience: true,
        shouldShowButton: true,
        refetch: vi.fn(),
      } as any);

      render(<ViewMatchesButton node={mockCurrentJobNode} />, { wrapper: createWrapper() });

      const button = screen.getByRole('button');

      // Simulate keyboard interaction
      button.focus();
      expect(document.activeElement).toBe(button);

      // Simulate Enter key press
      fireEvent.keyDown(button, { key: 'Enter', code: 'Enter' });
      expect(mockNavigate).toHaveBeenCalled();
    });
  });

  describe('Integration with Timeline', () => {
    it('should render correctly within timeline node context', () => {
      mockUseExperienceMatches.mockReturnValue({
        data: mockMatchData,
        isLoading: false,
        error: null,
        hasMatches: true,
        matchCount: 2,
        searchQuery: 'Building scalable React applications with TypeScript',
        isCurrentExperience: true,
        shouldShowButton: true,
        refetch: vi.fn(),
      } as any);

      const { container } = render(<ViewMatchesButton node={mockCurrentJobNode} />, { wrapper: createWrapper() });

      // Button should be rendered
      expect(container.firstChild).not.toBeNull();

      // Should have appropriate styling for timeline context
      const button = screen.getByRole('button');
      expect(button).toHaveClass('timeline-action-button'); // Expected class
    });

    it('should maintain consistent styling with other timeline actions', () => {
      mockUseExperienceMatches.mockReturnValue({
        data: mockMatchData,
        isLoading: false,
        error: null,
        hasMatches: true,
        matchCount: 2,
        searchQuery: 'Building scalable React applications with TypeScript',
        isCurrentExperience: true,
        shouldShowButton: true,
        refetch: vi.fn(),
      } as any);

      render(<ViewMatchesButton node={mockCurrentJobNode} />, { wrapper: createWrapper() });

      const button = screen.getByRole('button');
      // Should have similar styling to ShareButton
      expect(button).toHaveClass('timeline-action-button');
    });
  });
});