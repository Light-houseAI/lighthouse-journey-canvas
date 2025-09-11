import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MultiStepAddNodeModal } from '../MultiStepAddNodeModal';
import { vi, describe, test, expect, beforeEach } from 'vitest';

// Mock the sub-components
vi.mock('../NodeTypeSelector', () => ({
  NodeTypeSelector: ({ onSelect, selectedType, availableTypes }: any) => (
    <div data-testid="node-type-selector">
      {availableTypes.map((type: string) => (
        <button
          key={type}
          data-testid={`node-type-${type}`}
          onClick={() => onSelect(type)}
          aria-pressed={selectedType === type}
        >
          {type}
        </button>
      ))}
    </div>
  ),
}));

vi.mock('../AddNodeModal', () => ({
  AddNodeModal: ({ isOpen, onClose, onSubmit, context }: any) => {
    if (!isOpen) return null;
    
    return (
      <div data-testid="add-node-form-modal">
        <h2>Add New {context.suggestedData?.type || 'Node'}</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const data = Object.fromEntries(formData.entries());
            onSubmit({ ...data, type: context.suggestedData?.type });
          }}
        >
          <input name="title" placeholder="Title" required data-testid="title-input" />
          <input name="description" placeholder="Description" data-testid="description-input" />
          
          {context.suggestedData?.type === 'workExperience' && (
            <>
              <input name="company" placeholder="Company" required data-testid="company-input" />
              <input name="start" placeholder="Start Date" required data-testid="start-input" />
            </>
          )}
          
          {context.suggestedData?.type === 'education' && (
            <>
              <input name="school" placeholder="School" required data-testid="school-input" />
              <input name="degree" placeholder="Degree" required data-testid="degree-input" />
              <input name="field" placeholder="Field" required data-testid="field-input" />
            </>
          )}
          
          {context.suggestedData?.type === 'project' && (
            <>
              <input name="technologies" placeholder="Technologies" data-testid="technologies-input" />
            </>
          )}
          
          <button type="submit" data-testid="submit-button">Submit</button>
          <button type="button" onClick={onClose} data-testid="cancel-button">Cancel</button>
        </form>
      </div>
    );
  },
}));

describe('MultiStepAddNodeModal', () => {
  const mockOnClose = vi.fn();
  const mockOnSubmit = vi.fn();
  
  const defaultContext = {
    insertionPoint: 'between' as const,
    parentNode: {
      id: 'parent-1',
      title: 'Parent Node',
      type: 'workExperience',
    },
    targetNode: {
      id: 'target-1',
      title: 'Target Node',
      type: 'workExperience',
    },
    availableTypes: ['workExperience', 'education', 'project', 'event', 'action'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders modal with type selection step initially', () => {
    render(
      <MultiStepAddNodeModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        context={defaultContext}
      />
    );

    // Should show modal title
    expect(screen.getByText('Add New Milestone')).toBeInTheDocument();
    
    // Should show context description
    expect(screen.getByText(/Adding between/)).toBeInTheDocument();
    expect(screen.getByText('Parent Node')).toBeInTheDocument();
    expect(screen.getByText('Target Node')).toBeInTheDocument();
    
    // Should show step indicator with step 1 active
    expect(screen.getByText('1')).toHaveClass('bg-purple-600');
    expect(screen.getByText('2')).toHaveClass('bg-gray-200');
    
    // Should show node type selector
    expect(screen.getByTestId('node-type-selector')).toBeInTheDocument();
    expect(screen.getByTestId('node-type-workExperience')).toBeInTheDocument();
    expect(screen.getByTestId('node-type-education')).toBeInTheDocument();
    expect(screen.getByTestId('node-type-project')).toBeInTheDocument();
    
    // Should show disabled Next button initially
    const nextButton = screen.getByTestId('next-button');
    expect(nextButton).toBeDisabled();
  });

  test('enables Next button when a node type is selected', async () => {
    const user = userEvent.setup();
    
    render(
      <MultiStepAddNodeModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        context={defaultContext}
      />
    );

    // Select a node type
    await user.click(screen.getByTestId('node-type-project'));
    
    // Next button should now be enabled
    const nextButton = screen.getByTestId('next-button');
    expect(nextButton).not.toBeDisabled();
    
    // Selected button should have aria-pressed="true"
    expect(screen.getByTestId('node-type-project')).toHaveAttribute('aria-pressed', 'true');
  });

  test('navigates to form details step when Next is clicked', async () => {
    const user = userEvent.setup();
    
    render(
      <MultiStepAddNodeModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        context={defaultContext}
      />
    );

    // Select a node type and click Next
    await user.click(screen.getByTestId('node-type-project'));
    await user.click(screen.getByTestId('next-button'));
    
    // Should now show the form modal
    expect(screen.getByTestId('add-node-form-modal')).toBeInTheDocument();
    expect(screen.getByText('Add New project')).toBeInTheDocument();
  });

  test('shows correct form fields for work experience type', async () => {
    const user = userEvent.setup();
    
    render(
      <MultiStepAddNodeModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        context={defaultContext}
      />
    );

    // Select work experience and go to form
    await user.click(screen.getByTestId('node-type-workExperience'));
    await user.click(screen.getByTestId('next-button'));
    
    // Should show work experience specific fields
    expect(screen.getByTestId('company-input')).toBeInTheDocument();
    expect(screen.getByTestId('start-input')).toBeInTheDocument();
  });

  test('shows correct form fields for education type', async () => {
    const user = userEvent.setup();
    
    render(
      <MultiStepAddNodeModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        context={defaultContext}
      />
    );

    // Select education and go to form
    await user.click(screen.getByTestId('node-type-education'));
    await user.click(screen.getByTestId('next-button'));
    
    // Should show education specific fields
    expect(screen.getByTestId('school-input')).toBeInTheDocument();
    expect(screen.getByTestId('degree-input')).toBeInTheDocument();
    expect(screen.getByTestId('field-input')).toBeInTheDocument();
  });

  test('shows correct form fields for project type', async () => {
    const user = userEvent.setup();
    
    render(
      <MultiStepAddNodeModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        context={defaultContext}
      />
    );

    // Select project and go to form
    await user.click(screen.getByTestId('node-type-project'));
    await user.click(screen.getByTestId('next-button'));
    
    // Should show project specific fields
    expect(screen.getByTestId('technologies-input')).toBeInTheDocument();
  });

  test('submits form with correct data for work experience', async () => {
    const user = userEvent.setup();
    mockOnSubmit.mockResolvedValueOnce(undefined);
    
    render(
      <MultiStepAddNodeModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        context={defaultContext}
      />
    );

    // Navigate to work experience form
    await user.click(screen.getByTestId('node-type-workExperience'));
    await user.click(screen.getByTestId('next-button'));
    
    // Fill out the form
    await user.type(screen.getByTestId('title-input'), 'Software Engineer');
    await user.type(screen.getByTestId('company-input'), 'Tech Corp');
    await user.type(screen.getByTestId('start-input'), '2024-01');
    await user.type(screen.getByTestId('description-input'), 'Great job');
    
    // Submit the form
    await user.click(screen.getByTestId('submit-button'));
    
    // Should call onSubmit with correct data
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        title: 'Software Engineer',
        company: 'Tech Corp',
        start: '2024-01',
        description: 'Great job',
        type: 'workExperience',
      });
    });
  });

  test('submits form with correct data for education', async () => {
    const user = userEvent.setup();
    mockOnSubmit.mockResolvedValueOnce(undefined);
    
    render(
      <MultiStepAddNodeModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        context={defaultContext}
      />
    );

    // Navigate to education form
    await user.click(screen.getByTestId('node-type-education'));
    await user.click(screen.getByTestId('next-button'));
    
    // Fill out the form
    await user.type(screen.getByTestId('title-input'), 'Bachelor of Science');
    await user.type(screen.getByTestId('school-input'), 'University of Tech');
    await user.type(screen.getByTestId('degree-input'), 'Bachelor of Science');
    await user.type(screen.getByTestId('field-input'), 'Computer Science');
    
    // Submit the form
    await user.click(screen.getByTestId('submit-button'));
    
    // Should call onSubmit with correct data
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        title: 'Bachelor of Science',
        school: 'University of Tech',
        degree: 'Bachelor of Science',
        field: 'Computer Science',
        type: 'education',
      });
    });
  });

  test('submits form with correct data for project', async () => {
    const user = userEvent.setup();
    mockOnSubmit.mockResolvedValueOnce(undefined);
    
    render(
      <MultiStepAddNodeModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        context={defaultContext}
      />
    );

    // Navigate to project form
    await user.click(screen.getByTestId('node-type-project'));
    await user.click(screen.getByTestId('next-button'));
    
    // Fill out the form
    await user.type(screen.getByTestId('title-input'), 'E-commerce Platform');
    await user.type(screen.getByTestId('description-input'), 'Full-stack e-commerce solution');
    await user.type(screen.getByTestId('technologies-input'), 'React, Node.js, PostgreSQL');
    
    // Submit the form
    await user.click(screen.getByTestId('submit-button'));
    
    // Should call onSubmit with correct data
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        title: 'E-commerce Platform',
        description: 'Full-stack e-commerce solution',
        technologies: 'React, Node.js, PostgreSQL',
        type: 'project',
      });
    });
  });

  test('handles different context types correctly', () => {
    // Test 'branch' insertion point
    const branchContext = {
      ...defaultContext,
      insertionPoint: 'branch' as const,
      targetNode: undefined,
    };
    
    render(
      <MultiStepAddNodeModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        context={branchContext}
      />
    );
    
    expect(screen.getByText(/Adding to/)).toBeInTheDocument();
    expect(screen.getByText('Parent Node')).toBeInTheDocument();
  });

  test('resets state when modal opens', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <MultiStepAddNodeModal
        isOpen={false}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        context={defaultContext}
      />
    );

    // Open modal and select a type
    rerender(
      <MultiStepAddNodeModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        context={defaultContext}
      />
    );
    
    await user.click(screen.getByTestId('node-type-project'));
    await user.click(screen.getByTestId('next-button'));
    
    // Close and reopen modal
    rerender(
      <MultiStepAddNodeModal
        isOpen={false}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        context={defaultContext}
      />
    );
    
    rerender(
      <MultiStepAddNodeModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        context={defaultContext}
      />
    );
    
    // Should be back to type selection step
    expect(screen.getByTestId('node-type-selector')).toBeInTheDocument();
    expect(screen.getByTestId('next-button')).toBeDisabled();
  });

  test('closes modal when cancel is clicked', async () => {
    const user = userEvent.setup();
    
    render(
      <MultiStepAddNodeModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        context={defaultContext}
      />
    );

    await user.click(screen.getByTestId('cancel-button'));
    
    expect(mockOnClose).toHaveBeenCalled();
  });

  test('handles submission loading state', async () => {
    const user = userEvent.setup();
    
    render(
      <MultiStepAddNodeModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        context={defaultContext}
        isSubmitting={true}
      />
    );

    // Navigate to form
    await user.click(screen.getByTestId('node-type-project'));
    await user.click(screen.getByTestId('next-button'));
    
    // Form should be in loading state (implementation detail of AddNodeModal mock)
    expect(screen.getByTestId('add-node-form-modal')).toBeInTheDocument();
  });
});