import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RippleButton } from './ripple-button';

describe('RippleButton', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render children', () => {
    render(<RippleButton>Test Content</RippleButton>);
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    render(<RippleButton className="custom-class">Content</RippleButton>);
    expect(screen.getByRole('button')).toHaveClass('custom-class');
  });

  it('should render as a button element', () => {
    render(<RippleButton>Click me</RippleButton>);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('should create ripple effect on click', () => {
    const { container } = render(<RippleButton>Click me</RippleButton>);
    const button = screen.getByRole('button');

    // Mock getBoundingClientRect
    button.getBoundingClientRect = vi.fn(() => ({
      width: 100,
      height: 50,
      left: 0,
      top: 0,
      right: 100,
      bottom: 50,
      x: 0,
      y: 0,
      toJSON: () => {},
    }));

    fireEvent.click(button, { clientX: 50, clientY: 25 });

    // Check that a ripple span is created
    const ripples = container.querySelectorAll('span span');
    expect(ripples.length).toBeGreaterThan(0);
  });

  it('should call onClick handler when clicked', () => {
    const handleClick = vi.fn();
    render(<RippleButton onClick={handleClick}>Click me</RippleButton>);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should remove ripple after duration', () => {
    const { container } = render(
      <RippleButton duration="600ms">Click me</RippleButton>
    );
    const button = screen.getByRole('button');

    button.getBoundingClientRect = vi.fn(() => ({
      width: 100,
      height: 50,
      left: 0,
      top: 0,
      right: 100,
      bottom: 50,
      x: 0,
      y: 0,
      toJSON: () => {},
    }));

    fireEvent.click(button);

    // Ripple should exist
    let ripples = container.querySelectorAll('span span');
    expect(ripples.length).toBeGreaterThan(0);

    // After duration, ripple should be removed
    act(() => {
      vi.advanceTimersByTime(600);
    });
    ripples = container.querySelectorAll('span span');
    expect(ripples.length).toBe(0);
  });

  it('should respect custom rippleColor prop', () => {
    const { container } = render(
      <RippleButton rippleColor="#ff0000">Click me</RippleButton>
    );
    const button = screen.getByRole('button');

    button.getBoundingClientRect = vi.fn(() => ({
      width: 100,
      height: 50,
      left: 0,
      top: 0,
      right: 100,
      bottom: 50,
      x: 0,
      y: 0,
      toJSON: () => {},
    }));

    fireEvent.click(button);

    const ripple = container.querySelector('span span') as HTMLElement;
    expect(ripple?.style.backgroundColor).toBe('rgb(255, 0, 0)');
  });

  it('should accept disabled prop', () => {
    render(<RippleButton disabled>Disabled</RippleButton>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('should accept type prop', () => {
    render(<RippleButton type="submit">Submit</RippleButton>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
  });

  it('should accept data attributes', () => {
    render(
      <RippleButton data-testid="ripple-button">Test</RippleButton>
    );
    expect(screen.getByTestId('ripple-button')).toBeInTheDocument();
  });

  it('should handle multiple rapid clicks', () => {
    const { container } = render(<RippleButton>Click me</RippleButton>);
    const button = screen.getByRole('button');

    button.getBoundingClientRect = vi.fn(() => ({
      width: 100,
      height: 50,
      left: 0,
      top: 0,
      right: 100,
      bottom: 50,
      x: 0,
      y: 0,
      toJSON: () => {},
    }));

    // Click multiple times
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);

    const ripples = container.querySelectorAll('span span');
    expect(ripples.length).toBe(3);
  });

  it('should calculate ripple size based on button dimensions', () => {
    const { container } = render(<RippleButton>Click me</RippleButton>);
    const button = screen.getByRole('button');

    button.getBoundingClientRect = vi.fn(() => ({
      width: 200,
      height: 100,
      left: 0,
      top: 0,
      right: 200,
      bottom: 100,
      x: 0,
      y: 0,
      toJSON: () => {},
    }));

    fireEvent.click(button, { clientX: 100, clientY: 50 });

    const ripple = container.querySelector('span span') as HTMLElement;
    // Size should be max of width and height = 200
    expect(ripple?.style.width).toBe('200px');
    expect(ripple?.style.height).toBe('200px');
  });
});
