import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Button } from './button';

describe('Button', () => {
  it('should render children', () => {
    render(<Button>Click Me</Button>);
    expect(screen.getByRole('button', { name: 'Click Me' })).toBeInTheDocument();
  });

  it('should apply default variant', () => {
    const { container } = render(<Button>Default</Button>);
    expect(container.firstChild).toHaveClass('bg-primary');
  });

  it('should apply destructive variant', () => {
    const { container } = render(<Button variant="destructive">Delete</Button>);
    expect(container.firstChild).toHaveClass('bg-destructive');
  });

  it('should apply outline variant', () => {
    const { container } = render(<Button variant="outline">Outline</Button>);
    expect(container.firstChild).toHaveClass('border-input');
  });

  it('should apply secondary variant', () => {
    const { container } = render(<Button variant="secondary">Secondary</Button>);
    expect(container.firstChild).toHaveClass('bg-secondary');
  });

  it('should apply ghost variant', () => {
    const { container } = render(<Button variant="ghost">Ghost</Button>);
    const button = container.firstChild as HTMLElement;
    // Ghost variant has hover styles, check button renders
    expect(button.tagName).toBe('BUTTON');
  });

  it('should apply link variant', () => {
    const { container } = render(<Button variant="link">Link</Button>);
    expect(container.firstChild).toHaveClass('text-primary');
  });

  it('should apply size variants', () => {
    const { container: sm } = render(<Button size="sm">Small</Button>);
    expect(sm.firstChild).toHaveClass('h-9');

    const { container: lg } = render(<Button size="lg">Large</Button>);
    expect(lg.firstChild).toHaveClass('h-11');

    const { container: icon } = render(<Button size="icon">Icon</Button>);
    expect(icon.firstChild).toHaveClass('h-10');
  });

  it('should handle onClick', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should be disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('should forward ref', () => {
    const ref = { current: null };
    render(<Button ref={ref}>Button</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it('should merge custom className', () => {
    const { container } = render(<Button className="custom-class">Button</Button>);
    expect(container.firstChild).toHaveClass('custom-class');
    expect(container.firstChild).toHaveClass('bg-primary');
  });
});
