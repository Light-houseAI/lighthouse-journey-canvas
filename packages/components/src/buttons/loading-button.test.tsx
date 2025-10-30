import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { LoadingButton } from './loading-button';

describe('LoadingButton', () => {
  it('should render children when not loading', () => {
    render(<LoadingButton isLoading={false}>Submit</LoadingButton>);
    expect(screen.getByText('Submit')).toBeInTheDocument();
  });

  it('should render children when loading without loadingText', () => {
    render(<LoadingButton isLoading={true}>Submit</LoadingButton>);
    expect(screen.getByText('Submit')).toBeInTheDocument();
  });

  it('should render loadingText when loading and loadingText is provided', () => {
    render(
      <LoadingButton isLoading={true} loadingText="Processing...">
        Submit
      </LoadingButton>
    );
    expect(screen.getByText('Processing...')).toBeInTheDocument();
    expect(screen.queryByText('Submit')).not.toBeInTheDocument();
  });

  it('should show spinner when loading', () => {
    const { container } = render(<LoadingButton isLoading={true}>Submit</LoadingButton>);
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('should not show spinner when not loading', () => {
    const { container } = render(<LoadingButton isLoading={false}>Submit</LoadingButton>);
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).not.toBeInTheDocument();
  });

  it('should be disabled when loading', () => {
    render(<LoadingButton isLoading={true}>Submit</LoadingButton>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('should not be disabled when not loading and disabled is false', () => {
    render(<LoadingButton isLoading={false}>Submit</LoadingButton>);
    const button = screen.getByRole('button');
    expect(button).not.toBeDisabled();
  });

  it('should be disabled when disabled prop is true even if not loading', () => {
    render(
      <LoadingButton isLoading={false} disabled={true}>
        Submit
      </LoadingButton>
    );
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('should show spinner at start position by default', () => {
    const { container } = render(<LoadingButton isLoading={true}>Submit</LoadingButton>);
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toHaveClass('mr-2');
    expect(spinner).not.toHaveClass('ml-2');
  });

  it('should show spinner at start position when spinnerPosition is start', () => {
    const { container } = render(
      <LoadingButton isLoading={true} spinnerPosition="start">
        Submit
      </LoadingButton>
    );
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toHaveClass('mr-2');
    expect(spinner).not.toHaveClass('ml-2');
  });

  it('should show spinner at end position when spinnerPosition is end', () => {
    const { container } = render(
      <LoadingButton isLoading={true} spinnerPosition="end">
        Submit
      </LoadingButton>
    );
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toHaveClass('ml-2');
    expect(spinner).not.toHaveClass('mr-2');
  });

  it('should apply custom className', () => {
    const { container } = render(
      <LoadingButton isLoading={false} className="custom-class">
        Submit
      </LoadingButton>
    );
    const button = container.querySelector('button');
    expect(button).toHaveClass('custom-class');
  });

  it('should forward ref to button element', () => {
    const ref = { current: null as HTMLButtonElement | null };
    render(
      <LoadingButton isLoading={false} ref={ref}>
        Submit
      </LoadingButton>
    );
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it('should pass through additional button props', () => {
    render(
      <LoadingButton isLoading={false} data-testid="test-button" type="submit">
        Submit
      </LoadingButton>
    );
    const button = screen.getByTestId('test-button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('type', 'submit');
  });

  it('should render as a button element', () => {
    render(<LoadingButton isLoading={false}>Submit</LoadingButton>);
    const button = screen.getByRole('button');
    expect(button.tagName).toBe('BUTTON');
  });

  it('should handle variant prop from Button component', () => {
    render(
      <LoadingButton isLoading={false} variant="destructive">
        Delete
      </LoadingButton>
    );
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('should handle size prop from Button component', () => {
    render(
      <LoadingButton isLoading={false} size="lg">
        Submit
      </LoadingButton>
    );
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });
});
