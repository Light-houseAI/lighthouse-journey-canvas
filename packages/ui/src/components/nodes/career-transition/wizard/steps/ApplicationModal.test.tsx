import { OrganizationType } from '@journey/schema';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApplicationModal } from './ApplicationModal';
import type { JobApplication } from './types';
import { ApplicationStatus, OutreachMethod } from './types';

// Mock the TodoList component and Button
vi.mock('@journey/components', () => ({
  TodoList: vi.fn(({ todos, onChange }) => (
    <div data-testid="todo-list">
      {todos.map((todo: any) => (
        <div key={todo.id}>{todo.description}</div>
      ))}
      <button
        onClick={() =>
          onChange([
            ...todos,
            { id: 'new', description: 'New todo', status: 'pending' },
          ])
        }
      >
        Add Todo
      </button>
    </div>
  )),
  Button: vi.fn(({ children, onClick, variant, className, disabled, type }) => (
    <button
      onClick={onClick}
      className={className}
      disabled={disabled}
      data-variant={variant}
      type={type}
    >
      {children}
    </button>
  )),
}));

// Mock OrganizationSelector
vi.mock('../../../../ui/organization-selector', () => ({
  OrganizationSelector: vi.fn(
    ({ value, onSelect, onClear, placeholder, required, error }) => (
      <div data-testid="organization-selector">
        <input
          data-testid="company-selector-input"
          placeholder={placeholder}
          value={value?.name || ''}
          onChange={(e) => {
            if (e.target.value) {
              onSelect({
                id: 999,
                name: e.target.value,
                type: OrganizationType.Company,
              });
            } else {
              onClear();
            }
          }}
          aria-label="Company"
          aria-required={required}
        />
        {error && <span data-testid="company-error">{error}</span>}
      </div>
    )
  ),
}));

describe('ApplicationModal', () => {
  const mockOnSave = vi.fn();
  const mockOnClose = vi.fn();

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    onSave: mockOnSave,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSave.mockResolvedValue(undefined);
  });

  describe('Add Mode', () => {
    it('should render modal with empty form fields', () => {
      render(<ApplicationModal {...defaultProps} />);

      expect(screen.getByText('Add Job Application')).toBeInTheDocument();

      // Check for empty form fields
      expect(screen.getByLabelText('Company')).toHaveValue('');
      expect(screen.getByLabelText('Job Title')).toHaveValue('');
      expect(screen.getByLabelText('Application Date')).toHaveValue('');
      expect(screen.getByLabelText('Status')).toHaveValue(
        ApplicationStatus.Applied
      );
      expect(screen.getByLabelText('Outreach Method')).toHaveValue(
        OutreachMethod.ColdApply
      );
    });

    it('should handle form submission with valid data', async () => {
      render(<ApplicationModal {...defaultProps} />);

      // Fill in form fields
      fireEvent.change(screen.getByLabelText('Company'), {
        target: { value: 'Tech Corp' },
      });
      fireEvent.change(screen.getByLabelText('Job Title'), {
        target: { value: 'Senior Developer' },
      });
      fireEvent.change(screen.getByLabelText('Application Date'), {
        target: { value: '2024-01-15' },
      });
      fireEvent.change(screen.getByLabelText('Job Posting URL'), {
        target: { value: 'https://techcorp.com/jobs/123' },
      });
      fireEvent.change(screen.getByLabelText('Status'), {
        target: { value: ApplicationStatus.PhoneInterview },
      });
      fireEvent.change(screen.getByLabelText('Outreach Method'), {
        target: { value: OutreachMethod.Referral },
      });

      // Submit form
      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith({
          company: 'Tech Corp',
          companyId: 999, // From mocked OrganizationSelector
          jobTitle: 'Senior Developer',
          applicationDate: '2024-01-15',
          jobPostingUrl: 'https://techcorp.com/jobs/123',
          applicationStatus: ApplicationStatus.PhoneInterview,
          outreachMethod: OutreachMethod.Referral,
          interviewContext: undefined,
          notes: undefined,
          todos: [],
        });
      });

      // Modal should close after successful save
      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('should validate required fields', async () => {
      render(<ApplicationModal {...defaultProps} />);

      // Try to submit without filling required fields
      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(screen.getByTestId('company-error')).toHaveTextContent(
          'Company is required'
        );
        expect(screen.getByText('Job Title is required')).toBeInTheDocument();
        expect(mockOnSave).not.toHaveBeenCalled();
      });
    });

    it('should handle todo management', () => {
      render(<ApplicationModal {...defaultProps} />);

      // Add a todo via the mocked TodoList
      const addTodoButton = screen.getByText('Add Todo');
      fireEvent.click(addTodoButton);

      // Check that the todo appears
      expect(screen.getByText('New todo')).toBeInTheDocument();
    });
  });

  describe('Edit Mode', () => {
    const existingApplication: JobApplication = {
      id: '1',
      company: 'Existing Corp',
      companyId: 123,
      jobTitle: 'Full Stack Engineer',
      applicationDate: '2024-01-10',
      applicationStatus: ApplicationStatus.TechnicalInterview,
      outreachMethod: OutreachMethod.LinkedInMessage,
      jobPostingUrl: 'https://existingcorp.com/jobs/456',
      interviewContext: 'Technical round scheduled',
      notes: 'Great company culture',
      todos: [
        {
          id: '1',
          description: 'Prepare system design',
          status: 'in-progress',
        },
        { id: '2', description: 'Review algorithms', status: 'pending' },
      ],
    };

    it('should populate form with existing application data', () => {
      render(
        <ApplicationModal {...defaultProps} application={existingApplication} />
      );

      expect(screen.getByText('Edit Job Application')).toBeInTheDocument();

      // Check pre-populated fields
      expect(screen.getByLabelText('Company')).toHaveValue('Existing Corp');
      expect(screen.getByLabelText('Job Title')).toHaveValue(
        'Full Stack Engineer'
      );
      expect(screen.getByLabelText('Application Date')).toHaveValue(
        '2024-01-10'
      );
      expect(screen.getByLabelText('Job Posting URL')).toHaveValue(
        'https://existingcorp.com/jobs/456'
      );
      expect(screen.getByLabelText('Status')).toHaveValue(
        ApplicationStatus.TechnicalInterview
      );
      expect(screen.getByLabelText('Outreach Method')).toHaveValue(
        OutreachMethod.LinkedInMessage
      );
      expect(screen.getByLabelText('Interview Context')).toHaveValue(
        'Technical round scheduled'
      );
      expect(screen.getByLabelText('Notes')).toHaveValue(
        'Great company culture'
      );

      // Check todos are displayed
      expect(screen.getByText('Prepare system design')).toBeInTheDocument();
      expect(screen.getByText('Review algorithms')).toBeInTheDocument();
    });

    it('should handle updating an existing application', async () => {
      render(
        <ApplicationModal {...defaultProps} application={existingApplication} />
      );

      // Wait for interview context field to appear (since status is TechnicalInterview)
      await waitFor(() => {
        expect(screen.getByLabelText('Interview Context')).toBeInTheDocument();
      });

      // Update some fields
      fireEvent.change(screen.getByLabelText('Status'), {
        target: { value: ApplicationStatus.Offer },
      });

      // Interview context field should be hidden after changing to non-interview status
      await waitFor(() => {
        expect(
          screen.queryByLabelText('Interview Context')
        ).not.toBeInTheDocument();
      });

      // Change to interview status and update interview context
      fireEvent.change(screen.getByLabelText('Status'), {
        target: { value: ApplicationStatus.FinalInterview },
      });

      await waitFor(() => {
        expect(screen.getByLabelText('Interview Context')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText('Interview Context'), {
        target: { value: 'Received offer!' },
      });

      // Submit form
      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith({
          company: 'Existing Corp',
          companyId: 123,
          jobTitle: 'Full Stack Engineer',
          applicationDate: '2024-01-10',
          jobPostingUrl: 'https://existingcorp.com/jobs/456',
          applicationStatus: ApplicationStatus.FinalInterview,
          outreachMethod: OutreachMethod.LinkedInMessage,
          interviewContext: 'Received offer!',
          notes: 'Great company culture',
          todos: existingApplication.todos,
        });
      });
    });
  });

  describe('Modal Behavior', () => {
    it('should close modal when Cancel is clicked', () => {
      render(<ApplicationModal {...defaultProps} />);

      fireEvent.click(screen.getByText('Cancel'));

      expect(mockOnClose).toHaveBeenCalled();
      expect(mockOnSave).not.toHaveBeenCalled();
    });

    it('should close modal when X button is clicked', () => {
      render(<ApplicationModal {...defaultProps} />);

      fireEvent.click(screen.getByLabelText('Close'));

      expect(mockOnClose).toHaveBeenCalled();
      expect(mockOnSave).not.toHaveBeenCalled();
    });

    it('should not render when isOpen is false', () => {
      const { container } = render(
        <ApplicationModal {...defaultProps} isOpen={false} />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should show loading state while saving', async () => {
      // Mock a slow save operation that resolves after enough time for us to check loading state
      let resolveFunc: () => void;
      const savePromise = new Promise<void>((resolve) => {
        resolveFunc = resolve;
      });
      mockOnSave.mockReturnValue(savePromise);

      render(<ApplicationModal {...defaultProps} />);

      // Fill required fields
      fireEvent.change(screen.getByLabelText('Company'), {
        target: { value: 'Test' },
      });
      fireEvent.change(screen.getByLabelText('Job Title'), {
        target: { value: 'Test' },
      });
      fireEvent.change(screen.getByLabelText('Application Date'), {
        target: { value: '2024-01-15' },
      });

      // Submit
      fireEvent.click(screen.getByText('Save'));

      // Check for loading state immediately
      await waitFor(() => {
        expect(screen.getByText('Saving...')).toBeInTheDocument();
        const saveButton = screen.getByText('Saving...').closest('button');
        expect(saveButton).toBeDisabled();
      });

      // Resolve the save operation
      resolveFunc!();

      // Wait for save to complete and modal to close
      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('should handle save errors gracefully', async () => {
      const errorMessage = 'Failed to save application';
      mockOnSave.mockRejectedValue(new Error(errorMessage));

      render(<ApplicationModal {...defaultProps} />);

      // Fill required fields
      fireEvent.change(screen.getByLabelText('Company'), {
        target: { value: 'Test' },
      });
      fireEvent.change(screen.getByLabelText('Job Title'), {
        target: { value: 'Test' },
      });
      fireEvent.change(screen.getByLabelText('Application Date'), {
        target: { value: '2024-01-15' },
      });

      // Submit
      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(screen.getByText(`Error: ${errorMessage}`)).toBeInTheDocument();
        expect(mockOnClose).not.toHaveBeenCalled();
      });
    });
  });

  describe('Interview Context Field', () => {
    it('should show interview context field for interview statuses', () => {
      render(<ApplicationModal {...defaultProps} />);

      // Initially should not show (default is Applied)
      expect(
        screen.queryByLabelText('Interview Context')
      ).not.toBeInTheDocument();

      // Change to Phone Interview status
      fireEvent.change(screen.getByLabelText('Status'), {
        target: { value: ApplicationStatus.PhoneInterview },
      });

      // Now it should show
      expect(screen.getByLabelText('Interview Context')).toBeInTheDocument();
    });

    it('should hide interview context for non-interview statuses', () => {
      render(<ApplicationModal {...defaultProps} />);

      // Set to interview status first
      fireEvent.change(screen.getByLabelText('Status'), {
        target: { value: ApplicationStatus.TechnicalInterview },
      });
      expect(screen.getByLabelText('Interview Context')).toBeInTheDocument();

      // Change to non-interview status
      fireEvent.change(screen.getByLabelText('Status'), {
        target: { value: ApplicationStatus.Rejected },
      });

      // Should be hidden
      expect(
        screen.queryByLabelText('Interview Context')
      ).not.toBeInTheDocument();
    });
  });

  describe('Form Sanitization', () => {
    it('should convert empty jobPostingUrl to undefined', async () => {
      render(<ApplicationModal {...defaultProps} />);

      // Fill required fields
      fireEvent.change(screen.getByLabelText('Company'), {
        target: { value: 'Test Corp' },
      });
      fireEvent.change(screen.getByLabelText('Job Title'), {
        target: { value: 'Engineer' },
      });
      fireEvent.change(screen.getByLabelText('Application Date'), {
        target: { value: '2024-01-15' },
      });

      // Leave jobPostingUrl empty
      // Submit form
      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.objectContaining({
            jobPostingUrl: undefined,
          })
        );
      });
    });

    it('should convert whitespace-only jobPostingUrl to undefined', async () => {
      render(<ApplicationModal {...defaultProps} />);

      // Fill required fields
      fireEvent.change(screen.getByLabelText('Company'), {
        target: { value: 'Test Corp' },
      });
      fireEvent.change(screen.getByLabelText('Job Title'), {
        target: { value: 'Engineer' },
      });
      fireEvent.change(screen.getByLabelText('Application Date'), {
        target: { value: '2024-01-15' },
      });

      // Fill jobPostingUrl with whitespace only
      fireEvent.change(screen.getByLabelText('Job Posting URL'), {
        target: { value: '   ' },
      });

      // Submit form
      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.objectContaining({
            jobPostingUrl: undefined,
          })
        );
      });
    });

    it('should convert empty optional fields to undefined', async () => {
      render(<ApplicationModal {...defaultProps} />);

      // Fill required fields only
      fireEvent.change(screen.getByLabelText('Company'), {
        target: { value: 'Test Corp' },
      });
      fireEvent.change(screen.getByLabelText('Job Title'), {
        target: { value: 'Engineer' },
      });
      fireEvent.change(screen.getByLabelText('Application Date'), {
        target: { value: '2024-01-15' },
      });

      // Leave optional fields empty
      // Submit form
      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.objectContaining({
            jobPostingUrl: undefined,
            interviewContext: undefined,
            notes: undefined,
          })
        );
      });
    });

    it('should preserve valid URL values', async () => {
      render(<ApplicationModal {...defaultProps} />);

      // Fill all fields with valid data
      fireEvent.change(screen.getByLabelText('Company'), {
        target: { value: 'Tech Corp' },
      });
      fireEvent.change(screen.getByLabelText('Job Title'), {
        target: { value: 'Senior Developer' },
      });
      fireEvent.change(screen.getByLabelText('Application Date'), {
        target: { value: '2024-01-15' },
      });
      fireEvent.change(screen.getByLabelText('Job Posting URL'), {
        target: { value: 'https://techcorp.com/jobs/123' },
      });

      // Submit form
      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.objectContaining({
            jobPostingUrl: 'https://techcorp.com/jobs/123',
          })
        );
      });
    });

    it('should sanitize whitespace-only notes and interviewContext', async () => {
      render(<ApplicationModal {...defaultProps} />);

      // Fill required fields
      fireEvent.change(screen.getByLabelText('Company'), {
        target: { value: 'Test Corp' },
      });
      fireEvent.change(screen.getByLabelText('Job Title'), {
        target: { value: 'Engineer' },
      });
      fireEvent.change(screen.getByLabelText('Application Date'), {
        target: { value: '2024-01-15' },
      });

      // Change to interview status to show interviewContext field
      fireEvent.change(screen.getByLabelText('Status'), {
        target: { value: ApplicationStatus.PhoneInterview },
      });

      await waitFor(() => {
        expect(screen.getByLabelText('Interview Context')).toBeInTheDocument();
      });

      // Fill with whitespace only
      fireEvent.change(screen.getByLabelText('Interview Context'), {
        target: { value: '   ' },
      });
      fireEvent.change(screen.getByLabelText('Notes'), {
        target: { value: '  ' },
      });

      // Submit form
      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.objectContaining({
            interviewContext: undefined,
            notes: undefined,
          })
        );
      });
    });
  });
});
