/**
 * CareerUpdateWizard Component Tests
 *
 * Tests the multi-step wizard flow for career updates.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as hierarchyApi from '../../../../services/hierarchy-api';
import * as updatesApi from '../../../../services/updates-api';
import { CareerUpdateWizard } from './CareerUpdateWizard';

// Mock the updates API
vi.mock('../../../../services/updates-api');

// Mock the hierarchy API
vi.mock('../../../../services/hierarchy-api', () => ({
  hierarchyApi: {
    listNodes: vi.fn(),
    createNode: vi.fn(),
    updateNode: vi.fn(),
    deleteNode: vi.fn(),
  },
}));

// Mock wouter
vi.mock('wouter', () => ({
  useLocation: vi.fn(() => ['/current-path', vi.fn()]),
}));

// Mock hooks
vi.mock('../../../../hooks/use-application-materials', () => ({
  useApplicationMaterials: vi.fn(() => ({
    data: { items: [], summary: undefined },
    isLoading: false,
  })),
  useCareerTransitionNode: vi.fn(() => ({
    data: {
      id: 'test-node',
      type: 'CareerTransition',
      parentId: null,
      meta: {},
    },
    isLoading: false,
  })),
  useUpdateApplicationMaterials: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
  })),
  useUpdateResumeEntry: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
  })),
  useRemoveResumeEntry: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
  })),
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
    // Default mock for listNodes to return empty array
    vi.mocked(hierarchyApi.hierarchyApi.listNodes).mockResolvedValue([]);
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

      // Should show checkbox for application materials
      expect(
        screen.getByLabelText(/updated application materials/i)
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

    it('should enable Confirm answer button when notes are entered', async () => {
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

      const notesTextarea = screen.getByPlaceholderText(/please describe/i);
      await user.type(notesTextarea, 'Some update notes');

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
    it('should advance to Job Applications step when application progress selected', async () => {
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
          screen.getByText(/step 2 of 2.*job applications/i)
        ).toBeInTheDocument();
      });
    });

    it('should advance to Application Materials step when materials selected', async () => {
      const user = userEvent.setup();
      render(
        <CareerUpdateWizard
          nodeId="test-node"
          onSuccess={vi.fn()}
          onCancel={vi.fn()}
        />,
        { wrapper: createWrapper() }
      );

      // Select "Updated application materials" checkbox
      const materialsCheckbox = screen.getByRole('checkbox', {
        name: /updated application materials/i,
      });
      await user.click(materialsCheckbox);

      // Click Confirm answer
      const confirmButton = screen.getByRole('button', {
        name: /confirm answer/i,
      });
      await user.click(confirmButton);

      // Should advance to step 2
      await waitFor(() => {
        expect(
          screen.getByText(/step 2.*application materials/i)
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

      // Select both checkboxes
      await user.click(
        screen.getByRole('checkbox', {
          name: /application or interview progress/i,
        })
      );
      await user.click(
        screen.getByRole('checkbox', {
          name: /updated application materials/i,
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
        screen.getByRole('checkbox', {
          name: /application or interview progress/i,
        })
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
    it('should submit with only notes when no checkboxes selected', async () => {
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

      // Type notes
      const notesTextarea = screen.getByPlaceholderText(/please describe/i);
      await user.type(notesTextarea, 'Just some notes');

      // Click confirm
      await user.click(screen.getByRole('button', { name: /confirm answer/i }));

      // Should submit with just notes
      await waitFor(() => {
        expect(mockCreateUpdate).toHaveBeenCalledWith('test-node', {
          notes: 'Just some notes',
          meta: {
            appliedToJobs: false,
            applicationMaterials: false,
          },
        });
      });

      // Should show success screen
      await waitFor(() => {
        expect(
          screen.getByText(/successfully added update!/i)
        ).toBeInTheDocument();
      });
    });

    it('should submit with only activity flags when continuing past job applications step', async () => {
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
        screen.getByRole('checkbox', {
          name: /application or interview progress/i,
        })
      );

      // Continue to next step
      await user.click(screen.getByRole('button', { name: /confirm answer/i }));

      // Wait for Job Applications step to load
      await waitFor(() => {
        expect(screen.getByText(/step 2 of 2/i)).toBeInTheDocument();
      });

      // Click Continue on the Job Applications step
      const continueButton = screen.getByRole('button', {
        name: /continue/i,
      });
      await user.click(continueButton);

      // Should submit with correct data
      await waitFor(() => {
        expect(mockCreateUpdate).toHaveBeenCalledWith('test-node', {
          notes: '',
          meta: expect.objectContaining({
            appliedToJobs: true,
            applicationMaterials: false,
          }),
        });
      });

      // Should show success screen instead of calling onSuccess directly
      await waitFor(() => {
        expect(
          screen.getByText(/successfully added update!/i)
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

      // Select both activities
      await user.click(
        screen.getByRole('checkbox', {
          name: /application or interview progress/i,
        })
      );
      await user.click(
        screen.getByRole('checkbox', {
          name: /updated application materials/i,
        })
      );

      // Continue through wizard
      await user.click(screen.getByRole('button', { name: /confirm answer/i }));

      // Navigate through Job Applications step
      await waitFor(() => {
        expect(screen.getByText(/step 2 of 3/i)).toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: /continue/i }));

      // Navigate through Application Materials step
      await waitFor(() => {
        expect(
          screen.getByText(/step 3.*application materials/i)
        ).toBeInTheDocument();
      });

      // Finish
      const continueButton = screen.getByRole('button', {
        name: /continue/i,
      });
      await user.click(continueButton);

      // Should submit with all activities
      await waitFor(() => {
        expect(mockCreateUpdate).toHaveBeenCalledWith('test-node', {
          notes: '',
          meta: expect.objectContaining({
            appliedToJobs: true,
            applicationMaterials: true,
          }),
        });
      });

      // Should show success screen
      await waitFor(() => {
        expect(
          screen.getByText(/successfully added update!/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe('Job Applications Step', () => {
    it('should show job applications step with Add button', async () => {
      const user = userEvent.setup();
      render(
        <CareerUpdateWizard
          nodeId="test-node"
          onSuccess={vi.fn()}
          onCancel={vi.fn()}
        />,
        { wrapper: createWrapper() }
      );

      // Navigate to Job Applications step
      await user.click(
        screen.getByRole('checkbox', {
          name: /application or interview progress/i,
        })
      );
      await user.click(screen.getByRole('button', { name: /confirm answer/i }));

      // Should show Job Applications step
      await waitFor(() => {
        expect(
          screen.getByText(/step 2 of 2.*job applications/i)
        ).toBeInTheDocument();
        expect(
          screen.getByText(
            /what progress have you made in applications or interviews/i
          )
        ).toBeInTheDocument();
      });

      // Should show Add Job Application button
      expect(
        screen.getByRole('button', { name: /add job application/i })
      ).toBeInTheDocument();
    });

    it('should show empty state when no applications added', async () => {
      const user = userEvent.setup();
      render(
        <CareerUpdateWizard
          nodeId="test-node"
          onSuccess={vi.fn()}
          onCancel={vi.fn()}
        />,
        { wrapper: createWrapper() }
      );

      // Navigate to Job Applications step
      await user.click(
        screen.getByRole('checkbox', {
          name: /application or interview progress/i,
        })
      );
      await user.click(screen.getByRole('button', { name: /confirm answer/i }));

      await waitFor(() => {
        expect(
          screen.getByText(/no job applications yet/i)
        ).toBeInTheDocument();
      });
    });

    it('should open add application modal when Add button clicked', async () => {
      const user = userEvent.setup();
      render(
        <CareerUpdateWizard
          nodeId="test-node"
          onSuccess={vi.fn()}
          onCancel={vi.fn()}
        />,
        { wrapper: createWrapper() }
      );

      // Navigate to Job Applications step
      await user.click(
        screen.getByRole('checkbox', {
          name: /application or interview progress/i,
        })
      );
      await user.click(screen.getByRole('button', { name: /confirm answer/i }));

      await waitFor(() => {
        expect(
          screen.getByText(/what progress have you made/i)
        ).toBeInTheDocument();
      });

      // Click Add Job Application button
      const addButton = screen.getByRole('button', {
        name: /add job application/i,
      });
      await user.click(addButton);

      // Should show modal
      await waitFor(() => {
        expect(
          screen.getByRole('heading', { name: /add job application/i })
        ).toBeInTheDocument();
      });
    });
  });
});
