import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { GradientButton } from './gradient-button';

describe('GradientButton', () => {
  it('should render button with children', () => {
    render(<GradientButton>Click me</GradientButton>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('should render as button element by default', () => {
    render(<GradientButton>Click me</GradientButton>);
    const button = screen.getByRole('button');
    expect(button.tagName).toBe('BUTTON');
  });

  it('should apply primary variant by default', () => {
    const { container } = render(<GradientButton>Click me</GradientButton>);
    const button = container.querySelector('button');
    expect(button?.className).toContain('from-blue-500');
    expect(button?.className).toContain('to-purple-600');
  });

  it('should apply secondary variant styles', () => {
    const { container } = render(
      <GradientButton variant="secondary">Click me</GradientButton>
    );
    const button = container.querySelector('button');
    expect(button?.className).toContain('from-slate-100');
    expect(button?.className).toContain('to-slate-200');
  });

  it('should apply destructive variant styles', () => {
    const { container } = render(
      <GradientButton variant="destructive">Delete</GradientButton>
    );
    const button = container.querySelector('button');
    expect(button?.className).toContain('from-red-500');
    expect(button?.className).toContain('to-red-600');
  });

  it('should apply emerald variant styles', () => {
    const { container } = render(
      <GradientButton variant="emerald">Submit</GradientButton>
    );
    const button = container.querySelector('button');
    expect(button?.className).toContain('from-emerald-500');
    expect(button?.className).toContain('to-teal-600');
  });

  it('should apply default size by default', () => {
    const { container } = render(<GradientButton>Click me</GradientButton>);
    const button = container.querySelector('button');
    expect(button?.className).toContain('px-6');
    expect(button?.className).toContain('py-3');
  });

  it('should apply small size styles', () => {
    const { container } = render(
      <GradientButton size="sm">Click me</GradientButton>
    );
    const button = container.querySelector('button');
    expect(button?.className).toContain('px-4');
    expect(button?.className).toContain('py-2');
  });

  it('should apply large size styles', () => {
    const { container } = render(
      <GradientButton size="lg">Click me</GradientButton>
    );
    const button = container.querySelector('button');
    expect(button?.className).toContain('px-8');
    expect(button?.className).toContain('py-4');
  });

  it('should render left icon', () => {
    const icon = <span data-testid="left-icon">←</span>;
    render(<GradientButton iconLeft={icon}>Click me</GradientButton>);
    expect(screen.getByTestId('left-icon')).toBeInTheDocument();
  });

  it('should render right icon', () => {
    const icon = <span data-testid="right-icon">→</span>;
    render(<GradientButton iconRight={icon}>Click me</GradientButton>);
    expect(screen.getByTestId('right-icon')).toBeInTheDocument();
  });

  it('should render both left and right icons', () => {
    const leftIcon = <span data-testid="left-icon">←</span>;
    const rightIcon = <span data-testid="right-icon">→</span>;
    render(
      <GradientButton iconLeft={leftIcon} iconRight={rightIcon}>
        Click me
      </GradientButton>
    );
    expect(screen.getByTestId('left-icon')).toBeInTheDocument();
    expect(screen.getByTestId('right-icon')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <GradientButton className="custom-class">Click me</GradientButton>
    );
    const button = container.querySelector('button');
    expect(button).toHaveClass('custom-class');
  });

  it('should be disabled when disabled prop is true', () => {
    render(<GradientButton disabled>Click me</GradientButton>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('should forward ref to button element', () => {
    const ref = { current: null as HTMLButtonElement | null };
    render(<GradientButton ref={ref}>Click me</GradientButton>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it('should pass through additional props', () => {
    render(<GradientButton data-testid="test-button">Click me</GradientButton>);
    expect(screen.getByTestId('test-button')).toBeInTheDocument();
  });

  it('should have hover gradient overlay element', () => {
    const { container } = render(<GradientButton>Click me</GradientButton>);
    const overlays = container.querySelectorAll('div.absolute');
    // Should have at least 2 divs: hover gradient and shimmer effect
    expect(overlays.length).toBeGreaterThanOrEqual(2);
  });

  it('should have shimmer effect element', () => {
    const { container } = render(<GradientButton>Click me</GradientButton>);
    const shimmer = container.querySelector('div.translate-x-\\[-100\\%\\]');
    expect(shimmer).toBeInTheDocument();
  });

  it('should render content in a span with relative z-10', () => {
    const { container } = render(<GradientButton>Click me</GradientButton>);
    const contentSpan = container.querySelector('span.relative.z-10');
    expect(contentSpan).toBeInTheDocument();
    expect(contentSpan?.textContent).toContain('Click me');
  });
});
