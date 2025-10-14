/**
 * CareerUpdateWizard Component Tests
 *
 * Tests the multi-step wizard flow for career updates.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as updatesApi from '../../../../services/updates-api';
import { CareerUpdateWizard } from './CareerUpdateWizard';

// Mock the updates API
vi.mock('../../../../services/updates-api');

// Mock wouter
vi.mock('wouter', () => ({
  useLocation: vi.fn(() => ['/current-path', vi.fn()]),
}));

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

describe('CareerUpdateWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Step 1: Activity Selection', () => {
    it('should render activity selection step initially', () => {
      render(
        <CareerUpdateWizard
          nodeId="test-node"
          onSuccess={vi.fn()}
          onCancel={vi.fn()}
        />,
        { wrapper: createWrapper() }
      );

      // Should show step indicator
      expect(
        screen.getByText(/step 1.*confirm activities/i)
      ).toBeInTheDocument();

      // Should show main question
      expect(
        screen.getByText(/what's new in your job search journey/i)
      ).toBeInTheDocument();

      // Should show checkbox for application/interview progress
      expect(
        screen.getByLabelText(/application or interview progress/i)
      ).toBeInTheDocument();
    });

    it('should show Confirm answer button', () => {
      render(
        <CareerUpdateWizard
          nodeId="test-node"
          onSuccess={vi.fn()}
          onCancel={vi.fn()}
        />,
        { wrapper: createWrapper() }
      );

      // Should have Confirm answer button
      expect(
        screen.getByRole('button', { name: /confirm answer/i })
      ).toBeInTheDocument();
    });

    it('should have Confirm answer button disabled when no activities selected', () => {
      render(
        <CareerUpdateWizard
          nodeId="test-node"
          onSuccess={vi.fn()}
          onCancel={vi.fn()}
        />,
        { wrapper: createWrapper() }
      );

      const confirmButton = screen.getByRole('button', {
        name: /confirm answer/i,
      });
      expect(confirmButton).toBeDisabled();
    });

    it('should enable Confirm answer button when activity is selected', async () => {
      const user = userEvent.setup();
      render(
        <CareerUpdateWizard
          nodeId="test-node"
          onSuccess={vi.fn()}
          onCancel={vi.fn()}
        />,
        { wrapper: createWrapper() }
      );

      const confirmButton = screen.getByRole('button', {
        name: /confirm answer/i,
      });
      expect(confirmButton).toBeDisabled();

      const checkbox = screen.getByRole('checkbox', {
        name: /application or interview progress/i,
      });
      await user.click(checkbox);

      expect(confirmButton).not.toBeDisabled();
    });

    it('should call onCancel when cancel button is clicked', async () => {
      const user = userEvent.setup();
      const mockOnCancel = vi.fn();

      render(
        <CareerUpdateWizard
          nodeId="test-node"
          onSuccess={vi.fn()}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      );

      const cancelButton = screen.getByRole('button', {
        name: /cancel update/i,
      });
      await user.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('Step Navigation', () => {
    it('should advance to Applied To Jobs step when selected', async () => {
      const user = userEvent.setup();
      render(
        <CareerUpdateWizard
          nodeId="test-node"
          onSuccess={vi.fn()}
          onCancel={vi.fn()}
        />,
        { wrapper: createWrapper() }
      );

      // Select "Application or interview progress" checkbox
      const appliedCheckbox = screen.getByRole('checkbox', {
        name: /application or interview progress/i,
      });
      await user.click(appliedCheckbox);

      // Click Confirm answer
      const confirmButton = screen.getByRole('button', {
        name: /confirm answer/i,
      });
      await user.click(confirmButton);

      // Should advance to step 2
      await waitFor(() => {
        expect(
          screen.getByText(/step 2 of 2.*applied to jobs/i)
        ).toBeInTheDocument();
      });
    });

    it('should advance to Resume Update step when selected', async () => {
      const user = userEvent.setup();
      render(
        <CareerUpdateWizard
          nodeId="test-node"
          onSuccess={vi.fn()}
          onCancel={vi.fn()}
        />,
        { wrapper: createWrapper() }
      );

      // Select "Updated resume" checkbox
      const resumeCheckbox = screen.getByRole('checkbox', {
        name: /updated my resume or portfolio/i,
      });
      await user.click(resumeCheckbox);

      // Click Confirm answer
      const confirmButton = screen.getByRole('button', {
        name: /confirm answer/i,
      });
      await user.click(confirmButton);

      // Should advance to step 2
      await waitFor(() => {
        expect(
          screen.getByText(/step 2 of 2.*resume\/portfolio update/i)
        ).toBeInTheDocument();
      });
    });

    it('should advance to Networking step when selected', async () => {
      const user = userEvent.setup();
      render(
        <CareerUpdateWizard
          nodeId="test-node"
          onSuccess={vi.fn()}
          onCancel={vi.fn()}
        />,
        { wrapper: createWrapper() }
      );

      // Select "Networked" checkbox
      const networkingCheckbox = screen.getByRole('checkbox', {
        name: /networked.*via messages/i,
      });
      await user.click(networkingCheckbox);

      // Click Confirm answer
      const confirmButton = screen.getByRole('button', {
        name: /confirm answer/i,
      });
      await user.click(confirmButton);

      // Should advance to step 2
      await waitFor(() => {
        expect(
          screen.getByText(/step 2 of 2.*networking/i)
        ).toBeInTheDocument();
      });
    });

    it('should advance to Skill Development step when selected', async () => {
      const user = userEvent.setup();
      render(
        <CareerUpdateWizard
          nodeId="test-node"
          onSuccess={vi.fn()}
          onCancel={vi.fn()}
        />,
        { wrapper: createWrapper() }
      );

      // Select "Developed skills" checkbox
      const skillsCheckbox = screen.getByRole('checkbox', {
        name: /developed skills.*through courses/i,
      });
      await user.click(skillsCheckbox);

      // Click Confirm answer
      const confirmButton = screen.getByRole('button', {
        name: /confirm answer/i,
      });
      await user.click(confirmButton);

      // Should advance to step 2
      await waitFor(() => {
        expect(
          screen.getByText(/step 2 of 2.*skill development/i)
        ).toBeInTheDocument();
      });
    });

    it('should advance to Interview Activity step when interview checkbox selected', async () => {
      const user = userEvent.setup();
      render(
        <CareerUpdateWizard
          nodeId="test-node"
          onSuccess={vi.fn()}
          onCancel={vi.fn()}
        />,
        { wrapper: createWrapper() }
      );

      // Select "Pending interview" checkbox
      const interviewCheckbox = screen.getByRole('checkbox', {
        name: /pending an upcoming interview/i,
      });
      await user.click(interviewCheckbox);

      // Click Confirm answer
      const confirmButton = screen.getByRole('button', {
        name: /confirm answer/i,
      });
      await user.click(confirmButton);

      // Should advance to Interview Activity step
      await waitFor(() => {
        expect(
          screen.getByText(/step 2 of 2.*interview activity/i)
        ).toBeInTheDocument();
      });
    });

    it('should show multiple steps when multiple activities selected', async () => {
      const user = userEvent.setup();
      render(
        <CareerUpdateWizard
          nodeId="test-node"
          onSuccess={vi.fn()}
          onCancel={vi.fn()}
        />,
        { wrapper: createWrapper() }
      );

      // Select two checkboxes
      await user.click(
        screen.getByRole('checkbox', { name: /applied to jobs/i })
      );
      await user.click(
        screen.getByRole('checkbox', {
          name: /updated my resume or portfolio/i,
        })
      );

      // Click Confirm answer
      const confirmButton = screen.getByRole('button', {
        name: /confirm answer/i,
      });
      await user.click(confirmButton);

      // Should show step 2 of 3 (activity selection + 2 follow-up steps)
      await waitFor(() => {
        expect(screen.getByText(/step 2 of 3/i)).toBeInTheDocument();
      });
    });

    it('should allow going back to previous step', async () => {
      const user = userEvent.setup();
      render(
        <CareerUpdateWizard
          nodeId="test-node"
          onSuccess={vi.fn()}
          onCancel={vi.fn()}
        />,
        { wrapper: createWrapper() }
      );

      // Go to step 2
      await user.click(
        screen.getByRole('checkbox', { name: /applied to jobs/i })
      );
      await user.click(screen.getByRole('button', { name: /confirm answer/i }));

      await waitFor(() => {
        expect(screen.getByText(/step 2 of 2/i)).toBeInTheDocument();
      });

      // Click Back button
      const backButton = screen.getByRole('button', { name: /back/i });
      await user.click(backButton);

      // Should be back at step 1
      await waitFor(() => {
        expect(
          screen.getByText(/step 1.*confirm activities/i)
        ).toBeInTheDocument();
        expect(
          screen.getByText(/what's new in your job search journey/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe('Form Submission', () => {
    it('should submit with only activity flags when no follow-up steps', async () => {
      const user = userEvent.setup();
      const mockOnSuccess = vi.fn();
      const mockCreateUpdate = vi.fn().mockResolvedValue({ id: 'update-123' });
      vi.mocked(updatesApi.createUpdate).mockImplementation(mockCreateUpdate);

      render(
        <CareerUpdateWizard
          nodeId="test-node"
          onSuccess={mockOnSuccess}
          onCancel={vi.fn()}
        />,
        { wrapper: createWrapper() }
      );

      // Select activity
      await user.click(
        screen.getByRole('checkbox', { name: /applied to jobs/i })
      );

      // Continue to next step
      await user.click(screen.getByRole('button', { name: /confirm answer/i }));

      // Click Finish or Continue on the Applied To Jobs step
      await waitFor(() => {
        expect(screen.getByText(/step 2 of 2/i)).toBeInTheDocument();
      });

      const finishButton = screen.getByRole('button', {
        name: /(finish|continue)/i,
      });
      await user.click(finishButton);

      // Should submit with correct data
      await waitFor(() => {
        expect(mockCreateUpdate).toHaveBeenCalledWith('test-node', {
          notes: undefined,
          meta: expect.objectContaining({
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
          }),
        });
      });

      // Should show success screen instead of calling onSuccess directly
      await waitFor(() => {
        expect(
          screen.getByText(/Successfully added update!/i)
        ).toBeInTheDocument();
      });
    });

    it('should submit with all selected activities', async () => {
      const user = userEvent.setup();
      const mockOnSuccess = vi.fn();
      const mockCreateUpdate = vi.fn().mockResolvedValue({ id: 'update-123' });
      vi.mocked(updatesApi.createUpdate).mockImplementation(mockCreateUpdate);

      render(
        <CareerUpdateWizard
          nodeId="test-node"
          onSuccess={mockOnSuccess}
          onCancel={vi.fn()}
        />,
        { wrapper: createWrapper() }
      );

      // Select multiple activities
      await user.click(
        screen.getByRole('checkbox', { name: /applied to jobs/i })
      );
      await user.click(
        screen.getByRole('checkbox', {
          name: /updated my resume or portfolio/i,
        })
      );
      await user.click(
        screen.getByRole('checkbox', { name: /pending an upcoming interview/i })
      );

      // Continue through wizard
      await user.click(screen.getByRole('button', { name: /confirm answer/i }));

      // Navigate through all steps
      await waitFor(() => {
        expect(screen.getByText(/step 2 of 4/i)).toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByText(/step 3 of 4/i)).toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByText(/step 4 of 4/i)).toBeInTheDocument();
      });

      // Finish
      const finishButton = screen.getByRole('button', {
        name: /(finish|continue)/i,
      });
      await user.click(finishButton);

      // Should submit with all activities
      await waitFor(() => {
        expect(mockCreateUpdate).toHaveBeenCalledWith('test-node', {
          notes: undefined,
          meta: expect.objectContaining({
            appliedToJobs: true,
            updatedResumeOrPortfolio: true,
            pendingInterviews: true,
          }),
        });
      });

      // Should show success screen
      await waitFor(() => {
        expect(
          screen.getByText(/Successfully added update!/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe('Interview Activity Step', () => {
    it('should show interview activity step with table', async () => {
      const user = userEvent.setup();
      render(
        <CareerUpdateWizard
          nodeId="test-node"
          onSuccess={vi.fn()}
          onCancel={vi.fn()}
        />,
        { wrapper: createWrapper() }
      );

      // Select interview checkbox
      await user.click(
        screen.getByRole('checkbox', { name: /pending an upcoming interview/i })
      );
      await user.click(screen.getByRole('button', { name: /confirm answer/i }));

      // Should show Interview Activity step
      await waitFor(() => {
        expect(
          screen.getByText(/step 2 of 2.*interview activity/i)
        ).toBeInTheDocument();
        expect(
          screen.getByText(/track your interview progress/i)
        ).toBeInTheDocument();
      });

      // Should show Add Interview button
      expect(
        screen.getByRole('button', { name: /add interview/i })
      ).toBeInTheDocument();
    });

    it('should show empty state when no interviews added', async () => {
      const user = userEvent.setup();
      render(
        <CareerUpdateWizard
          nodeId="test-node"
          onSuccess={vi.fn()}
          onCancel={vi.fn()}
        />,
        { wrapper: createWrapper() }
      );

      // Navigate to Interview Activity step
      await user.click(
        screen.getByRole('checkbox', { name: /completed an interview/i })
      );
      await user.click(screen.getByRole('button', { name: /confirm answer/i }));

      await waitFor(() => {
        expect(
          screen.getByText(/no interviews added yet/i)
        ).toBeInTheDocument();
      });
    });

    it('should open add interview modal when Add Interview button clicked', async () => {
      const user = userEvent.setup();
      render(
        <CareerUpdateWizard
          nodeId="test-node"
          onSuccess={vi.fn()}
          onCancel={vi.fn()}
        />,
        { wrapper: createWrapper() }
      );

      // Navigate to Interview Activity step
      await user.click(
        screen.getByRole('checkbox', { name: /pending an upcoming interview/i })
      );
      await user.click(screen.getByRole('button', { name: /confirm answer/i }));

      await waitFor(() => {
        expect(
          screen.getByText(/track your interview progress/i)
        ).toBeInTheDocument();
      });

      // Click Add Interview button
      const addButton = screen.getByRole('button', { name: /add interview/i });
      await user.click(addButton);

      // Should show modal
      await waitFor(() => {
        expect(
          screen.getByRole('heading', { name: /add interview/i })
        ).toBeInTheDocument();
        expect(screen.getByLabelText(/company \*/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/position \*/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/stage \*/i)).toBeInTheDocument();
      });
    });

    it('should add interview to table when form is submitted', async () => {
      const user = userEvent.setup();
      render(
        <CareerUpdateWizard
          nodeId="test-node"
          onSuccess={vi.fn()}
          onCancel={vi.fn()}
        />,
        { wrapper: createWrapper() }
      );

      // Navigate to Interview Activity step
      await user.click(
        screen.getByRole('checkbox', { name: /pending an upcoming interview/i })
      );
      await user.click(screen.getByRole('button', { name: /confirm answer/i }));

      await waitFor(() => {
        expect(
          screen.getByText(/track your interview progress/i)
        ).toBeInTheDocument();
      });

      // Open modal
      await user.click(screen.getByRole('button', { name: /add interview/i }));

      // Fill form
      await waitFor(() => {
        expect(screen.getByLabelText(/company \*/i)).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/company \*/i), 'Google');
      await user.type(
        screen.getByLabelText(/position \*/i),
        'Software Engineer'
      );
      await user.type(screen.getByLabelText(/stage \*/i), 'Technical Round');
      await user.type(screen.getByLabelText(/date \*/i), '2025-10-15');

      // Submit form
      const submitButtons = screen.getAllByRole('button', {
        name: /add interview/i,
      });
      // The modal submit button is the last one
      await user.click(submitButtons[submitButtons.length - 1]);

      // Should show in table
      await waitFor(() => {
        expect(screen.getByText('Google')).toBeInTheDocument();
        expect(screen.getByText('Software Engineer')).toBeInTheDocument();
        expect(screen.getByText('Technical Round')).toBeInTheDocument();
      });
    });

    it('should edit interview when edit button clicked', async () => {
      const user = userEvent.setup();
      render(
        <CareerUpdateWizard
          nodeId="test-node"
          onSuccess={vi.fn()}
          onCancel={vi.fn()}
        />,
        { wrapper: createWrapper() }
      );

      // Navigate and add interview
      await user.click(
        screen.getByRole('checkbox', { name: /pending an upcoming interview/i })
      );
      await user.click(screen.getByRole('button', { name: /confirm answer/i }));

      await waitFor(() => {
        expect(
          screen.getByText(/track your interview progress/i)
        ).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /add interview/i }));

      await waitFor(() => {
        expect(screen.getByLabelText(/company \*/i)).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/company \*/i), 'Google');
      await user.type(
        screen.getByLabelText(/position \*/i),
        'Software Engineer'
      );
      await user.type(screen.getByLabelText(/stage \*/i), 'Technical Round');
      await user.type(screen.getByLabelText(/date \*/i), '2025-10-15');

      const submitButtons = screen.getAllByRole('button', {
        name: /add interview/i,
      });
      await user.click(submitButtons[submitButtons.length - 1]);

      await waitFor(() => {
        expect(screen.getByText('Google')).toBeInTheDocument();
      });

      // Click edit button
      const editButton = screen.getByRole('button', {
        name: /edit interview/i,
      });
      await user.click(editButton);

      // Should show edit modal
      await waitFor(() => {
        expect(
          screen.getByRole('heading', { name: /edit interview/i })
        ).toBeInTheDocument();
      });

      // Change company name
      const companyInput = screen.getByLabelText(/company \*/i);
      await user.clear(companyInput);
      await user.type(companyInput, 'Meta');

      // Save changes
      await user.click(screen.getByRole('button', { name: /save changes/i }));

      // Should show updated value
      await waitFor(() => {
        expect(screen.getByText('Meta')).toBeInTheDocument();
        expect(screen.queryByText('Google')).not.toBeInTheDocument();
      });
    });

    it('should delete interview when delete button clicked', async () => {
      const user = userEvent.setup();
      render(
        <CareerUpdateWizard
          nodeId="test-node"
          onSuccess={vi.fn()}
          onCancel={vi.fn()}
        />,
        { wrapper: createWrapper() }
      );

      // Navigate and add interview
      await user.click(
        screen.getByRole('checkbox', { name: /pending an upcoming interview/i })
      );
      await user.click(screen.getByRole('button', { name: /confirm answer/i }));

      await waitFor(() => {
        expect(
          screen.getByText(/track your interview progress/i)
        ).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /add interview/i }));

      await waitFor(() => {
        expect(screen.getByLabelText(/company \*/i)).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/company \*/i), 'Google');
      await user.type(
        screen.getByLabelText(/position \*/i),
        'Software Engineer'
      );
      await user.type(screen.getByLabelText(/stage \*/i), 'Technical Round');
      await user.type(screen.getByLabelText(/date \*/i), '2025-10-15');

      const submitButtons = screen.getAllByRole('button', {
        name: /add interview/i,
      });
      await user.click(submitButtons[submitButtons.length - 1]);

      await waitFor(() => {
        expect(screen.getByText('Google')).toBeInTheDocument();
      });

      // Click delete button
      const deleteButton = screen.getByRole('button', {
        name: /delete interview/i,
      });
      await user.click(deleteButton);

      // Should show empty state again
      await waitFor(() => {
        expect(
          screen.getByText(/no interviews added yet/i)
        ).toBeInTheDocument();
        expect(screen.queryByText('Google')).not.toBeInTheDocument();
      });
    });
  });
});
