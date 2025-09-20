/**
 * Component Tests for Timeline Components
 * Tests client-specific timeline functionality, user interactions, and data rendering
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Timeline } from '../timeline/Timeline';
import { HierarchicalTimeline } from '../timeline/HierarchicalTimeline';
import { ExperienceSection } from '../timeline/ExperienceSection';

// Mock dependencies
vi.mock('@/services/http-client', () => ({
  httpClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/stores/auth-store', () => ({
  useAuthStore: () => ({
    user: {
      id: 1,
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
    },
  }),
}));

// Mock timeline store hook
vi.mock('@/hooks/useTimelineStore', () => ({
  useTimelineStore: () => ({
    nodes: mockTimelineData,
    loading: false,
    error: null,
    loadNodes: vi.fn(),
    updateNode: vi.fn(),
    deleteNode: vi.fn(),
    focusNode: vi.fn(),
    selectNode: vi.fn(),
  }),
}));

const mockTimelineData = [
  {
    id: '1',
    type: 'experience',
    title: 'Software Engineer',
    company: 'Tech Corp',
    startDate: '2023-01-01',
    endDate: '2023-12-31',
    description: 'Developed React applications',
    skills: ['React', 'TypeScript', 'Node.js'],
    isPrivate: false,
  },
  {
    id: '2',
    type: 'education',
    title: 'Computer Science Degree',
    institution: 'University',
    startDate: '2019-09-01',
    endDate: '2023-05-01',
    description: 'Bachelor of Science in Computer Science',
    skills: ['Algorithms', 'Data Structures'],
    isPrivate: false,
  },
];

const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('Timeline Components', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    vi.clearAllMocks();
  });

  describe('Timeline Component', () => {
    it('should render timeline with user data', () => {
      render(
        <TestWrapper>
          <Timeline />
        </TestWrapper>
      );

      expect(screen.getByText('Software Engineer')).toBeInTheDocument();
      expect(screen.getByText('Tech Corp')).toBeInTheDocument();
      expect(screen.getByText('Computer Science Degree')).toBeInTheDocument();
    });

    it('should display loading state', () => {
      vi.mocked(require('@/contexts/TimelineContext').useTimelineContext).mockReturnValue({
        timelineData: [],
        loading: true,
        error: null,
        refetch: vi.fn(),
      });

      render(
        <TestWrapper>
          <Timeline />
        </TestWrapper>
      );

      expect(screen.getByTestId('timeline-loading')).toBeInTheDocument();
    });

    it('should display error state', () => {
      const errorMessage = 'Failed to load timeline data';
      vi.mocked(require('@/contexts/TimelineContext').useTimelineContext).mockReturnValue({
        timelineData: [],
        loading: false,
        error: { message: errorMessage },
        refetch: vi.fn(),
      });

      render(
        <TestWrapper>
          <Timeline />
        </TestWrapper>
      );

      expect(screen.getByText(errorMessage)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    it('should handle adding new experience', async () => {
      const mockAddExperience = vi.fn();
      vi.mocked(require('@/contexts/TimelineContext').useTimelineContext).mockReturnValue({
        timelineData: mockTimelineData,
        loading: false,
        error: null,
        addExperience: mockAddExperience,
      });

      render(
        <TestWrapper>
          <Timeline />
        </TestWrapper>
      );

      const addButton = screen.getByRole('button', { name: /add experience/i });
      await user.click(addButton);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    });

    it('should filter timeline by experience type', async () => {
      render(
        <TestWrapper>
          <Timeline />
        </TestWrapper>
      );

      const filterButton = screen.getByRole('button', { name: /filter/i });
      await user.click(filterButton);

      const experienceFilter = screen.getByRole('checkbox', { name: /experience/i });
      await user.click(experienceFilter);

      expect(screen.getByText('Software Engineer')).toBeInTheDocument();
      expect(screen.queryByText('Computer Science Degree')).not.toBeInTheDocument();
    });
  });

  describe('HierarchicalTimeline Component', () => {
    const hierarchicalData = {
      groups: [
        {
          id: 'work',
          title: 'Work Experience',
          items: [mockTimelineData[0]],
        },
        {
          id: 'education',
          title: 'Education',
          items: [mockTimelineData[1]],
        },
      ],
    };

    it('should render hierarchical timeline structure', () => {
      render(
        <TestWrapper>
          <HierarchicalTimeline data={hierarchicalData} />
        </TestWrapper>
      );

      expect(screen.getByText('Work Experience')).toBeInTheDocument();
      expect(screen.getByText('Education')).toBeInTheDocument();
      expect(screen.getByText('Software Engineer')).toBeInTheDocument();
      expect(screen.getByText('Computer Science Degree')).toBeInTheDocument();
    });

    it('should allow collapsing/expanding sections', async () => {
      render(
        <TestWrapper>
          <HierarchicalTimeline data={hierarchicalData} />
        </TestWrapper>
      );

      const workSection = screen.getByRole('button', { name: /work experience/i });
      await user.click(workSection);

      await waitFor(() => {
        expect(screen.queryByText('Software Engineer')).not.toBeInTheDocument();
      });

      await user.click(workSection);

      await waitFor(() => {
        expect(screen.getByText('Software Engineer')).toBeInTheDocument();
      });
    });

    it('should handle drag and drop reordering', async () => {
      const mockReorder = vi.fn();

      render(
        <TestWrapper>
          <HierarchicalTimeline 
            data={hierarchicalData}
            onReorder={mockReorder}
            isDragEnabled={true}
          />
        </TestWrapper>
      );

      const experienceItem = screen.getByTestId('timeline-item-1');
      const educationSection = screen.getByTestId('timeline-group-education');

      fireEvent.dragStart(experienceItem);
      fireEvent.dragOver(educationSection);
      fireEvent.drop(educationSection);

      expect(mockReorder).toHaveBeenCalledWith(
        expect.objectContaining({
          itemId: '1',
          targetGroupId: 'education',
        })
      );
    });
  });

  describe('ExperienceSection Component', () => {
    const experienceData = mockTimelineData[0];

    it('should render experience details', () => {
      render(
        <TestWrapper>
          <ExperienceSection experience={experienceData} />
        </TestWrapper>
      );

      expect(screen.getByText('Software Engineer')).toBeInTheDocument();
      expect(screen.getByText('Tech Corp')).toBeInTheDocument();
      expect(screen.getByText('Developed React applications')).toBeInTheDocument();
      expect(screen.getByText('React')).toBeInTheDocument();
      expect(screen.getByText('TypeScript')).toBeInTheDocument();
    });

    it('should handle edit mode', async () => {
      const mockUpdate = vi.fn();

      render(
        <TestWrapper>
          <ExperienceSection 
            experience={experienceData}
            onUpdate={mockUpdate}
            isEditable={true}
          />
        </TestWrapper>
      );

      const editButton = screen.getByRole('button', { name: /edit/i });
      await user.click(editButton);

      expect(screen.getByDisplayValue('Software Engineer')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Tech Corp')).toBeInTheDocument();

      const titleInput = screen.getByDisplayValue('Software Engineer');
      await user.clear(titleInput);
      await user.type(titleInput, 'Senior Software Engineer');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: '1',
          title: 'Senior Software Engineer',
        })
      );
    });

    it('should handle delete confirmation', async () => {
      const mockDelete = vi.fn();

      render(
        <TestWrapper>
          <ExperienceSection 
            experience={experienceData}
            onDelete={mockDelete}
            isDeletable={true}
          />
        </TestWrapper>
      );

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/are you sure/i)).toBeInTheDocument();

      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await user.click(confirmButton);

      expect(mockDelete).toHaveBeenCalledWith('1');
    });

    it('should toggle privacy settings', async () => {
      const mockTogglePrivacy = vi.fn();

      render(
        <TestWrapper>
          <ExperienceSection 
            experience={experienceData}
            onTogglePrivacy={mockTogglePrivacy}
          />
        </TestWrapper>
      );

      const privacyToggle = screen.getByRole('switch', { name: /private/i });
      await user.click(privacyToggle);

      expect(mockTogglePrivacy).toHaveBeenCalledWith('1', true);
    });

    it('should display skills as tags', () => {
      render(
        <TestWrapper>
          <ExperienceSection experience={experienceData} />
        </TestWrapper>
      );

      experienceData.skills.forEach(skill => {
        expect(screen.getByText(skill)).toBeInTheDocument();
        expect(screen.getByText(skill)).toHaveClass('skill-tag');
      });
    });

    it('should handle skill addition', async () => {
      const mockUpdateSkills = vi.fn();

      render(
        <TestWrapper>
          <ExperienceSection 
            experience={experienceData}
            onUpdateSkills={mockUpdateSkills}
            isEditable={true}
          />
        </TestWrapper>
      );

      const addSkillButton = screen.getByRole('button', { name: /add skill/i });
      await user.click(addSkillButton);

      const skillInput = screen.getByPlaceholderText(/enter skill/i);
      await user.type(skillInput, 'Jest');
      await user.keyboard('{Enter}');

      expect(mockUpdateSkills).toHaveBeenCalledWith('1', [...experienceData.skills, 'Jest']);
    });
  });

  describe('Timeline Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(
        <TestWrapper>
          <Timeline />
        </TestWrapper>
      );

      expect(screen.getByRole('main')).toHaveAttribute('aria-label', 'Professional Timeline');
      expect(screen.getAllByRole('article')).toHaveLength(mockTimelineData.length);
    });

    it('should support keyboard navigation', async () => {
      render(
        <TestWrapper>
          <Timeline />
        </TestWrapper>
      );

      const firstItem = screen.getAllByRole('article')[0];
      firstItem.focus();

      await user.keyboard('{ArrowDown}');
      const secondItem = screen.getAllByRole('article')[1];
      expect(secondItem).toHaveFocus();

      await user.keyboard('{ArrowUp}');
      expect(firstItem).toHaveFocus();
    });

    it('should announce timeline updates to screen readers', async () => {
      const mockAnnounce = vi.fn();
      (global as any).speechSynthesis = {
        speak: mockAnnounce,
      };

      render(
        <TestWrapper>
          <Timeline />
        </TestWrapper>
      );

      const addButton = screen.getByRole('button', { name: /add experience/i });
      await user.click(addButton);

      expect(screen.getByRole('status')).toHaveTextContent(/form opened/i);
    });
  });
});