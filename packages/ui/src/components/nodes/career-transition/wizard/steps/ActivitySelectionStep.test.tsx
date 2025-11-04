/**
 * ActivitySelectionStep Component Tests
 *
 * Tests the activity selection step of the career update wizard.
 * Focuses on checkbox interactions, notes input, and form validation.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { WizardData } from '../CareerUpdateWizard';
import { ActivitySelectionStep } from './ActivitySelectionStep';

describe('ActivitySelectionStep', () => {
  const mockOnNext = vi.fn();

  const defaultProps = {
    data: {
      appliedToJobs: false,
      applicationMaterials: false,
      networking: false,
    } as WizardData,
    onNext: mockOnNext,
    onCancel: vi.fn(),
    totalSteps: 2,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the component with all activity checkboxes', () => {
      render(<ActivitySelectionStep {...defaultProps} />);

      expect(
        screen.getByRole('checkbox', {
          name: /application or interview progress/i,
        })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('checkbox', {
          name: /updated application materials/i,
        })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('checkbox', { name: /^networking$/i })
      ).toBeInTheDocument();
    });

    it('should render notes textarea', () => {
      render(<ActivitySelectionStep {...defaultProps} />);

      const textarea = screen.getByPlaceholderText(
        /please describe any other updates or context/i
      );
      expect(textarea).toBeInTheDocument();
    });

    it('should render Continue and Cancel buttons', () => {
      render(<ActivitySelectionStep {...defaultProps} />);

      expect(
        screen.getByRole('button', { name: /confirm answer/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /cancel/i })
      ).toBeInTheDocument();
    });
  });

  describe('Checkbox Interactions', () => {
    it('should check "applied to jobs" checkbox when clicked', async () => {
      const user = userEvent.setup();
      render(<ActivitySelectionStep {...defaultProps} />);

      const checkbox = screen.getByRole('checkbox', {
        name: /application or interview progress/i,
      });
      await user.click(checkbox);

      expect(checkbox).toBeChecked();
    });

    it('should check "application materials" checkbox when clicked', async () => {
      const user = userEvent.setup();
      render(<ActivitySelectionStep {...defaultProps} />);

      const checkbox = screen.getByRole('checkbox', {
        name: /updated application materials/i,
      });
      await user.click(checkbox);

      expect(checkbox).toBeChecked();
    });

    it('should check "networking" checkbox when clicked', async () => {
      const user = userEvent.setup();
      render(<ActivitySelectionStep {...defaultProps} />);

      const checkbox = screen.getByRole('checkbox', {
        name: /^networking$/i,
      });
      await user.click(checkbox);

      expect(checkbox).toBeChecked();
    });

    it('should uncheck a checkbox when clicked twice', async () => {
      const user = userEvent.setup();
      render(<ActivitySelectionStep {...defaultProps} />);

      const checkbox = screen.getByRole('checkbox', {
        name: /application or interview progress/i,
      });
      await user.click(checkbox);
      expect(checkbox).toBeChecked();

      await user.click(checkbox);
      expect(checkbox).not.toBeChecked();
    });

    it('should check multiple checkboxes', async () => {
      const user = userEvent.setup();
      render(<ActivitySelectionStep {...defaultProps} />);

      const appliedCheckbox = screen.getByRole('checkbox', {
        name: /application or interview progress/i,
      });
      const materialsCheckbox = screen.getByRole('checkbox', {
        name: /updated application materials/i,
      });

      await user.click(appliedCheckbox);
      await user.click(materialsCheckbox);

      expect(appliedCheckbox).toBeChecked();
      expect(materialsCheckbox).toBeChecked();
    });
  });

  describe('Notes Input', () => {
    it('should allow typing in notes textarea', async () => {
      const user = userEvent.setup();
      render(<ActivitySelectionStep {...defaultProps} />);

      const textarea = screen.getByPlaceholderText(
        /please describe any other updates or context/i
      );
      await user.type(textarea, 'Additional context about my career update');

      expect(textarea).toHaveValue('Additional context about my career update');
    });

    it('should display existing notes from data prop', () => {
      const propsWithNotes = {
        ...defaultProps,
        data: {
          ...defaultProps.data,
          notes: 'Existing notes',
        },
      };

      render(<ActivitySelectionStep {...propsWithNotes} />);

      const textarea = screen.getByPlaceholderText(
        /please describe any other updates or context/i
      );
      expect(textarea).toHaveValue('Existing notes');
    });

    it('should clear notes when textarea is cleared', async () => {
      const user = userEvent.setup();
      const propsWithNotes = {
        ...defaultProps,
        data: {
          ...defaultProps.data,
          notes: 'Existing notes',
        },
      };

      render(<ActivitySelectionStep {...propsWithNotes} />);

      const textarea = screen.getByPlaceholderText(
        /please describe any other updates or context/i
      );
      await user.clear(textarea);

      expect(textarea).toHaveValue('');
    });
  });

  describe('Form Validation', () => {
    it('should disable Continue button when no activities are selected and no notes', () => {
      render(<ActivitySelectionStep {...defaultProps} />);

      const continueButton = screen.getByRole('button', {
        name: /confirm answer/i,
      });
      expect(continueButton).toBeDisabled();
    });

    it('should enable Continue button when at least one activity is selected', async () => {
      const user = userEvent.setup();
      render(<ActivitySelectionStep {...defaultProps} />);

      const checkbox = screen.getByRole('checkbox', {
        name: /application or interview progress/i,
      });
      await user.click(checkbox);

      await waitFor(() => {
        const continueButton = screen.getByRole('button', {
          name: /confirm answer/i,
        });
        expect(continueButton).not.toBeDisabled();
      });
    });

    it('should enable Continue button when notes are provided', async () => {
      const user = userEvent.setup();
      render(<ActivitySelectionStep {...defaultProps} />);

      const textarea = screen.getByPlaceholderText(
        /please describe any other updates or context/i
      );
      await user.type(textarea, 'Some notes about my update');

      await waitFor(() => {
        const continueButton = screen.getByRole('button', {
          name: /confirm answer/i,
        });
        expect(continueButton).not.toBeDisabled();
      });
    });

    it('should enable Continue button when both activities and notes are provided', async () => {
      const user = userEvent.setup();
      render(<ActivitySelectionStep {...defaultProps} />);

      const checkbox = screen.getByRole('checkbox', {
        name: /^networking$/i,
      });
      await user.click(checkbox);

      const textarea = screen.getByPlaceholderText(
        /please describe any other updates or context/i
      );
      await user.type(textarea, 'Some notes');

      await waitFor(() => {
        const continueButton = screen.getByRole('button', {
          name: /confirm answer/i,
        });
        expect(continueButton).not.toBeDisabled();
      });
    });
  });

  describe('Navigation', () => {
    it('should call onNext with selected activities when Continue is clicked', async () => {
      const user = userEvent.setup();
      render(<ActivitySelectionStep {...defaultProps} />);

      const appliedCheckbox = screen.getByRole('checkbox', {
        name: /application or interview progress/i,
      });
      await user.click(appliedCheckbox);

      const continueButton = screen.getByRole('button', {
        name: /confirm answer/i,
      });
      await user.click(continueButton);

      expect(mockOnNext).toHaveBeenCalledWith({
        appliedToJobs: true,
        applicationMaterials: false,
        networking: false,
        notes: undefined,
      });
    });

    it('should call onNext with multiple selected activities', async () => {
      const user = userEvent.setup();
      render(<ActivitySelectionStep {...defaultProps} />);

      const appliedCheckbox = screen.getByRole('checkbox', {
        name: /application or interview progress/i,
      });
      const materialsCheckbox = screen.getByRole('checkbox', {
        name: /updated application materials/i,
      });
      await user.click(appliedCheckbox);
      await user.click(materialsCheckbox);

      const continueButton = screen.getByRole('button', {
        name: /confirm answer/i,
      });
      await user.click(continueButton);

      expect(mockOnNext).toHaveBeenCalledWith({
        appliedToJobs: true,
        applicationMaterials: true,
        networking: false,
        notes: undefined,
      });
    });

    it('should call onNext with notes when provided', async () => {
      const user = userEvent.setup();
      render(<ActivitySelectionStep {...defaultProps} />);

      const textarea = screen.getByPlaceholderText(
        /please describe any other updates or context/i
      );
      await user.type(textarea, 'My career update notes');

      const continueButton = screen.getByRole('button', {
        name: /confirm answer/i,
      });
      await user.click(continueButton);

      expect(mockOnNext).toHaveBeenCalledWith({
        appliedToJobs: false,
        applicationMaterials: false,
        networking: false,
        notes: 'My career update notes',
      });
    });

    it('should call onCancel when Cancel button is clicked', async () => {
      const user = userEvent.setup();
      const mockOnCancel = vi.fn();
      const props = { ...defaultProps, onCancel: mockOnCancel };
      render(<ActivitySelectionStep {...props} />);

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalled();
    });
  });

  describe('Initial State', () => {
    it('should pre-check checkboxes based on data prop', () => {
      const propsWithSelected = {
        ...defaultProps,
        data: {
          appliedToJobs: true,
          applicationMaterials: true,
          networking: false,
        },
      };

      render(<ActivitySelectionStep {...propsWithSelected} />);

      expect(
        screen.getByRole('checkbox', {
          name: /application or interview progress/i,
        })
      ).toBeChecked();
      expect(
        screen.getByRole('checkbox', {
          name: /updated application materials/i,
        })
      ).toBeChecked();
      expect(
        screen.getByRole('checkbox', { name: /^networking$/i })
      ).not.toBeChecked();
    });

    it('should enable Continue button when data has pre-selected activities', () => {
      const propsWithSelected = {
        ...defaultProps,
        data: {
          appliedToJobs: true,
          applicationMaterials: false,
          networking: false,
        },
      };

      render(<ActivitySelectionStep {...propsWithSelected} />);

      const continueButton = screen.getByRole('button', {
        name: /confirm answer/i,
      });
      expect(continueButton).not.toBeDisabled();
    });
  });
});
