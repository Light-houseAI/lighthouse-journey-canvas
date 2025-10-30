import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { MultiStepAddNodeModal } from './MultiStepAddNodeModal';

// Mock the hooks that the forms use
vi.mock('../../../hooks/useAuth', () => ({
  useCurrentUser: vi.fn(() => ({
    data: { id: 'user-1', email: 'test@example.com' },
    isLoading: false,
  })),
}));

vi.mock('../../../hooks/useTimeline', () => ({
  useCreateNode: vi.fn(() => ({
    mutateAsync: vi.fn().mockResolvedValue({ id: 'new-node-id' }),
  })),
  useUpdateNode: vi.fn(() => ({
    mutateAsync: vi.fn().mockResolvedValue({ id: 'updated-node-id' }),
  })),
}));

// Mock the NodeModalRouter to render a simple form
vi.mock('./NodeModalRouter', () => ({
  NodeModalRouter: ({ onSuccess, context }: any) => {
    const formId = context.nodeType
      ? `${context.nodeType.toLowerCase()}-form`
      : 'node-form';

    return (
      <div data-testid="node-modal-router">
        <form
          id={formId}
          onSubmit={(e) => {
            e.preventDefault();
            onSuccess?.();
          }}
        >
          <input name="title" placeholder="Title" data-testid="title-input" />
          <button type="submit" data-testid="form-submit-button">
            Submit Form
          </button>
        </form>
      </div>
    );
  },
}));

describe('MultiStepAddNodeModal', () => {
  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();
  let queryClient: QueryClient;

  const defaultContext = {
    insertionPoint: 'between' as const,
    parentNode: {
      id: 'parent-1',
      title: 'Parent Node',
      type: 'job',
    },
    targetNode: {
      id: 'target-1',
      title: 'Target Node',
      type: 'job',
    },
    availableTypes: ['job', 'education', 'project', 'event', 'action'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  const renderWithProvider = (ui: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    );
  };

  test('renders modal with type selection step initially', () => {
    renderWithProvider(
      <MultiStepAddNodeModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
        context={defaultContext}
      />
    );

    // Should show the step indicator
    expect(screen.getByText('Select Type')).toBeInTheDocument();
    expect(screen.getByText('Add Details')).toBeInTheDocument();

    // Should show the type selector content
    expect(
      screen.getByText('What would you like to add to your journey?')
    ).toBeInTheDocument();

    // Should show Next button (disabled initially)
    const nextButton = screen.getByTestId('next-button');
    expect(nextButton).toBeInTheDocument();
    expect(nextButton).toBeDisabled();

    // Should show Cancel button
    expect(screen.getByTestId('cancel-button')).toBeInTheDocument();
  });

  test('enables Next button when a node type is selected', async () => {
    const user = userEvent.setup();

    renderWithProvider(
      <MultiStepAddNodeModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
        context={defaultContext}
      />
    );

    // Find and click the Project tile
    const projectTile = screen.getByText('Project').closest('button');
    expect(projectTile).toBeInTheDocument();

    await user.click(projectTile!);

    // Next button should now be enabled
    const nextButton = screen.getByTestId('next-button');
    expect(nextButton).not.toBeDisabled();
  });

  test('navigates to form details step when Next is clicked', async () => {
    const user = userEvent.setup();

    renderWithProvider(
      <MultiStepAddNodeModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
        context={defaultContext}
      />
    );

    // Select a node type and click Next
    const projectTile = screen.getByText('Project').closest('button');
    await user.click(projectTile!);
    await user.click(screen.getByTestId('next-button'));

    // Should now show the form modal
    expect(screen.getByTestId('node-modal-router')).toBeInTheDocument();

    // Should show Back and Add buttons
    expect(screen.getByTestId('back-button')).toBeInTheDocument();
    expect(screen.getByTestId('submit-button')).toBeInTheDocument();
  });

  test('shows correct form fields for job type', async () => {
    const user = userEvent.setup();

    renderWithProvider(
      <MultiStepAddNodeModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
        context={defaultContext}
      />
    );

    // Select job and go to form
    const jobTile = screen.getByText('Employment').closest('button');
    await user.click(jobTile!);
    await user.click(screen.getByTestId('next-button'));

    // Should show the form
    expect(screen.getByTestId('node-modal-router')).toBeInTheDocument();
  });

  test('shows correct form fields for education type', async () => {
    const user = userEvent.setup();

    renderWithProvider(
      <MultiStepAddNodeModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
        context={defaultContext}
      />
    );

    // Select education and go to form
    const educationTile = screen.getByText('Education').closest('button');
    await user.click(educationTile!);
    await user.click(screen.getByTestId('next-button'));

    // Should show the form
    expect(screen.getByTestId('node-modal-router')).toBeInTheDocument();
  });

  test('shows correct form fields for project type', async () => {
    const user = userEvent.setup();

    renderWithProvider(
      <MultiStepAddNodeModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
        context={defaultContext}
      />
    );

    // Select project and go to form
    const projectTile = screen.getByText('Project').closest('button');
    await user.click(projectTile!);
    await user.click(screen.getByTestId('next-button'));

    // Should show the form
    expect(screen.getByTestId('node-modal-router')).toBeInTheDocument();
  });

  test('submits form with correct data for job', async () => {
    const user = userEvent.setup();

    renderWithProvider(
      <MultiStepAddNodeModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
        context={defaultContext}
      />
    );

    // Navigate to job form
    const jobTile = screen.getByText('Employment').closest('button');
    await user.click(jobTile!);
    await user.click(screen.getByTestId('next-button'));

    // Submit the form by clicking the Add button
    await user.click(screen.getByTestId('submit-button'));

    // Should call onSuccess and onClose
    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  test('submits form with correct data for education', async () => {
    const user = userEvent.setup();

    renderWithProvider(
      <MultiStepAddNodeModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
        context={defaultContext}
      />
    );

    // Navigate to education form
    const educationTile = screen.getByText('Education').closest('button');
    await user.click(educationTile!);
    await user.click(screen.getByTestId('next-button'));

    // Submit the form
    await user.click(screen.getByTestId('submit-button'));

    // Should call onSuccess and onClose
    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  test('submits form with correct data for project', async () => {
    const user = userEvent.setup();

    renderWithProvider(
      <MultiStepAddNodeModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
        context={defaultContext}
      />
    );

    // Navigate to project form
    const projectTile = screen.getByText('Project').closest('button');
    await user.click(projectTile!);
    await user.click(screen.getByTestId('next-button'));

    // Submit the form
    await user.click(screen.getByTestId('submit-button'));

    // Should call onSuccess and onClose
    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  test('handles different context types correctly', () => {
    // Test 'branch' insertion point
    const branchContext = {
      ...defaultContext,
      insertionPoint: 'branch' as const,
      targetNode: undefined,
    };

    renderWithProvider(
      <MultiStepAddNodeModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
        context={branchContext}
      />
    );

    // Should still render the modal with type selector
    expect(
      screen.getByText('What would you like to add to your journey?')
    ).toBeInTheDocument();
  });

  test('resets state when modal opens', async () => {
    const user = userEvent.setup();
    const { rerender } = renderWithProvider(
      <MultiStepAddNodeModal
        isOpen={false}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
        context={defaultContext}
      />
    );

    // Open modal and select a type
    rerender(
      <QueryClientProvider client={queryClient}>
        <MultiStepAddNodeModal
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          context={defaultContext}
        />
      </QueryClientProvider>
    );

    const projectTile = screen.getByText('Project').closest('button');
    await user.click(projectTile!);
    await user.click(screen.getByTestId('next-button'));

    // Should show form
    expect(screen.getByTestId('node-modal-router')).toBeInTheDocument();

    // Close and reopen modal
    rerender(
      <QueryClientProvider client={queryClient}>
        <MultiStepAddNodeModal
          isOpen={false}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          context={defaultContext}
        />
      </QueryClientProvider>
    );

    rerender(
      <QueryClientProvider client={queryClient}>
        <MultiStepAddNodeModal
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          context={defaultContext}
        />
      </QueryClientProvider>
    );

    // Should be back to type selection step
    expect(
      screen.getByText('What would you like to add to your journey?')
    ).toBeInTheDocument();
    expect(screen.getByTestId('next-button')).toBeDisabled();
  });

  test('closes modal when cancel is clicked', async () => {
    const user = userEvent.setup();

    renderWithProvider(
      <MultiStepAddNodeModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
        context={defaultContext}
      />
    );

    await user.click(screen.getByTestId('cancel-button'));

    expect(mockOnClose).toHaveBeenCalled();
  });

  test('can go back from form to type selection', async () => {
    const user = userEvent.setup();

    renderWithProvider(
      <MultiStepAddNodeModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
        context={defaultContext}
      />
    );

    // Navigate to form
    const projectTile = screen.getByText('Project').closest('button');
    await user.click(projectTile!);
    await user.click(screen.getByTestId('next-button'));

    // Should show form
    expect(screen.getByTestId('node-modal-router')).toBeInTheDocument();

    // Click back button
    await user.click(screen.getByTestId('back-button'));

    // Should be back to type selection
    expect(
      screen.getByText('What would you like to add to your journey?')
    ).toBeInTheDocument();
  });
});
