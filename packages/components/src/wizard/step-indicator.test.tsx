import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { StepIndicator, Step } from './step-indicator';

const mockSteps: Step[] = [
  { id: '1', label: 'Personal Info' },
  { id: '2', label: 'Address' },
  { id: '3', label: 'Review' },
];

describe('StepIndicator', () => {
  it('should render all steps', () => {
    render(<StepIndicator steps={mockSteps} currentStep={0} />);
    expect(screen.getByText('Personal Info')).toBeInTheDocument();
    expect(screen.getByText('Address')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
  });

  it('should show step numbers', () => {
    render(<StepIndicator steps={mockSteps} currentStep={0} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('should highlight current step', () => {
    render(<StepIndicator steps={mockSteps} currentStep={1} />);
    const currentStepButton = screen.getByText('2').closest('div');
    expect(currentStepButton).toHaveClass('border-primary');
  });

  it('should show check icon for completed steps', () => {
    const { container } = render(
      <StepIndicator steps={mockSteps} currentStep={2} />
    );
    // Steps 0 and 1 should show check icons
    const checkIcons = container.querySelectorAll('svg');
    expect(checkIcons.length).toBeGreaterThan(0);
  });

  it('should call onStepClick when clickable step is clicked', () => {
    const onStepClick = vi.fn();
    render(
      <StepIndicator
        steps={mockSteps}
        currentStep={2}
        onStepClick={onStepClick}
      />
    );

    // Click on first step (completed, should be clickable)
    const step1 = screen.getByText('Personal Info');
    fireEvent.click(step1);

    expect(onStepClick).toHaveBeenCalledWith(0);
  });

  it('should not call onStepClick for future steps', () => {
    const onStepClick = vi.fn();
    render(
      <StepIndicator
        steps={mockSteps}
        currentStep={0}
        onStepClick={onStepClick}
      />
    );

    // Try to click on future step (should not work)
    const step3 = screen.getByText('Review');
    fireEvent.click(step3);

    expect(onStepClick).not.toHaveBeenCalled();
  });

  it('should allow clicking current step when onStepClick is provided', () => {
    const onStepClick = vi.fn();
    render(
      <StepIndicator
        steps={mockSteps}
        currentStep={1}
        onStepClick={onStepClick}
      />
    );

    const currentStep = screen.getByText('Address');
    fireEvent.click(currentStep);

    expect(onStepClick).toHaveBeenCalledWith(1);
  });

  it('should not make steps clickable when onStepClick is not provided', () => {
    render(<StepIndicator steps={mockSteps} currentStep={1} />);

    const step1 = screen.getByText('Personal Info').closest('button');
    expect(step1).toBeDisabled();
  });

  it('should render in compact mode without labels', () => {
    render(<StepIndicator steps={mockSteps} currentStep={0} compact />);
    expect(screen.queryByText('Personal Info')).not.toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('should render vertical orientation', () => {
    const { container } = render(
      <StepIndicator steps={mockSteps} currentStep={0} orientation="vertical" />
    );
    // Should not have connector lines in horizontal style
    expect(container.firstChild).toBeInTheDocument();
  });

  it('should render horizontal orientation by default', () => {
    const { container } = render(
      <StepIndicator steps={mockSteps} currentStep={0} />
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <StepIndicator
        steps={mockSteps}
        currentStep={0}
        className="custom-indicator"
      />
    );
    expect(container.querySelector('nav')).toHaveClass('custom-indicator');
  });

  it('should show connector lines between steps in horizontal mode', () => {
    const { container } = render(
      <StepIndicator steps={mockSteps} currentStep={1} />
    );
    // Check for connector divs (should be steps.length - 1)
    const connectors = container.querySelectorAll('.mx-2.h-0\\.5');
    expect(connectors.length).toBeGreaterThan(0);
  });

  it('should style completed connector lines differently', () => {
    const { container } = render(
      <StepIndicator steps={mockSteps} currentStep={2} />
    );
    const connectors = container.querySelectorAll('.mx-2.h-0\\.5');
    // First connector should show as completed
    expect(connectors[0]).toHaveClass('bg-primary');
  });

  it('should handle single step', () => {
    const singleStep = [{ id: '1', label: 'Only Step' }];
    render(<StepIndicator steps={singleStep} currentStep={0} />);
    expect(screen.getByText('Only Step')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('should handle completed state (all steps done)', () => {
    render(<StepIndicator steps={mockSteps} currentStep={3} />);
    // All steps should show as completed
    const { container } = render(
      <StepIndicator steps={mockSteps} currentStep={3} />
    );
    const completedSteps = container.querySelectorAll('.border-primary.bg-primary');
    expect(completedSteps.length).toBe(3);
  });

  it('should disable future steps when clicked', () => {
    const onStepClick = vi.fn();
    render(
      <StepIndicator
        steps={mockSteps}
        currentStep={0}
        onStepClick={onStepClick}
      />
    );

    const futureStepButton = screen.getByText('3').closest('button');
    expect(futureStepButton).toBeDisabled();
  });

  it('should enable past and current steps when onStepClick provided', () => {
    const onStepClick = vi.fn();
    render(
      <StepIndicator
        steps={mockSteps}
        currentStep={2}
        onStepClick={onStepClick}
      />
    );

    const step1Button = screen.getByText('Personal Info').closest('button');
    const step2Button = screen.getByText('Address').closest('button');
    const step3Button = screen.getByText('Review').closest('button');

    expect(step1Button).not.toBeDisabled();
    expect(step2Button).not.toBeDisabled();
    expect(step3Button).not.toBeDisabled();
  });
});
