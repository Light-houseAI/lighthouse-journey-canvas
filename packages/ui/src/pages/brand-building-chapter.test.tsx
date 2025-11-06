/**
 * Brand Building Chapter Page Tests
 *
 * Tests for the brand building chapter detail view including:
 * - Platform activity display
 * - Screenshot deduplication
 * - Empty states
 */

import { BrandPlatform } from '@journey/schema';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useBrandBuildingActivities } from '../hooks/useBrandBuildingActivities';
import { useTimelineNode } from '../hooks/useTimeline';
import BrandBuildingChapter from './brand-building-chapter';

// Mock dependencies
vi.mock('wouter', () => ({
  useRoute: vi.fn(() => [true, { nodeId: 'test-node-id' }]),
}));

vi.mock('../contexts/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      backgroundGradient: 'bg-gradient-to-br from-gray-50 to-gray-100',
    },
  }),
}));

vi.mock('../hooks/useAuth', () => ({
  useCurrentUser: () => ({
    data: {
      firstName: 'John',
      lastName: 'Doe',
      userName: 'johndoe',
      email: 'john@example.com',
    },
  }),
}));

vi.mock('../hooks/useTimeline');
vi.mock('../hooks/useBrandBuildingActivities');

vi.mock('../components/journey/JourneyHeader', () => ({
  JourneyHeader: () => <div data-testid="journey-header">Header</div>,
}));

vi.mock('../components/permissions/PermissionsDisplay', () => ({
  PermissionsDisplay: () => <div data-testid="permissions">Permissions</div>,
}));

vi.mock('../components/user/UserAvatar', () => ({
  UserAvatar: () => <div data-testid="user-avatar">User Avatar</div>,
}));

describe('BrandBuildingChapter', () => {
  const mockUseTimelineNode = vi.mocked(useTimelineNode);
  const mockUseBrandBuildingActivities = vi.mocked(useBrandBuildingActivities);

  const baseNode = {
    id: 'test-node-id',
    userName: 'johndoe',
    updatedAt: '2024-01-15T12:00:00Z',
    permissions: [],
    meta: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading and Empty States', () => {
    it('should show loading spinner while fetching data', () => {
      mockUseTimelineNode.mockReturnValue({
        data: undefined,
        isLoading: true,
      } as any);
      mockUseBrandBuildingActivities.mockReturnValue({
        activities: [],
        isLoading: true,
      } as any);

      render(<BrandBuildingChapter />);

      // Check for spinner by class since it doesn't have a role
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('should show empty state when no activities exist', () => {
      mockUseTimelineNode.mockReturnValue({
        data: baseNode,
        isLoading: false,
      } as any);
      mockUseBrandBuildingActivities.mockReturnValue({
        activities: [],
        isLoading: false,
      } as any);

      render(<BrandBuildingChapter />);

      expect(
        screen.getByText('No brand building activities recorded yet.')
      ).toBeInTheDocument();
    });
  });

  describe('Activity Display', () => {
    it('should display activities grouped by platform', () => {
      const activities = [
        {
          id: '1',
          platform: 'LinkedIn' as BrandPlatform,
          profileUrl: 'https://linkedin.com/in/johndoe',
          screenshots: [
            {
              storageKey: 'key1',
              filename: 'screenshot1.png',
              mimeType: 'image/png',
              sizeBytes: 1024,
              notes: 'Test note',
            },
          ],
          notes: 'LinkedIn activity',
          timestamp: '2024-01-15T12:00:00Z',
        },
        {
          id: '2',
          platform: 'X' as BrandPlatform,
          profileUrl: 'https://x.com/johndoe',
          screenshots: [
            {
              storageKey: 'key2',
              filename: 'screenshot2.png',
              mimeType: 'image/png',
              sizeBytes: 2048,
              notes: 'X note',
            },
          ],
          notes: 'X activity',
          timestamp: '2024-01-16T12:00:00Z',
        },
      ];

      mockUseTimelineNode.mockReturnValue({
        data: baseNode,
        isLoading: false,
      } as any);
      mockUseBrandBuildingActivities.mockReturnValue({
        activities,
        isLoading: false,
      } as any);

      render(<BrandBuildingChapter />);

      expect(screen.getByText('LinkedIn')).toBeInTheDocument();
      expect(screen.getByText('X')).toBeInTheDocument();
      expect(screen.getByText('LinkedIn activity')).toBeInTheDocument();
      expect(screen.getByText('X activity')).toBeInTheDocument();
    });

    it('should display screenshots with links', () => {
      const activities = [
        {
          id: '1',
          platform: 'LinkedIn' as BrandPlatform,
          profileUrl: 'https://linkedin.com/in/johndoe',
          screenshots: [
            {
              storageKey: 'test-key',
              filename: 'test-screenshot.png',
              mimeType: 'image/png',
              sizeBytes: 1024,
              notes: 'Screenshot notes',
            },
          ],
          timestamp: '2024-01-15T12:00:00Z',
        },
      ];

      mockUseTimelineNode.mockReturnValue({
        data: baseNode,
        isLoading: false,
      } as any);
      mockUseBrandBuildingActivities.mockReturnValue({
        activities,
        isLoading: false,
      } as any);

      render(<BrandBuildingChapter />);

      expect(screen.getByText('test-screenshot.png')).toBeInTheDocument();
      expect(screen.getByText('Screenshot notes')).toBeInTheDocument();

      const link = screen.getByRole('link', { name: 'test-screenshot.png' });
      expect(link).toHaveAttribute('href', '/api/files/test-key');
    });
  });

  describe('Screenshot Deduplication', () => {
    it('should remove duplicate screenshots with same filename and size', () => {
      const activities = [
        {
          id: '1',
          platform: 'LinkedIn' as BrandPlatform,
          profileUrl: 'https://linkedin.com/in/johndoe',
          screenshots: [
            {
              storageKey: 'key1',
              filename: 'duplicate.png',
              mimeType: 'image/png',
              sizeBytes: 1024,
              notes: 'First upload',
            },
            {
              storageKey: 'key2',
              filename: 'duplicate.png', // Same filename
              mimeType: 'image/png',
              sizeBytes: 1024, // Same size
              notes: 'Second upload - should be removed',
            },
            {
              storageKey: 'key3',
              filename: 'unique.png',
              mimeType: 'image/png',
              sizeBytes: 2048,
              notes: 'Unique file',
            },
          ],
          timestamp: '2024-01-15T12:00:00Z',
        },
      ];

      mockUseTimelineNode.mockReturnValue({
        data: baseNode,
        isLoading: false,
      } as any);
      mockUseBrandBuildingActivities.mockReturnValue({
        activities,
        isLoading: false,
      } as any);

      render(<BrandBuildingChapter />);

      // Should show "Screenshots (2)" not "Screenshots (3)"
      expect(screen.getByText('Screenshots (2):')).toBeInTheDocument();

      // Should only show first duplicate
      expect(screen.getByText('First upload')).toBeInTheDocument();
      expect(
        screen.queryByText('Second upload - should be removed')
      ).not.toBeInTheDocument();

      // Should show unique file
      expect(screen.getByText('Unique file')).toBeInTheDocument();
    });

    it('should keep files with same filename but different size', () => {
      const activities = [
        {
          id: '1',
          platform: 'LinkedIn' as BrandPlatform,
          profileUrl: 'https://linkedin.com/in/johndoe',
          screenshots: [
            {
              storageKey: 'key1',
              filename: 'screenshot.png',
              mimeType: 'image/png',
              sizeBytes: 1024, // Different size
              notes: 'Small version',
            },
            {
              storageKey: 'key2',
              filename: 'screenshot.png', // Same filename
              mimeType: 'image/png',
              sizeBytes: 2048, // Different size
              notes: 'Large version',
            },
          ],
          timestamp: '2024-01-15T12:00:00Z',
        },
      ];

      mockUseTimelineNode.mockReturnValue({
        data: baseNode,
        isLoading: false,
      } as any);
      mockUseBrandBuildingActivities.mockReturnValue({
        activities,
        isLoading: false,
      } as any);

      render(<BrandBuildingChapter />);

      // Should show both files
      expect(screen.getByText('Screenshots (2):')).toBeInTheDocument();
      expect(screen.getByText('Small version')).toBeInTheDocument();
      expect(screen.getByText('Large version')).toBeInTheDocument();
    });

    it('should deduplicate across multiple activities in same platform', () => {
      const activities = [
        {
          id: '1',
          platform: 'LinkedIn' as BrandPlatform,
          profileUrl: 'https://linkedin.com/in/johndoe',
          screenshots: [
            {
              storageKey: 'key1',
              filename: 'file1.png',
              mimeType: 'image/png',
              sizeBytes: 1024,
              notes: 'File 1',
            },
            {
              storageKey: 'key2',
              filename: 'duplicate.png',
              mimeType: 'image/png',
              sizeBytes: 2048,
              notes: 'First duplicate',
            },
          ],
          timestamp: '2024-01-15T12:00:00Z',
        },
        {
          id: '2',
          platform: 'LinkedIn' as BrandPlatform,
          profileUrl: 'https://linkedin.com/in/johndoe',
          screenshots: [
            {
              storageKey: 'key3',
              filename: 'duplicate.png', // Duplicate from first activity
              mimeType: 'image/png',
              sizeBytes: 2048,
              notes: 'Second duplicate - should be removed',
            },
            {
              storageKey: 'key4',
              filename: 'file2.png',
              mimeType: 'image/png',
              sizeBytes: 3072,
              notes: 'File 2',
            },
          ],
          timestamp: '2024-01-16T12:00:00Z',
        },
      ];

      mockUseTimelineNode.mockReturnValue({
        data: baseNode,
        isLoading: false,
      } as any);
      mockUseBrandBuildingActivities.mockReturnValue({
        activities,
        isLoading: false,
      } as any);

      render(<BrandBuildingChapter />);

      // First activity should have 2 screenshots
      const screenshotSections = screen.getAllByText(/Screenshots \(\d+\):/);
      expect(screenshotSections[0]).toHaveTextContent('Screenshots (2):');

      // Second activity should have 1 screenshot (duplicate removed)
      expect(screenshotSections[1]).toHaveTextContent('Screenshots (1):');

      // Should show first duplicate but not second
      expect(screen.getByText('First duplicate')).toBeInTheDocument();
      expect(
        screen.queryByText('Second duplicate - should be removed')
      ).not.toBeInTheDocument();
    });
  });

  describe('LLM Summary Display', () => {
    it('should display platform summary and key points when available', () => {
      const activities = [
        {
          id: '1',
          platform: 'LinkedIn' as BrandPlatform,
          profileUrl: 'https://linkedin.com/in/johndoe',
          screenshots: [],
          timestamp: '2024-01-15T12:00:00Z',
        },
      ];

      const nodeWithSummary = {
        ...baseNode,
        meta: {
          brandBuildingData: {
            summaries: {
              LinkedIn: 'Great LinkedIn presence with engaging content.',
            },
            keyPoints: {
              LinkedIn: [
                'Active engagement',
                'Quality content',
                'Growing network',
              ],
            },
          },
        },
      };

      mockUseTimelineNode.mockReturnValue({
        data: nodeWithSummary,
        isLoading: false,
      } as any);
      mockUseBrandBuildingActivities.mockReturnValue({
        activities,
        isLoading: false,
      } as any);

      render(<BrandBuildingChapter />);

      expect(
        screen.getByText('Great LinkedIn presence with engaging content.')
      ).toBeInTheDocument();
      expect(
        screen.getByText('Key strengths on LinkedIn:')
      ).toBeInTheDocument();
      expect(screen.getByText('Active engagement')).toBeInTheDocument();
      expect(screen.getByText('Quality content')).toBeInTheDocument();
      expect(screen.getByText('Growing network')).toBeInTheDocument();
    });

    it('should show placeholder when summary is not available', () => {
      const activities = [
        {
          id: '1',
          platform: 'LinkedIn' as BrandPlatform,
          profileUrl: 'https://linkedin.com/in/johndoe',
          screenshots: [],
          timestamp: '2024-01-15T12:00:00Z',
        },
      ];

      mockUseTimelineNode.mockReturnValue({
        data: baseNode,
        isLoading: false,
      } as any);
      mockUseBrandBuildingActivities.mockReturnValue({
        activities,
        isLoading: false,
      } as any);

      render(<BrandBuildingChapter />);

      expect(
        screen.getByText(
          'Summary will be generated after activities are added.'
        )
      ).toBeInTheDocument();
    });
  });
});
