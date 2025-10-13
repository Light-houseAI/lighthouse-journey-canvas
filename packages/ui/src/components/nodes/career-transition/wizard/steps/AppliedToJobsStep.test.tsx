import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { WizardData } from '../CareerUpdateWizard';
import { AppliedToJobsStep } from './AppliedToJobsStep';
import type { JobApplication } from './types';
import { ApplicationStatus, EventType, OutreachMethod } from './types';

// Mock the hierarchyApi
vi.mock('../../../../../services/hierarchy-api', () => ({
  hierarchyApi: {
    listNodes: vi.fn(),
    createNode: vi.fn(),
    updateNode: vi.fn(),
    deleteNode: vi.fn(),
  },
}));

const createQueryWrapper = () => {
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

describe('AppliedToJobsStep', () => {
  const mockOnNext = vi.fn();
  const mockOnBack = vi.fn();
  const mockOnCancel = vi.fn();

  const defaultProps = {
    data: { appliedToJobs: true } as WizardData,
    onNext: mockOnNext,
    onBack: mockOnBack,
    onCancel: mockOnCancel,
    currentStep: 1,
    totalSteps: 2,
    nodeId: 'test-node-123',
  };

  const sampleApplications: JobApplication[] = [
    {
      id: '1',
      company: 'Tech Corp',
      jobTitle: 'Senior Developer',
      applicationDate: '2024-01-15',
      applicationStatus: ApplicationStatus.Applied,
      outreachMethod: OutreachMethod.ColdApply,
      jobPostingUrl: 'https://techcorp.com/jobs/123',
      todos: [
        { id: '1', description: 'Research company', status: 'completed' },
        { id: '2', description: 'Update resume', status: 'pending' },
      ],
    },
    {
      id: '2',
      company: 'StartupXYZ',
      jobTitle: 'Full Stack Engineer',
      applicationDate: '2024-01-20',
      applicationStatus: ApplicationStatus.PhoneInterview,
      outreachMethod: OutreachMethod.Referral,
      interviewContext: 'Phone screen scheduled for next week',
      todos: [
        { id: '3', description: 'Prepare questions', status: 'in-progress' },
      ],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Table View', () => {
    it('should render table with applications', async () => {
      const { hierarchyApi } = await import(
        '../../../../../services/hierarchy-api'
      );
      vi.mocked(hierarchyApi.listNodes).mockResolvedValue(
        sampleApplications.map((app) => ({
          id: app.id,
          type: 'Event',
          parentId: 'test-node-123',
          meta: {
            eventType: EventType.JobApplication,
            ...app,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }))
      );

      render(<AppliedToJobsStep {...defaultProps} />, {
        wrapper: createQueryWrapper(),
      });

      // Check for table headers
      await waitFor(() => {
        expect(screen.getByText('Job')).toBeInTheDocument();
        expect(screen.getByText('Status')).toBeInTheDocument();
        expect(screen.getByText('Outreach')).toBeInTheDocument();
        expect(screen.getByText('Posting URL')).toBeInTheDocument();
        expect(screen.getByText('Todos')).toBeInTheDocument();
        expect(screen.getByText('Actions')).toBeInTheDocument();
      });

      // Check for application data (company and job title are in separate elements)
      expect(screen.getByText('Tech Corp')).toBeInTheDocument();
      expect(screen.getByText('Senior Developer')).toBeInTheDocument();
      expect(screen.getByText('StartupXYZ')).toBeInTheDocument();
      expect(screen.getByText('Full Stack Engineer')).toBeInTheDocument();
    });

    it('should render empty state when no applications', async () => {
      const { hierarchyApi } = await import(
        '../../../../../services/hierarchy-api'
      );
      vi.mocked(hierarchyApi.listNodes).mockResolvedValue([]);

      render(<AppliedToJobsStep {...defaultProps} />, {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => {
        expect(
          screen.getByText(/No job applications yet/i)
        ).toBeInTheDocument();
        expect(screen.getByText('Add job application')).toBeInTheDocument();
      });
    });

    it('should handle edit button click', async () => {
      const { hierarchyApi } = await import(
        '../../../../../services/hierarchy-api'
      );
      vi.mocked(hierarchyApi.listNodes).mockResolvedValue(
        sampleApplications.map((app) => ({
          id: app.id,
          type: 'Event',
          parentId: 'test-node-123',
          meta: {
            eventType: EventType.JobApplication,
            ...app,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }))
      );

      render(<AppliedToJobsStep {...defaultProps} />, {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => {
        const editButtons = screen.getAllByLabelText('Edit');
        expect(editButtons).toHaveLength(2);
      });

      const editButtons = screen.getAllByLabelText('Edit');
      fireEvent.click(editButtons[0]);

      // Modal should open with application data
      await waitFor(() => {
        expect(screen.getByText('Edit Job Application')).toBeInTheDocument();
        expect(
          screen.getByDisplayValue('Senior Developer')
        ).toBeInTheDocument();
      });
    });

    it('should handle delete button click', async () => {
      const { hierarchyApi } = await import(
        '../../../../../services/hierarchy-api'
      );
      vi.mocked(hierarchyApi.listNodes).mockResolvedValue(
        sampleApplications.map((app) => ({
          id: app.id,
          type: 'Event',
          parentId: 'test-node-123',
          meta: {
            eventType: EventType.JobApplication,
            ...app,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }))
      );
      vi.mocked(hierarchyApi.deleteNode).mockResolvedValue(undefined);

      render(<AppliedToJobsStep {...defaultProps} />, {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => {
        const deleteButtons = screen.getAllByLabelText('Delete');
        expect(deleteButtons).toHaveLength(2);
      });

      const deleteButtons = screen.getAllByLabelText('Delete');

      // Mock window.confirm
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(confirmSpy).toHaveBeenCalledWith(
          'Are you sure you want to delete this job application?'
        );
        expect(hierarchyApi.deleteNode).toHaveBeenCalledWith('1');
      });

      confirmSpy.mockRestore();
    });

    it('should cancel delete when user declines confirmation', async () => {
      const { hierarchyApi } = await import(
        '../../../../../services/hierarchy-api'
      );
      vi.mocked(hierarchyApi.listNodes).mockResolvedValue(
        sampleApplications.map((app) => ({
          id: app.id,
          type: 'Event',
          parentId: 'test-node-123',
          meta: {
            eventType: EventType.JobApplication,
            ...app,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }))
      );

      render(<AppliedToJobsStep {...defaultProps} />, {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => {
        const deleteButtons = screen.getAllByLabelText('Delete');
        expect(deleteButtons).toHaveLength(2);
      });

      const deleteButtons = screen.getAllByLabelText('Delete');

      // Mock window.confirm to return false
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(confirmSpy).toHaveBeenCalled();
        expect(hierarchyApi.deleteNode).not.toHaveBeenCalled();
      });

      confirmSpy.mockRestore();
    });
  });

  describe('Add Application', () => {
    it('should open modal when Add button is clicked', async () => {
      const { hierarchyApi } = await import(
        '../../../../../services/hierarchy-api'
      );
      vi.mocked(hierarchyApi.listNodes).mockResolvedValue([]);

      render(<AppliedToJobsStep {...defaultProps} />, {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByText('Add job application')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Add job application'));

      // Modal should open empty
      await waitFor(() => {
        expect(screen.getByText('Add Job Application')).toBeInTheDocument();
        expect(screen.getByLabelText('Job Title')).toBeInTheDocument();
        expect(screen.getByLabelText('Application Date')).toBeInTheDocument();
      });
    });
  });

  describe('Navigation', () => {
    it('should call onNext when Continue is clicked', async () => {
      const { hierarchyApi } = await import(
        '../../../../../services/hierarchy-api'
      );
      vi.mocked(hierarchyApi.listNodes).mockResolvedValue(
        sampleApplications.map((app) => ({
          id: app.id,
          type: 'Event',
          parentId: 'test-node-123',
          meta: {
            eventType: EventType.JobApplication,
            ...app,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }))
      );

      render(<AppliedToJobsStep {...defaultProps} />, {
        wrapper: createQueryWrapper(),
      });

      // Wait for data to load by checking for an application in the table
      await waitFor(() => {
        expect(screen.getByText('Tech Corp')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Continue'));

      expect(mockOnNext).toHaveBeenCalledWith({
        appliedToJobsData: expect.objectContaining({
          applications: expect.arrayContaining([
            expect.objectContaining({
              company: 'Tech Corp',
              jobTitle: 'Senior Developer',
            }),
          ]),
        }),
      });
    });

    it('should call onBack when Back is clicked', async () => {
      render(<AppliedToJobsStep {...defaultProps} />, {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByText('Back')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Back'));

      expect(mockOnBack).toHaveBeenCalled();
    });

    it('should call onCancel when Cancel is clicked', async () => {
      render(<AppliedToJobsStep {...defaultProps} />, {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByText('Cancel update')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Cancel update'));

      expect(mockOnCancel).toHaveBeenCalled();
    });
  });

  describe('Todo Count Display', () => {
    it('should display todo counts correctly', async () => {
      const { hierarchyApi } = await import(
        '../../../../../services/hierarchy-api'
      );
      vi.mocked(hierarchyApi.listNodes).mockResolvedValue(
        sampleApplications.map((app) => ({
          id: app.id,
          type: 'Event',
          parentId: 'test-node-123',
          meta: {
            eventType: EventType.JobApplication,
            ...app,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }))
      );

      render(<AppliedToJobsStep {...defaultProps} />, {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => {
        // First application has 1 completed, 1 pending
        const firstAppTodos = screen.getByTestId('todo-count-1');
        expect(firstAppTodos).toHaveTextContent('1 / 2');

        // Second application has 1 in-progress
        const secondAppTodos = screen.getByTestId('todo-count-2');
        expect(secondAppTodos).toHaveTextContent('0 / 1');
      });
    });
  });
});
