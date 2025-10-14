/**
 * EducationForm Unit Tests
 *
 * Functional tests for education form creation and editing
 */

import type { TimelineNode } from '@journey/schema';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EducationForm } from './EducationModal';

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

describe('EducationForm', () => {
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
        <EducationForm onSuccess={mockOnSuccess} onFailure={mockOnFailure} />
      );

      expect(screen.getByText(/Institution/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Degree/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Field of Study/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Location/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Description/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Start Date/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/End Date/i)).toBeInTheDocument();
    });
  });

  describe('Update Mode', () => {
    const mockNode: TimelineNode = {
      id: 'edu-1',
      type: 'education',
      title: 'Test University',
      meta: {
        orgId: 1,
        degree: 'Bachelor of Science',
        field: 'Computer Science',
        location: 'Test City',
        description: 'Great education',
        startDate: '2010-09',
        endDate: '2014-05',
      },
      userId: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should populate fields with existing data', () => {
      renderWithClient(
        <EducationForm
          node={mockNode}
          onSuccess={mockOnSuccess}
          onFailure={mockOnFailure}
        />
      );

      expect(
        screen.getByDisplayValue('Bachelor of Science')
      ).toBeInTheDocument();
      expect(screen.getByDisplayValue('Computer Science')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test City')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Great education')).toBeInTheDocument();
      expect(screen.getByDisplayValue('2010-09')).toBeInTheDocument();
      expect(screen.getByDisplayValue('2014-05')).toBeInTheDocument();
    });
  });

  describe('Form Interaction', () => {
    it('should update field values when typing', async () => {
      const user = userEvent.setup();

      renderWithClient(
        <EducationForm onSuccess={mockOnSuccess} onFailure={mockOnFailure} />
      );

      const degreeInput = screen.getByLabelText(/Degree/i);
      await user.type(degreeInput, 'Master of Science');

      expect(degreeInput).toHaveValue('Master of Science');
    });

    it('should update all text fields', async () => {
      const user = userEvent.setup();

      renderWithClient(
        <EducationForm onSuccess={mockOnSuccess} onFailure={mockOnFailure} />
      );

      await user.type(screen.getByLabelText(/Degree/i), 'PhD');
      await user.type(screen.getByLabelText(/Field of Study/i), 'Physics');
      await user.type(screen.getByLabelText(/Location/i), 'Boston, MA');
      await user.type(
        screen.getByLabelText(/Description/i),
        'Advanced studies'
      );

      expect(screen.getByLabelText(/Degree/i)).toHaveValue('PhD');
      expect(screen.getByLabelText(/Field of Study/i)).toHaveValue('Physics');
      expect(screen.getByLabelText(/Location/i)).toHaveValue('Boston, MA');
      expect(screen.getByLabelText(/Description/i)).toHaveValue(
        'Advanced studies'
      );
    });
  });

  describe('Date Fields', () => {
    it('should accept date in YYYY-MM format', async () => {
      const user = userEvent.setup();

      renderWithClient(
        <EducationForm onSuccess={mockOnSuccess} onFailure={mockOnFailure} />
      );

      const startDateInput = screen.getByLabelText(/Start Date/i);
      await user.type(startDateInput, '2020-09');

      expect(startDateInput).toHaveValue('2020-09');
    });

    it('should render both start and end date fields', () => {
      renderWithClient(
        <EducationForm onSuccess={mockOnSuccess} onFailure={mockOnFailure} />
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
