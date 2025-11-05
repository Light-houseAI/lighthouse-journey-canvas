import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Toggle } from './toggle';

describe('Toggle', () => {
  it('should render without crashing', () => {
    render(<Toggle>Toggle</Toggle>);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('should display children content', () => {
    render(<Toggle>Toggle Button</Toggle>);
    expect(screen.getByText('Toggle Button')).toBeInTheDocument();
  });

  it('should handle pressed state changes', () => {
    const handlePressedChange = vi.fn();
    render(<Toggle onPressedChange={handlePressedChange}>Toggle</Toggle>);
    fireEvent.click(screen.getByRole('button'));
    expect(handlePressedChange).toHaveBeenCalled();
  });

  it('should be pressed when pressed prop is true', () => {
    render(<Toggle pressed={true}>Toggle</Toggle>);
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('data-state', 'on');
  });

  it('should be unpressed when pressed prop is false', () => {
    render(<Toggle pressed={false}>Toggle</Toggle>);
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('data-state', 'off');
  });

  it('should be disabled when disabled prop is true', () => {
    render(<Toggle disabled>Toggle</Toggle>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('should apply custom className', () => {
    const { container } = render(<Toggle className="custom-toggle">Toggle</Toggle>);
    expect(container.querySelector('.custom-toggle')).toBeInTheDocument();
  });

  it('should forward ref', () => {
    const ref = { current: null };
    render(<Toggle ref={ref}>Toggle</Toggle>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it('should support different variants', () => {
    const { rerender } = render(<Toggle variant="default">Toggle</Toggle>);
    expect(screen.getByRole('button')).toBeInTheDocument();

    rerender(<Toggle variant="outline">Toggle</Toggle>);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('should support different sizes', () => {
    const { rerender } = render(<Toggle size="default">Toggle</Toggle>);
    expect(screen.getByRole('button')).toBeInTheDocument();

    rerender(<Toggle size="sm">Toggle</Toggle>);
    expect(screen.getByRole('button')).toBeInTheDocument();

    rerender(<Toggle size="lg">Toggle</Toggle>);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});
