import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { WizardShell } from './wizard-shell';
import { Step } from './step-indicator';

const mockSteps: Step[] = [
  { id: '1', label: 'Step 1' },
  { id: '2', label: 'Step 2' },
  { id: '3', label: 'Step 3' },
];

describe('WizardShell', () => {
  const defaultProps = {
    currentStep: 0,
    steps: mockSteps,
    onStepChange: vi.fn(),
    content: <div>Step Content</div>,
  };

  it('should render step content', () => {
    render(<WizardShell {...defaultProps} />);
    expect(screen.getByText('Step Content')).toBeInTheDocument();
  });

  it('should render step indicator', () => {
    render(<WizardShell {...defaultProps} />);
    expect(screen.getByText('Step 1')).toBeInTheDocument();
    expect(screen.getByText('Step 2')).toBeInTheDocument();
    expect(screen.getByText('Step 3')).toBeInTheDocument();
  });

  it('should render default back and next buttons', () => {
    render(<WizardShell {...defaultProps} currentStep={1} />);
    expect(screen.getByText('Back')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
  });

  it('should disable back button on first step', () => {
    render(<WizardShell {...defaultProps} currentStep={0} />);
    const backButton = screen.getByText('Back');
    expect(backButton).toBeDisabled();
  });

  it('should show submit button on last step', () => {
    render(<WizardShell {...defaultProps} currentStep={2} />);
    expect(screen.getByText('Submit')).toBeInTheDocument();
    expect(screen.queryByText('Next')).not.toBeInTheDocument();
  });

  it('should call onStepChange when back button is clicked', () => {
    const onStepChange = vi.fn();
    render(
      <WizardShell {...defaultProps} currentStep={1} onStepChange={onStepChange} />
    );

    const backButton = screen.getByText('Back');
    fireEvent.click(backButton);

    expect(onStepChange).toHaveBeenCalledWith(0);
  });

  it('should call onStepChange when next button is clicked', () => {
    const onStepChange = vi.fn();
    render(
      <WizardShell {...defaultProps} currentStep={0} onStepChange={onStepChange} />
    );

    const nextButton = screen.getByText('Next');
    fireEvent.click(nextButton);

    expect(onStepChange).toHaveBeenCalledWith(1);
  });

  it('should call custom onBack handler if provided', () => {
    const onBack = vi.fn();
    const onStepChange = vi.fn();
    render(
      <WizardShell
        {...defaultProps}
        currentStep={1}
        onBack={onBack}
        onStepChange={onStepChange}
      />
    );

    const backButton = screen.getByText('Back');
    fireEvent.click(backButton);

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onStepChange).not.toHaveBeenCalled();
  });

  it('should call custom onNext handler if provided', () => {
    const onNext = vi.fn();
    const onStepChange = vi.fn();
    render(
      <WizardShell
        {...defaultProps}
        currentStep={0}
        onNext={onNext}
        onStepChange={onStepChange}
      />
    );

    const nextButton = screen.getByText('Next');
    fireEvent.click(nextButton);

    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onStepChange).not.toHaveBeenCalled();
  });

  it('should call onSubmit when submit button is clicked', () => {
    const onSubmit = vi.fn();
    render(
      <WizardShell {...defaultProps} currentStep={2} onSubmit={onSubmit} />
    );

    const submitButton = screen.getByText('Submit');
    fireEvent.click(submitButton);

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('should render custom button text', () => {
    render(
      <WizardShell
        {...defaultProps}
        currentStep={1}
        backButtonText="Previous"
        nextButtonText="Continue"
        submitButtonText="Finish"
      />
    );

    expect(screen.getByText('Previous')).toBeInTheDocument();
    expect(screen.getByText('Continue')).toBeInTheDocument();
  });

  it('should render custom footer when provided', () => {
    const customFooter = <div>Custom Footer</div>;
    render(<WizardShell {...defaultProps} footer={customFooter} />);

    expect(screen.getByText('Custom Footer')).toBeInTheDocument();
    expect(screen.queryByText('Back')).not.toBeInTheDocument();
    expect(screen.queryByText('Next')).not.toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <WizardShell {...defaultProps} className="custom-wizard" />
    );
    expect(container.firstChild).toHaveClass('custom-wizard');
  });

  it('should pass onStepChange to StepIndicator', () => {
    const onStepChange = vi.fn();
    render(
      <WizardShell
        {...defaultProps}
        currentStep={1}
        onStepChange={onStepChange}
      />
    );

    // Click on first step indicator (completed step shows check icon, not number)
    const step1Button = screen.getByText('Step 1');
    fireEvent.click(step1Button);

    expect(onStepChange).toHaveBeenCalledWith(0);
  });

  it('should handle middle step correctly', () => {
    render(<WizardShell {...defaultProps} currentStep={1} />);

    const backButton = screen.getByText('Back');
    const nextButton = screen.getByText('Next');

    expect(backButton).not.toBeDisabled();
    expect(nextButton).toBeInTheDocument();
    expect(screen.queryByText('Submit')).not.toBeInTheDocument();
  });

  it('should not call onStepChange beyond valid range', () => {
    const onStepChange = vi.fn();
    render(
      <WizardShell
        {...defaultProps}
        currentStep={2}
        onStepChange={onStepChange}
      />
    );

    // On last step, clicking next shouldn't call onStepChange
    const submitButton = screen.getByText('Submit');
    fireEvent.click(submitButton);

    // onStepChange should not be called, only onSubmit (if provided)
    expect(onStepChange).not.toHaveBeenCalled();
  });

  it('should render with single step', () => {
    const singleStep = [{ id: '1', label: 'Only Step' }];
    render(
      <WizardShell {...defaultProps} steps={singleStep} currentStep={0} />
    );

    expect(screen.getByText('Only Step')).toBeInTheDocument();
    expect(screen.getByText('Back')).toBeDisabled();
    expect(screen.getByText('Submit')).toBeInTheDocument();
  });
});
