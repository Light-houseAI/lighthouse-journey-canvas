/**
 * ActionForm Unit Tests
 *
 * Functional tests for action form creation and editing
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ActionForm } from './ActionModal';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { TimelineNode } from '@journey/schema';

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
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  );
};

describe('ActionForm', () => {
  const mockOnSuccess = vi.fn();
  const mockOnFailure = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateNode.mockResolvedValue({ id: 'new-id' });
    mockUpdateNode.mockResolvedValue({ id: 'updated-id' });
    mockInvalidateQueries.mockResolvedValue(undefined);
  });

  describe('Create Mode', () => {
    it('should render create form with correct title', () => {
      renderWithClient(
        <ActionForm onSuccess={mockOnSuccess} onFailure={mockOnFailure} />
      );

      expect(screen.getByRole('heading', { name: 'Add Action' })).toBeInTheDocument();
    });

    it('should render all required form fields', () => {
      renderWithClient(
        <ActionForm onSuccess={mockOnSuccess} onFailure={mockOnFailure} />
      );

      expect(screen.getByLabelText(/Title/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Description/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Start Date/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/End Date/i)).toBeInTheDocument();
    });

    it('should have submit button', () => {
      renderWithClient(
        <ActionForm onSuccess={mockOnSuccess} onFailure={mockOnFailure} />
      );

      const submitButton = screen.getByTestId('submit-button');
      expect(submitButton).toBeInTheDocument();
      expect(submitButton).toHaveTextContent('Add Action');
    });
  });

  describe('Update Mode', () => {
    const mockNode: TimelineNode = {
      id: 'action-1',
      type: 'action',
      title: 'Test Action',
      meta: {
        title: 'Test Action',
        description: 'A test action',
        startDate: '2023-01',
        endDate: '2023-12',
      },
      userId: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should render update form with correct title', () => {
      renderWithClient(
        <ActionForm
          node={mockNode}
          onSuccess={mockOnSuccess}
          onFailure={mockOnFailure}
        />
      );

      expect(screen.getByText('Edit Action')).toBeInTheDocument();
    });

    it('should populate fields with existing data', () => {
      renderWithClient(
        <ActionForm
          node={mockNode}
          onSuccess={mockOnSuccess}
          onFailure={mockOnFailure}
        />
      );

      expect(screen.getByDisplayValue('Test Action')).toBeInTheDocument();
      expect(screen.getByDisplayValue('A test action')).toBeInTheDocument();
      expect(screen.getByDisplayValue('2023-01')).toBeInTheDocument();
      expect(screen.getByDisplayValue('2023-12')).toBeInTheDocument();
    });

    it('should show update button text', () => {
      renderWithClient(
        <ActionForm
          node={mockNode}
          onSuccess={mockOnSuccess}
          onFailure={mockOnFailure}
        />
      );

      expect(screen.getByText('Update Action')).toBeInTheDocument();
    });
  });

  describe('Form Interaction', () => {
    it('should update field values when typing', async () => {
      const user = userEvent.setup();

      renderWithClient(
        <ActionForm onSuccess={mockOnSuccess} onFailure={mockOnFailure} />
      );

      const titleInput = screen.getByLabelText(/Title/i);
      await user.type(titleInput, 'New Action');

      expect(titleInput).toHaveValue('New Action');
    });

    it('should update all text fields', async () => {
      const user = userEvent.setup();

      renderWithClient(
        <ActionForm onSuccess={mockOnSuccess} onFailure={mockOnFailure} />
      );

      await user.type(screen.getByLabelText(/Title/i), 'My Action');
      await user.type(screen.getByLabelText(/Description/i), 'Action description');

      expect(screen.getByLabelText(/Title/i)).toHaveValue('My Action');
      expect(screen.getByLabelText(/Description/i)).toHaveValue('Action description');
    });
  });

  describe('Form Validation', () => {
    it('should have submit button of type submit', () => {
      renderWithClient(
        <ActionForm onSuccess={mockOnSuccess} onFailure={mockOnFailure} />
      );

      const submitButton = screen.getByTestId('submit-button');
      expect(submitButton).toHaveAttribute('type', 'submit');
    });
  });

  describe('Date Fields', () => {
    it('should accept date in YYYY-MM format', async () => {
      const user = userEvent.setup();

      renderWithClient(
        <ActionForm onSuccess={mockOnSuccess} onFailure={mockOnFailure} />
      );

      const startDateInput = screen.getByLabelText(/Start Date/i);
      await user.type(startDateInput, '2023-01');

      expect(startDateInput).toHaveValue('2023-01');
    });

    it('should render both start and end date fields', () => {
      renderWithClient(
        <ActionForm onSuccess={mockOnSuccess} onFailure={mockOnFailure} />
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
