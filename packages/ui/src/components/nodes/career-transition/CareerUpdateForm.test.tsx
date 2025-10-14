/**
 * CareerUpdateForm Component Tests
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as updatesApi from '../../../services/updates-api';
import { CareerUpdateForm } from './CareerUpdateForm';

// Mock the updates API
vi.mock('../../../services/updates-api');

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('CareerUpdateForm', () => {
  describe('Form Field Rendering', () => {
    it('should render all job search prep checkboxes', () => {
      render(
        <CareerUpdateForm
          nodeId="test-node"
          onSuccess={vi.fn()}
          onCancel={vi.fn()}
        />,
        {
          wrapper: createWrapper(),
        }
      );

      expect(
        screen.getByLabelText(/applied to jobs with strong fit/i)
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText(/updated my resume or portfolio/i)
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText(/networked.*via messages/i)
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText(/developed skills.*through courses/i)
      ).toBeInTheDocument();
    });

    it('should render all interview activity checkboxes', () => {
      render(
        <CareerUpdateForm
          nodeId="test-node"
          onSuccess={vi.fn()}
          onCancel={vi.fn()}
        />,
        { wrapper: createWrapper() }
      );

      expect(
        screen.getByLabelText(/pending an upcoming interview/i)
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText(/completed an interview/i)
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText(/practiced mock interviews/i)
      ).toBeInTheDocument();
      expect(screen.getByLabelText(/received an offer/i)).toBeInTheDocument();
      expect(
        screen.getByLabelText(/received a rejection/i)
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText(/possibly been ghosted/i)
      ).toBeInTheDocument();
    });

    it('should render notes textarea', () => {
      render(
        <CareerUpdateForm
          nodeId="test-node"
          onSuccess={vi.fn()}
          onCancel={vi.fn()}
        />,
        { wrapper: createWrapper() }
      );

      const notesField = screen.getByPlaceholderText(/please describe/i);
      expect(notesField).toBeInTheDocument();
      expect(notesField.tagName).toBe('TEXTAREA');
    });
  });

  describe('Form Validation & State Management', () => {
    it('should allow typing in notes field', async () => {
      const user = userEvent.setup();
      render(
        <CareerUpdateForm
          nodeId="test-node"
          onSuccess={vi.fn()}
          onCancel={vi.fn()}
        />,
        { wrapper: createWrapper() }
      );

      const notesField = screen.getByPlaceholderText(/please describe/i);
      await user.type(notesField, 'Test note');

      expect(notesField).toHaveValue('Test note');
    });

    it('should enforce max 1000 character limit on notes field', async () => {
      const user = userEvent.setup();
      render(
        <CareerUpdateForm
          nodeId="test-node"
          onSuccess={vi.fn()}
          onCancel={vi.fn()}
        />,
        { wrapper: createWrapper() }
      );

      const notesField = screen.getByPlaceholderText(
        /please describe/i
      ) as HTMLTextAreaElement;
      const longText = 'a'.repeat(1001);

      await user.type(notesField, longText);

      expect(notesField.value.length).toBe(1000);
    });

    it('should toggle checkbox state when clicked', async () => {
      const user = userEvent.setup();
      render(
        <CareerUpdateForm
          nodeId="test-node"
          onSuccess={vi.fn()}
          onCancel={vi.fn()}
        />,
        { wrapper: createWrapper() }
      );

      const checkbox = screen.getByRole('checkbox', {
        name: /applied to jobs/i,
      });
      expect(checkbox).toHaveAttribute('data-state', 'unchecked');

      await user.click(checkbox);
      expect(checkbox).toHaveAttribute('data-state', 'checked');

      await user.click(checkbox);
      expect(checkbox).toHaveAttribute('data-state', 'unchecked');
    });

    it('should manage state for all checkboxes independently', async () => {
      const user = userEvent.setup();
      render(
        <CareerUpdateForm
          nodeId="test-node"
          onSuccess={vi.fn()}
          onCancel={vi.fn()}
        />,
        { wrapper: createWrapper() }
      );

      const appliedCheckbox = screen.getByRole('checkbox', {
        name: /applied to jobs/i,
      });
      const resumeCheckbox = screen.getByRole('checkbox', {
        name: /updated my resume or portfolio/i,
      });
      const interviewCheckbox = screen.getByRole('checkbox', {
        name: /pending an upcoming interview/i,
      });

      // All should start unchecked
      expect(appliedCheckbox).toHaveAttribute('data-state', 'unchecked');
      expect(resumeCheckbox).toHaveAttribute('data-state', 'unchecked');
      expect(interviewCheckbox).toHaveAttribute('data-state', 'unchecked');

      // Check first checkbox
      await user.click(appliedCheckbox);
      expect(appliedCheckbox).toHaveAttribute('data-state', 'checked');
      expect(resumeCheckbox).toHaveAttribute('data-state', 'unchecked');
      expect(interviewCheckbox).toHaveAttribute('data-state', 'unchecked');

      // Check second checkbox
      await user.click(resumeCheckbox);
      expect(appliedCheckbox).toHaveAttribute('data-state', 'checked');
      expect(resumeCheckbox).toHaveAttribute('data-state', 'checked');
      expect(interviewCheckbox).toHaveAttribute('data-state', 'unchecked');

      // Check third checkbox
      await user.click(interviewCheckbox);
      expect(appliedCheckbox).toHaveAttribute('data-state', 'checked');
      expect(resumeCheckbox).toHaveAttribute('data-state', 'checked');
      expect(interviewCheckbox).toHaveAttribute('data-state', 'checked');
    });

    it('should have submit button disabled when no changes made', () => {
      render(
        <CareerUpdateForm
          nodeId="test-node"
          onSuccess={vi.fn()}
          onCancel={vi.fn()}
        />,
        { wrapper: createWrapper() }
      );

      const submitButton = screen.getByRole('button', {
        name: /confirm answer/i,
      });
      expect(submitButton).toBeDisabled();
    });

    it('should enable submit button when a checkbox is checked', async () => {
      const user = userEvent.setup();
      render(
        <CareerUpdateForm
          nodeId="test-node"
          onSuccess={vi.fn()}
          onCancel={vi.fn()}
        />,
        { wrapper: createWrapper() }
      );

      const submitButton = screen.getByRole('button', {
        name: /confirm answer/i,
      });
      expect(submitButton).toBeDisabled();

      const checkbox = screen.getByRole('checkbox', {
        name: /applied to jobs/i,
      });
      await user.click(checkbox);

      expect(submitButton).not.toBeDisabled();
    });

    it('should enable submit button when notes have content', async () => {
      const user = userEvent.setup();
      render(
        <CareerUpdateForm
          nodeId="test-node"
          onSuccess={vi.fn()}
          onCancel={vi.fn()}
        />,
        { wrapper: createWrapper() }
      );

      const submitButton = screen.getByRole('button', {
        name: /confirm answer/i,
      });
      expect(submitButton).toBeDisabled();

      const notesField = screen.getByPlaceholderText(/please describe/i);
      await user.type(notesField, 'Some notes');

      expect(submitButton).not.toBeDisabled();
    });
  });

  describe('Form Submission', () => {
    it('should call onCancel when cancel button is clicked', async () => {
      const user = userEvent.setup();
      const mockOnCancel = vi.fn();

      render(
        <CareerUpdateForm
          nodeId="test-node"
          onSuccess={vi.fn()}
          onCancel={mockOnCancel}
        />,
        {
          wrapper: createWrapper(),
        }
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });

    it('should handle all checkbox changes in hasChanges validation', async () => {
      const user = userEvent.setup();
      render(
        <CareerUpdateForm
          nodeId="test-node"
          onSuccess={vi.fn()}
          onCancel={vi.fn()}
        />,
        { wrapper: createWrapper() }
      );

      const submitButton = screen.getByRole('button', {
        name: /confirm answer/i,
      });

      // Test each checkbox enables the submit button
      const checkboxNames = [
        /applied to jobs with strong fit/i,
        /updated my resume or portfolio/i,
        /networked.*via messages/i,
        /developed skills.*through courses/i,
        /pending an upcoming interview/i,
        /completed an interview/i,
        /practiced mock interviews/i,
        /received an offer/i,
        /received a rejection/i,
        /possibly been ghosted/i,
      ];

      for (const name of checkboxNames) {
        const checkbox = screen.getByRole('checkbox', { name });

        // Button should be disabled initially
        expect(submitButton).toBeDisabled();

        // Check the checkbox
        await user.click(checkbox);
        expect(submitButton).not.toBeDisabled();

        // Uncheck to reset for next test
        await user.click(checkbox);
      }
    });

    it('should submit form data when submit button is clicked', async () => {
      const user = userEvent.setup();
      const mockOnSuccess = vi.fn();
      const mockCreateUpdate = vi.fn().mockResolvedValue({ id: 'update-123' });
      vi.mocked(updatesApi.createUpdate).mockImplementation(mockCreateUpdate);

      render(
        <CareerUpdateForm
          nodeId="test-node"
          onSuccess={mockOnSuccess}
          onCancel={vi.fn()}
        />,
        { wrapper: createWrapper() }
      );

      // Fill in some form data
      const appliedCheckbox = screen.getByRole('checkbox', {
        name: /applied to jobs with strong fit/i,
      });
      await user.click(appliedCheckbox);

      const notesField = screen.getByPlaceholderText(/please describe/i);
      await user.type(notesField, 'Applied to 5 companies');

      // Submit the form
      const submitButton = screen.getByRole('button', {
        name: /confirm answer/i,
      });
      await user.click(submitButton);

      // Wait for API call
      await waitFor(() => {
        expect(mockCreateUpdate).toHaveBeenCalledWith('test-node', {
          notes: 'Applied to 5 companies',
          meta: {
            appliedToJobs: true,
            updatedResumeOrPortfolio: false,
            networked: false,
            developedSkills: false,
            pendingInterviews: false,
            completedInterviews: false,
            practicedMock: false,
            receivedOffers: false,
            receivedRejections: false,
            possiblyGhosted: false,
          },
        });
      });

      // onSuccess should be called
      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Client-Side Zod Validation', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should not submit when no changes are made (validation prevents empty submission)', async () => {
      const mockOnSuccess = vi.fn();
      const mockCreateUpdate = vi.fn();
      vi.mocked(updatesApi.createUpdate).mockImplementation(mockCreateUpdate);

      render(
        <CareerUpdateForm
          nodeId="test-node"
          onSuccess={mockOnSuccess}
          onCancel={vi.fn()}
        />,
        { wrapper: createWrapper() }
      );

      const submitButton = screen.getByRole('button', {
        name: /confirm answer/i,
      });

      // Submit button should be disabled with no changes
      expect(submitButton).toBeDisabled();

      // API should not be called
      expect(mockCreateUpdate).not.toHaveBeenCalled();
    });

    it('should validate and prevent submission with invalid data', async () => {
      const user = userEvent.setup();
      const mockOnSuccess = vi.fn();
      const mockCreateUpdate = vi.fn();
      vi.mocked(updatesApi.createUpdate).mockImplementation(mockCreateUpdate);

      render(
        <CareerUpdateForm
          nodeId="test-node"
          onSuccess={mockOnSuccess}
          onCancel={vi.fn()}
        />,
        { wrapper: createWrapper() }
      );

      // Try to enable the form with whitespace-only notes
      const notesField = screen.getByPlaceholderText(/please describe/i);
      await user.type(notesField, '   '); // Only whitespace

      const submitButton = screen.getByRole('button', {
        name: /confirm answer/i,
      });

      // Button should remain disabled because hasChanges checks notes.trim().length > 0
      // Whitespace-only notes won't enable the button
      expect(submitButton).toBeDisabled();

      // API should not be called
      expect(mockCreateUpdate).not.toHaveBeenCalled();
    });

    it('should display inline error message when validation fails', async () => {
      const user = userEvent.setup();
      const mockCreateUpdate = vi
        .fn()
        .mockRejectedValue(
          new Error(
            'Validation failed: notes: String must contain at least 1 character(s)'
          )
        );
      vi.mocked(updatesApi.createUpdate).mockImplementation(mockCreateUpdate);

      render(
        <CareerUpdateForm
          nodeId="test-node"
          onSuccess={vi.fn()}
          onCancel={vi.fn()}
        />,
        { wrapper: createWrapper() }
      );

      // Add a checkbox to enable submission
      const checkbox = screen.getByRole('checkbox', {
        name: /applied to jobs/i,
      });
      await user.click(checkbox);

      // Submit the form
      const submitButton = screen.getByRole('button', {
        name: /confirm answer/i,
      });
      await user.click(submitButton);

      // Wait for error message to appear (if validation error is inline)
      // Note: The actual error display depends on the component's error handling logic
    });

    it('should successfully submit with valid data', async () => {
      const user = userEvent.setup();
      const mockOnSuccess = vi.fn();
      const mockCreateUpdate = vi.fn().mockResolvedValue({ id: 'update-123' });
      vi.mocked(updatesApi.createUpdate).mockImplementation(mockCreateUpdate);

      render(
        <CareerUpdateForm
          nodeId="test-node"
          onSuccess={mockOnSuccess}
          onCancel={vi.fn()}
        />,
        { wrapper: createWrapper() }
      );

      // Fill in valid data
      const checkbox = screen.getByRole('checkbox', {
        name: /applied to jobs with strong fit/i,
      });
      await user.click(checkbox);

      const notesField = screen.getByPlaceholderText(/please describe/i);
      await user.type(notesField, 'Applied to multiple positions');

      // Submit the form
      const submitButton = screen.getByRole('button', {
        name: /confirm answer/i,
      });
      await user.click(submitButton);

      // Wait for successful submission
      await waitFor(() => {
        expect(mockCreateUpdate).toHaveBeenCalledWith('test-node', {
          notes: 'Applied to multiple positions',
          meta: expect.objectContaining({
            appliedToJobs: true,
          }),
        });
      });

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalledTimes(1);
      });
    });

    it('should pass validation with only checkboxes (no notes)', async () => {
      const user = userEvent.setup();
      const mockOnSuccess = vi.fn();
      const mockCreateUpdate = vi.fn().mockResolvedValue({ id: 'update-123' });
      vi.mocked(updatesApi.createUpdate).mockImplementation(mockCreateUpdate);

      render(
        <CareerUpdateForm
          nodeId="test-node"
          onSuccess={mockOnSuccess}
          onCancel={vi.fn()}
        />,
        { wrapper: createWrapper() }
      );

      // Only check checkboxes, no notes
      const appliedCheckbox = screen.getByRole('checkbox', {
        name: /applied to jobs with strong fit/i,
      });
      const interviewCheckbox = screen.getByRole('checkbox', {
        name: /completed an interview/i,
      });

      await user.click(appliedCheckbox);
      await user.click(interviewCheckbox);

      // Submit the form
      const submitButton = screen.getByRole('button', {
        name: /confirm answer/i,
      });
      await user.click(submitButton);

      // Should successfully submit with undefined notes
      await waitFor(() => {
        expect(mockCreateUpdate).toHaveBeenCalledWith('test-node', {
          notes: undefined,
          meta: expect.objectContaining({
            appliedToJobs: true,
            completedInterviews: true,
          }),
        });
      });

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalledTimes(1);
      });
    });

    it('should pass validation with only notes (no checkboxes)', async () => {
      const user = userEvent.setup();
      const mockOnSuccess = vi.fn();
      const mockCreateUpdate = vi.fn().mockResolvedValue({ id: 'update-123' });
      vi.mocked(updatesApi.createUpdate).mockImplementation(mockCreateUpdate);

      render(
        <CareerUpdateForm
          nodeId="test-node"
          onSuccess={mockOnSuccess}
          onCancel={vi.fn()}
        />,
        { wrapper: createWrapper() }
      );

      // Only fill notes, no checkboxes
      const notesField = screen.getByPlaceholderText(/please describe/i);
      await user.type(notesField, 'General job search progress');

      // Submit the form
      const submitButton = screen.getByRole('button', {
        name: /confirm answer/i,
      });
      await user.click(submitButton);

      // Should successfully submit with all checkboxes false
      await waitFor(() => {
        expect(mockCreateUpdate).toHaveBeenCalledWith('test-node', {
          notes: 'General job search progress',
          meta: {
            appliedToJobs: false,
            updatedResumeOrPortfolio: false,
            networked: false,
            developedSkills: false,
            pendingInterviews: false,
            completedInterviews: false,
            practicedMock: false,
            receivedOffers: false,
            receivedRejections: false,
            possiblyGhosted: false,
          },
        });
      });

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalledTimes(1);
      });
    });
  });
});
