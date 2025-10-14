/**
 * ProjectForm Unit Tests
 *
 * Functional tests for project form creation and editing
 */

import type { TimelineNode } from '@journey/schema';
import { ProjectStatus, ProjectType } from '@journey/schema';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectForm } from './ProjectModal';

// Mock dependencies
const mockCreateNode = vi.fn();
const mockUpdateNode = vi.fn();
const mockInvalidateQueries = vi.fn();

vi.mock('../../../stores/auth-store', () => ({
  useAuthStore: () => ({
    user: { id: 1, email: 'test@example.com' },
    isAuthenticated: true,
  }),
}));

vi.mock('../../../stores/hierarchy-store', () => ({
  useHierarchyStore: () => ({
    createNode: mockCreateNode,
    updateNode: mockUpdateNode,
  }),
}));

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: mockInvalidateQueries,
    }),
  };
});

vi.mock('../../../utils/error-toast', () => ({
  handleAPIError: vi.fn(),
  showSuccessToast: vi.fn(),
}));

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const renderWithClient = (component: React.ReactElement) => {
  const queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>{component}</QueryClientProvider>
  );
};

describe('ProjectForm', () => {
  const mockOnSuccess = vi.fn();
  const mockOnFailure = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateNode.mockResolvedValue({ id: 'new-id' });
    mockUpdateNode.mockResolvedValue({ id: 'updated-id' });
    mockInvalidateQueries.mockResolvedValue(undefined);
  });

  describe('Create Mode', () => {
    it('should render all required form fields', () => {
      renderWithClient(
        <ProjectForm onSuccess={mockOnSuccess} onFailure={mockOnFailure} />
      );

      expect(screen.getByLabelText(/Title/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Description/i)).toBeInTheDocument();
      expect(screen.getByText(/Project Type/i)).toBeInTheDocument();
      expect(screen.getByText(/^Status$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Start Date/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/End Date/i)).toBeInTheDocument();
    });
  });

  describe('Update Mode', () => {
    const mockNode: TimelineNode = {
      id: 'project-1',
      type: 'project',
      title: 'Test Project',
      meta: {
        title: 'Test Project',
        description: 'A test project',
        technologies: ['React', 'TypeScript'],
        projectType: ProjectType.Personal,
        status: ProjectStatus.Active,
        startDate: '2023-01',
        endDate: '2023-12',
      },
      userId: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should populate fields with existing data', () => {
      renderWithClient(
        <ProjectForm
          node={mockNode}
          onSuccess={mockOnSuccess}
          onFailure={mockOnFailure}
        />
      );

      expect(screen.getByDisplayValue('Test Project')).toBeInTheDocument();
      expect(screen.getByDisplayValue('A test project')).toBeInTheDocument();
      expect(screen.getByDisplayValue('2023-01')).toBeInTheDocument();
      expect(screen.getByDisplayValue('2023-12')).toBeInTheDocument();
    });
  });

  describe('Form Interaction', () => {
    it('should update field values when typing', async () => {
      const user = userEvent.setup();

      renderWithClient(
        <ProjectForm onSuccess={mockOnSuccess} onFailure={mockOnFailure} />
      );

      const titleInput = screen.getByLabelText(/Title/i);
      await user.type(titleInput, 'New Project');

      expect(titleInput).toHaveValue('New Project');
    });

    it('should update all text fields', async () => {
      const user = userEvent.setup();

      renderWithClient(
        <ProjectForm onSuccess={mockOnSuccess} onFailure={mockOnFailure} />
      );

      await user.type(screen.getByLabelText(/Title/i), 'My Project');
      await user.type(
        screen.getByLabelText(/Description/i),
        'Project description'
      );

      expect(screen.getByLabelText(/Title/i)).toHaveValue('My Project');
      expect(screen.getByLabelText(/Description/i)).toHaveValue(
        'Project description'
      );
    });
  });

  describe('Date Fields', () => {
    it('should accept date in YYYY-MM format', async () => {
      const user = userEvent.setup();

      renderWithClient(
        <ProjectForm onSuccess={mockOnSuccess} onFailure={mockOnFailure} />
      );

      const startDateInput = screen.getByLabelText(/Start Date/i);
      await user.type(startDateInput, '2023-01');

      expect(startDateInput).toHaveValue('2023-01');
    });

    it('should render both start and end date fields', () => {
      renderWithClient(
        <ProjectForm onSuccess={mockOnSuccess} onFailure={mockOnFailure} />
      );

      const startDate = screen.getByLabelText(/Start Date/i);
      const endDate = screen.getByLabelText(/End Date/i);

      expect(startDate).toBeInTheDocument();
      expect(endDate).toBeInTheDocument();
      expect(startDate).toHaveAttribute('pattern', '\\d{4}-\\d{2}');
      expect(endDate).toHaveAttribute('pattern', '\\d{4}-\\d{2}');
    });
  });
});
