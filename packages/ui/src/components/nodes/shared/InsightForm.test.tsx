/**
 * InsightForm Unit Tests
 *
 * Functional tests for insight creation and editing
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InsightForm } from './InsightForm';
import { NodeInsight } from '@journey/schema';

// Mock dependencies
const mockOnClose = vi.fn();
const mockOnSuccess = vi.fn();
const mockMutateAsync = vi.fn();

vi.mock('../../../hooks/useNodeInsights', () => ({
  useCreateInsight: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
  useUpdateInsight: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

describe('InsightForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Create Mode', () => {
    it('should render form in create mode', () => {
      render(
        <InsightForm
          nodeId="job-1"
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.getByText('Add New Insight')).toBeInTheDocument();
      expect(screen.getByLabelText(/share your insight/i)).toBeInTheDocument();
      expect(screen.getByText('Save Insight')).toBeInTheDocument();
    });

    it('should show character count', () => {
      render(
        <InsightForm
          nodeId="job-1"
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.getByText('0/2000 characters')).toBeInTheDocument();
    });

    it('should update character count as user types', async () => {
      const user = userEvent.setup();

      render(
        <InsightForm
          nodeId="job-1"
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const textarea = screen.getByLabelText(/share your insight/i);
      await user.type(textarea, 'Test insight');

      expect(screen.getByText('12/2000 characters')).toBeInTheDocument();
    });

    it('should disable save button when description is empty', () => {
      render(
        <InsightForm
          nodeId="job-1"
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const saveButton = screen.getByText('Save Insight').closest('button');
      expect(saveButton).toBeDisabled();
    });

    it('should enable save button when description is provided', async () => {
      const user = userEvent.setup();

      render(
        <InsightForm
          nodeId="job-1"
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const textarea = screen.getByLabelText(/share your insight/i);
      await user.type(textarea, 'This is my insight');

      const saveButton = screen.getByText('Save Insight');
      expect(saveButton).not.toBeDisabled();
    });
  });

  describe('Edit Mode', () => {
    const mockInsight: NodeInsight = {
      id: 1,
      nodeId: 'job-1',
      description: 'Original insight text',
      resources: ['https://example.com'],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should render form in edit mode with existing data', () => {
      render(
        <InsightForm
          nodeId="job-1"
          insight={mockInsight}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.getByText('Edit Insight')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Original insight text')).toBeInTheDocument();
      expect(screen.getByText('https://example.com')).toBeInTheDocument();
      expect(screen.getByText('Update')).toBeInTheDocument();
    });

    it('should show existing resources', () => {
      render(
        <InsightForm
          nodeId="job-1"
          insight={mockInsight}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.getByText('https://example.com')).toBeInTheDocument();
    });
  });

  describe('Resources Management', () => {
    it('should allow adding a resource', async () => {
      const user = userEvent.setup();

      render(
        <InsightForm
          nodeId="job-1"
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const resourceInput = screen.getByPlaceholderText(/URL, book reference/i);
      await user.type(resourceInput, 'https://test.com');

      const addButton = screen.getByRole('button', { name: '' }); // RippleButton with Plus icon
      await user.click(addButton);

      expect(screen.getByText('https://test.com')).toBeInTheDocument();
      expect(resourceInput).toHaveValue('');
    });

  });

  describe('Form Actions', () => {
    it('should call onClose when cancel is clicked', async () => {
      const user = userEvent.setup();

      render(
        <InsightForm
          nodeId="job-1"
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const cancelButton = screen.getByText('Cancel');
      await user.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalledOnce();
    });

    it('should submit form with valid data', async () => {
      const user = userEvent.setup();
      mockMutateAsync.mockResolvedValue({});

      render(
        <InsightForm
          nodeId="job-1"
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const textarea = screen.getByLabelText(/share your insight/i);
      await user.type(textarea, 'My new insight');

      const saveButton = screen.getByText('Save Insight');
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith({
          description: 'My new insight',
          resources: [],
        });
      });
    });
  });
});
